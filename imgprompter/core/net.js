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

  function detectProvider(apiUrl) {
    var u = (apiUrl || "").toLowerCase();
    if (/generativelanguage\.googleapis\.com|ai\.google\.dev/i.test(u)) return "gemini";
    if (/doubao|volces|volcengine/i.test(u)) return "doubao";
    if (/dashscope|aliyun|alibaba/i.test(u)) return "ali";
    if (/moonshot|kimi/i.test(u)) return "kimi";
    if (/siliconflow|siliconcloud/i.test(u)) return "siliconflow";
    if (/xiaomimimo\.com/i.test(u)) return "mimo";
    return "openai";
  }

  function resolveEndpoint(apiUrl, provider) {
    var url = apiUrl.trim().replace(/\/+$/, "");
    if (provider === "anthropic") {
      if (/\/v1\/messages$/i.test(url)) return url;
      if (/\/v1$/i.test(url)) return url + "/messages";
      return url + "/v1/messages";
    }
    if (provider === "doubao") {
      if (/\/chat\/completions$/i.test(url)) return url;
      if (/\/responses$/i.test(url)) return url.replace(/\/responses$/i, "/chat/completions");
      if (/\/api\/v3$/i.test(url)) return url + "/chat/completions";
      return url + "/api/v3/chat/completions";
    }
    if (provider === "ali") {
      if (/\/chat\/completions$/i.test(url)) return url;
      if (/\/v1$/i.test(url)) return url + "/chat/completions";
      return url + "/v1/chat/completions";
    }
    if (provider === "kimi" || provider === "moonshot") {
      if (/\/chat\/completions$/i.test(url)) return url;
      if (/\/v1$/i.test(url)) return url + "/chat/completions";
      return url + "/v1/chat/completions";
    }
    if (provider === "siliconflow") {
      if (/\/chat\/completions$/i.test(url)) return url;
      return url + "/chat/completions";
    }
    if (/\/chat\/completions$/i.test(url)) return url;
    if (/\/responses$/i.test(url)) return url;
    if (/\/v[0-9]+$/i.test(url)) return url + "/chat/completions";
    return url + "/chat/completions";
  }

  function isResponsesEndpoint(endpoint) {
    return /\/responses$/i.test(endpoint.trim());
  }

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

  function shouldUseJsonResponseFormat(provider, format) {
    if (!format || format === "plain") return false;
    if (provider === "anthropic" || provider === "doubao") return false;
    return true;
  }

  function applyJsonResponseFormat(body, provider, format) {
    if (shouldUseJsonResponseFormat(provider, format)) {
      body.response_format = { type: "json_object" };
    }
  }

  function isReasoningOpenAIModel(model) {
    var m = (model || "").toLowerCase();
    return /(?:^|\/|\s)o[13](?:-|$|\/|\s)/.test(m) || /^gpt-5/.test(m);
  }

  function applyOpenAIThinking(body, model) {
    var m = (model || "").toLowerCase();
    if (/qwen|deepseek|glm|doubao|moonshot|kimi|mimo/.test(m)) {
      body.extra_body = { enable_thinking: true };
    } else if (isReasoningOpenAIModel(model)) {
      body.reasoning_effort = "low";
    }
  }

  function applyResponsesThinking(body, model) {
    if (/qwen/i.test(model)) {
      body.enable_thinking = true;
    } else if (isReasoningOpenAIModel(model)) {
      body.reasoning = { effort: "low" };
    }
  }

  function applyOpenAIFastReasoning(body, model, useResponses) {
    if (!isReasoningOpenAIModel(model)) return;
    if (useResponses) {
      body.reasoning = { effort: "none" };
      return;
    }
    body.reasoning_effort = "none";
  }

  function extractMediaFromDataUrl(dataUrl) {
    var m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (m) return { mediaType: m[1], base64: m[2] };
    return { mediaType: "image/jpeg", base64: dataUrl };
  }

  function ensureTrailingSlash(url) {
    var u = String(url || "").trim();
    if (!u) return "https://generativelanguage.googleapis.com/v1beta/";
    if (u.charAt(u.length - 1) !== "/") return u + "/";
    return u;
  }

  function buildGeminiEndpoint(apiUrl, model) {
    var base = ensureTrailingSlash(apiUrl || "https://generativelanguage.googleapis.com/v1beta");
    var path = "models/" + encodeURIComponent(model) + ":generateContent";
    try {
      return new URL(path, base).toString();
    } catch (e) {
      return base.replace(/\/+$/, "") + "/" + path;
    }
  }

  function buildGeminiHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    };
  }

  function buildGeminiGenerationConfig(format) {
    var config = { maxOutputTokens: getMaxTokens(format) };
    if (format && format !== "plain") config.responseMimeType = "application/json";
    return config;
  }

  function buildGeminiAnalyzeBody(cfg, systemPrompt, userText, imageDataUrl, format) {
    var parts = extractMediaFromDataUrl(imageDataUrl);
    return {
      contents: [
        {
          parts: [
            { text: systemPrompt + "\n\n" + userText },
            {
              inline_data: {
                mime_type: parts.mediaType,
                data: parts.base64,
              },
            },
          ],
        },
      ],
      generationConfig: buildGeminiGenerationConfig(format),
    };
  }

  function buildGeminiTextBody(cfg, systemPrompt, userText, format) {
    return {
      contents: [
        {
          parts: [{ text: systemPrompt + "\n\n" + userText }],
        },
      ],
      generationConfig: buildGeminiGenerationConfig(format),
    };
  }

  function parseGeminiResponse(data) {
    var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    if (!parts || !parts.length) return "";
    var texts = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i] && parts[i].text) texts.push(parts[i].text);
    }
    return texts.join("\n");
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

  function buildOpenAIHeaders(apiKey, provider) {
    if (provider === "mimo") {
      return {
        "Content-Type": "application/json",
        "api-key": apiKey,
      };
    }
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    };
  }

  function buildAnthropicHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  function buildOpenAIBody(cfg, systemPrompt, userText, imageDataUrl, format) {
    var provider = detectProvider(cfg.apiUrl);
    var body = {
      model: cfg.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt + "\n\n" + userText },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        },
      ],
      max_tokens: getMaxTokens(format),
    };
    if (cfg.thinking) applyOpenAIThinking(body, cfg.model);
    else applyOpenAIFastReasoning(body, cfg.model, false);
    applyJsonResponseFormat(body, provider, format);
    return body;
  }

  function buildOpenAITextBody(cfg, systemPrompt, userText, format) {
    var provider = detectProvider(cfg.apiUrl);
    var body = {
      model: cfg.model,
      messages: [
        { role: "user", content: systemPrompt + "\n\n" + userText },
      ],
      max_tokens: getMaxTokens(format),
    };
    if (cfg.thinking) applyOpenAIThinking(body, cfg.model);
    applyJsonResponseFormat(body, provider, format);
    return body;
  }

  function buildResponsesBody(cfg, systemPrompt, userText, imageDataUrl, format) {
    var body = {
      model: cfg.model,
      instructions: systemPrompt,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: imageDataUrl },
            { type: "input_text", text: userText },
          ],
        },
      ],
      max_output_tokens: getMaxTokens(format),
    };
    if (cfg.thinking) applyResponsesThinking(body, cfg.model);
    else applyOpenAIFastReasoning(body, cfg.model, true);
    return body;
  }

  function buildResponsesTextBody(cfg, systemPrompt, userText, format) {
    var body = {
      model: cfg.model,
      instructions: systemPrompt,
      input: [{ role: "user", content: userText }],
      max_output_tokens: getMaxTokens(format),
    };
    if (cfg.thinking) applyResponsesThinking(body, cfg.model);
    return body;
  }

  function buildAnthropicBody(cfg, systemPrompt, userText, imageDataUrl, format) {
    var parts = extractMediaFromDataUrl(imageDataUrl);
    var body = {
      model: cfg.model,
      max_tokens: getMaxTokens(format),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: parts.mediaType,
                data: parts.base64,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    };
    if (cfg.thinking) {
      body.thinking = { type: "enabled", budget_tokens: 4096 };
      body.max_tokens = Math.max(body.max_tokens, 8192);
    }
    return body;
  }

  function buildAnthropicTextBody(cfg, systemPrompt, userText, format) {
    var body = {
      model: cfg.model,
      max_tokens: getMaxTokens(format),
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    };
    if (cfg.thinking) {
      body.thinking = { type: "enabled", budget_tokens: 4096 };
      body.max_tokens = Math.max(body.max_tokens, 8192);
    }
    return body;
  }

  function parseOpenAIResponse(data) {
    if (data.choices && data.choices[0] && data.choices[0].message) {
      var msg = data.choices[0].message;
      if (typeof msg.content === "string") return msg.content || "";
      if (Array.isArray(msg.content)) {
        var texts = [];
        var i;
        for (i = 0; i < msg.content.length; i++) {
          var part = msg.content[i];
          if (part && part.type === "text" && part.text) texts.push(part.text);
        }
        return texts.join("\n");
      }
    }
    if (data.output && typeof data.output === "string") return data.output;
    return "";
  }

  function parseResponsesAPI(data) {
    if (!data.output || !Array.isArray(data.output)) {
      if (data.output_text) return data.output_text || "";
      return "";
    }
    var texts = [];
    var i;
    var j;
    for (i = 0; i < data.output.length; i++) {
      var item = data.output[i];
      if (item.type === "message" && item.content && Array.isArray(item.content)) {
        for (j = 0; j < item.content.length; j++) {
          if (item.content[j].type === "output_text") texts.push(item.content[j].text || "");
        }
      }
    }
    return texts.join("\n");
  }

  function parseOpenAIOrResponses(data, useResponses) {
    if (useResponses) return parseResponsesAPI(data);
    return parseOpenAIResponse(data);
  }

  function parseAnthropicResponse(data) {
    if (data.content && Array.isArray(data.content)) {
      var texts = [];
      var i;
      for (i = 0; i < data.content.length; i++) {
        if (data.content[i].type === "text") texts.push(data.content[i].text || "");
      }
      return texts.join("\n");
    }
    return "";
  }

  function classifyHttpError(status, body, provider) {
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
    if (/429.*quota|quota.*exceeded|billing|plan/i.test(s)) return "RATE_LIMITED";
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
      endpointType: isResponsesEndpoint(endpoint) ? "responses" : "chat",
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
        var provider = detectProvider(endpoint);
        var label = classifyHttpError(res.status, text, provider);
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
      endpointType: isResponsesEndpoint(endpoint) ? "responses" : "chat",
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
        var provider = detectProvider(endpoint);
        var label = classifyHttpError(res.status, text, provider);
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

  function analyzeImage(cfg, imageDataUrl, onProgress, onDone, perfSession) {
    var provider = detectProvider(cfg.apiUrl);
    var endpoint = resolveEndpoint(cfg.apiUrl, provider);
    var useResponses = isResponsesEndpoint(endpoint);
    var prompts = ImgPrompterPrompts.buildAnalyzePrompt(cfg.lang, cfg.format);
    var sysPrompt = prompts.sysPrompt;
    var userText = prompts.userPrompt;

    perfMark(perfSession, "prompt_build", {
      format: cfg.format,
      lang: cfg.lang,
      provider: provider,
    });

    var headers;
    var body;
    var endpointForFetch = endpoint;
    if (provider === "gemini") {
      endpointForFetch = buildGeminiEndpoint(cfg.apiUrl, cfg.model);
      headers = buildGeminiHeaders(cfg.apiKey);
      body = buildGeminiAnalyzeBody(cfg, sysPrompt, userText, imageDataUrl, cfg.format);
    } else if (provider === "anthropic") {
      headers = buildAnthropicHeaders(cfg.apiKey);
      body = buildAnthropicBody(cfg, sysPrompt, userText, imageDataUrl, cfg.format);
    } else if (useResponses) {
      headers = buildOpenAIHeaders(cfg.apiKey, provider);
      body = buildResponsesBody(cfg, sysPrompt, userText, imageDataUrl, cfg.format);
    } else {
      headers = buildOpenAIHeaders(cfg.apiKey, provider);
      body = buildOpenAIBody(cfg, sysPrompt, userText, imageDataUrl, cfg.format);
    }

    doFetchWithProgress(endpointForFetch, headers, body, ANALYZE_TIMEOUT_MS, onProgress, "AI 正在分析图片，请稍候...", function (err, data) {
      if (err) {
        onDone({ code: mapErrorToCode(err.message), label: err.message }, null);
        return;
      }

      var text = "";
      if (provider === "gemini") text = parseGeminiResponse(data);
      else if (provider === "anthropic") text = parseAnthropicResponse(data);
      else text = parseOpenAIOrResponses(data, useResponses);

      finishVisionResult(cfg, provider, text, onProgress, onDone, perfSession);
    }, perfSession);
  }

  function rewritePrompt(cfg, currentJson, instruction, onProgress, onDone, perfSession) {
    var provider = detectProvider(cfg.apiUrl);
    var endpoint = resolveEndpoint(cfg.apiUrl, provider);
    var useResponses = isResponsesEndpoint(endpoint);
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
      provider: provider,
      rewrite: true,
    });

    var headers;
    var body;
    var endpointForFetch = endpoint;
    if (provider === "gemini") {
      endpointForFetch = buildGeminiEndpoint(cfg.apiUrl, cfg.model);
      headers = buildGeminiHeaders(cfg.apiKey);
      body = buildGeminiTextBody(cfg, sysPrompt, userText, cfg.format);
    } else if (provider === "anthropic") {
      headers = buildAnthropicHeaders(cfg.apiKey);
      body = buildAnthropicTextBody(cfg, sysPrompt, userText, cfg.format);
    } else if (useResponses) {
      headers = buildOpenAIHeaders(cfg.apiKey, provider);
      body = buildResponsesTextBody(cfg, sysPrompt, userText, cfg.format);
    } else {
      headers = buildOpenAIHeaders(cfg.apiKey, provider);
      body = buildOpenAITextBody(cfg, sysPrompt, userText, cfg.format);
    }

    doFetchWithProgress(endpointForFetch, headers, body, REWRITE_TIMEOUT_MS, onProgress, "AI 正在重写提示词，请稍候...", function (err, data) {
      if (err) {
        onDone({ code: mapErrorToCode(err.message), label: err.message }, null);
        return;
      }

      var text = "";
      if (provider === "gemini") text = parseGeminiResponse(data);
      else if (provider === "anthropic") text = parseAnthropicResponse(data);
      else text = parseOpenAIOrResponses(data, useResponses);

      finishVisionResult(cfg, provider, text, onProgress, onDone, perfSession);
    }, perfSession);
  }

  function isFullImageEndpoint(apiUrl) {
    var u = String(apiUrl || "").trim();
    if (/\/images\/generations$/i.test(u)) return true;
    if (/:generateContent$/i.test(u)) return true;
    if (/\/multimodal-generation\/generation$/i.test(u)) return true;
    return false;
  }

  function stripKnownCompletionSuffix(url) {
    return String(url || "")
      .replace(/\/chat\/completions$/i, "")
      .replace(/\/responses$/i, "")
      .replace(/\/messages$/i, "")
      .replace(/\/images\/generations$/i, "")
      .replace(/\/services\/aigc\/multimodal-generation\/generation$/i, "")
      .replace(/\/api\/v3\/chat\/completions$/i, "/api/v3")
      .replace(/\/compatible-mode\/v1\/chat\/completions$/i, "")
      .replace(/\/compatible-mode\/v1$/i, "");
  }

  function resolveAliImageEndpoint(apiUrl) {
    var url = stripKnownCompletionSuffix(apiUrl).trim().replace(/\/+$/, "");
    if (/\/multimodal-generation\/generation$/i.test(url)) return url;
    if (!url || /compatible-mode/i.test(url)) {
      url = "https://dashscope.aliyuncs.com/api/v1";
    } else if (/dashscope\.aliyuncs\.com/i.test(url) && !/\/api\/v1/i.test(url)) {
      url = "https://dashscope.aliyuncs.com/api/v1";
    }
    return url.replace(/\/+$/, "") + "/services/aigc/multimodal-generation/generation";
  }

  function resolveImageEndpoint(apiUrl, model, provider) {
    var url = stripKnownCompletionSuffix(apiUrl).trim().replace(/\/+$/, "");
    if (!url) return "";
    if (isFullImageEndpoint(url)) return url;
    if (provider === "gemini") return buildGeminiEndpoint(apiUrl, model);
    if (provider === "anthropic") return "";
    if (provider === "ali") return resolveAliImageEndpoint(apiUrl);
    if (/\/images\/generations$/i.test(url)) return url;
    return url + "/images/generations";
  }

  function buildGeminiImageBody(prompt) {
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["Image"],
        imageConfig: { aspectRatio: "1:1" },
      },
    };
  }

  function buildOpenAIImageBody(model, prompt, provider) {
    if (provider === "doubao") {
      return {
        model: model,
        prompt: prompt,
        n: 1,
        size: "2K",
        response_format: "url",
        watermark: false,
      };
    }
    return {
      model: model,
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    };
  }

  function buildAliImageBody(model, prompt) {
    return {
      model: model,
      input: {
        messages: [
          {
            role: "user",
            content: [{ text: prompt }],
          },
        ],
      },
      parameters: {
        n: 1,
        watermark: false,
      },
    };
  }

  function parseGeminiImages(data) {
    var out = [];
    var candidates = data && data.candidates ? data.candidates : [];
    var ci;
    var pi;
    for (ci = 0; ci < candidates.length; ci++) {
      var parts = candidates[ci] && candidates[ci].content && candidates[ci].content.parts;
      if (!parts) continue;
      for (pi = 0; pi < parts.length; pi++) {
        var part = parts[pi];
        if (!part) continue;
        var raw = (part.inlineData && part.inlineData.data) || (part.inline_data && part.inline_data.data);
        if (!raw) continue;
        var mime = (part.inlineData && part.inlineData.mimeType) || (part.inline_data && part.inline_data.mime_type) || "image/png";
        out.push({ src: "data:" + mime + ";base64," + raw });
      }
    }
    return out;
  }

  function parseOpenAIImages(data) {
    var out = [];
    var items = data && data.data ? data.data : [];
    var i;
    for (i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item) continue;
      if (item.b64_json) out.push({ src: "data:image/png;base64," + item.b64_json });
      else if (item.url) out.push({ src: item.url });
    }
    return out;
  }

  function parseAliImages(data) {
    var out = [];
    var choices = data && data.output && data.output.choices ? data.output.choices : [];
    var ci;
    var ii;
    var content;
    var part;
    for (ci = 0; ci < choices.length; ci++) {
      content = choices[ci] && choices[ci].message && choices[ci].message.content;
      if (!content) continue;
      for (ii = 0; ii < content.length; ii++) {
        part = content[ii];
        if (!part || !part.image) continue;
        out.push({ src: String(part.image) });
      }
    }
    return out;
  }

  function parseGeneratedImages(provider, data) {
    if (provider === "gemini") return parseGeminiImages(data);
    if (provider === "ali") return parseAliImages(data);
    return parseOpenAIImages(data);
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

    perfMark(perfSession, "prompt_build", {
      mode: "generate-image",
      provider: detectProvider(apiUrl),
    });

    var provider = detectProvider(apiUrl);
    if (provider === "anthropic") {
      onDone({ code: "GEN_UNSUPPORTED", label: "anthropic" }, null);
      return;
    }

    var endpoint = resolveImageEndpoint(apiUrl, model, provider);
    if (!endpoint) {
      onDone({ code: "GEN_UNSUPPORTED", label: "no endpoint" }, null);
      return;
    }

    var headers;
    var body;
    if (provider === "gemini") {
      headers = buildGeminiHeaders(apiKey);
      body = buildGeminiImageBody(trimmedPrompt);
    } else if (provider === "ali") {
      headers = buildOpenAIHeaders(apiKey, provider);
      body = buildAliImageBody(model, trimmedPrompt);
    } else {
      headers = buildOpenAIHeaders(apiKey, provider);
      body = buildOpenAIImageBody(model, trimmedPrompt, provider);
    }

    doFetchWithProgress(endpoint, headers, body, IMAGE_GEN_TIMEOUT_MS, onProgress, "AI 正在生成图片，请稍候...", function (err, data) {
      if (err) {
        onDone({ code: mapErrorToCode(err.message), label: err.message }, null);
        return;
      }
      var images = parseGeneratedImages(provider, data);
      perfMark(perfSession, "result_parse", {
        mode: "generate-image",
        imageCount: images.length,
      });
      if (!images.length) {
        onDone({ code: "GEN_NO_IMAGE", label: "no images" }, null);
        return;
      }
      onProgress("生成完成", 100);
      onDone(null, { images: images, provider: provider, model: model });
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
    var provider = detectProvider(cfg.apiUrl);
    var endpoint = resolveEndpoint(cfg.apiUrl, provider);
    var useResponses = isResponsesEndpoint(endpoint);
    var headers;
    var body;

    if (provider === "gemini") {
      endpoint = buildGeminiEndpoint(cfg.apiUrl, cfg.model);
      headers = buildGeminiHeaders(cfg.apiKey);
      body = {
        contents: [{ parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 5 },
      };
    } else if (provider === "anthropic") {
      headers = buildAnthropicHeaders(cfg.apiKey);
      body = {
        model: cfg.model,
        max_tokens: 5,
        messages: [{ role: "user", content: "hi" }],
      };
    } else if (useResponses) {
      headers = buildOpenAIHeaders(cfg.apiKey, provider);
      body = {
        model: cfg.model,
        input: "hi",
        max_output_tokens: 5,
      };
    } else {
      headers = buildOpenAIHeaders(cfg.apiKey, provider);
      body = {
        model: cfg.model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      };
    }

    doFetch(endpoint, headers, body, TEST_TIMEOUT_MS, function (err) {
      if (err) cb(false, err.message);
      else cb(true, "连接成功");
    }, perfSession);
  }

  return {
    detectProvider: detectProvider,
    resolveEndpoint: resolveEndpoint,
    testConnection: testConnection,
    testGenConnection: testGenConnection,
    analyzeImage: analyzeImage,
    rewritePrompt: rewritePrompt,
    generateImage: generateImage,
    mapErrorToCode: mapErrorToCode,
  };
})();
