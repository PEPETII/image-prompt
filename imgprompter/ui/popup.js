(function () {
  "use strict";

  var tabVision = document.getElementById("tab-vision");
  var tabGen = document.getElementById("tab-gen");
  var tabHistory = document.getElementById("tab-history");
  var msgEl = document.getElementById("settings-msg");
  var genMsgEl = document.getElementById("gen-settings-msg");

  var selectGenPlatform = document.getElementById("select-gen-platform");
  var inputGenApiUrl = document.getElementById("input-gen-api-url");
  var inputGenApiKey = document.getElementById("input-gen-api-key");
  var inputGenModel = document.getElementById("input-gen-model");
  var selectGenPresetModel = document.getElementById("select-gen-preset-model") ||
    document.getElementById("select-doubao-gen-model");
  var selectDoubaoGenModel = selectGenPresetModel;
  var labelGenModel = document.getElementById("label-gen-model");
  var hintGenModel = document.getElementById("hint-gen-model");
  var errGenApiUrl = document.getElementById("err-gen-api-url");
  var errGenApiKey = document.getElementById("err-gen-api-key");
  var errGenModel = document.getElementById("err-gen-model");
  var btnGenTest = document.getElementById("btn-gen-test");
  var btnGenSave = document.getElementById("btn-gen-save");
  var btnGenClear = document.getElementById("btn-gen-clear");
  var btnToggleGenKey = document.getElementById("btn-toggle-gen-key");

  var inputApiUrl = document.getElementById("input-api-url");
  var inputApiKey = document.getElementById("input-api-key");
  var inputModel = document.getElementById("input-model");
  var selectVisionPresetModel = document.getElementById("select-vision-preset-model") ||
    document.getElementById("select-doubao-model");
  var selectDoubaoModel = selectVisionPresetModel;
  var labelModel = document.getElementById("label-model");
  var hintModel = document.getElementById("hint-model");
  var selectPlatform = document.getElementById("select-platform");
  var selectLang = document.getElementById("select-lang");
  var selectFormat = document.getElementById("select-format");
  var toggleThinking = document.getElementById("toggle-thinking");
  var selectImageQuality = document.getElementById("select-image-quality");

  var errApiUrl = document.getElementById("err-api-url");
  var errApiKey = document.getElementById("err-api-key");
  var errModel = document.getElementById("err-model");

  var btnSave = document.getElementById("btn-save");
  var btnTest = document.getElementById("btn-test");
  var btnClear = document.getElementById("btn-clear");
  var btnToggleKey = document.getElementById("btn-toggle-key");

  var profileDrafts = {};
  var storedProfiles = {};
  var genDrafts = {};

  var VISION_MODEL_CUSTOM = ImgPrompterStore.MODEL_PICKER_CUSTOM || "__custom__";
  var GEN_MODEL_CUSTOM = ImgPrompterStore.MODEL_PICKER_CUSTOM || "__custom__";

  function cloneProfile(profile) {
    return {
      apiUrl: profile && profile.apiUrl ? profile.apiUrl : "",
      apiKey: profile && profile.apiKey ? profile.apiKey : "",
      model: profile && profile.model ? profile.model : "",
    };
  }

  function cloneGenDraft(profile) {
    return {
      platform: profile && profile.platform ? profile.platform : "custom",
      apiUrl: profile && profile.apiUrl ? profile.apiUrl : "",
      apiKey: profile && profile.apiKey ? profile.apiKey : "",
      model: profile && profile.model ? profile.model : "",
    };
  }

  function cloneProfiles(profiles) {
    var out = {};
    var key;
    if (profiles) {
      for (key in profiles) {
        if (profiles.hasOwnProperty(key)) out[key] = cloneProfile(profiles[key]);
      }
    }
    return out;
  }

  function profileIsEmpty(profile) {
    if (!profile) return true;
    return !String(profile.apiUrl || "").trim() &&
      !String(profile.apiKey || "").trim() &&
      !String(profile.model || "").trim();
  }

  function updateDraftFromForm(platform) {
    profileDrafts[platform] = {
      apiUrl: inputApiUrl.value.trim(),
      apiKey: inputApiKey.value.trim(),
      model: getVisionModelValue(),
    };
  }

  function getVisionPresetPlatformConfig(platform) {
    return ImgPrompterStore.getVisionPickerConfig(platform);
  }

  function isVisionPresetModel(platform, modelId) {
    var cfg = getVisionPresetPlatformConfig(platform);
    var i;
    var m = String(modelId || "").trim();
    if (!cfg || !m) return false;
    for (i = 0; i < cfg.models.length; i++) {
      if (cfg.models[i].id === m) return true;
    }
    return false;
  }

  function refillVisionPresetSelect(platform) {
    var cfg = getVisionPresetPlatformConfig(platform);
    var i;
    var opt;
    if (!selectVisionPresetModel || !cfg) return;
    while (selectVisionPresetModel.firstChild) {
      selectVisionPresetModel.removeChild(selectVisionPresetModel.firstChild);
    }
    for (i = 0; i < cfg.models.length; i++) {
      opt = document.createElement("option");
      opt.value = cfg.models[i].id;
      opt.textContent = cfg.models[i].label;
      selectVisionPresetModel.appendChild(opt);
    }
    if (cfg.allowCustom) {
      opt = document.createElement("option");
      opt.value = VISION_MODEL_CUSTOM;
      opt.textContent = "自定义（手动输入）";
      selectVisionPresetModel.appendChild(opt);
    }
  }

  function isVisionPresetPickerActive() {
    var platform = selectPlatform.value;
    var cfg = getVisionPresetPlatformConfig(platform);
    return !!cfg && cfg.models && cfg.models.length > 0 &&
      selectVisionPresetModel &&
      !selectVisionPresetModel.classList.contains("ip-model-picker-hidden");
  }

  function getVisionModelValue() {
    var platform = selectPlatform.value;
    var cfg = getVisionPresetPlatformConfig(platform);
    if (isVisionPresetPickerActive() && cfg) {
      if (cfg.allowCustom && selectVisionPresetModel.value === VISION_MODEL_CUSTOM) {
        return inputModel.value.trim();
      }
      return selectVisionPresetModel.value.trim();
    }
    return inputModel.value.trim();
  }

  function setVisionPresetPickerValue(platform, model) {
    var cfg = getVisionPresetPlatformConfig(platform);
    var m = String(model || "").trim();
    if (!cfg || !selectVisionPresetModel) return;
    if (isVisionPresetModel(platform, m)) {
      selectVisionPresetModel.value = m;
      inputModel.value = m;
      inputModel.classList.add("ip-model-input-hidden");
    } else if (cfg.allowCustom && m) {
      selectVisionPresetModel.value = VISION_MODEL_CUSTOM;
      inputModel.value = m;
      inputModel.classList.remove("ip-model-input-hidden");
    } else {
      selectVisionPresetModel.value = cfg.model || "";
      inputModel.value = cfg.model || "";
      inputModel.classList.add("ip-model-input-hidden");
    }
  }

  function onVisionPresetSelectChange() {
    var platform = selectPlatform.value;
    var cfg = getVisionPresetPlatformConfig(platform);
    if (!cfg || !selectVisionPresetModel) return;
    if (cfg.allowCustom && selectVisionPresetModel.value === VISION_MODEL_CUSTOM) {
      inputModel.classList.remove("ip-model-input-hidden");
      if (labelModel) labelModel.setAttribute("for", "input-model");
      inputModel.focus();
    } else {
      inputModel.value = selectVisionPresetModel.value;
      inputModel.classList.add("ip-model-input-hidden");
      if (labelModel) labelModel.setAttribute("for", "select-vision-preset-model");
    }
    clearFieldErr(inputModel, errModel);
    clearFieldErr(selectVisionPresetModel, errModel);
    clearMsg();
  }

  function getGenPresetPlatformConfig(platform) {
    return ImgPrompterStore.getGenPickerConfig(platform);
  }

  function updateGenDraftFromForm(platform) {
    genDrafts[platform] = {
      platform: platform,
      apiUrl: inputGenApiUrl.value.trim(),
      apiKey: inputGenApiKey.value.trim(),
      model: getGenModelValue(),
    };
  }

  function isGenPresetModel(platform, modelId) {
    var cfg = getGenPresetPlatformConfig(platform);
    var i;
    var m = String(modelId || "").trim();
    if (!cfg || !m) return false;
    for (i = 0; i < cfg.models.length; i++) {
      if (cfg.models[i].id === m) return true;
    }
    return false;
  }

  function refillGenPresetSelect(platform) {
    var cfg = getGenPresetPlatformConfig(platform);
    var i;
    var opt;
    if (!selectGenPresetModel || !cfg) return;
    while (selectGenPresetModel.firstChild) {
      selectGenPresetModel.removeChild(selectGenPresetModel.firstChild);
    }
    for (i = 0; i < cfg.models.length; i++) {
      opt = document.createElement("option");
      opt.value = cfg.models[i].id;
      opt.textContent = cfg.models[i].label;
      selectGenPresetModel.appendChild(opt);
    }
    if (cfg.allowCustom) {
      opt = document.createElement("option");
      opt.value = GEN_MODEL_CUSTOM;
      opt.textContent = "自定义（手动输入）";
      selectGenPresetModel.appendChild(opt);
    }
  }

  function isGenPresetPickerActive() {
    var platform = selectGenPlatform.value;
    var cfg = getGenPresetPlatformConfig(platform);
    return !!cfg && cfg.models && cfg.models.length > 0 &&
      selectGenPresetModel &&
      !selectGenPresetModel.classList.contains("ip-model-picker-hidden");
  }

  function getGenModelValue() {
    var platform = selectGenPlatform.value;
    var cfg = getGenPresetPlatformConfig(platform);
    if (isGenPresetPickerActive() && cfg) {
      if (cfg.allowCustom && selectGenPresetModel.value === GEN_MODEL_CUSTOM) {
        return inputGenModel.value.trim();
      }
      return selectGenPresetModel.value.trim();
    }
    return inputGenModel.value.trim();
  }

  function setGenPresetPickerValue(platform, model) {
    var cfg = getGenPresetPlatformConfig(platform);
    var m = String(model || "").trim();
    if (!cfg || !selectGenPresetModel) return;
    if (isGenPresetModel(platform, m)) {
      selectGenPresetModel.value = m;
      inputGenModel.value = m;
      inputGenModel.classList.add("ip-model-input-hidden");
    } else if (cfg.allowCustom && m) {
      selectGenPresetModel.value = GEN_MODEL_CUSTOM;
      inputGenModel.value = m;
      inputGenModel.classList.remove("ip-model-input-hidden");
    } else {
      selectGenPresetModel.value = cfg.model || "";
      inputGenModel.value = cfg.model || "";
      inputGenModel.classList.add("ip-model-input-hidden");
    }
  }

  function onGenPresetSelectChange() {
    var platform = selectGenPlatform.value;
    var cfg = getGenPresetPlatformConfig(platform);
    if (!cfg || !selectGenPresetModel) return;
    if (cfg.allowCustom && selectGenPresetModel.value === GEN_MODEL_CUSTOM) {
      inputGenModel.classList.remove("ip-model-input-hidden");
      if (labelGenModel) labelGenModel.setAttribute("for", "input-gen-model");
      inputGenModel.focus();
    } else {
      inputGenModel.value = selectGenPresetModel.value;
      inputGenModel.classList.add("ip-model-input-hidden");
      if (labelGenModel) labelGenModel.setAttribute("for", "select-gen-preset-model");
    }
    clearFieldErr(inputGenModel, errGenModel);
    clearFieldErr(selectGenPresetModel, errGenModel);
    clearGenMsg();
  }

  function syncGenModelField(platform) {
    var cfg = getGenPresetPlatformConfig(platform);
    if (cfg && cfg.models && cfg.models.length) {
      refillGenPresetSelect(platform);
      if (selectGenPresetModel) selectGenPresetModel.classList.remove("ip-model-picker-hidden");
      if (labelGenModel) labelGenModel.setAttribute("for", "select-gen-preset-model");
      if (hintGenModel) hintGenModel.textContent = cfg.hint;
      setGenPresetPickerValue(platform, inputGenModel.value.trim());
      onGenPresetSelectChange();
    } else {
      if (selectGenPresetModel) selectGenPresetModel.classList.add("ip-model-picker-hidden");
      inputGenModel.classList.remove("ip-model-input-hidden");
      if (labelGenModel) labelGenModel.setAttribute("for", "input-gen-model");
      inputGenModel.placeholder = cfg && cfg.model ? cfg.model : "gpt-image-1.5";
      if (hintGenModel) hintGenModel.textContent = cfg && cfg.hint
        ? cfg.hint
        : "需支持图片生成，例如 gpt-image-1.5、gemini-2.5-flash-image";
    }
  }

  function syncVisionModelField(platform) {
    var cfg = getVisionPresetPlatformConfig(platform);
    if (cfg && cfg.models && cfg.models.length) {
      refillVisionPresetSelect(platform);
      if (selectVisionPresetModel) selectVisionPresetModel.classList.remove("ip-model-picker-hidden");
      if (labelModel) labelModel.setAttribute("for", "select-vision-preset-model");
      if (hintModel) hintModel.textContent = cfg.hint;
      setVisionPresetPickerValue(platform, inputModel.value.trim());
      onVisionPresetSelectChange();
    } else {
      if (selectVisionPresetModel) selectVisionPresetModel.classList.add("ip-model-picker-hidden");
      inputModel.classList.remove("ip-model-input-hidden");
      if (labelModel) labelModel.setAttribute("for", "input-model");
      inputModel.placeholder = cfg && cfg.model ? cfg.model : "gpt-5.2";
      if (hintModel) hintModel.textContent = cfg && cfg.hint
        ? cfg.hint
        : "需支持视觉输入，例如 gpt-5.2、gemini-2.5-flash";
    }
  }

  function hydrateProfileFields(platform, source) {
    var profile = cloneProfile(source);
    var preset = getVisionPresetPlatformConfig(platform);
    if (preset && profileIsEmpty(profile)) {
      profile.apiUrl = preset.apiUrl;
      if (!profile.model) profile.model = preset.model || "";
    }
    inputApiUrl.value = profile.apiUrl || "";
    inputApiKey.value = profile.apiKey || "";
    inputModel.value = profile.model || "";
    clearFieldErr(inputApiUrl, errApiUrl);
    clearFieldErr(inputApiKey, errApiKey);
    clearFieldErr(inputModel, errModel);
    if (selectVisionPresetModel) clearFieldErr(selectVisionPresetModel, errModel);
    clearMsg();
    syncVisionModelField(platform);
  }

  if (selectVisionPresetModel) {
    selectVisionPresetModel.addEventListener("change", onVisionPresetSelectChange);
  }

  selectPlatform.addEventListener("change", function () {
    var previousPlatform = selectPlatform.getAttribute("data-prev-platform");
    if (!previousPlatform) previousPlatform = "custom";
    updateDraftFromForm(previousPlatform);
    var platform = selectPlatform.value;
    selectPlatform.setAttribute("data-prev-platform", platform);
    hydrateProfileFields(platform, profileDrafts[platform] || {});
  });

  function switchNavTab(target) {
    var navBtns = document.querySelectorAll(".nav-btn");
    var i;
    for (i = 0; i < navBtns.length; i++) {
      navBtns[i].classList.toggle("active", navBtns[i].getAttribute("data-tab") === target);
    }
    tabVision.classList.toggle("visible", target === "vision");
    tabGen.classList.toggle("visible", target === "gen");
    tabHistory.classList.toggle("visible", target === "history");
    if (target === "history" && popupHistory) popupHistory.onTabActivated();
  }

  var navBtns = document.querySelectorAll(".nav-btn");
  navBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchNavTab(btn.getAttribute("data-tab"));
    });
  });

  btnToggleKey.addEventListener("click", function () {
    var showing = btnToggleKey.classList.toggle("showing");
    inputApiKey.type = showing ? "text" : "password";
  });

  btnToggleGenKey.addEventListener("click", function () {
    var showing = btnToggleGenKey.classList.toggle("showing");
    inputGenApiKey.type = showing ? "text" : "password";
  });

  function showMsg(text, ok) {
    msgEl.textContent = text;
    msgEl.className = "form-msg " + (ok ? "ok" : "err");
  }

  function clearMsg() {
    msgEl.textContent = "";
    msgEl.className = "form-msg";
  }

  function showGenMsg(text, ok) {
    genMsgEl.textContent = text;
    genMsgEl.className = "form-msg " + (ok ? "ok" : "err");
  }

  function clearGenMsg() {
    genMsgEl.textContent = "";
    genMsgEl.className = "form-msg";
  }

  function setFieldErr(inputEl, errEl, text) {
    inputEl.classList.add("invalid");
    errEl.textContent = text;
  }

  function clearFieldErr(inputEl, errEl) {
    inputEl.classList.remove("invalid");
    errEl.textContent = "";
  }

  function clearAllFieldErrs() {
    clearFieldErr(inputApiUrl, errApiUrl);
    clearFieldErr(inputApiKey, errApiKey);
    clearFieldErr(inputModel, errModel);
    if (selectVisionPresetModel) clearFieldErr(selectVisionPresetModel, errModel);
  }

  inputApiUrl.addEventListener("input", function () { clearFieldErr(inputApiUrl, errApiUrl); clearMsg(); });
  inputApiKey.addEventListener("input", function () { clearFieldErr(inputApiKey, errApiKey); clearMsg(); });
  inputModel.addEventListener("input", function () {
    clearFieldErr(inputModel, errModel);
    if (selectVisionPresetModel) clearFieldErr(selectVisionPresetModel, errModel);
    clearMsg();
  });

  [inputApiUrl, inputApiKey, inputModel].forEach(function (input) {
    input.addEventListener("paste", function (e) {
      e.stopPropagation();
    });
  });

  function validate() {
    var modelFieldEl;
    clearAllFieldErrs();
    clearMsg();
    var url = inputApiUrl.value.trim();
    var key = inputApiKey.value.trim();
    var model = getVisionModelValue();
    var valid = true;

    if (!url) {
      setFieldErr(inputApiUrl, errApiUrl, ImgPrompterErr.msg("API_URL_EMPTY"));
      valid = false;
    } else if (!/^https:\/\//i.test(url)) {
      setFieldErr(inputApiUrl, errApiUrl, ImgPrompterErr.msg("API_URL_NOT_HTTPS"));
      valid = false;
    }

    if (!key) {
      setFieldErr(inputApiKey, errApiKey, ImgPrompterErr.msg("API_KEY_EMPTY"));
      valid = false;
    }

    if (!model) {
      if (isVisionPresetPickerActive()) {
        var visionCfg = getVisionPresetPlatformConfig(selectPlatform.value);
        modelFieldEl = visionCfg && visionCfg.allowCustom &&
          selectVisionPresetModel.value === VISION_MODEL_CUSTOM
          ? inputModel
          : selectVisionPresetModel;
      } else {
        modelFieldEl = inputModel;
      }
      setFieldErr(modelFieldEl, errModel, ImgPrompterErr.msg("MODEL_EMPTY"));
      valid = false;
    } else if (
      ImgPrompterStore.isOpenAIVisionContext(selectPlatform.value, url) &&
      !ImgPrompterStore.isOpenAIVisionModel5x(model)
    ) {
      modelFieldEl = isVisionPresetPickerActive() &&
        selectVisionPresetModel &&
        selectVisionPresetModel.value !== VISION_MODEL_CUSTOM
        ? selectVisionPresetModel
        : inputModel;
      setFieldErr(modelFieldEl, errModel, ImgPrompterErr.msg("OPENAI_VISION_5X"));
      valid = false;
    }

    return valid;
  }

  function clearAllGenFieldErrs() {
    clearFieldErr(inputGenApiUrl, errGenApiUrl);
    clearFieldErr(inputGenApiKey, errGenApiKey);
    clearFieldErr(inputGenModel, errGenModel);
    if (selectGenPresetModel) clearFieldErr(selectGenPresetModel, errGenModel);
  }

  function validateGen() {
    var modelFieldEl;
    clearAllGenFieldErrs();
    clearGenMsg();
    var url = inputGenApiUrl.value.trim();
    var key = inputGenApiKey.value.trim();
    var model = getGenModelValue();
    var valid = true;

    if (!url) {
      setFieldErr(inputGenApiUrl, errGenApiUrl, ImgPrompterErr.msg("API_URL_EMPTY"));
      valid = false;
    } else if (!/^https:\/\//i.test(url)) {
      setFieldErr(inputGenApiUrl, errGenApiUrl, ImgPrompterErr.msg("API_URL_NOT_HTTPS"));
      valid = false;
    }

    if (!key) {
      setFieldErr(inputGenApiKey, errGenApiKey, ImgPrompterErr.msg("API_KEY_EMPTY"));
      valid = false;
    }

    if (!model) {
      if (isGenPresetPickerActive()) {
        var genCfg = getGenPresetPlatformConfig(selectGenPlatform.value);
        modelFieldEl = genCfg && genCfg.allowCustom &&
          selectGenPresetModel.value === GEN_MODEL_CUSTOM
          ? inputGenModel
          : selectGenPresetModel;
      } else {
        modelFieldEl = inputGenModel;
      }
      setFieldErr(modelFieldEl, errGenModel, ImgPrompterErr.msg("MODEL_EMPTY"));
      valid = false;
    }

    return valid;
  }

  function readGenFromForm() {
    return {
      platform: selectGenPlatform.value,
      apiUrl: inputGenApiUrl.value.trim(),
      apiKey: inputGenApiKey.value.trim(),
      model: getGenModelValue(),
    };
  }

  function hydrateGenFields(genProfile) {
    var profile = cloneGenDraft(genProfile);
    var preset = getGenPresetPlatformConfig(profile.platform);
    if (preset && profileIsEmpty(profile)) {
      profile.apiUrl = preset.apiUrl;
      if (!profile.model && preset.model) profile.model = preset.model;
    }
    selectGenPlatform.value = profile.platform || "custom";
    selectGenPlatform.setAttribute("data-prev-platform", profile.platform || "custom");
    inputGenApiUrl.value = profile.apiUrl || "";
    inputGenApiKey.value = profile.apiKey || "";
    inputGenModel.value = profile.model || "";
    clearAllGenFieldErrs();
    clearGenMsg();
    syncGenModelField(profile.platform || "custom");
    if (getGenPresetPlatformConfig(profile.platform || "custom")) {
      setGenPresetPickerValue(profile.platform, profile.model || "");
    }
  }

  if (selectGenPresetModel) {
    selectGenPresetModel.addEventListener("change", onGenPresetSelectChange);
  }

  selectGenPlatform.addEventListener("change", function () {
    var platform = selectGenPlatform.value;
    var previousPlatform = selectGenPlatform.getAttribute("data-prev-platform") || "custom";
    updateGenDraftFromForm(previousPlatform);
    var nextDraft = genDrafts[platform] || { platform: platform };
    hydrateGenFields(nextDraft);
  });

  function getFormFlatConfig() {
    return {
      platform: selectPlatform.value,
      apiUrl: inputApiUrl.value.trim(),
      apiKey: inputApiKey.value.trim(),
      model: getVisionModelValue(),
      lang: selectLang.value,
      format: selectFormat.value,
      thinking: toggleThinking.checked,
      imageQualityMode: selectImageQuality ? selectImageQuality.value : "standard",
    };
  }

  function buildSaveConfig() {
    var platform = selectPlatform.value;
    updateDraftFromForm(platform);
    var profiles = cloneProfiles(storedProfiles);
    var key;
    for (key in profileDrafts) {
      if (profileDrafts.hasOwnProperty(key)) profiles[key] = cloneProfile(profileDrafts[key]);
    }
    var flat = getFormFlatConfig();
    var gen = readGenFromForm();
    return {
      schemaVersion: 3,
      platform: platform,
      apiUrl: flat.apiUrl,
      apiKey: flat.apiKey,
      model: flat.model,
      lang: flat.lang,
      format: flat.format,
      thinking: flat.thinking,
      imageQualityMode: flat.imageQualityMode,
      profiles: profiles,
      genProfile: gen,
      genPlatform: gen.platform,
      genApiUrl: gen.apiUrl,
      genApiKey: gen.apiKey,
      genModel: gen.model,
    };
  }

  function buildGenOnlySaveConfig(baseCfg, cb) {
    if (baseCfg) {
      var cfg = {
        schemaVersion: 3,
        platform: baseCfg.platform,
        apiUrl: baseCfg.apiUrl,
        apiKey: baseCfg.apiKey,
        model: baseCfg.model,
        lang: baseCfg.lang,
        format: baseCfg.format,
        thinking: baseCfg.thinking,
        imageQualityMode: baseCfg.imageQualityMode || "standard",
        profiles: cloneProfiles(baseCfg.profiles || storedProfiles),
        genProfile: readGenFromForm(),
        genPlatform: readGenFromForm().platform,
        genApiUrl: readGenFromForm().apiUrl,
        genApiKey: readGenFromForm().apiKey,
        genModel: readGenFromForm().model,
      };
      cb(cfg);
      return;
    }
    ImgPrompterStore.getConfig(function (current) {
      cb({
        schemaVersion: 3,
        platform: current.platform,
        apiUrl: current.apiUrl,
        apiKey: current.apiKey,
        model: current.model,
        lang: current.lang,
        format: current.format,
        thinking: current.thinking,
        imageQualityMode: current.imageQualityMode || "standard",
        profiles: cloneProfiles(current.profiles),
        genProfile: readGenFromForm(),
        genPlatform: readGenFromForm().platform,
        genApiUrl: readGenFromForm().apiUrl,
        genApiKey: readGenFromForm().apiKey,
        genModel: readGenFromForm().model,
      });
    });
  }

  function setFormConfig(cfg) {
    storedProfiles = cloneProfiles(cfg.profiles || {});
    profileDrafts = cloneProfiles(cfg.profiles || {});
    genDrafts = {};
    var platform = cfg.platform || "custom";
    selectPlatform.value = platform;
    selectPlatform.setAttribute("data-prev-platform", platform);
    selectLang.value = cfg.lang || "zh";
    selectFormat.value = cfg.format || "json";
    toggleThinking.checked = !!cfg.thinking;
    if (selectImageQuality) selectImageQuality.value = cfg.imageQualityMode || "standard";
    var activeProfile = profileDrafts[platform] || {
      apiUrl: cfg.apiUrl || "",
      apiKey: cfg.apiKey || "",
      model: cfg.model || "",
    };
    profileDrafts[platform] = cloneProfile(activeProfile);
    hydrateProfileFields(platform, activeProfile);
    var currentGenProfile = cfg.genProfile || {
      platform: cfg.genPlatform,
      apiUrl: cfg.genApiUrl,
      apiKey: cfg.genApiKey,
      model: cfg.genModel,
    };
    genDrafts[currentGenProfile.platform || "custom"] = cloneGenDraft(currentGenProfile);
    hydrateGenFields(currentGenProfile);
    clearAllFieldErrs();
    clearMsg();
  }

  function resetForm() {
    storedProfiles = {};
    profileDrafts = {};
    genDrafts = {};
    selectPlatform.value = "custom";
    selectPlatform.setAttribute("data-prev-platform", "custom");
    inputApiUrl.value = "";
    inputApiKey.value = "";
    inputModel.value = "";
    selectLang.value = "zh";
    selectFormat.value = "json";
    toggleThinking.checked = false;
    if (selectImageQuality) selectImageQuality.value = "standard";
    hydrateGenFields(null);
    syncVisionModelField("custom");
    clearAllFieldErrs();
    clearAllGenFieldErrs();
    clearMsg();
    clearGenMsg();
  }

  btnSave.addEventListener("click", function () {
    if (!validate()) return;
    var cfg = buildSaveConfig();
    ImgPrompterStore.saveConfig(cfg, function (err) {
      if (err) {
        showMsg(ImgPrompterErr.msg("STORAGE_FAIL"), false);
        return;
      }
      storedProfiles = cloneProfiles(cfg.profiles);
      showMsg("配置已保存", true);
    });
  });

  btnClear.addEventListener("click", function () {
    ImgPrompterStore.clearConfig(function (err) {
      if (err) {
        showMsg(ImgPrompterErr.msg("STORAGE_FAIL"), false);
        return;
      }
      resetForm();
      showMsg("配置已清除", true);
    });
  });

  btnGenSave.addEventListener("click", function () {
    if (!validateGen()) return;
    buildGenOnlySaveConfig(null, function (cfg) {
      ImgPrompterStore.saveConfig(cfg, function (err) {
        if (err) {
          showGenMsg(ImgPrompterErr.msg("STORAGE_FAIL"), false);
          return;
        }
        showGenMsg("生图配置已保存", true);
      });
    });
  });

  btnGenClear.addEventListener("click", function () {
    buildGenOnlySaveConfig(null, function (cfg) {
      cfg.genProfile = { platform: "custom", apiUrl: "", apiKey: "", model: "" };
      cfg.genPlatform = "custom";
      cfg.genApiUrl = "";
      cfg.genApiKey = "";
      cfg.genModel = "";
      ImgPrompterStore.saveConfig(cfg, function (err) {
        if (err) {
          showGenMsg(ImgPrompterErr.msg("STORAGE_FAIL"), false);
          return;
        }
        hydrateGenFields(null);
        showGenMsg("生图配置已清除", true);
      });
    });
  });

  btnTest.addEventListener("click", function () {
    if (!validate()) return;
    var cfg = getFormFlatConfig();

    btnTest.classList.add("loading");
    btnTest.disabled = true;
    btnSave.disabled = true;
    btnClear.disabled = true;
    showMsg("正在测试连接...", true);

    ImgPrompterNet.testConnection(cfg, function (ok, text) {
      btnTest.classList.remove("loading");
      btnTest.disabled = false;
      btnSave.disabled = false;
      btnClear.disabled = false;

      if (ok) {
        showMsg("连接成功，API 可用", true);
      } else {
        var mapped = mapTestError(text);
        showMsg(mapped, false);
      }
    });
  });

  btnGenTest.addEventListener("click", function () {
    if (!validateGen()) return;
    var cfg = getFormFlatConfig();

    btnGenTest.classList.add("loading");
    btnGenTest.disabled = true;
    btnGenSave.disabled = true;
    btnGenClear.disabled = true;
    showGenMsg("正在测试生图连接...", true);

    ImgPrompterNet.testGenConnection(cfg, function (ok, text) {
      btnGenTest.classList.remove("loading");
      btnGenTest.disabled = false;
      btnGenSave.disabled = false;
      btnGenClear.disabled = false;

      if (ok) {
        showGenMsg("连接成功，生图 API 可用", true);
      } else {
        var genMapped = mapTestError(text);
        if (text === "GEN_CONFIG_EMPTY") genMapped = ImgPrompterErr.msg("GEN_CONFIG_EMPTY");
        if (text === "GEN_UNSUPPORTED") genMapped = ImgPrompterErr.msg("GEN_UNSUPPORTED");
        if (text === "GEN_NO_IMAGE") genMapped = ImgPrompterErr.msg("GEN_NO_IMAGE");
        showGenMsg(genMapped, false);
      }
    });
  });

  function mapTestError(raw) {
    var s = (raw || "").toLowerCase();
    if (/401|unauthorized|invalid.*key|invalid.*api/i.test(s)) return ImgPrompterErr.msg("API_KEY_INVALID");
    if (/404|not found|model.*not/i.test(s)) return ImgPrompterErr.msg("MODEL_MISSING");
    if (/429.*quota|quota.*exceeded|billing|plan/i.test(s)) return ImgPrompterErr.msg("QUOTA_EXCEEDED");
    if (/429|rate/i.test(s)) return "请求频率受限，请稍后重试";
    if (/cors|cross.origin|blocked/i.test(s)) return ImgPrompterErr.msg("CORS_BLOCKED");
    if (/not.json|unexpected.token|syntaxerror/i.test(s)) return ImgPrompterErr.msg("RESPONSE_NOT_JSON");
    if (/abort|timeout|timed out/i.test(s)) return ImgPrompterErr.msg("TIMEOUT");
    if (/network|fetch|failed to fetch|err_net/i.test(s)) return ImgPrompterErr.msg("NETWORK");
    if (/400|bad request/i.test(s)) return "请求格式有误，请检查 API 地址和模型名称";
    return "连接失败：" + raw;
  }

  function loadConfig() {
    ImgPrompterStore.getConfig(function (cfg) {
      setFormConfig(cfg);
    });
  }

  var popupHistory = new ImgPrompterPopupHistory({
    listEl: document.getElementById("history-list"),
    emptyEl: document.getElementById("history-empty"),
    clearBtnEl: document.getElementById("btn-clear-history"),
    msgEl: document.getElementById("settings-msg"),
  });

  selectPlatform.setAttribute("data-prev-platform", selectPlatform.value);

  function openTabFromHash() {
    if (window.location.hash === "#gen") {
      switchNavTab("gen");
    }
  }

  loadConfig();
  openTabFromHash();
})();
