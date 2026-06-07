var ImgPrompterProviderGemini = (function () {
  "use strict";

  function ensureTrailingSlash(url) {
    var u = String(url || "").trim();
    if (!u) return "https://generativelanguage.googleapis.com/v1beta/";
    if (u.charAt(u.length - 1) !== "/") return u + "/";
    return u;
  }

  function buildEndpoint(apiUrl, model) {
    var base = ensureTrailingSlash(apiUrl || "https://generativelanguage.googleapis.com/v1beta");
    var path = "models/" + encodeURIComponent(model) + ":generateContent";
    try {
      return new URL(path, base).toString();
    } catch (e) {
      return base.replace(/\/+$/, "") + "/" + path;
    }
  }

  function buildHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    };
  }

  function buildGenerationConfig(format, getMaxTokens) {
    var config = { maxOutputTokens: getMaxTokens(format) };
    if (format && format !== "plain") config.responseMimeType = "application/json";
    return config;
  }

  function buildAnalyzeBody(cfg, sysPrompt, userText, imageDataUrl, format, getMaxTokens) {
    var parts = ImgPrompterProviders.extractMediaFromDataUrl(imageDataUrl);
    return {
      contents: [
        {
          parts: [
            { text: sysPrompt + "\n\n" + userText },
            {
              inline_data: {
                mime_type: parts.mediaType,
                data: parts.base64,
              },
            },
          ],
        },
      ],
      generationConfig: buildGenerationConfig(format, getMaxTokens),
    };
  }

  function buildTextBody(cfg, sysPrompt, userText, format, getMaxTokens) {
    return {
      contents: [
        {
          parts: [{ text: sysPrompt + "\n\n" + userText }],
        },
      ],
      generationConfig: buildGenerationConfig(format, getMaxTokens),
    };
  }

  function buildTestBody(cfg, getMaxTokens) {
    return {
      contents: [{ parts: [{ text: "hi" }] }],
      generationConfig: { maxOutputTokens: 5 },
    };
  }

  function buildImageBody(prompt) {
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["Image"],
        imageConfig: { aspectRatio: "1:1" },
      },
    };
  }

  function resolveEndpoint(apiUrl, model) {
    return buildEndpoint(apiUrl, model);
  }

  function resolveImageEndpoint(apiUrl, model) {
    return buildEndpoint(apiUrl, model);
  }

  function parseResponse(data) {
    var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    if (!parts || !parts.length) return "";
    var texts = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i] && parts[i].text) texts.push(parts[i].text);
    }
    return texts.join("\n");
  }

  function parseImages(data) {
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

  return {
    name: "gemini",
    aliases: ["gemini"],
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

ImgPrompterProviders.register(ImgPrompterProviderGemini);
