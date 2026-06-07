var ImgPrompterProviderOpenAICompat = (function () {
  "use strict";

  function buildHeaders(apiKey, provider) {
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

  function isReasoningOpenAIModel(model) {
    var m = String(model || "").toLowerCase();
    return /(?:^|\/|\s)o[13](?:-|$|\/|\s)/.test(m) || /^gpt-5/.test(m);
  }

  function applyThinking(body, model) {
    var m = String(model || "").toLowerCase();
    if (/qwen|deepseek|glm|doubao|moonshot|kimi|mimo/.test(m)) {
      body.extra_body = { enable_thinking: true };
    } else if (isReasoningOpenAIModel(model)) {
      body.reasoning_effort = "low";
    }
  }

  function applyFastReasoning(body, model) {
    if (!isReasoningOpenAIModel(model)) return;
    body.reasoning_effort = "none";
  }

  function shouldUseJsonResponseFormat(provider, format) {
    if (!format || format === "plain") return false;
    if (provider === "doubao") return false;
    return true;
  }

  function applyJsonResponseFormat(body, provider, format) {
    if (shouldUseJsonResponseFormat(provider, format)) {
      body.response_format = { type: "json_object" };
    }
  }

  function buildAnalyzeBody(cfg, sysPrompt, userText, imageDataUrl, format, getMaxTokens) {
    var provider = cfg.provider || "openai";
    var body = {
      model: cfg.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: sysPrompt + "\n\n" + userText },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        },
      ],
      max_tokens: getMaxTokens(format),
    };
    if (cfg.thinking) applyThinking(body, cfg.model);
    else applyFastReasoning(body, cfg.model);
    applyJsonResponseFormat(body, provider, format);
    return body;
  }

  function buildTextBody(cfg, sysPrompt, userText, format, getMaxTokens) {
    var provider = cfg.provider || "openai";
    var body = {
      model: cfg.model,
      messages: [
        { role: "user", content: sysPrompt + "\n\n" + userText },
      ],
      max_tokens: getMaxTokens(format),
    };
    if (cfg.thinking) applyThinking(body, cfg.model);
    applyJsonResponseFormat(body, provider, format);
    return body;
  }

  function buildTestBody(cfg) {
    return {
      model: cfg.model,
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 5,
    };
  }

  function buildImageBody(model, prompt, provider) {
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

  function resolveEndpoint(apiUrl, provider) {
    var url = String(apiUrl || "").trim().replace(/\/+$/, "");
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

  function resolveImageEndpoint(apiUrl, model, provider) {
    var base = ImgPrompterProviders.stripKnownCompletionSuffix(apiUrl).trim().replace(/\/+$/, "");
    if (!base) return "";
    if (ImgPrompterProviders.isFullImageEndpoint(base)) return base;
    if (/\/images\/generations$/i.test(base)) return base;
    return base + "/images/generations";
  }

  function parseResponse(data) {
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

  function parseImages(data) {
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

  return {
    name: "openai_compatible",
    aliases: ["openai", "doubao", "kimi", "moonshot", "siliconflow", "mimo", "custom"],
    buildHeaders: buildHeaders,
    buildAnalyzeBody: buildAnalyzeBody,
    buildTextBody: buildTextBody,
    buildTestBody: buildTestBody,
    buildImageBody: buildImageBody,
    resolveEndpoint: resolveEndpoint,
    resolveImageEndpoint: resolveImageEndpoint,
    parseResponse: parseResponse,
    parseImages: parseImages,
    isResponses: false,
  };
})();

ImgPrompterProviders.register(ImgPrompterProviderOpenAICompat);
