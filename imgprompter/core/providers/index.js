var ImgPrompterProviders = (function () {
  "use strict";

  var _registry = {};

  function register(provider) {
    if (!provider || !provider.name) return;
    _registry[provider.name] = provider;
  }

  function get(name) {
    if (!name) return null;
    return _registry[name] || null;
  }

  function list() {
    var out = [];
    var key;
    for (key in _registry) {
      if (_registry.hasOwnProperty(key)) out.push(key);
    }
    return out;
  }

  function detectProvider(apiUrl) {
    var u = String(apiUrl || "").toLowerCase();
    if (/generativelanguage\.googleapis\.com|ai\.google\.dev/i.test(u)) return "gemini";
    if (/doubao|volces|volcengine/i.test(u)) return "doubao";
    if (/dashscope|aliyun|alibaba/i.test(u)) return "ali";
    if (/moonshot|kimi/i.test(u)) return "kimi";
    if (/siliconflow|siliconcloud/i.test(u)) return "siliconflow";
    if (/xiaomimimo\.com/i.test(u)) return "mimo";
    if (/anthropic\.com/i.test(u)) return "anthropic";
    if (/openai\.com/i.test(u)) return "openai";
    return "openai";
  }

  function isResponsesEndpoint(endpoint) {
    return /\/responses$/i.test(String(endpoint || "").trim());
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

  function isFullImageEndpoint(apiUrl) {
    var u = String(apiUrl || "").trim();
    if (/\/images\/generations$/i.test(u)) return true;
    if (/:generateContent$/i.test(u)) return true;
    if (/\/multimodal-generation\/generation$/i.test(u)) return true;
    return false;
  }

  function extractMediaFromDataUrl(dataUrl) {
    var m = String(dataUrl || "").match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (m) return { mediaType: m[1], base64: m[2] };
    return { mediaType: "image/jpeg", base64: dataUrl };
  }

  return {
    register: register,
    get: get,
    list: list,
    detectProvider: detectProvider,
    isResponsesEndpoint: isResponsesEndpoint,
    stripKnownCompletionSuffix: stripKnownCompletionSuffix,
    isFullImageEndpoint: isFullImageEndpoint,
    extractMediaFromDataUrl: extractMediaFromDataUrl,
  };
})();
