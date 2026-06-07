if (typeof importScripts === "function") {
  importScripts("providers/index.js", "providers/openai_compatible.js", "providers/openai.js", "providers/gemini.js", "providers/ali.js");
}

var ImgPrompterNet = (function () {
  "use strict";

  var TEST_TIMEOUT_MS = 15000;
  var ANALYZE_TIMEOUT_MS = 60000;
  var REWRITE_TIMEOUT_MS = 60000;
  var IMAGE_GEN_TIMEOUT_MS = 120000;

  var JSON_FIELDS = [
    "brief",
    "subject",
    "scene",
    "action",
    "composition",
    "lighting",
    "colors",
    "style",
    "camera",
    "materials",
    "mood",
    "key_details",
    "prompt_zh",
    "prompt_en",
    "negative_prompt",
  ];

  var DETAIL_FIELDS = JSON_FIELDS;

  var MAX_TOKENS_MAP = {
    plain: 180,
    mj: 260,
    sd: 320,
    json: 720,
    detail: 900,
  };

  function getMaxTokens(format) {
    return MAX_TOKENS_MAP[format] || 1000;
  }

  function perfMark(session, name, extra) {
    if (!session || typeof ImgPrompterPerf === "undefined") return;
    ImgPrompterPerf.mark(session, name);
    ImgPrompterPerf.log(session, name, extra);
  }

  function pickProvider(detectedName, isResponses) {
    if (detectedName === "gemini") return ImgPrompterProviders.get("gemini");
    if (detectedName === "ali") return ImgPrompterProviders.get("ali");
    if (isResponses) return ImgPrompterProviders.get("openai");
    return ImgPrompterProviders.get("openai_compatible");
  }

  function sanitizeText(value) {
    if (value === undefined || value === null) return "";
    return String(value).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  function sanitizeArray(value) {
    var source = [];
    var out = [];
    var i;
    if (Array.isArray(value)) source = value;
    else if (value !== undefined && value !== null && value !== "") source = [value];
    for (i = 0; i < source.length; i++) {
      var item = sanitizeText(source[i]);
      if (item) out.push(item);
    }
    return out;
  }

  function buildBriefFromFields(data) {
    var parts = [];
    if (data.subject) parts.push(data.subject);
    if (data.scene) parts.push(data.scene);
    if (data.style) parts.push(data.style);
    return sanitizeText(parts.join("，")).substring(0, 60);
  }

  function normalizePlainResult(cfg, text) {
    var lines = String(text || "").split(/\s*---\s*/);
    var zh = "";
    var en = "";
    if (cfg.lang === "en") {
      en = sanitizeText(lines[lines.length - 1] || lines[0] || "");
    } else if (cfg.lang === "both") {
      zh = sanitizeText(lines[0] || "");
      en = sanitizeText(lines[lines.length - 1] || "");
    } else {
      zh = sanitizeText(lines[0] || "");
    }
    return {
      brief: sanitizeText((zh || en).substring(0, 50)),
      prompt_zh: zh,
      prompt_en: en,
    };
  }

  function normalizeJsonResult(cfg, data) {
    var normalized = {};
    var fields = cfg.format === "detail" ? DETAIL_FIELDS : JSON_FIELDS;
    var i;
    var key;
    var source = data && typeof data === "object" ? data : {};
    for (i = 0; i < fields.length; i++) {
      key = fields[i];
      if (key === "key_details") normalized[key] = sanitizeArray(source[key]);
      else normalized[key] = sanitizeText(source[key]);
    }

    if (cfg.lang === "zh") normalized.prompt_en = "";
    if (cfg.lang === "en") normalized.prompt_zh = "";

    if (!normalized.brief) normalized.brief = buildBriefFromFields(normalized);
    if ((cfg.lang === "zh" || cfg.lang === "both") && !normalized.prompt_zh) {
      normalized.prompt_zh = sanitizeText([
        normalized.subject,
        normalized.scene,
        normalized.action,
        normalized.composition,
        normalized.lighting,
        normalized.colors,
        normalized.style,
        normalized.camera,
        normalized.materials,
        normalized.mood,
      ].join("，"));
    }
    if ((cfg.lang === "en" || cfg.lang === "both") && !normalized.prompt_en) {
      normalized.prompt_en = sanitizeText(source.prompt_en || source.prompt || normalized.prompt_zh);
    }
    return normalized;
  }

  function normalizeMjResult(data) {
    var source = data && typeof data === "object" ? data : {};
    return {
      prompt_mj: sanitizeText(source.prompt_mj || source.prompt_en || source.prompt || ""),
      mj_params: sanitizeText(source.mj_params || ""),
    };
  }

  function normalizeSdResult(data) {
    var source = data && typeof data === "object" ? data : {};
    return {
      prompt_sd: sanitizeText(source.prompt_sd || source.prompt_en || source.prompt || ""),
      sd_negative: sanitizeText(source.sd_negative || source.negative || ""),
    };
  }

  function finishVisionResult(cfg, provider, text, onProgress, onDone, perfSession) {
    if (!text || !text.trim()) {
      onDone({ code: "AI_EMPTY", label: "empty response" }, null);
      return;
    }

    onProgress("正在解析结果...", 90);
    perfMark(perfSession, "result_parse_start");

    if (cfg.format === "plain") {
      var plainResult = normalizePlainResult(cfg, text);
      perfMark(perfSession, "result_parse", {
        format: cfg.format,
        hasJson: true,
      });
      onDone(null, { json: plainResult, raw: text, provider: provider });
      return;
    }

    var parsed = ImgPrompterParse.safeParse(text);
    if (!parsed.ok) {
      perfMark(perfSession, "result_parse", {
        format: cfg.format,
        hasJson: false,
      });
      onDone({ code: "RESPONSE_NOT_JSON", label: "structured output required" }, null);
      return;
    }

    var json = null;
    if (cfg.format === "json" || cfg.format === "detail") json = normalizeJsonResult(cfg, parsed.data);
    else if (cfg.format === "mj") json = normalizeMjResult(parsed.data);
    else if (cfg.format === "sd") json = normalizeSdResult(parsed.data);

    perfMark(perfSession, "result_parse", {
      format: cfg.format,
      hasJson: !!json,
    });
    onDone(null, { json: json, raw: text, provider: provider });
  }

  function classifyHttpError(status, body) {
    var b = (body || "").toLowerCase();
    if (status === 401 || status === 403) return "401 Unauthorized";
    if (status === 404) {
      if (/model/i.test(b)) return "404 Model Not Found";
      return "404 Not Found";
    }
    if (status === 400) {
      if (/image|vision|multimodal|does not support/i.test(b)) return "400 Model No Vision";
      if (/invalid.*api.*key|incorrect.*key/i.test(b)) return "401 Unauthorized";
      return "400 Bad Request";
    }
    if (status === 429) {
      if (/quota|billing|plan|limit/i.test(b)) return "429 Quota Exceeded";
      return "429 Rate Limited";
    }
    if (status === 529) return "529 Overloaded";
    if (status >= 500) return status + " Server Error";
    return "HTTP " + status;
  }

  function mapErrorToCode(label) {
    var s = (label || "").toLowerCase();
    if (/401|unauthorized|invalid.*key|incorrect.*key/i.test(s)) return "API_KEY_INVALID";
    if (/404.*model|model.*not.found/i.test(s)) return "MODEL_MISSING";
    if (/400.*no.vision|does.not.support|vision|multimodal/i.test(s)) return "MODEL_NO_VISION";
    if (/404/i.test(s)) return "API_URL_WRONG";
    if (/400.*bad.request/i.test(s)) return "BAD_REQUEST";
    if (/429.*quota|quota.*exceeded|billing|plan/i.test(s)) return "QUOTA_EXCEEDED";
    if (/429|rate/i.test(s)) return "RATE_LIMITED";
    if (/529|overload/i.test(s)) return "API_OVERLOADED";
    if (/cors|cross.origin|blocked.by.cors/i.test(s)) return "CORS_BLOCKED";
    if (/not.json|unexpected.token|syntaxerror/i.test(s)) return "RESPONSE_NOT_JSON";
    if (/timeout|timed.out|abort/i.test(s)) return "TIMEOUT";
    if (/network|fetch|failed.to.fetch|err_net/i.test(s)) return "NETWORK";
    return "API_URL_WRONG";
  }

  function doFetch(endpoint, headers, body, timeout, cb, perfSession) {
    var controller = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, timeout);

    perfMark(perfSession, "api_request_start", {
      endpointType: ImgPrompterProviders.isResponsesEndpoint(endpoint) ? "responses" : "chat",
      bodyBytes: JSON.stringify(body).length,
    });

    fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    .then(function (res) {
      clearTimeout(timer);
      if (res.ok) {
        return res.text().then(function (text) {
          perfMark(perfSession, "api_request", {
            status: res.status,
            responseBytes: text.length,
          });
          try {
            var data = JSON.parse(text);
            cb(null, data);
          } catch (e) {
            cb(new Error("Response Not JSON"), null);
          }
        });
      }
      return res.text().then(function (text) {
        perfMark(perfSession, "api_request", {
          status: res.status,
          responseBytes: text.length,
        });
        var label = classifyHttpError(res.status, text);
        cb(new Error(label), null);
      });
    })
    .catch(function (err) {
      clearTimeout(timer);
      perfMark(perfSession, "api_request", {
        error: err && err.name ? err.name : "fetch-error",
      });
      if (timedOut || err.name === "AbortError") cb(new Error("Timeout"), null);
      else if (/cors|blocked/i.test(err.message || "")) cb(new Error("CORS Blocked"), null);
      else cb(err, null);
    });
  }

  function doFetchWithProgress(endpoint, headers, body, timeout, onProgress, progressText, cb, perfSession) {
    var controller = new AbortController();
    var timedOut = false;
    var progressTimer = null;
    var currentPct = 60;
    var waitText = progressText || "AI 正在分析图片，请稍候...";

    function startProgress() {
      if (progressTimer) return;
      progressTimer = setInterval(function () {
        if (currentPct < 85) {
          currentPct += 1;
          onProgress(waitText, currentPct);
        }
      }, 2000);
    }

    function stopProgress() {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
    }

    var timer = setTimeout(function () {
      timedOut = true;
      stopProgress();
      controller.abort();
    }, timeout);

    onProgress("正在发送请求...", 60);
    startProgress();
    perfMark(perfSession, "api_request_start", {
      endpointType: ImgPrompterProviders.isResponsesEndpoint(endpoint) ? "responses" : "chat",
      bodyBytes: JSON.stringify(body).length,
    });

    fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    .then(function (res) {
      clearTimeout(timer);
      if (res.ok) {
        return res.text().then(function (text) {
          stopProgress();
          perfMark(perfSession, "api_request", {
            status: res.status,
            responseBytes: text.length,
          });
          try {
            var data = JSON.parse(text);
            cb(null, data);
          } catch (e) {
            cb(new Error("Response Not JSON"), null);
          }
        });
      }
      stopProgress();
      return res.text().then(function (text) {
        perfMark(perfSession, "api_request", {
          status: res.status,
          responseBytes: text.length,
        });
        var label = classifyHttpError(res.status, text);
        cb(new Error(label), null);
      });
    })
    .catch(function (err) {
      clearTimeout(timer);
      stopProgress();
      perfMark(perfSession, "api_request", {
        error: err && err.name ? err.name : "fetch-error",
      });
      if (timedOut || err.name === "AbortError") cb(new Error("Timeout"), null);
      else if (/cors|blocked/i.test(err.message || "")) cb(new Error("CORS Blocked"), null);
      else cb(err, null);
    });
  }

  function buildProviderConfig(cfg) {
    var provider = ImgPrompterProviders.detectProvider(cfg.apiUrl);
    var endpoint = "";
    var isResponses = false;
    var selected = null;

    if (provider === "gemini") {
      selected = ImgPrompterProviders.get("gemini");
      endpoint = selected.resolveEndpoint(cfg.apiUrl, cfg.model);
    } else if (provider === "ali") {
      selected = ImgPrompterProviders.get("ali");
      endpoint = selected.resolveEndpoint(cfg.apiUrl, provider);
    } else {
      var compat = ImgPrompterProviders.get("openai_compatible");
      endpoint = compat.resolveEndpoint(cfg.apiUrl, provider);
      isResponses = ImgPrompterProviders.isResponsesEndpoint(endpoint);
      selected = isResponses ? ImgPrompterProviders.get("openai") : compat;
      endpoint = selected.resolveEndpoint(cfg.apiUrl, provider);
    }

    return {
      detected: provider,
      isResponses: isResponses,
      selected: selected,
      endpoint: endpoint,
    };
  }

  function analyzeImage(cfg, imageDataUrl, onProgress, onDone, perfSession) {
    var info = buildProviderConfig(cfg);
    var selected = info.selected;
    var prompts = ImgPrompterPrompts.buildAnalyzePrompt(cfg.lang, cfg.format);
    var sysPrompt = prompts.sysPrompt;
    var userText = prompts.userPrompt;

    perfMark(perfSession, "prompt_build", {
      format: cfg.format,
      lang: cfg.lang,
      provider: info.detected,
    });

    var headers = selected.buildHeaders(cfg.apiKey, info.detected);
    var body = selected.buildAnalyzeBody(
      { model: cfg.model, thinking: cfg.thinking, provider: info.detected },
      sysPrompt,
      userText,
      imageDataUrl,
      cfg.format,
      getMaxTokens
    );

    doFetchWithProgress(info.endpoint, headers, body, ANALYZE_TIMEOUT_MS, onProgress, "AI 正在分析图片，请稍候...", function (err, data) {
      if (err) {
        onDone({ code: mapErrorToCode(err.message), label: err.message }, null);
        return;
      }
      var text = selected.parseResponse(data);
      finishVisionResult(cfg, info.detected, text, onProgress, onDone, perfSession);
    }, perfSession);
  }

  function rewritePrompt(cfg, currentJson, instruction, onProgress, onDone, perfSession) {
    var info = buildProviderConfig(cfg);
    var selected = info.selected;
    var prompts = ImgPrompterPrompts.buildRewritePrompt(cfg.lang, cfg.format);
    var sysPrompt = prompts.sysPrompt;
    var userText;

    if (cfg.format === "plain") {
      var existingPrompt = currentJson.prompt_zh || currentJson.prompt_en || "";
      userText = "当前提示词：\n" + existingPrompt + "\n\n修改要求：\n" + instruction + "\n\n" + prompts.userPrompt;
    } else {
      userText = "当前提示词 JSON：\n" + JSON.stringify(currentJson, null, 2) + "\n\n修改要求：\n" + instruction + "\n\n" + prompts.userPrompt;
    }

    perfMark(perfSession, "prompt_build", {
      format: cfg.format,
      lang: cfg.lang,
      provider: info.detected,
      rewrite: true,
    });

    var headers = selected.buildHeaders(cfg.apiKey, info.detected);
    var body = selected.buildTextBody(
      { model: cfg.model, thinking: cfg.thinking, provider: info.detected },
      sysPrompt,
      userText,
      cfg.format,
      getMaxTokens
    );

    doFetchWithProgress(info.endpoint, headers, body, REWRITE_TIMEOUT_MS, onProgress, "AI 正在重写提示词，请稍候...", function (err, data) {
      if (err) {
        onDone({ code: mapErrorToCode(err.message), label: err.message }, null);
        return;
      }
      var text = selected.parseResponse(data);
      finishVisionResult(cfg, info.detected, text, onProgress, onDone, perfSession);
    }, perfSession);
  }

  function generateImage(genCfg, prompt, onProgress, onDone, perfSession) {
    var apiUrl = genCfg.genApiUrl || genCfg.apiUrl || "";
    var apiKey = genCfg.genApiKey || genCfg.apiKey || "";
    var model = genCfg.genModel || genCfg.model || "";
    var trimmedPrompt = String(prompt || "").trim();

    if (!apiUrl || !apiKey || !model) {
      onDone({ code: "GEN_CONFIG_EMPTY", label: "gen config empty" }, null);
      return;
    }
    if (!trimmedPrompt) {
      onDone({ code: "GEN_PROMPT_EMPTY", label: "empty prompt" }, null);
      return;
    }

    var detected = ImgPrompterProviders.detectProvider(apiUrl);
    if (detected === "anthropic") {
      onDone({ code: "GEN_UNSUPPORTED", label: "anthropic" }, null);
      return;
    }

    var selected = null;
    var endpoint = "";
    if (detected === "gemini") {
      selected = ImgPrompterProviders.get("gemini");
    } else if (detected === "ali") {
      selected = ImgPrompterProviders.get("ali");
    } else {
      selected = ImgPrompterProviders.get("openai_compatible");
    }
    endpoint = selected.resolveImageEndpoint(apiUrl, model, detected);
    if (!endpoint) {
      onDone({ code: "GEN_UNSUPPORTED", label: "no endpoint" }, null);
      return;
    }

    perfMark(perfSession, "prompt_build", {
      mode: "generate-image",
      provider: detected,
    });

    var headers = selected.buildHeaders(apiKey, detected);
    var body = selected.buildImageBody(model, trimmedPrompt, detected);

    doFetchWithProgress(endpoint, headers, body, IMAGE_GEN_TIMEOUT_MS, onProgress, "AI 正在生成图片，请稍候...", function (err, data) {
      if (err) {
        onDone({ code: mapErrorToCode(err.message), label: err.message }, null);
        return;
      }
      var images = selected.parseImages(data);
      perfMark(perfSession, "result_parse", {
        mode: "generate-image",
        imageCount: images.length,
      });
      if (!images.length) {
        onDone({ code: "GEN_NO_IMAGE", label: "no images" }, null);
        return;
      }
      onProgress("生成完成", 100);
      onDone(null, { images: images, provider: detected, model: model });
    }, perfSession);
  }

  function testGenConnection(genCfg, cb, perfSession) {
    var apiUrl = genCfg.genApiUrl || genCfg.apiUrl || "";
    var apiKey = genCfg.genApiKey || genCfg.apiKey || "";
    var model = genCfg.genModel || genCfg.model || "";

    if (!apiUrl || !apiKey || !model) {
      cb(false, "GEN_CONFIG_EMPTY");
      return;
    }

    generateImage(genCfg, "test", function () {}, function (err, result) {
      if (err) {
        var label = err.label || err.code || "error";
        cb(false, label);
        return;
      }
      if (!result || !result.images || !result.images.length) {
        cb(false, "GEN_NO_IMAGE");
        return;
      }
      cb(true, "连接成功");
    }, perfSession);
  }

  function testConnection(cfg, cb, perfSession) {
    var info = buildProviderConfig(cfg);
    var selected = info.selected;
    var headers = selected.buildHeaders(cfg.apiKey, info.detected);
    var body = selected.buildTestBody({ model: cfg.model }, getMaxTokens);

    doFetch(info.endpoint, headers, body, TEST_TIMEOUT_MS, function (err) {
      if (err) cb(false, err.message);
      else cb(true, "连接成功");
    }, perfSession);
  }

  return {
    detectProvider: ImgPrompterProviders.detectProvider,
    testConnection: testConnection,
    testGenConnection: testGenConnection,
    analyzeImage: analyzeImage,
    rewritePrompt: rewritePrompt,
    generateImage: generateImage,
    mapErrorToCode: mapErrorToCode,
  };
})();
