var ImgPrompterProviderOpenAI = (function () {
  "use strict";

  function isReasoningOpenAIModel(model) {
    var m = String(model || "").toLowerCase();
    return /(?:^|\/|\s)o[13](?:-|$|\/|\s)/.test(m) || /^gpt-5/.test(m);
  }

  function applyResponsesThinking(body, model) {
    if (/qwen/i.test(model)) {
      body.enable_thinking = true;
    } else if (isReasoningOpenAIModel(model)) {
      body.reasoning = { effort: "low" };
    }
  }

  function applyResponsesFastReasoning(body, model) {
    if (!isReasoningOpenAIModel(model)) return;
    body.reasoning = { effort: "none" };
  }

  function buildHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    };
  }

  function buildAnalyzeBody(cfg, sysPrompt, userText, imageDataUrl, format, getMaxTokens) {
    var body = {
      model: cfg.model,
      instructions: sysPrompt,
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
    else applyResponsesFastReasoning(body, cfg.model);
    return body;
  }

  function buildTextBody(cfg, sysPrompt, userText, format, getMaxTokens) {
    var body = {
      model: cfg.model,
      instructions: sysPrompt,
      input: [{ role: "user", content: userText }],
      max_output_tokens: getMaxTokens(format),
    };
    if (cfg.thinking) applyResponsesThinking(body, cfg.model);
    return body;
  }

  function buildTestBody(cfg) {
    return {
      model: cfg.model,
      input: "hi",
      max_output_tokens: 5,
    };
  }

  function resolveEndpoint(apiUrl, provider) {
    var url = String(apiUrl || "").trim().replace(/\/+$/, "");
    if (/\/responses$/i.test(url)) return url;
    if (/\/chat\/completions$/i.test(url)) return url;
    if (/\/v[0-9]+$/i.test(url)) return url + "/responses";
    return url + "/responses";
  }

  function resolveImageEndpoint(apiUrl) {
    var base = ImgPrompterProviders.stripKnownCompletionSuffix(apiUrl).trim().replace(/\/+$/, "");
    if (!base) return "";
    if (/\/images\/generations$/i.test(base)) return base;
    return base + "/images/generations";
  }

  function parseResponse(data) {
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
    name: "openai",
    aliases: ["openai_responses"],
    buildHeaders: buildHeaders,
    buildAnalyzeBody: buildAnalyzeBody,
    buildTextBody: buildTextBody,
    buildTestBody: buildTestBody,
    buildImageBody: null,
    resolveEndpoint: resolveEndpoint,
    resolveImageEndpoint: resolveImageEndpoint,
    parseResponse: parseResponse,
    parseImages: parseImages,
    isResponses: true,
  };
})();

ImgPrompterProviders.register(ImgPrompterProviderOpenAI);
