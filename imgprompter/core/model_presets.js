var ImgPrompterModelPresets = (function () {
  "use strict";

  var OPENAI_VISION_5X_FALLBACK = "gpt-5-mini";

  var MODEL_PICKER_CUSTOM = "__custom__";

  var DEFAULT_API_URLS = {
    openai: "https://api.openai.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    doubao: "https://ark.cn-beijing.volces.com/api/v3",
    ali: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    kimi: "https://api.moonshot.cn/v1",
    siliconflow: "https://api.siliconflow.cn/v1",
    mimo: "https://api.xiaomimimo.com/v1",
  };

  var DEFAULT_GEN_API_URLS = {
    ali: "https://dashscope.aliyuncs.com/api/v1",
  };

  var MODEL_RENAMES = {
    "claude-3-5-sonnet-20241022": "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-latest": "claude-sonnet-4-20250514",
    "gpt-4-vision-preview": OPENAI_VISION_5X_FALLBACK,
    "gpt-4-turbo": OPENAI_VISION_5X_FALLBACK,
    "gpt-4-turbo-preview": OPENAI_VISION_5X_FALLBACK,
    "gpt-4": OPENAI_VISION_5X_FALLBACK,
    "gpt-4o": OPENAI_VISION_5X_FALLBACK,
    "gpt-4o-mini": "gpt-5-nano",
    "gpt-4.1": OPENAI_VISION_5X_FALLBACK,
    "gpt-4.1-mini": "gpt-5-nano",
    "gpt-4.1-nano": "gpt-5-nano",
    "gpt-image-1-preview": "gpt-image-1.5",
    "gemini-2.5-flash-image-preview-latest": "gemini-2.5-flash-image",
    "Doubao-vision-pro-32k": "doubao-seed-2-0-lite-260428",
    "Doubao-Seed-2.0-lite": "doubao-seed-2-0-lite-260428",
    "Doubao-Seed-2.0-pro": "doubao-seed-2-0-pro-260215",
    "Doubao-Seed-2.0-mini": "doubao-seed-2-0-mini-260215",
    "Doubao-Seed-2.0-Code": "doubao-seed-2-0-code-preview-260215",
    "Doubao-Seed-1.8": "doubao-seed-1-8-251228",
    "Doubao-Seed-1.6": "doubao-seed-1-6-251015",
    "Doubao-Seed-1.6-flash": "doubao-seed-1-6-flash-250828",
    "Doubao-Seed-1.6-thinking": "doubao-seed-1-6-thinking-250715",
    "doubao-seed-2-0-lite-260215": "doubao-seed-2-0-lite-260428",
  };

  var VISION_PLATFORM_PRESETS = {
    openai: {
      apiUrl: DEFAULT_API_URLS.openai,
      model: "gpt-5-nano",
      hint: "识图建议 gpt-5-nano / gpt-5-mini（更快）；gpt-5.2 更慢。关闭思考模式可明显加快响应。",
      allowCustom: true,
      models: [
        { id: "gpt-5.2", label: "GPT-5.2" },
        { id: "gpt-5-mini", label: "GPT-5 mini" },
        { id: "gpt-5-nano", label: "GPT-5 nano" },
      ],
    },
    gemini: {
      apiUrl: DEFAULT_API_URLS.gemini,
      model: "gemini-2.5-flash",
      hint: "识图建议 gemini-2.5-flash（更快）；Pro 更慢但更细。",
      allowCustom: true,
      models: [
        { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
        { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
        { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
      ],
    },
    doubao: {
      apiUrl: DEFAULT_API_URLS.doubao,
      model: "doubao-seed-2-0-lite-260428",
      hint: "从列表选择常用模型；选“自定义”可填写 ep- 接入点或其它模型 ID。",
      allowCustom: true,
      models: [
        { id: "doubao-seed-2-0-pro-260215", label: "Doubao-Seed-2.0-pro" },
        { id: "doubao-seed-2-0-lite-260428", label: "Doubao-Seed-2.0-lite" },
        { id: "doubao-seed-2-0-mini-260215", label: "Doubao-Seed-2.0-mini" },
        { id: "doubao-seed-2-0-code-preview-260215", label: "Doubao-Seed-2.0-Code" },
        { id: "doubao-seed-1-8-251228", label: "Doubao-Seed-1.8" },
        { id: "doubao-seed-1-6-251015", label: "Doubao-Seed-1.6" },
        { id: "doubao-seed-1-6-flash-250828", label: "Doubao-Seed-1.6-flash" },
        { id: "doubao-seed-1-6-thinking-250715", label: "Doubao-Seed-1.6-thinking" },
      ],
    },
    ali: {
      apiUrl: DEFAULT_API_URLS.ali,
      model: "qwen-vl-plus",
      hint: "通义视觉模型可直接自定义输入；模型可用性以你的 API 权限为准。",
      allowCustom: true,
      models: [],
    },
    kimi: {
      apiUrl: DEFAULT_API_URLS.kimi,
      model: "",
      hint: "请填写支持视觉输入的 Kimi 模型（如 moonshot-v1-vision），普通文本模型无法识图。",
      allowCustom: true,
      models: [],
    },
    siliconflow: {
      apiUrl: DEFAULT_API_URLS.siliconflow,
      model: "Qwen/Qwen2.5-VL-72B-Instruct",
      hint: "硅基流动常见视觉模型可直接自定义输入。",
      allowCustom: true,
      models: [],
    },
    mimo: {
      apiUrl: DEFAULT_API_URLS.mimo,
      model: "mimo-v2.5",
      hint: "小米 MiMo 视觉模型；选“自定义”可填写其它模型 ID。",
      allowCustom: true,
      models: [
        { id: "mimo-v2.5", label: "mimo-v2.5" },
        { id: "mimo-v2-omni", label: "mimo-v2-omni" },
        { id: "mimo-v2.5-pro", label: "mimo-v2.5-pro" },
        { id: "mimo-v2-flash", label: "mimo-v2-flash" },
      ],
    },
    custom: {
      apiUrl: "",
      model: "",
      hint: "可填写任意兼容 API 地址与视觉模型名称。",
      allowCustom: true,
      models: [],
    },
  };

  var GEN_PLATFORM_PRESETS = {
    openai: {
      apiUrl: DEFAULT_API_URLS.openai,
      model: "gpt-image-1.5",
      hint: "推荐使用最新官方生图模型；image2 作为部分兼容网关常用别名一并提供，实际可用性以你的 API 权限为准。",
      allowCustom: true,
      models: [
        { id: "gpt-image-1.5", label: "gpt-image-1.5" },
        { id: "gpt-image-1", label: "gpt-image-1" },
        { id: "gpt-image-1-mini", label: "gpt-image-1-mini" },
        { id: "image2", label: "image2（兼容别名）" },
      ],
    },
    gemini: {
      apiUrl: DEFAULT_API_URLS.gemini,
      model: "gemini-2.5-flash-image",
      hint: "首选 gemini-2.5-flash-image；preview 旧名仅作兼容候选，实际可用性以你的 API 权限为准。",
      allowCustom: true,
      models: [
        { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
        { id: "gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash Image Preview（兼容旧链路）" },
        { id: "gemini-2.0-flash-preview-image-generation", label: "Gemini 2.0 Flash Preview Image Generation（兼容旧链路）" },
      ],
    },
    doubao: {
      apiUrl: DEFAULT_API_URLS.doubao,
      model: "doubao-seedream-4-5-251128",
      hint: "API Key 填控制台密钥（可为 sk- 或 ark- 等）；模型填已开通的 Seedream 名称（如 doubao-seedream-4-5-251128）。",
      allowCustom: true,
      models: [
        { id: "doubao-seedream-5-0-260128", label: "Doubao-Seedream-5.0-lite" },
        { id: "doubao-seedream-4-5-251128", label: "Doubao-Seedream-4.5" },
        { id: "doubao-seedream-4-0-250828", label: "Doubao-Seedream-4.0" },
        { id: "doubao-seedream-3-0-t2i-250415", label: "Doubao-Seedream-3.0-t2i" },
      ],
    },
    ali: {
      apiUrl: DEFAULT_GEN_API_URLS.ali,
      model: "qwen-image-2.0-2026-03-03",
      hint: "通义 Qwen-Image 使用 DashScope 生图接口（/api/v1）；勿填识图用的 compatible-mode 地址。",
      allowCustom: true,
      models: [
        { id: "qwen-image-2.0-2026-03-03", label: "Qwen-Image-2.0" },
        { id: "qwen-image-2.0-pro-2026-04-22", label: "Qwen-Image-2.0-Pro" },
        { id: "qwen-image-max-2025-12-30", label: "Qwen-Image-Max" },
        { id: "qwen-image-plus-2026-01-09", label: "Qwen-Image-Plus" },
        { id: "qwen-image-edit-max-2026-01-15", label: "Qwen-Image-Edit-Max" },
      ],
    },
    siliconflow: {
      apiUrl: DEFAULT_API_URLS.siliconflow,
      model: "Kwai-Kolors/Kolors",
      hint: "默认 Kolors；可在模型广场确认已开通的生图模型与权限。",
      allowCustom: true,
      models: [
        { id: "Kwai-Kolors/Kolors", label: "Kwai-Kolors/Kolors" },
        { id: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1-schnell" },
        { id: "Qwen/Qwen-Image", label: "Qwen/Qwen-Image" },
      ],
    },
    custom: {
      apiUrl: "",
      model: "",
      hint: "支持 OpenAI 兼容（/images/generations）、Gemini（generateContent）、通义 DashScope、豆包 Seedream 等生图接口。Kimi/MiMo 等暂不支持自动生图。",
      allowCustom: true,
      models: [],
    },
  };

  return {
    OPENAI_VISION_5X_FALLBACK: OPENAI_VISION_5X_FALLBACK,
    MODEL_PICKER_CUSTOM: MODEL_PICKER_CUSTOM,
    DEFAULT_API_URLS: DEFAULT_API_URLS,
    DEFAULT_GEN_API_URLS: DEFAULT_GEN_API_URLS,
    MODEL_RENAMES: MODEL_RENAMES,
    VISION_PLATFORM_PRESETS: VISION_PLATFORM_PRESETS,
    GEN_PLATFORM_PRESETS: GEN_PLATFORM_PRESETS,
  };
})();
