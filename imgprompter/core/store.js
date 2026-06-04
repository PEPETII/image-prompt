var ImgPrompterStore = (function () {
  "use strict";

  var CONFIG_KEY = "imgprompter_cfg";
  var HISTORY_KEY = "imgprompter_hist";
  var MAX_HISTORY = 20;
  var SCHEMA_VERSION = 3;

  var PLATFORM_KEYS = [
    "openai",
    "gemini",
    "doubao",
    "ali",
    "kimi",
    "siliconflow",
    "mimo",
    "custom",
  ];

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

  var OPENAI_VISION_5X_FALLBACK = "gpt-5-mini";

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

  var MODEL_PICKER_CUSTOM = "__custom__";

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
      model: "moonshot-v1-8k",
      hint: "Kimi 兼容视觉模型请按你的网关与权限填写。",
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
      hint: "可填写任意兼容 API 地址与生图模型名称。",
      allowCustom: true,
      models: [],
    },
  };

  function isKnownPlatform(platform) {
    for (var i = 0; i < PLATFORM_KEYS.length; i++) {
      if (PLATFORM_KEYS[i] === platform) return true;
    }
    return false;
  }

  function isKnownGenPlatform(platform) {
    if (platform === "custom") return true;
    return Object.prototype.hasOwnProperty.call(GEN_PLATFORM_PRESETS, platform) && platform !== "custom";
  }

  function cloneModelItem(item) {
    return {
      id: item && item.id ? String(item.id) : "",
      label: item && item.label ? String(item.label) : "",
    };
  }

  function clonePickerConfig(src) {
    var out = {
      apiUrl: src && src.apiUrl ? String(src.apiUrl) : "",
      model: src && src.model ? String(src.model) : "",
      hint: src && src.hint ? String(src.hint) : "",
      allowCustom: !src || src.allowCustom !== false,
      models: [],
    };
    var i;
    var list = src && src.models ? src.models : [];
    for (i = 0; i < list.length; i++) out.models.push(cloneModelItem(list[i]));
    return out;
  }

  function getVisionPickerConfig(platform) {
    return clonePickerConfig(VISION_PLATFORM_PRESETS[platform] || VISION_PLATFORM_PRESETS.custom);
  }

  function getGenPickerConfig(platform) {
    return clonePickerConfig(GEN_PLATFORM_PRESETS[platform] || GEN_PLATFORM_PRESETS.custom);
  }

  function detectProviderFromUrl(apiUrl) {
    var u = (apiUrl || "").toLowerCase();
    if (/generativelanguage\.googleapis\.com|ai\.google\.dev/i.test(u)) return "gemini";
    if (/doubao|volces|volcengine/i.test(u)) return "doubao";
    if (/dashscope|aliyun|alibaba/i.test(u)) return "ali";
    if (/moonshot|kimi/i.test(u)) return "kimi";
    if (/siliconflow|siliconcloud/i.test(u)) return "siliconflow";
    if (/xiaomimimo\.com/i.test(u)) return "mimo";
    if (/openai\.com/i.test(u)) return "openai";
    return "custom";
  }

  function inferPlatformFromUrl(apiUrl) {
    var p = detectProviderFromUrl(apiUrl);
    if (p === "custom") return "custom";
    return p;
  }

  function inferPlatformFromModel(model) {
    var m = String(model || "").trim().toLowerCase();
    if (!m) return "";
    if (/^gemini/i.test(m)) return "gemini";
    if (/^gpt|^o[1345](-|$)|^chatgpt/i.test(m)) return "openai";
    if (/qwen|dashscope|tongyi/i.test(m)) return "ali";
    if (/doubao|ep-/i.test(m)) return "doubao";
    if (/moonshot|kimi/i.test(m)) return "kimi";
    if (/siliconflow/i.test(m)) return "siliconflow";
    if (/^mimo/i.test(m)) return "mimo";
    return "";
  }

  function emptyProfile() {
    return { apiUrl: "", apiKey: "", model: "" };
  }

  function emptyGenProfile() {
    return { platform: "custom", apiUrl: "", apiKey: "", model: "" };
  }

  function cloneGenProfile(genProfile) {
    var src = genProfile || emptyGenProfile();
    return {
      platform: src.platform && isKnownPlatform(src.platform) ? src.platform : "custom",
      apiUrl: src.apiUrl ? String(src.apiUrl) : "",
      apiKey: src.apiKey ? String(src.apiKey) : "",
      model: src.model ? String(src.model) : "",
    };
  }

  function cloneProfile(profile) {
    return {
      apiUrl: profile && profile.apiUrl ? String(profile.apiUrl) : "",
      apiKey: profile && profile.apiKey ? String(profile.apiKey) : "",
      model: profile && profile.model ? String(profile.model) : "",
    };
  }

  function cloneProfiles(profiles) {
    var out = {};
    var i;
    for (i = 0; i < PLATFORM_KEYS.length; i++) {
      out[PLATFORM_KEYS[i]] = cloneProfile(profiles && profiles[PLATFORM_KEYS[i]]);
    }
    return out;
  }

  function profileHasCredentials(profile) {
    if (!profile) return false;
    return !!(String(profile.apiUrl || "").trim() || String(profile.apiKey || "").trim() || String(profile.model || "").trim());
  }

  function applyDefaults(raw) {
    var cfg = {
      schemaVersion: SCHEMA_VERSION,
      platform: "custom",
      lang: "zh",
      format: "json",
      thinking: false,
      profiles: cloneProfiles(null),
      genProfile: emptyGenProfile(),
    };
    if (raw && typeof raw === "object") {
      if (raw.platform) cfg.platform = raw.platform;
      if (raw.lang) cfg.lang = raw.lang;
      if (raw.format) cfg.format = raw.format;
      if (raw.thinking === true) cfg.thinking = true;
      if (raw.schemaVersion) cfg.schemaVersion = raw.schemaVersion;
      if (raw.profiles && typeof raw.profiles === "object") {
        cfg.profiles = cloneProfiles(raw.profiles);
      }
      if (raw.genProfile && typeof raw.genProfile === "object") {
        cfg.genProfile = cloneGenProfile(raw.genProfile);
      }
    }
    if (!isKnownPlatform(cfg.platform)) cfg.platform = "custom";
    if (cfg.thinking !== true) cfg.thinking = false;
    return cfg;
  }

  function migrateV1ToV2(cfg) {
    if (cfg.schemaVersion >= 2) return cfg;
    var legacyUrl = "";
    var legacyKey = "";
    var legacyModel = "";
    if (cfg.apiUrl) legacyUrl = String(cfg.apiUrl);
    if (cfg.apiKey) legacyKey = String(cfg.apiKey);
    if (cfg.model) legacyModel = String(cfg.model);
    var inferred = inferPlatformFromUrl(legacyUrl);
    var platform = cfg.platform;
    if (!isKnownPlatform(platform)) platform = inferred;
    if (platform === "custom" && inferred !== "custom") platform = inferred;
    var profile = {
      apiUrl: legacyUrl,
      apiKey: legacyKey,
      model: legacyModel,
    };
    if (profileHasCredentials(profile)) {
      var bucket = inferred !== "custom" ? inferred : platform;
      if (!isKnownPlatform(bucket)) bucket = "custom";
      cfg.profiles[bucket] = cloneProfile(profile);
      if (platform === "custom" && bucket !== "custom") platform = bucket;
    }
    cfg.platform = platform;
    cfg.schemaVersion = 2;
    return cfg;
  }

  function migrateV2ToV3(cfg) {
    if (cfg.schemaVersion >= SCHEMA_VERSION) return cfg;
    if (!cfg.genProfile) cfg.genProfile = emptyGenProfile();
    else cfg.genProfile = cloneGenProfile(cfg.genProfile);
    cfg.schemaVersion = SCHEMA_VERSION;
    return cfg;
  }

  function isOpenAIVisionModel5x(model) {
    var m = String(model || "").trim().toLowerCase();
    if (!m) return false;
    return /^gpt-5(\.|$|\/|-)/.test(m);
  }

  function isOpenAIVisionContext(platform, apiUrl) {
    if (platform === "openai") return true;
    return /openai\.com/i.test(String(apiUrl || ""));
  }

  function upgradeOpenAIVisionModel(model) {
    var trimmed = String(model || "").trim();
    if (!trimmed) return trimmed;
    if (isOpenAIVisionModel5x(trimmed)) return trimmed;
    var lower = trimmed.toLowerCase();
    if (/^gpt-4|^gpt-3|^o[0-9]/.test(lower) || /^chatgpt/i.test(lower)) {
      return OPENAI_VISION_5X_FALLBACK;
    }
    return trimmed;
  }

  function renameModel(model) {
    var trimmed = String(model || "").trim();
    if (!trimmed) return trimmed;
    if (MODEL_RENAMES[trimmed]) return MODEL_RENAMES[trimmed];
    return trimmed;
  }

  function applyModelRenamesToProfile(profile) {
    var changed = false;
    var next = cloneProfile(profile);
    var renamed = renameModel(next.model);
    if (renamed !== next.model) {
      next.model = renamed;
      changed = true;
    }
    return { profile: next, changed: changed };
  }

  function repairSingleProfile(platform, profile) {
    var dirty = false;
    var next = cloneProfile(profile);
    var renamed = applyModelRenamesToProfile(next);
    next = renamed.profile;
    if (renamed.changed) dirty = true;

    if (platform === "openai" || inferPlatformFromUrl(next.apiUrl) === "openai") {
      var upgraded = upgradeOpenAIVisionModel(next.model);
      if (upgraded !== next.model) {
        next.model = upgraded;
        dirty = true;
      }
    }

    var urlProvider = inferPlatformFromUrl(next.apiUrl);
    var modelProvider = inferPlatformFromModel(next.model);

    if (modelProvider && urlProvider !== "custom" && modelProvider !== urlProvider) {
      if (DEFAULT_API_URLS[modelProvider]) {
        next.apiUrl = DEFAULT_API_URLS[modelProvider];
        dirty = true;
      }
      urlProvider = modelProvider;
    } else if (modelProvider && urlProvider === "custom" && DEFAULT_API_URLS[modelProvider]) {
      if (!next.apiUrl || inferPlatformFromUrl(next.apiUrl) === "custom") {
        next.apiUrl = DEFAULT_API_URLS[modelProvider];
        dirty = true;
        urlProvider = modelProvider;
      }
    }

    if (!next.apiUrl && modelProvider && DEFAULT_API_URLS[modelProvider]) {
      next.apiUrl = DEFAULT_API_URLS[modelProvider];
      dirty = true;
      urlProvider = modelProvider;
    }

    return { profile: next, dirty: dirty, urlProvider: urlProvider };
  }

  function buildProfiles(cfg) {
    var profiles = cloneProfiles(cfg.profiles);
    var i;
    for (i = 0; i < PLATFORM_KEYS.length; i++) {
      if (!profiles[PLATFORM_KEYS[i]]) profiles[PLATFORM_KEYS[i]] = emptyProfile();
    }
    return profiles;
  }

  var REMOVED_PLATFORMS = ["deepseek", "zhipu", "anthropic"];
  var REMOVED_GEN_PLATFORMS = ["kimi", "mimo"];

  function migrateRemovedGenPlatforms(cfg) {
    var dirty = false;
    var i;
    var p;
    if (!cfg.genProfile) return false;
    for (i = 0; i < REMOVED_GEN_PLATFORMS.length; i++) {
      p = REMOVED_GEN_PLATFORMS[i];
      if (cfg.genProfile.platform === p) {
        cfg.genProfile.platform = "custom";
        dirty = true;
      }
    }
    return dirty;
  }

  function repairGenProfile(platform, profile) {
    var result = repairSingleProfile(platform, profile);
    var next = result.profile;
    var dirty = result.dirty;
    if (platform === "ali") {
      var u = String(next.apiUrl || "").trim();
      if (!u || /compatible-mode/i.test(u)) {
        next.apiUrl = DEFAULT_GEN_API_URLS.ali;
        dirty = true;
      }
    }
    return { profile: next, dirty: dirty };
  }

  function migrateRemovedPlatforms(cfg) {
    var dirty = false;
    var i;
    var p;
    for (i = 0; i < REMOVED_PLATFORMS.length; i++) {
      p = REMOVED_PLATFORMS[i];
      if (cfg.platform === p) {
        cfg.platform = "custom";
        dirty = true;
      }
      if (cfg.profiles && cfg.profiles[p]) {
        if (!profileHasCredentials(cfg.profiles.custom) && profileHasCredentials(cfg.profiles[p])) {
          cfg.profiles.custom = cloneProfile(cfg.profiles[p]);
        }
        delete cfg.profiles[p];
        dirty = true;
      }
      if (cfg.genProfile && cfg.genProfile.platform === p) {
        cfg.genProfile.platform = "custom";
        dirty = true;
      }
    }
    return dirty;
  }

  function repairCfg(cfg) {
    var dirty = false;
    if (migrateRemovedPlatforms(cfg)) dirty = true;
    if (migrateRemovedGenPlatforms(cfg)) dirty = true;
    var profiles = buildProfiles(cfg);
    var i;
    var key;
    var repaired;

    for (i = 0; i < PLATFORM_KEYS.length; i++) {
      key = PLATFORM_KEYS[i];
      repaired = repairSingleProfile(key, profiles[key]);
      if (repaired.dirty) dirty = true;
      profiles[key] = repaired.profile;
    }

    var activePlatform = cfg.platform;
    var activeProfile = profiles[activePlatform] || emptyProfile();
    var activeRepair = repairSingleProfile(activePlatform, activeProfile);
    profiles[activePlatform] = activeRepair.profile;
    if (activeRepair.dirty) dirty = true;

    if (activePlatform !== "custom") {
      var urlProvider = inferPlatformFromUrl(activeRepair.profile.apiUrl);
      if (urlProvider !== "custom" && urlProvider !== activePlatform) {
        if (!profileHasCredentials(profiles[urlProvider])) {
          profiles[urlProvider] = cloneProfile(activeRepair.profile);
        }
        activePlatform = urlProvider;
        dirty = true;
      }
    }

    cfg.platform = activePlatform;
    cfg.profiles = profiles;

    if (!cfg.genProfile) cfg.genProfile = emptyGenProfile();
    var genPlatform = isKnownGenPlatform(cfg.genProfile.platform) ? cfg.genProfile.platform : "custom";
    var genRepaired = repairGenProfile(genPlatform, cfg.genProfile);
    cfg.genProfile = cloneGenProfile(genRepaired.profile);
    cfg.genProfile.platform = genPlatform;
    if (genRepaired.dirty) dirty = true;
    if (genPlatform !== "custom") {
      var genUrlProvider = inferPlatformFromUrl(cfg.genProfile.apiUrl);
      if (genUrlProvider !== "custom" && genUrlProvider !== genPlatform) {
        var genFixedUrl = DEFAULT_GEN_API_URLS[genPlatform] || DEFAULT_API_URLS[genPlatform];
        if (genFixedUrl) {
          cfg.genProfile.apiUrl = genFixedUrl;
          dirty = true;
        }
      }
    }

    if (dirty) cfg._dirty = true;
    return cfg;
  }

  function flattenCfg(cfg) {
    var platform = cfg.platform;
    var profile = cfg.profiles[platform] || emptyProfile();
    var gen = cloneGenProfile(cfg.genProfile);
    return {
      schemaVersion: SCHEMA_VERSION,
      platform: platform,
      apiUrl: profile.apiUrl || "",
      apiKey: profile.apiKey || "",
      model: profile.model || "",
      lang: cfg.lang || "zh",
      format: cfg.format || "json",
      thinking: cfg.thinking === true,
      profiles: cloneProfiles(cfg.profiles),
      genPlatform: gen.platform,
      genApiUrl: gen.apiUrl || "",
      genApiKey: gen.apiKey || "",
      genModel: gen.model || "",
      genProfile: gen,
    };
  }

  function toStoredCfg(cfg) {
    return {
      schemaVersion: SCHEMA_VERSION,
      platform: cfg.platform,
      lang: cfg.lang || "zh",
      format: cfg.format || "json",
      thinking: cfg.thinking === true,
      profiles: cloneProfiles(cfg.profiles),
      genProfile: cloneGenProfile(cfg.genProfile),
    };
  }

  function normalizeIncomingCfg(cfg) {
    var base = applyDefaults(null);
    if (!cfg || typeof cfg !== "object") return base;
    base.platform = isKnownPlatform(cfg.platform) ? cfg.platform : base.platform;
    base.lang = cfg.lang || base.lang;
    base.format = cfg.format || base.format;
    base.thinking = cfg.thinking === true;
    base.profiles = cloneProfiles(cfg.profiles);
    var platform = base.platform;
    var active = {
      apiUrl: cfg.apiUrl || "",
      apiKey: cfg.apiKey || "",
      model: cfg.model || "",
    };
    if (profileHasCredentials(active) || profileHasCredentials(base.profiles[platform])) {
      var merged = cloneProfile(base.profiles[platform]);
      if (active.apiUrl) merged.apiUrl = String(active.apiUrl);
      if (active.apiKey) merged.apiKey = String(active.apiKey);
      if (active.model) merged.model = String(active.model);
      base.profiles[platform] = merged;
    }
    if (cfg.genProfile && typeof cfg.genProfile === "object") {
      base.genProfile = cloneGenProfile(cfg.genProfile);
    } else {
      base.genProfile = cloneGenProfile(base.genProfile);
    }
    if (cfg.genApiUrl || cfg.genApiKey || cfg.genModel || cfg.genPlatform) {
      var genMerged = cloneGenProfile(base.genProfile);
      if (cfg.genPlatform && isKnownGenPlatform(cfg.genPlatform)) genMerged.platform = cfg.genPlatform;
      if (cfg.genApiUrl) genMerged.apiUrl = String(cfg.genApiUrl);
      if (cfg.genApiKey) genMerged.apiKey = String(cfg.genApiKey);
      if (cfg.genModel) genMerged.model = String(cfg.genModel);
      base.genProfile = genMerged;
    }
    return base;
  }

  function processConfig(raw, cb) {
    var hadSchema = raw && raw.schemaVersion >= SCHEMA_VERSION;
    var cfg = applyDefaults(raw);
    var dirty = !hadSchema;
    if (!hadSchema && raw) {
      cfg.apiUrl = raw.apiUrl || "";
      cfg.apiKey = raw.apiKey || "";
      cfg.model = raw.model || "";
    }
    cfg = migrateV1ToV2(cfg);
    if (!hadSchema) dirty = true;
    if (!raw || !raw.genProfile || raw.schemaVersion < SCHEMA_VERSION) dirty = true;
    cfg = migrateV2ToV3(cfg);
    cfg = repairCfg(cfg);
    if (cfg._dirty) {
      dirty = true;
      delete cfg._dirty;
    }
    var stored = toStoredCfg(cfg);
    var effective = flattenCfg(cfg);
    if (dirty) {
      saveConfigRaw(stored, function () {
        cb(effective);
      });
      return;
    }
    cb(effective);
  }

  function saveConfigRaw(stored, cb) {
    var data = {};
    data[CONFIG_KEY] = stored;
    chrome.storage.local.set(data, function () {
      if (chrome.runtime.lastError) {
        if (cb) cb(chrome.runtime.lastError);
        return;
      }
      if (cb) cb(null);
    });
  }

  function getConfig(cb) {
    chrome.storage.local.get(CONFIG_KEY, function (result) {
      if (chrome.runtime.lastError) {
        processConfig(null, cb);
        return;
      }
      processConfig(result[CONFIG_KEY] || null, cb);
    });
  }

  function saveConfig(cfg, cb) {
    var normalized = normalizeIncomingCfg(cfg);
    normalized.schemaVersion = SCHEMA_VERSION;
    var stored = toStoredCfg(normalized);
    saveConfigRaw(stored, cb);
  }

  function clearConfig(cb) {
    chrome.storage.local.remove(CONFIG_KEY, function () {
      if (chrome.runtime.lastError) {
        if (cb) cb(chrome.runtime.lastError);
        return;
      }
      if (cb) cb(null);
    });
  }

  function getHistory(cb) {
    chrome.storage.local.get(HISTORY_KEY, function (result) {
      if (chrome.runtime.lastError) {
        cb([]);
        return;
      }
      cb(result[HISTORY_KEY] || []);
    });
  }

  function pushHistory(record, cb) {
    getHistory(function (list) {
      list.unshift(record);
      if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
      var data = {};
      data[HISTORY_KEY] = list;
      chrome.storage.local.set(data, function () {
        if (cb) cb(chrome.runtime.lastError || null);
      });
    });
  }

  function clearHistory(cb) {
    chrome.storage.local.remove(HISTORY_KEY, function () {
      if (chrome.runtime.lastError) {
        if (cb) cb(chrome.runtime.lastError);
        return;
      }
      if (cb) cb(null);
    });
  }

  return {
    MODEL_PICKER_CUSTOM: MODEL_PICKER_CUSTOM,
    isOpenAIVisionModel5x: isOpenAIVisionModel5x,
    isOpenAIVisionContext: isOpenAIVisionContext,
    upgradeOpenAIVisionModel: upgradeOpenAIVisionModel,
    PLATFORM_KEYS: PLATFORM_KEYS,
    DEFAULT_API_URLS: DEFAULT_API_URLS,
    DEFAULT_GEN_API_URLS: DEFAULT_GEN_API_URLS,
    VISION_PLATFORM_PRESETS: VISION_PLATFORM_PRESETS,
    GEN_PLATFORM_PRESETS: GEN_PLATFORM_PRESETS,
    getVisionPickerConfig: getVisionPickerConfig,
    getGenPickerConfig: getGenPickerConfig,
    getConfig: getConfig,
    saveConfig: saveConfig,
    clearConfig: clearConfig,
    getHistory: getHistory,
    pushHistory: pushHistory,
    clearHistory: clearHistory,
  };
})();
