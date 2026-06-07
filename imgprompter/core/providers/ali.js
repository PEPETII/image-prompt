var ImgPrompterProviderAli = (function () {
  "use strict";

  function buildHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    };
  }

  function resolveEndpoint(apiUrl, provider) {
    var url = String(apiUrl || "").trim().replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(url)) return url;
    if (/\/v1$/i.test(url)) return url + "/chat/completions";
    return url + "/v1/chat/completions";
  }

  function resolveImageEndpoint(apiUrl) {
    var base = ImgPrompterProviders.stripKnownCompletionSuffix(apiUrl).trim().replace(/\/+$/, "");
    if (/\/multimodal-generation\/generation$/i.test(base)) return base;
    if (!base || /compatible-mode/i.test(base)) {
      base = "https://dashscope.aliyuncs.com/api/v1";
    } else if (/dashscope\.aliyuncs\.com/i.test(base) && !/\/api\/v1/i.test(base)) {
      base = "https://dashscope.aliyuncs.com/api/v1";
    }
    return base.replace(/\/+$/, "") + "/services/aigc/multimodal-generation/generation";
  }

  function buildAnalyzeBody(cfg, sysPrompt, userText, imageDataUrl, format, getMaxTokens) {
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
    if (cfg.thinking) {
      body.extra_body = { enable_thinking: true };
    }
    if (format && format !== "plain") {
      body.response_format = { type: "json_object" };
    }
    return body;
  }

  function buildTextBody(cfg, sysPrompt, userText, format, getMaxTokens) {
    var body = {
      model: cfg.model,
      messages: [
        { role: "user", content: sysPrompt + "\n\n" + userText },
      ],
      max_tokens: getMaxTokens(format),
    };
    if (cfg.thinking) {
      body.extra_body = { enable_thinking: true };
    }
    if (format && format !== "plain") {
      body.response_format = { type: "json_object" };
    }
    return body;
  }

  function buildTestBody(cfg) {
    return {
      model: cfg.model,
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 5,
    };
  }

  function buildImageBody(model, prompt) {
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
    return "";
  }

  function parseImages(data) {
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

  return {
    name: "ali",
    aliases: ["ali"],
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

ImgPrompterProviders.register(ImgPrompterProviderAli);
