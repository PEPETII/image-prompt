importScripts("model_presets.js", "store.js", "err.js", "prompts.js", "parse.js", "perf.js", "imgproc.js", "net.js");

(function () {
  "use strict";

  var MENU_ID = "imgprompter-analyze";
  var MAX_IMG_BYTES = 8 * 1024 * 1024;
  var analyzeSessionCache = {};

  function ensureContextMenu() {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "生成 AI 图片提示词",
      contexts: ["image"],
    }, function () {
      if (chrome.runtime.lastError) { /* already exists, ignore */ }
    });
  }

  function ensureConfigMigrated() {
    ImgPrompterStore.getConfig(function () {});
  }

  chrome.runtime.onInstalled.addListener(function () {
    ensureContextMenu();
    ensureConfigMigrated();
  });
  chrome.runtime.onStartup.addListener(function () {
    ensureContextMenu();
    ensureConfigMigrated();
  });

  chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId !== MENU_ID) return;
    var imgSrc = info.srcUrl;
    if (!imgSrc) return;

    ImgPrompterStore.getConfig(function (cfg) {
      if (!cfg.apiUrl || !cfg.apiKey || !cfg.model) {
        sendToTab(tab.id, { type: "imgprompter-no-config" });
        return;
      }
      sendToTab(tab.id, {
        type: "imgprompter-start",
        src: imgSrc,
        pageUrl: info.pageUrl || (tab && tab.url) || "",
        imageQualityMode: cfg.imageQualityMode || "standard",
      });
    });
  });

  function sendToTab(tabId, msg) {
    chrome.tabs.sendMessage(tabId, msg, function () {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["core/err.js", "core/prompts.js", "core/perf.js", "core/imgproc.js", "ui/overlay.js"],
        }, function () {
          if (chrome.runtime.lastError) return;
          chrome.tabs.sendMessage(tabId, msg);
        });
      }
    });
  }

  function isInjectableUrl(url) {
    if (!url) return false;
    if (/^(chrome|edge|about|moz-extension|chrome-extension|devtools|view-source):/i.test(url)) return false;
    if (/^https?:\/\//i.test(url)) return true;
    if (/^file:/i.test(url)) return true;
    return false;
  }

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var chunks = [];
    var chunkSize = 8192;
    for (var i = 0; i < bytes.length; i += chunkSize) {
      var end = Math.min(i + chunkSize, bytes.length);
      chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, end)));
    }
    return btoa(chunks.join(""));
  }

  function guessContentType(url) {
    if (/\.jpe?g$/i.test(url)) return "image/jpeg";
    if (/\.png$/i.test(url)) return "image/png";
    if (/\.webp$/i.test(url)) return "image/webp";
    if (/\.gif$/i.test(url)) return "image/gif";
    return "image/jpeg";
  }

  function sendProgress(tabId, text, pct) {
    chrome.tabs.sendMessage(tabId, { type: "imgprompter-progress", text: text, pct: pct });
  }

  function buildQualityOpts(cfg) {
    return { imageQualityMode: cfg.imageQualityMode || "standard" };
  }

  function getMissingVisionConfigCode(cfg) {
    if (!cfg || !cfg.apiUrl) return "API_URL_EMPTY";
    if (!cfg.apiKey) return "API_KEY_EMPTY";
    if (!cfg.model) return "MODEL_EMPTY";
    if (ImgPrompterStore.isOpenAIVisionContext(cfg.platform, cfg.apiUrl) &&
      !ImgPrompterStore.isOpenAIVisionModel5x(cfg.model)) {
      return "OPENAI_VISION_5X";
    }
    return "";
  }

  function getMissingGenConfigCode(cfg) {
    if (!cfg || !cfg.genApiUrl) return "API_URL_EMPTY";
    if (!cfg.genApiKey) return "API_KEY_EMPTY";
    if (!cfg.genModel) return "MODEL_EMPTY";
    return "";
  }

  function buildFetchOptions(pageUrl) {
    var opts = { credentials: "include" };
    var normalizedPageUrl = String(pageUrl || "").trim();
    if (/^https?:\/\//i.test(normalizedPageUrl)) {
      opts.referrer = normalizedPageUrl;
    }
    return opts;
  }

  function fetchImageBuffer(url, pageUrl, perfSession, cb) {
    var fetchController = new AbortController();
    var fetchStartedAt = Date.now();
    var fetchTimedOut = false;
    var fetchTimer = setTimeout(function () {
      fetchTimedOut = true;
      fetchController.abort();
    }, 20000);

    var fetchOpts = buildFetchOptions(pageUrl);
    fetchOpts.signal = fetchController.signal;

    fetch(url, fetchOpts)
      .then(function (res) {
        clearTimeout(fetchTimer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        var declaredLen = parseInt(res.headers.get("content-length") || "0", 10);
        if (declaredLen > MAX_IMG_BYTES) throw new Error("IMG_TOO_LARGE");
        var ct = res.headers.get("content-type") || guessContentType(url);
        return res.arrayBuffer().then(function (buf) {
          return { buffer: buf, contentType: ct };
        });
      })
      .then(function (result) {
        if (result.buffer.byteLength > MAX_IMG_BYTES) throw new Error("IMG_TOO_LARGE");
        if (perfSession) {
          ImgPrompterPerf.log(perfSession, "image_read", fetchStartedAt, {
            bytes: result.buffer.byteLength,
            contentType: result.contentType,
          });
        }
        cb(null, result.buffer, result.contentType);
      })
      .catch(function (err) {
        clearTimeout(fetchTimer);
        if (perfSession) {
          ImgPrompterPerf.log(perfSession, "image_read", fetchStartedAt, {
            error: err && (err.message || err.name) || "unknown",
          });
        }
        if (fetchTimedOut || err.name === "AbortError") {
          cb(new Error("IMG_LOAD_TIMEOUT"), null, null);
        } else {
          cb(err, null, null);
        }
      });
  }

  function normalizeScreenshotCrop(value) {
    if (!value || typeof value !== "object") return null;

    var crop = {
      x: Number(value.x),
      y: Number(value.y),
      width: Number(value.width),
      height: Number(value.height),
      devicePixelRatio: Number(value.devicePixelRatio) || 1,
    };

    if (
      !isFinite(crop.x) ||
      !isFinite(crop.y) ||
      !isFinite(crop.width) ||
      !isFinite(crop.height) ||
      crop.width <= 0 ||
      crop.height <= 0
    ) {
      return null;
    }

    return crop;
  }

  function cropCapturedDataUrl(dataUrl, crop, cb) {
    if (typeof createImageBitmap === "undefined" || typeof OffscreenCanvas === "undefined") {
      cb(new Error("IMG_LOAD_FAIL"), null);
      return;
    }

    fetch(dataUrl)
      .then(function (res) { return res.blob(); })
      .then(function (blob) { return createImageBitmap(blob); })
      .then(function (bitmap) {
        var scale = crop.devicePixelRatio || 1;
        var sx = Math.max(0, Math.floor(crop.x * scale));
        var sy = Math.max(0, Math.floor(crop.y * scale));
        var sw = Math.max(1, Math.min(bitmap.width - sx, Math.floor(crop.width * scale)));
        var sh = Math.max(1, Math.min(bitmap.height - sy, Math.floor(crop.height * scale)));

        var canvas = new OffscreenCanvas(sw, sh);
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          if (bitmap.close) bitmap.close();
          throw new Error("IMG_LOAD_FAIL");
        }
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
        if (bitmap.close) bitmap.close();

        return canvas.convertToBlob({ type: "image/png" });
      })
      .then(function (blob) {
        return blob.arrayBuffer();
      })
      .then(function (buffer) {
        if (buffer.byteLength > MAX_IMG_BYTES) throw new Error("IMG_TOO_LARGE");
        var b64 = arrayBufferToBase64(buffer);
        cb(null, "data:image/png;base64," + b64);
      })
      .catch(function (err) {
        cb(err, null);
      });
  }

  function captureVisibleTabCrop(windowId, crop, cb) {
    if (windowId === undefined || windowId === null || !crop) {
      cb(new Error("IMG_SCREENSHOT_FAIL"), null);
      return;
    }

    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, function (dataUrl) {
      if (chrome.runtime.lastError || !dataUrl) {
        cb(new Error("IMG_SCREENSHOT_FAIL"), null);
        return;
      }
      cropCapturedDataUrl(dataUrl, crop, cb);
    });
  }

  function buildAnalyzeCacheKey(imgSrc, cfg) {
    return String(imgSrc || "") + "|" + String(cfg.lang || "zh") + "|" + String(cfg.format || "json") + "|" + String(cfg.model || "") + "|" + String(cfg.apiUrl || "") + "|thinking:" + (cfg.thinking ? "1" : "0") + "|quality:" + (cfg.imageQualityMode || "standard");
  }

  function deliverCachedAnalyze(tabId, cached, cfg) {
    sendProgress(tabId, "使用缓存结果", 100);
    var resultMsg = {
      type: "imgprompter-result",
      json: cached.json,
      provider: cached.provider || "",
      format: cfg.format,
    };
    chrome.tabs.sendMessage(tabId, resultMsg);
  }

  function saveAnalyzeCache(imgSrc, cfg, result) {
    if (!imgSrc || !result || !result.json) return;
    var key = buildAnalyzeCacheKey(imgSrc, cfg);
    analyzeSessionCache[key] = {
      json: result.json,
      provider: result.provider || "",
    };
  }

  function prepareImageDataUrl(tabId, imgSrc, opts, perfSession, qualityOpts, cb) {
    if (!imgSrc) {
      cb(new Error("IMG_LOAD_FAIL"), null);
      return;
    }

    var pageUrl = (opts && opts.pageUrl) || "";
    var screenshotCrop = normalizeScreenshotCrop(opts && opts.screenshotCrop);
    var windowId = opts && opts.windowId;

    if (/^data:image/i.test(imgSrc)) {
      sendProgress(tabId, "正在压缩图片...", 30);
      ImgPrompterImgProc.compressFromDataUrl(imgSrc, perfSession, qualityOpts).then(function (result) {
        cb(null, result.base64);
      }).catch(function (err) {
        cb(err, null);
      });
      return;
    }

    function afterBuffer(err, buffer, contentType) {
      if (err) {
        if (screenshotCrop && windowId !== undefined && windowId !== null) {
          sendProgress(tabId, "正在截取页面图片...", 15);
          captureVisibleTabCrop(windowId, screenshotCrop, function (cropErr, cropDataUrl) {
            if (cropErr) {
              cb(cropErr, null);
              return;
            }
            sendProgress(tabId, "正在压缩图片...", 30);
            ImgPrompterImgProc.compressFromDataUrl(cropDataUrl, perfSession, qualityOpts).then(function (result) {
              cb(null, result.base64);
            }).catch(function (compressErr) {
              cb(compressErr, null);
            });
          });
          return;
        }
        cb(err, null);
        return;
      }
      sendProgress(tabId, "正在压缩图片...", 30);
      ImgPrompterImgProc.compressFromArrayBuffer(buffer, contentType, perfSession, qualityOpts).then(function (result) {
        cb(null, result.base64);
      }).catch(function (compressErr) {
        cb(compressErr, null);
      });
    }

    sendProgress(tabId, "正在下载图片...", 10);
    fetchImageBuffer(imgSrc, pageUrl, perfSession, afterBuffer);
  }

  function doAnalyze(tabId, cfg, imageDataUrl, imgSrc, perfSession) {
    ImgPrompterNet.analyzeImage(
      cfg,
      imageDataUrl,
      function (text, pct) {
        chrome.tabs.sendMessage(tabId, { type: "imgprompter-progress", text: text, pct: pct });
      },
      function (err, result) {
        if (err) {
          if (perfSession) ImgPrompterPerf.logTotal(perfSession, "analyze_total", { code: err.code || "error" });
          var userMsg = ImgPrompterErr.msg(err.code);
          chrome.tabs.sendMessage(tabId, { type: "imgprompter-error", text: userMsg, code: err.code });
          return;
        }
        var jsonToSend = result.json;
        var rawToSend = result.raw;
        var resultMsg = {
          type: "imgprompter-result",
          json: jsonToSend,
          provider: result.provider,
          format: cfg.format,
        };
        if (!jsonToSend) {
          resultMsg.raw = rawToSend;
        }
        chrome.tabs.sendMessage(tabId, resultMsg);
        if (jsonToSend) {
          saveAnalyzeCache(imgSrc, cfg, result);
          setTimeout(function () {
            saveToHistory(imgSrc, jsonToSend, cfg.format, cfg.lang, perfSession);
          }, 0);
        }
        if (perfSession) {
          ImgPrompterPerf.logTotal(perfSession, "analyze_total", {
            provider: result.provider || "",
            format: cfg.format,
          });
        }
      },
      perfSession
    );
  }

  function shouldPrepareInBg(msg) {
    if (!msg.imgSrc) return false;
    if (/^data:image/i.test(msg.imgSrc)) return true;
    if (/^https?:\/\//i.test(msg.imgSrc)) return true;
    return false;
  }

  function doRewrite(tabId, cfg, currentJson, instruction, imgSrc, perfSession) {
    ImgPrompterNet.rewritePrompt(
      cfg,
      currentJson,
      instruction,
      function (text, pct) {
        chrome.tabs.sendMessage(tabId, { type: "imgprompter-progress", text: text, pct: pct });
      },
      function (err, result) {
        if (err) {
          if (perfSession) ImgPrompterPerf.logTotal(perfSession, "rewrite_total", { code: err.code || "error" });
          var userMsg = ImgPrompterErr.msg(err.code);
          chrome.tabs.sendMessage(tabId, { type: "imgprompter-rewrite-fail", text: userMsg, code: err.code });
          return;
        }
        var jsonToSend = result.json;
        var rawToSend = result.raw;
        var rewriteMsg = {
          type: "imgprompter-rewrite-done",
          json: jsonToSend,
          provider: result.provider,
          format: cfg.format,
        };
        if (!jsonToSend) {
          rewriteMsg.raw = rawToSend;
        }
        chrome.tabs.sendMessage(tabId, rewriteMsg);
        if (jsonToSend) {
          setTimeout(function () {
            saveToHistory(imgSrc, jsonToSend, cfg.format, cfg.lang, perfSession);
          }, 0);
        }
        if (perfSession) {
          ImgPrompterPerf.logTotal(perfSession, "rewrite_total", {
            provider: result.provider || "",
            format: cfg.format,
          });
        }
      },
      perfSession
    );
  }

  var MAX_IMGSRC_LEN = 512;

  function saveToHistory(imgSrc, json, format, lang, perfSession) {
    var historyStartedAt = Date.now();
    var safeImgSrc = "";
    if (imgSrc && !/^data:/i.test(imgSrc) && imgSrc.length <= MAX_IMGSRC_LEN) {
      safeImgSrc = imgSrc;
    }

    var record = {
      time: new Date().toISOString(),
      imgSrc: safeImgSrc,
      brief: json.brief || "",
      format: format || "json",
      lang: lang || "zh",
    };

    if (format === "plain") {
      if (lang === "zh" || lang === "both") record.prompt_zh = json.prompt_zh || "";
      if (lang === "en" || lang === "both") record.prompt_en = json.prompt_en || "";
    }
    if (format === "mj") {
      record.prompt_mj = json.prompt_mj || "";
      record.mj_params = json.mj_params || "";
    }
    if (format === "sd") {
      record.prompt_sd = json.prompt_sd || "";
      record.sd_negative = json.sd_negative || "";
    }

    if (format === "json" || format === "detail") {
      if (lang === "zh" || lang === "both") record.prompt_zh = json.prompt_zh || "";
      if (lang === "en" || lang === "both") record.prompt_en = json.prompt_en || "";
      record.json = JSON.parse(JSON.stringify(json));
    } else {
      record.json = json;
    }
    ImgPrompterStore.pushHistory(record, function () {
      if (perfSession) {
        ImgPrompterPerf.log(perfSession, "history_save", historyStartedAt, {
          format: record.format,
        });
      }
    });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === "imgprompter-get-config") {
      ImgPrompterStore.getConfig(function (cfg) {
        sendResponse(cfg);
      });
      return true;
    }

    if (msg.type === "imgprompter-open-popup") {
      var popupUrl = chrome.runtime.getURL("ui/popup.html");
      if (msg.tab === "gen") popupUrl += "#gen";
      chrome.tabs.create({ url: popupUrl });
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-analyze") {
      var senderTabId = sender.tab ? sender.tab.id : null;
      if (!senderTabId) {
        sendResponse({ ok: false, code: "INJECT_BLOCKED" });
        return true;
      }

      ImgPrompterStore.getConfig(function (cfg) {
        var missingCode = getMissingVisionConfigCode(cfg);
        if (missingCode) {
          sendResponse({ ok: false, code: missingCode });
          return;
        }

        var perfSession = ImgPrompterPerf.create("analyze", {
          format: cfg.format || "",
          lang: cfg.lang || "",
          model: cfg.model || "",
          provider: ImgPrompterNet.detectProvider(cfg.apiUrl || ""),
          imageQualityMode: cfg.imageQualityMode || "standard",
        });

        var cacheImgSrc = msg.imgSrc || "";
        var cacheKey = buildAnalyzeCacheKey(cacheImgSrc, cfg);
        var cachedResult = analyzeSessionCache[cacheKey];
        if (cachedResult && cachedResult.json) {
          ImgPrompterPerf.logTotal(perfSession, "analyze_total", { cached: true });
          deliverCachedAnalyze(senderTabId, cachedResult, cfg);
          sendResponse({ ok: true, accepted: true });
          return;
        }

        function startAnalyze(imageDataUrl, prepared) {
          if (prepared) {
            sendProgress(senderTabId, "正在调用 AI 分析...", 50);
            doAnalyze(senderTabId, cfg, imageDataUrl, cacheImgSrc, perfSession);
            return;
          }
          sendProgress(senderTabId, "正在压缩图片...", 40);
          ImgPrompterImgProc.compressFromDataUrl(imageDataUrl, perfSession, buildQualityOpts(cfg)).then(function (compressed) {
            sendProgress(senderTabId, "正在调用 AI 分析...", 50);
            doAnalyze(senderTabId, cfg, compressed.base64, cacheImgSrc, perfSession);
          }).catch(function (compressErr) {
            var prepCode = compressErr && compressErr.message ? compressErr.message : "IMG_COMPRESS_FAIL";
            ImgPrompterPerf.logTotal(perfSession, "analyze_total", { code: prepCode });
            chrome.tabs.sendMessage(senderTabId, {
              type: "imgprompter-error",
              text: ImgPrompterErr.msg(prepCode),
              code: prepCode,
            });
          });
        }

        function runPrepare() {
          var prepOpts = {
            pageUrl: msg.pageUrl || "",
            screenshotCrop: msg.screenshotCrop,
            windowId: sender.tab ? sender.tab.windowId : null,
          };
          prepareImageDataUrl(senderTabId, msg.imgSrc, prepOpts, perfSession, buildQualityOpts(cfg), function (prepErr, dataUrl) {
            if (prepErr) {
              var prepCode = prepErr.message || "IMG_LOAD_FAIL";
              ImgPrompterPerf.logTotal(perfSession, "analyze_total", { code: prepCode });
              var prepMsg = ImgPrompterErr.msg(prepCode);
              if (!prepMsg || prepMsg === prepCode) {
                prepMsg = ImgPrompterErr.msg("IMG_LOAD_FAIL");
              }
              chrome.tabs.sendMessage(senderTabId, {
                type: "imgprompter-error",
                text: prepMsg,
                code: prepCode,
              });
              return;
            }
            startAnalyze(dataUrl, false);
          });
        }

        if (msg.imageDataUrl) {
          sendProgress(senderTabId, "正在调用 AI 分析...", 30);
          startAnalyze(msg.imageDataUrl, !!msg.imagePrepared);
          sendResponse({ ok: true, accepted: true });
        } else if (shouldPrepareInBg(msg)) {
          runPrepare();
          sendResponse({ ok: true, accepted: true });
        } else {
          ImgPrompterPerf.logTotal(perfSession, "analyze_total", { code: "IMG_LOAD_FAIL" });
          sendResponse({ ok: false, code: "IMG_LOAD_FAIL" });
        }
      });
      return true;
    }

    if (msg.type === "imgprompter-rewrite") {
      var rewriteTabId = sender.tab ? sender.tab.id : null;
      if (!rewriteTabId) {
        sendResponse({ ok: false, code: "INJECT_BLOCKED" });
        return true;
      }

      ImgPrompterStore.getConfig(function (cfg) {
        var missingCode = getMissingVisionConfigCode(cfg);
        if (missingCode) {
          sendResponse({ ok: false, code: missingCode });
          return;
        }
        doRewrite(
          rewriteTabId,
          cfg,
          msg.currentJson,
          msg.instruction,
          msg.imgSrc || "",
          ImgPrompterPerf.create("rewrite", {
            format: cfg.format || "",
            lang: cfg.lang || "",
            model: cfg.model || "",
            provider: ImgPrompterNet.detectProvider(cfg.apiUrl || ""),
          })
        );
        sendResponse({ ok: true, accepted: true });
      });
      return true;
    }

    if (msg.type === "imgprompter-show-history-record") {
      if (!msg.record) {
        sendResponse({ ok: false, code: "RECORD_EMPTY" });
        return true;
      }
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
        var tab = tabs && tabs[0];
        if (!tab || !tab.id) {
          sendResponse({ ok: false, code: "INJECT_BLOCKED" });
          return;
        }
        if (!isInjectableUrl(tab.url || "")) {
          sendResponse({ ok: false, code: "INJECT_BLOCKED" });
          return;
        }
        sendToTab(tab.id, { type: "imgprompter-open-history-record", record: msg.record });
        sendResponse({ ok: true });
      });
      return true;
    }

    if (msg.type === "imgprompter-reanalyze-history-record") {
      if (!msg.record || !msg.record.imgSrc) {
        sendResponse({ ok: false, code: "IMG_SRC_EMPTY" });
        return true;
      }
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
        var tab = tabs && tabs[0];
        if (!tab || !tab.id || !isInjectableUrl(tab.url || "")) {
          sendResponse({ ok: false, code: "INJECT_BLOCKED" });
          return;
        }
        sendToTab(tab.id, {
          type: "imgprompter-start",
          src: msg.record.imgSrc,
          pageUrl: msg.record.pageUrl || tab.url || "",
        });
        sendResponse({ ok: true });
      });
      return true;
    }

    if (msg.type === "imgprompter-get-history") {
      ImgPrompterStore.getHistory(function (list) {
        sendResponse({ ok: true, list: list });
      });
      return true;
    }

    if (msg.type === "imgprompter-clear-history") {
      analyzeSessionCache = {};
      ImgPrompterStore.clearHistory(function (err) {
        sendResponse({ ok: !err });
      });
      return true;
    }

    if (msg.type === "imgprompter-generate") {
      var genTabId = sender.tab ? sender.tab.id : null;
      if (!genTabId) {
        sendResponse({ ok: false, code: "INJECT_BLOCKED" });
        return true;
      }

      ImgPrompterStore.getConfig(function (cfg) {
        var missingCode = getMissingGenConfigCode(cfg);
        if (missingCode) {
          sendResponse({ ok: false, code: missingCode });
          return;
        }

        var genPerf = ImgPrompterPerf.create("generate", {
          model: cfg.genModel || "",
          provider: ImgPrompterNet.detectProvider(cfg.genApiUrl || ""),
        });
        chrome.tabs.sendMessage(genTabId, {
          type: "imgprompter-generate-progress",
          text: "正在准备生图...",
          pct: 10,
        });
        ImgPrompterNet.generateImage(cfg, msg.prompt || "", function (text, pct) {
          chrome.tabs.sendMessage(genTabId, {
            type: "imgprompter-generate-progress",
            text: text,
            pct: pct,
          });
        }, function (err, result) {
          if (err) {
            ImgPrompterPerf.logTotal(genPerf, "generate_total", { code: err.code || "error" });
            chrome.tabs.sendMessage(genTabId, {
              type: "imgprompter-generate-fail",
              text: ImgPrompterErr.msg(err.code),
              code: err.code,
            });
            return;
          }
          ImgPrompterPerf.logTotal(genPerf, "generate_total", {
            provider: result.provider || "",
            model: result.model || "",
            images: result.images ? result.images.length : 0,
          });
          chrome.tabs.sendMessage(genTabId, {
            type: "imgprompter-generate-done",
            images: result.images,
            provider: result.provider,
            model: result.model,
          });
        }, genPerf);
        sendResponse({ ok: true, accepted: true });
      });
      return true;
    }
  });
})();
