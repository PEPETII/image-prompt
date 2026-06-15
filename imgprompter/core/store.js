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

  var DEFAULT_API_URLS = ImgPrompterModelPresets.DEFAULT_API_URLS;
  var DEFAULT_GEN_API_URLS = ImgPrompterModelPresets.DEFAULT_GEN_API_URLS;
  var MODEL_RENAMES = ImgPrompterModelPresets.MODEL_RENAMES;
  var VISION_PLATFORM_PRESETS = ImgPrompterModelPresets.VISION_PLATFORM_PRESETS;
  var GEN_PLATFORM_PRESETS = ImgPrompterModelPresets.GEN_PLATFORM_PRESETS;
  var MODEL_PICKER_CUSTOM = ImgPrompterModelPresets.MODEL_PICKER_CUSTOM;
  var OPENAI_VISION_5X_FALLBACK = ImgPrompterModelPresets.OPENAI_VISION_5X_FALLBACK;

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
      platform: src.platform && isKnownGenPlatform(src.platform) ? src.platform : "custom",
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

  function normalizeImageQualityMode(mode) {
    var m = String(mode || "").trim().toLowerCase();
    if (m === "fast" || m === "standard" || m === "high") return m;
    return "standard";
  }

  function applyDefaults(raw) {
    var cfg = {
      schemaVersion: SCHEMA_VERSION,
      platform: "custom",
      lang: "zh",
      format: "json",
      thinking: false,
      imageQualityMode: "standard",
      profiles: cloneProfiles(null),
      genProfile: emptyGenProfile(),
    };
    if (raw && typeof raw === "object") {
      if (raw.platform) cfg.platform = raw.platform;
      if (raw.lang) cfg.lang = raw.lang;
      if (raw.format) cfg.format = raw.format;
      if (raw.thinking === true) cfg.thinking = true;
      if (raw.imageQualityMode) cfg.imageQualityMode = normalizeImageQualityMode(raw.imageQualityMode);
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
    cfg.imageQualityMode = normalizeImageQualityMode(cfg.imageQualityMode);
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
      if (!next.apiUrl) {
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
      imageQualityMode: normalizeImageQualityMode(cfg.imageQualityMode),
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
      imageQualityMode: normalizeImageQualityMode(cfg.imageQualityMode),
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
    base.imageQualityMode = normalizeImageQualityMode(cfg.imageQualityMode);
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
