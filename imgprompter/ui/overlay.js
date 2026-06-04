(function () {
  "use strict";

  var OVERLAY_ID = "imgprompter-root";
  var SHADOW_HOST_ID = "imgprompter-host";
  var cssLoaded = false;
  var cssText = "";
  var currentImgSrc = "";
  var currentPageUrl = "";
  var lastContextImage = null;
  var currentJson = null;
  var currentRaw = "";
  var activeTab = "tab-prompt";
  var rewriting = false;
  var currentFormat = "plain";
  var currentLang = "zh";
  var currentPanelMode = "prompt";
  var generatingImage = false;
  var barAnimTimers = [];

  var JSON_FIELD_LABELS = {
    brief: "摘要",
    subject: "主体",
    scene: "场景",
    action: "动作",
    composition: "构图",
    lighting: "光线",
    colors: "色彩",
    style: "风格",
    camera: "镜头",
    materials: "材质",
    mood: "氛围",
    key_details: "关键细节",
    prompt_zh: "中文生图提示词",
    prompt_en: "英文生图提示词",
    negative_prompt: "负面提示词",
  };

  var JSON_STRUCTURE_FIELD_KEYS = [
    "subject",
    "scene",
    "action",
    "composition",
    "lighting",
    "colors",
    "style",
    "camera",
    "materials",
    "mood",
  ];

  function loadCSS(cb) {
    if (cssLoaded) { cb(cssText); return; }
    var cssUrl = chrome.runtime.getURL("ui/overlay.css");
    fetch(cssUrl)
      .then(function (r) { return r.text(); })
      .then(function (t) { cssText = t; cssLoaded = true; cb(t); })
      .catch(function () { cb(""); });
  }

  function ensureHost() {
    if (document.getElementById(SHADOW_HOST_ID)) {
      return document.getElementById(SHADOW_HOST_ID);
    }
    var host = document.createElement("div");
    host.id = SHADOW_HOST_ID;
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    loadCSS(function (css) { style.textContent = css; });
    shadow.appendChild(style);
    var root = document.createElement("div");
    root.id = OVERLAY_ID;
    shadow.appendChild(root);
    return host;
  }

  function getRoot() {
    var host = document.getElementById(SHADOW_HOST_ID);
    if (!host) return null;
    return host.shadowRoot.getElementById(OVERLAY_ID);
  }

  function removeHost() {
    var host = document.getElementById(SHADOW_HOST_ID);
    if (host) host.remove();
  }

  function makeDraggable(handleEl, cardEl) {
    var offset = { x: 0, y: 0 };
    var dragging = false;
    handleEl.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("textarea") || e.target.closest("a") || e.target.closest(".ip-tab-bar") || e.target.closest(".ip-mode-bar")) return;
      dragging = true;
      offset.x = e.clientX - cardEl.getBoundingClientRect().left;
      offset.y = e.clientY - cardEl.getBoundingClientRect().top;
      handleEl.setPointerCapture(e.pointerId);
    });
    handleEl.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      cardEl.style.left = (e.clientX - offset.x) + "px";
      cardEl.style.top = (e.clientY - offset.y) + "px";
      cardEl.style.position = "fixed";
      cardEl.style.transform = "none";
    });
    handleEl.addEventListener("pointerup", function () { dragging = false; });
  }

  function ce(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("已复制到剪贴板");
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("已复制到剪贴板");
    } catch (e) {
      showToast("复制失败，请手动复制");
    }
    document.body.removeChild(ta);
  }

  function showToast(text) {
    var root = getRoot();
    if (!root) return;
    var toast = ce("div", "ip-toast", text);
    root.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 1800);
  }

  function animateBar(bar) {
    barAnimTimers.forEach(clearTimeout);
    barAnimTimers = [];
    var steps = [
      { s: 0.15, delay: 150 },
      { s: 0.30, delay: 400 },
      { s: 0.45, delay: 800 },
      { s: 0.55, delay: 1200 },
    ];
    steps.forEach(function (step) {
      barAnimTimers.push(setTimeout(function () {
        if (bar.isConnected) {
          bar.style.transform = "scaleX(" + step.s + ")";
        }
      }, step.delay));
    });
  }

  function showNoConfig() {
    var host = ensureHost();
    var root = host.shadowRoot.getElementById(OVERLAY_ID);
    root.innerHTML = "";

    var card = ce("div", "ip-card");
    var dragHead = ce("div", "ip-drag-head");
    var closeBtn = ce("button", "ip-close", "\u2715");
    closeBtn.addEventListener("click", removeHost);
    dragHead.appendChild(closeBtn);
    card.appendChild(dragHead);

    var icon = ce("div", "ip-icon-warn", "\u26A0");
    card.appendChild(icon);
    var title = ce("div", "ip-panel-title", "尚未配置 API");
    card.appendChild(title);
    var desc = ce("div", "ip-panel-desc", "请先点击浏览器工具栏的「看图写提示词」图标，在设置页中填写 API 地址、密钥和模型名称。");
    card.appendChild(desc);

    var guideBtn = ce("button", "ip-btn ip-btn-primary", "打开设置");
    guideBtn.addEventListener("click", function () {
      chrome.runtime.sendMessage({ type: "imgprompter-open-popup" });
    });
    card.appendChild(guideBtn);

    root.appendChild(card);
    makeDraggable(dragHead, card);
  }

  function showProgress(imgSrc, statusText) {
    currentImgSrc = imgSrc || currentImgSrc;
    var host = ensureHost();
    var root = host.shadowRoot.getElementById(OVERLAY_ID);
    root.innerHTML = "";

    var card = ce("div", "ip-card");
    var dragHead = ce("div", "ip-drag-head");
    var closeBtn = ce("button", "ip-close", "\u2715");
    closeBtn.addEventListener("click", removeHost);
    dragHead.appendChild(closeBtn);
    card.appendChild(dragHead);

    if (currentImgSrc) {
      var thumbWrap = ce("div", "ip-thumb-wrap");
      var thumb = ce("img", "ip-thumb");
      thumb.src = currentImgSrc;
      thumb.alt = "分析图片";
      thumb.addEventListener("error", function () { thumb.style.display = "none"; });
      thumbWrap.appendChild(thumb);
      card.appendChild(thumbWrap);
    }

    var title = ce("div", "ip-panel-title", "AI 图片提示词分析");
    card.appendChild(title);

    var barOuter = ce("div", "ip-bar-outer");
    var barInner = ce("div", "ip-bar-inner");
    barOuter.appendChild(barInner);
    card.appendChild(barOuter);

    var status = ce("div", "ip-status-text", statusText || "正在准备分析...");
    card.appendChild(status);

    root.appendChild(card);
    makeDraggable(dragHead, card);
    barInner.offsetWidth;
    animateBar(barInner);
  }

  function updateProgress(statusText, pct) {
    barAnimTimers.forEach(clearTimeout);
    barAnimTimers = [];
    var root = getRoot();
    if (!root) return;
    var bar = root.querySelector(".ip-bar-inner");
    if (bar && typeof pct === "number") {
      var scale = Math.min(1, Math.max(0, pct / 100));
      bar.style.transform = "scaleX(" + scale + ")";
    }
    var status = root.querySelector(".ip-status-text");
    if (status) status.textContent = statusText;
  }

  function showError(errorText, errorTitle) {
    var host = ensureHost();
    var root = host.shadowRoot.getElementById(OVERLAY_ID);
    root.innerHTML = "";

    var card = ce("div", "ip-card ip-card-err");
    var dragHead = ce("div", "ip-drag-head");
    var closeBtn = ce("button", "ip-close", "\u2715");
    closeBtn.addEventListener("click", removeHost);
    dragHead.appendChild(closeBtn);
    card.appendChild(dragHead);

    var icon = ce("div", "ip-icon-err", "\u2716");
    card.appendChild(icon);
    var title = ce("div", "ip-panel-title", errorTitle || "分析失败");
    card.appendChild(title);
    var desc = ce("div", "ip-panel-desc", errorText);
    card.appendChild(desc);

    var retryBtn = ce("button", "ip-btn ip-btn-outline", "重新分析");
    retryBtn.addEventListener("click", function () {
      if (currentImgSrc) processImage(currentImgSrc);
    });
    card.appendChild(retryBtn);

    root.appendChild(card);
    makeDraggable(dragHead, card);
  }

  function showResult(jsonData, rawText, isRewrite, format) {
    if (isRewrite && !jsonData) {
      rewriting = false;
      if (rawText) currentRaw = rawText;
      restoreModifyUi();
      showToast("重写返回非 JSON，已保留上次结果");
      return;
    }
    currentJson = jsonData;
    currentRaw = rawText || "";
    currentFormat = format || "plain";
    rewriting = false;
    chrome.runtime.sendMessage({ type: "imgprompter-get-config" }, function (cfg) {
      if (chrome.runtime.lastError) {
        currentLang = "zh";
      } else {
        currentLang = (cfg && cfg.lang) || "zh";
      }
      normalizeJsonResult();
      showResultPanel(currentJson, rawText, isRewrite, format);
    });
  }

  function showResultPanel(jsonData, rawText, isRewrite, format) {
    var host = ensureHost();
    var root = host.shadowRoot.getElementById(OVERLAY_ID);
    root.innerHTML = "";

    var card = ce("div", "ip-card ip-card-result");

    var dragHead = ce("div", "ip-drag-head");
    var closeBtn = ce("button", "ip-close", "\u2715");
    closeBtn.addEventListener("click", removeHost);

    var headTitle = ce("span", "ip-head-title", "看图写提示词");
    dragHead.appendChild(headTitle);
    dragHead.appendChild(closeBtn);
    card.appendChild(dragHead);

    if (currentImgSrc) {
      var thumbLine = ce("div", "ip-thumb-line");
      var thumb = ce("img", "ip-thumb-sm");
      thumb.src = currentImgSrc;
      thumb.alt = "分析图片";
      thumb.addEventListener("error", function () { thumb.style.display = "none"; });
      thumbLine.appendChild(thumb);
      card.appendChild(thumbLine);
    }

    if (isRewrite) {
      var rewriteBadge = ce("div", "ip-rewrite-badge", "已重写");
      card.appendChild(rewriteBadge);
    }

    currentPanelMode = "prompt";
    generatingImage = false;

    var modeBar = ce("div", "ip-mode-bar");
    modeBar.id = "ip-mode-bar";
    var modePromptBtn = ce("button", "ip-mode-btn active", "生成提示词");
    modePromptBtn.setAttribute("data-mode", "prompt");
    var modeImageBtn = ce("button", "ip-mode-btn", "生成图片");
    modeImageBtn.setAttribute("data-mode", "image");
    modeBar.appendChild(modePromptBtn);
    modeBar.appendChild(modeImageBtn);
    card.appendChild(modeBar);

    var promptSection = ce("div", "ip-prompt-section");
    promptSection.id = "ip-prompt-section";

    var tabBar = ce("div", "ip-tab-bar");
    var tabs = [];

    var isJsonFormat = currentFormat === "json";
    var isDetailFormat = currentFormat === "detail";
    var isMjFormat = currentFormat === "mj";
    var isSdFormat = currentFormat === "sd";

    if (isDetailFormat) {
      tabs.push({ id: "tab-json", label: "JSON" });
    } else if (isMjFormat) {
      tabs.push({ id: "tab-mj", label: "Midjourney" });
      tabs.push({ id: "tab-prompt", label: "提示词" });
      tabs.push({ id: "tab-json", label: "JSON" });
    } else if (isSdFormat) {
      tabs.push({ id: "tab-sd", label: "Stable Diffusion" });
      tabs.push({ id: "tab-prompt", label: "提示词" });
      tabs.push({ id: "tab-json", label: "JSON" });
    } else if (isJsonFormat) {
      tabs.push({ id: "tab-json", label: "JSON" });
    } else {
      tabs.push({ id: "tab-prompt", label: "提示词" });
    }

    activeTab = tabs[0].id;

    tabs.forEach(function (t) {
      var btn = ce("button", "ip-tab-btn" + (t.id === activeTab ? " active" : ""), t.label);
      btn.setAttribute("data-tab", t.id);
      btn.addEventListener("click", function () {
        if (activeTab === "tab-prompt") syncPromptFromEditor();
        if (activeTab === "tab-json" && isJsonEditableFormat()) syncJsonFromEditor();
        tabBar.querySelectorAll(".ip-tab-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        activeTab = t.id;
        renderTabContent(t.id);
      });
      tabBar.appendChild(btn);
    });
    promptSection.appendChild(tabBar);

    var contentWrap = ce("div", "ip-content-wrap");
    contentWrap.id = "ip-tab-content";
    promptSection.appendChild(contentWrap);

    var modifySection = ce("div", "ip-modify-section");
    modifySection.id = "ip-modify-section";

    var styleRow = ce("div", "ip-style-row");
    var styleItems = [
      { key: "realistic", label: "写实" },
      { key: "anime", label: "动漫" },
      { key: "cinematic", label: "电影感" },
      { key: "product", label: "产品摄影" },
      { key: "cyberpunk", label: "赛博朋克" },
      { key: "3dicon", label: "3D 图标" },
    ];
    styleItems.forEach(function (si) {
      var tag = ce("button", "ip-style-tag", si.label);
      tag.addEventListener("click", function () {
        if (rewriting || !currentJson) return;
        var instruction = ImgPrompterPrompts.STYLE_PRESETS[si.key];
        if (instruction) requestRewrite(instruction);
      });
      styleRow.appendChild(tag);
    });
    modifySection.appendChild(styleRow);

    var inputRow = ce("div", "ip-input-row");
    var inputEl = ce("input", "ip-modify-input");
    inputEl.type = "text";
    inputEl.placeholder = "输入修改要求，例如：改成水彩画风格...";
    inputEl.id = "ip-modify-input";
    inputRow.appendChild(inputEl);

    var submitBtn = ce("button", "ip-btn ip-btn-primary ip-btn-submit", "修改");
    submitBtn.id = "ip-modify-submit";
    submitBtn.addEventListener("click", function () {
      var val = inputEl.value.trim();
      if (!val || rewriting || !currentJson) return;
      requestRewrite(val);
    });
    inputRow.appendChild(submitBtn);
    modifySection.appendChild(inputRow);

    promptSection.appendChild(modifySection);
    card.appendChild(promptSection);

    var genSection = ce("div", "ip-gen-section");
    genSection.id = "ip-gen-section";
    genSection.style.display = "none";

    var genLabel = ce("div", "ip-gen-label", "生图提示词");
    genSection.appendChild(genLabel);

    var genPromptTa = ce("textarea", "ip-gen-prompt");
    genPromptTa.id = "ip-gen-prompt";
    genPromptTa.placeholder = "输入或粘贴要生成的图片描述...";
    genSection.appendChild(genPromptTa);

    var genActions = ce("div", "ip-tab-actions");
    var genSubmitBtn = ce("button", "ip-btn ip-btn-primary ip-btn-sm", "生成图片");
    genSubmitBtn.id = "ip-gen-submit";
    genSubmitBtn.addEventListener("click", function () {
      var val = genPromptTa.value.trim();
      startImageGenerate(val);
    });
    genActions.appendChild(genSubmitBtn);
    genSection.appendChild(genActions);

    var genStatus = ce("div", "ip-gen-status");
    genStatus.id = "ip-gen-status";
    genSection.appendChild(genStatus);

    var genResultWrap = ce("div", "ip-gen-result-wrap");
    genResultWrap.id = "ip-gen-result-wrap";
    genSection.appendChild(genResultWrap);

    card.appendChild(genSection);

    function onModeClick(mode) {
      if (mode === currentPanelMode) return;
      switchPanelMode(mode, false);
    }

    modePromptBtn.addEventListener("click", function () { onModeClick("prompt"); });
    modeImageBtn.addEventListener("click", function () { onModeClick("image"); });

    root.appendChild(card);
    makeDraggable(dragHead, card);
    renderTabContent(activeTab);

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        submitBtn.click();
      }
    });
  }

  function getJsonEditFieldKeys() {
    var keys = ["brief"];
    var i;
    for (i = 0; i < JSON_STRUCTURE_FIELD_KEYS.length; i++) {
      keys.push(JSON_STRUCTURE_FIELD_KEYS[i]);
    }
    keys.push("key_details");
    if (currentLang === "en") {
      keys.push("prompt_en");
    } else if (currentLang === "both") {
      keys.push("prompt_zh");
      keys.push("prompt_en");
    } else {
      keys.push("prompt_zh");
    }
    keys.push("negative_prompt");
    return keys;
  }

  function pickJsonForFormat(jsonData) {
    if (!jsonData) return {};
    var keys = getJsonEditFieldKeys();
    var out = {};
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key === "key_details") {
        out[key] = Array.isArray(jsonData[key]) ? jsonData[key].slice() : [];
      } else {
        out[key] = jsonData[key] || "";
      }
    }
    return out;
  }

  function normalizeJsonResult() {
    if (!currentJson || currentFormat !== "detail") return;
    currentJson = pickJsonForFormat(currentJson);
  }

  function createPromptTextarea(id, value) {
    var ta = document.createElement("textarea");
    ta.className = "ip-prompt-edit" + (currentFormat === "plain" ? " ip-prompt-edit-plain" : "");
    ta.id = id;
    ta.value = value || "";
    ta.disabled = rewriting;
    ta.addEventListener("input", function () {
      syncPromptFromEditor();
    });
    return ta;
  }

  function isJsonEditableFormat() {
    return currentFormat === "json" || currentFormat === "detail";
  }

  function getJsonFieldDisplayValue(key) {
    if (!currentJson) return "";
    var val = currentJson[key];
    if (key === "key_details") {
      if (Array.isArray(val)) return val.join("、");
      return val || "";
    }
    return val || "";
  }

  function parseKeyDetailsText(text) {
    var parts = String(text || "").split(/[、,\n]/);
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      var item = parts[i].replace(/^\s+|\s+$/g, "");
      if (item) out.push(item);
    }
    return out;
  }

  function syncPromptFromEditor() {
    if (!currentJson) return;
    var root = getRoot();
    if (!root) return;
    var zhTa = root.querySelector("#ip-prompt-zh");
    var enTa = root.querySelector("#ip-prompt-en");
    if (currentLang === "zh" || currentLang === "both") {
      if (zhTa) currentJson.prompt_zh = zhTa.value;
    }
    if (currentLang === "en" || currentLang === "both") {
      if (enTa) currentJson.prompt_en = enTa.value;
    }
  }

  function syncJsonFromEditor() {
    if (!currentJson || !isJsonEditableFormat()) return;
    var root = getRoot();
    if (!root) return;
    var edits = root.querySelectorAll(".ip-json-edit");
    var i;
    for (i = 0; i < edits.length; i++) {
      var key = edits[i].getAttribute("data-key");
      if (!key) continue;
      if (key === "key_details") {
        currentJson[key] = parseKeyDetailsText(edits[i].value);
      } else {
        currentJson[key] = edits[i].value;
      }
    }
  }

  function updatePlainRaw() {
    if (currentFormat !== "plain" || !currentJson) return;
    var zh = currentJson.prompt_zh || "";
    var en = currentJson.prompt_en || "";
    if (currentLang === "both") {
      currentRaw = zh + "\n---\n" + en;
    } else if (currentLang === "en") {
      currentRaw = en;
    } else {
      currentRaw = zh;
    }
  }

  function updateBriefInline() {
    var root = getRoot();
    if (!root || !currentJson) return;
    var briefEl = root.querySelector(".ip-brief-inline");
    if (briefEl) briefEl.textContent = currentJson.brief || "";
  }

  function setPromptEditorDisabled(disabled) {
    var root = getRoot();
    if (!root) return;
    var edits = root.querySelectorAll(".ip-prompt-edit");
    var i;
    for (i = 0; i < edits.length; i++) edits[i].disabled = disabled;
    var jsonEdits = root.querySelectorAll(".ip-json-edit");
    for (i = 0; i < jsonEdits.length; i++) jsonEdits[i].disabled = disabled;
    var saveBtn = root.querySelector("#ip-prompt-save");
    if (saveBtn) saveBtn.disabled = disabled;
    var jsonSaveBtn = root.querySelector("#ip-json-save");
    if (jsonSaveBtn) jsonSaveBtn.disabled = disabled;
    var copies = root.querySelectorAll(".ip-prompt-copy");
    for (i = 0; i < copies.length; i++) copies[i].disabled = disabled;
    var jsonCopies = root.querySelectorAll(".ip-json-copy");
    for (i = 0; i < jsonCopies.length; i++) jsonCopies[i].disabled = disabled;
  }

  function applyPromptSave() {
    if (!currentJson || rewriting) return;
    syncPromptFromEditor();
    updatePlainRaw();
    if (activeTab === "tab-json") {
      renderTabContent("tab-json");
    }
    showToast("已保存为当前结果");
  }

  function applyJsonSave() {
    if (!currentJson || rewriting) return;
    syncJsonFromEditor();
    currentJson = pickJsonForFormat(currentJson);
    updateBriefInline();
    showToast("已保存为当前结果");
  }

  function requestRewrite(instruction) {
    if (rewriting || !currentJson) return;
    syncPromptFromEditor();
    if (isJsonEditableFormat()) syncJsonFromEditor();
    rewriting = true;

    var inputEl = getRoot() ? getRoot().querySelector("#ip-modify-input") : null;
    var submitBtn = getRoot() ? getRoot().querySelector("#ip-modify-submit") : null;
    if (inputEl) { inputEl.disabled = true; inputEl.value = instruction; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "修改中..."; submitBtn.classList.add("ip-btn-loading"); }

    var styleTags = getRoot() ? getRoot().querySelectorAll(".ip-style-tag") : [];
    for (var i = 0; i < styleTags.length; i++) { styleTags[i].disabled = true; }

    setPromptEditorDisabled(true);

    chrome.runtime.sendMessage(
      {
        type: "imgprompter-rewrite",
        currentJson: currentJson,
        instruction: instruction,
        imgSrc: currentImgSrc,
      },
      function (resp) {
        if (chrome.runtime.lastError) {
          rewriting = false;
          restoreModifyUi();
          showToast(ImgPrompterErr.msg("NETWORK"));
          return;
        }
        if (!resp || !resp.ok) {
          rewriting = false;
          restoreModifyUi();
          var rwMsg = resp && resp.code ? ImgPrompterErr.msg(resp.code) : "重写请求发送失败，旧结果已保留";
          showToast(rwMsg);
        }
      }
    );
  }

  function restoreModifyUi() {
    var root = getRoot();
    if (!root) return;
    var inputEl = root.querySelector("#ip-modify-input");
    var submitBtn = root.querySelector("#ip-modify-submit");
    if (inputEl) { inputEl.disabled = false; inputEl.value = ""; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "修改"; submitBtn.classList.remove("ip-btn-loading"); }
    var styleTags = root.querySelectorAll(".ip-style-tag");
    for (var i = 0; i < styleTags.length; i++) { styleTags[i].disabled = false; }
    setPromptEditorDisabled(false);
  }

  /* 顶层模式：生成提示词 / 生成图片 */
  function switchPanelMode(mode, autoGenerate) {
    currentPanelMode = mode;
    var root = getRoot();
    if (!root) return;
    var promptSection = root.querySelector("#ip-prompt-section");
    var genSection = root.querySelector("#ip-gen-section");
    var modeBtns = root.querySelectorAll(".ip-mode-btn");
    var i;
    if (!promptSection || !genSection) return;
    for (i = 0; i < modeBtns.length; i++) {
      modeBtns[i].classList.toggle("active", modeBtns[i].getAttribute("data-mode") === mode);
    }
    promptSection.style.display = mode === "prompt" ? "" : "none";
    genSection.style.display = mode === "image" ? "" : "none";
    if (mode === "image" && autoGenerate) {
      var prompt = collectPromptForImageGen();
      var ta = root.querySelector("#ip-gen-prompt");
      if (ta) ta.value = prompt;
      if (prompt) startImageGenerate(prompt);
    }
  }

  function collectPromptForImageGen() {
    if (!currentJson) return String(currentRaw || "").trim();
    if (activeTab === "tab-prompt") syncPromptFromEditor();
    if (activeTab === "tab-json" && isJsonEditableFormat()) syncJsonFromEditor();
    if (currentFormat === "mj") {
      return String(currentJson.prompt_mj || currentJson.prompt_en || "").trim();
    }
    if (currentFormat === "sd") {
      return String(currentJson.prompt_sd || currentJson.prompt_en || "").trim();
    }
    if (currentFormat === "json" || currentFormat === "detail") {
      if (typeof ImgPrompterPrompts !== "undefined" && ImgPrompterPrompts.buildImageGenPromptFromJson) {
        return ImgPrompterPrompts.buildImageGenPromptFromJson(currentJson, currentFormat, currentLang);
      }
    }
    if (currentLang === "en") return String(currentJson.prompt_en || "").trim();
    if (currentLang === "both") {
      var en = String(currentJson.prompt_en || "").trim();
      if (en) return en;
      return String(currentJson.prompt_zh || "").trim();
    }
    return String(currentJson.prompt_zh || "").trim();
  }

  function appendGotoGenButton(actions) {
    var btn = ce("button", "ip-btn ip-btn-outline ip-btn-sm ip-btn-goto-gen", "去生图");
    btn.disabled = rewriting || generatingImage;
    btn.addEventListener("click", function () {
      gotoGenerateFromPrompt();
    });
    actions.insertBefore(btn, actions.firstChild);
  }

  function gotoGenerateFromPrompt() {
    chrome.runtime.sendMessage({ type: "imgprompter-get-config" }, function (cfg) {
      if (chrome.runtime.lastError || !cfg || !cfg.genApiUrl || !cfg.genApiKey || !cfg.genModel) {
        showToast(ImgPrompterErr.msg("GEN_CONFIG_EMPTY"));
        chrome.runtime.sendMessage({ type: "imgprompter-open-popup", tab: "gen" });
        return;
      }
      var prompt = collectPromptForImageGen();
      var root = getRoot();
      if (root) {
        var ta = root.querySelector("#ip-gen-prompt");
        if (ta) ta.value = prompt;
      }
      switchPanelMode("image", false);
      if (prompt) startImageGenerate(prompt);
      else showToast(ImgPrompterErr.msg("GEN_PROMPT_EMPTY"));
    });
  }

  function setGenUiBusy(busy) {
    var root = getRoot();
    if (!root) return;
    var submit = root.querySelector("#ip-gen-submit");
    var ta = root.querySelector("#ip-gen-prompt");
    var gotoBtns = root.querySelectorAll(".ip-btn-goto-gen");
    var i;
    if (submit) submit.disabled = busy;
    if (ta) ta.disabled = busy;
    for (i = 0; i < gotoBtns.length; i++) gotoBtns[i].disabled = busy || rewriting;
  }

  function renderGenStatus(text, isError) {
    var root = getRoot();
    if (!root) return;
    var el = root.querySelector("#ip-gen-status");
    if (!el) return;
    el.textContent = text || "";
    el.className = "ip-gen-status" + (isError ? " ip-gen-status-err" : "");
  }

  function renderGenImages(images) {
    var root = getRoot();
    if (!root) return;
    var wrap = root.querySelector("#ip-gen-result-wrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!images || !images.length) return;
    var i;
    for (i = 0; i < images.length; i++) {
      if (!images[i] || !images[i].src) continue;
      var img = ce("img", "ip-gen-preview");
      img.src = images[i].src;
      img.alt = "生成结果";
      wrap.appendChild(img);
    }
  }

  function startImageGenerate(prompt) {
    if (generatingImage) return;
    var trimmed = String(prompt || "").trim();
    if (!trimmed) {
      showToast(ImgPrompterErr.msg("GEN_PROMPT_EMPTY"));
      return;
    }
    chrome.runtime.sendMessage({ type: "imgprompter-get-config" }, function (cfg) {
      if (chrome.runtime.lastError || !cfg || !cfg.genApiUrl || !cfg.genApiKey || !cfg.genModel) {
        showToast(ImgPrompterErr.msg("GEN_CONFIG_EMPTY"));
        chrome.runtime.sendMessage({ type: "imgprompter-open-popup", tab: "gen" });
        return;
      }
      generatingImage = true;
      setGenUiBusy(true);
      renderGenStatus("正在提交生图请求...", false);
      renderGenImages([]);
      chrome.runtime.sendMessage({ type: "imgprompter-generate", prompt: trimmed }, function (resp) {
        if (chrome.runtime.lastError) {
          generatingImage = false;
          setGenUiBusy(false);
          renderGenStatus(ImgPrompterErr.msg("NETWORK"), true);
          showToast(ImgPrompterErr.msg("NETWORK"));
          return;
        }
        if (!resp || !resp.ok) {
          generatingImage = false;
          setGenUiBusy(false);
          var genMsg = resp && resp.code ? ImgPrompterErr.msg(resp.code) : "生图请求发送失败，请重试";
          renderGenStatus(genMsg, true);
          showToast(genMsg);
        }
      });
    });
  }

  function onGenerateProgress(text, pct) {
    renderGenStatus(text || "正在生成图片...", false);
  }

  function onGenerateDone(images) {
    generatingImage = false;
    setGenUiBusy(false);
    renderGenStatus("", false);
    renderGenImages(images);
    showToast("图片已生成");
  }

  function onGenerateFail(text, code) {
    generatingImage = false;
    setGenUiBusy(false);
    var msg = text || ImgPrompterErr.msg(code || "API_URL_WRONG");
    renderGenStatus(msg, true);
    showToast(msg);
  }

  function renderTabContent(tabId) {
    var root = getRoot();
    if (!root) return;
    var wrap = root.querySelector("#ip-tab-content");
    if (!wrap) return;
    wrap.innerHTML = "";

    if (!currentJson) {
      renderRawContent(wrap);
      return;
    }

    switch (tabId) {
      case "tab-prompt":
        renderPromptTab(wrap);
        break;
      case "tab-mj":
        renderMjTab(wrap);
        break;
      case "tab-sd":
        renderSdTab(wrap);
        break;
      case "tab-json":
        renderJsonTab(wrap);
        break;
      default:
        renderPromptTab(wrap);
    }
  }

  function renderPromptTab(wrap) {
    if (!currentJson) return;

    var showZh = currentLang === "zh" || currentLang === "both";
    var showEn = currentLang === "en" || currentLang === "both";
    var zhTa = null;
    var enTa = null;

    if (showZh) {
      var zhBox = ce("div", "ip-prompt-box");
      var zhLabel = ce("div", "ip-prompt-label", "中文");
      zhLabel.style.cssText = "font-size:12px;color:#888;margin-bottom:6px;";
      zhBox.appendChild(zhLabel);
      zhTa = createPromptTextarea("ip-prompt-zh", currentJson.prompt_zh || "");
      zhBox.appendChild(zhTa);
      wrap.appendChild(zhBox);
    }

    if (showEn) {
      var enBox = ce("div", "ip-prompt-box");
      if (showZh) enBox.style.marginTop = "16px";
      var enLabel = ce("div", "ip-prompt-label", "英文");
      enLabel.style.cssText = "font-size:12px;color:#888;margin-bottom:6px;";
      enBox.appendChild(enLabel);
      enTa = createPromptTextarea("ip-prompt-en", currentJson.prompt_en || "");
      enBox.appendChild(enTa);
      wrap.appendChild(enBox);
    }

    var actions = ce("div", "ip-tab-actions");
    appendGotoGenButton(actions);
    if (showZh && zhTa) {
      var zhCopy = ce("button", "ip-btn ip-btn-outline ip-btn-sm ip-prompt-copy", "复制中文");
      zhCopy.disabled = rewriting;
      zhCopy.addEventListener("click", function () {
        copyText(zhTa.value);
      });
      actions.appendChild(zhCopy);
    }
    if (showEn && enTa) {
      var enCopy = ce("button", "ip-btn ip-btn-outline ip-btn-sm ip-prompt-copy", "复制英文");
      enCopy.disabled = rewriting;
      enCopy.addEventListener("click", function () {
        copyText(enTa.value);
      });
      actions.appendChild(enCopy);
    }
    var saveBtn = ce("button", "ip-btn ip-btn-primary ip-btn-sm", "保存为当前结果");
    saveBtn.id = "ip-prompt-save";
    saveBtn.disabled = rewriting;
    saveBtn.addEventListener("click", applyPromptSave);
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
  }

  var DETAIL_GRID_FIELDS = [
    { key: "subject", label: "主体" },
    { key: "scene", label: "场景" },
    { key: "action", label: "动作" },
    { key: "composition", label: "构图" },
    { key: "lighting", label: "光线" },
    { key: "colors", label: "色彩" },
    { key: "style", label: "风格" },
    { key: "camera", label: "镜头" },
    { key: "materials", label: "材质" },
    { key: "mood", label: "氛围" },
    { key: "usage", label: "用途" },
  ];

  function appendDetailGrid(wrap) {
    if (!currentJson) return;

    var grid = ce("div", "ip-detail-grid");
    var i;
    for (i = 0; i < DETAIL_GRID_FIELDS.length; i++) {
      var f = DETAIL_GRID_FIELDS[i];
      var val = currentJson[f.key];
      if (!val) continue;
      var cell = ce("div", "ip-detail-cell");
      var lbl = ce("div", "ip-detail-lbl", f.label);
      var valEl = ce("div", "ip-detail-val", val);
      cell.appendChild(lbl);
      cell.appendChild(valEl);
      grid.appendChild(cell);
    }

    if (currentJson.key_details && currentJson.key_details.length) {
      var kdCell = ce("div", "ip-detail-cell ip-detail-wide");
      var kdLbl = ce("div", "ip-detail-lbl", "关键细节");
      var kdVal = ce("div", "ip-detail-val", currentJson.key_details.join("、"));
      kdCell.appendChild(kdLbl);
      kdCell.appendChild(kdVal);
      grid.appendChild(kdCell);
    }

    if (grid.childNodes.length) {
      wrap.appendChild(grid);
    }
  }

  function copyDetailGridText() {
    var lines = [];
    var i;
    for (i = 0; i < DETAIL_GRID_FIELDS.length; i++) {
      var f = DETAIL_GRID_FIELDS[i];
      if (currentJson[f.key]) lines.push(f.label + ": " + currentJson[f.key]);
    }
    if (currentJson.key_details && currentJson.key_details.length) {
      lines.push("关键细节: " + currentJson.key_details.join("、"));
    }
    copyText(lines.join("\n"));
  }

  function renderMjTab(wrap) {
    var mjPrompt = (currentJson && currentJson.prompt_mj) || "";
    var mjParams = (currentJson && currentJson.mj_params) || "";
    var fallbackEn = (currentJson && currentJson.prompt_en) || "";

    var mainBox = ce("div", "ip-prompt-box");
    var mainLabel = ce("div", "ip-prompt-label", "Midjourney Prompt");
    mainLabel.style.cssText = "font-size:12px;color:#888;margin-bottom:6px;";
    mainBox.appendChild(mainLabel);

    var mainText = mjPrompt || fallbackEn || "（无内容）";
    var mainContent = ce("div", "ip-prompt-text ip-mj-text", mainText);
    mainBox.appendChild(mainContent);
    wrap.appendChild(mainBox);

    if (mjParams) {
      var paramBox = ce("div", "ip-prompt-box");
      paramBox.style.marginTop = "12px";
      var paramLabel = ce("div", "ip-prompt-label", "Parameters");
      paramLabel.style.cssText = "font-size:12px;color:#888;margin-bottom:6px;";
      paramBox.appendChild(paramLabel);
      var paramContent = ce("div", "ip-prompt-text ip-mj-params", mjParams);
      paramBox.appendChild(paramContent);
      wrap.appendChild(paramBox);
    }

    var actions = ce("div", "ip-tab-actions");
    appendGotoGenButton(actions);
    var copyBtn = ce("button", "ip-btn ip-btn-outline ip-btn-sm", "复制 MJ Prompt");
    copyBtn.addEventListener("click", function () {
      var copyStr = mjPrompt || fallbackEn || "";
      if (mjParams) copyStr += " " + mjParams;
      copyText(copyStr.trim());
    });
    actions.appendChild(copyBtn);
    wrap.appendChild(actions);
  }

  function renderSdTab(wrap) {
    var sdPrompt = (currentJson && currentJson.prompt_sd) || "";
    var sdNegative = (currentJson && currentJson.sd_negative) || "";
    var fallbackEn = (currentJson && currentJson.prompt_en) || "";

    var mainBox = ce("div", "ip-prompt-box");
    var mainLabel = ce("div", "ip-prompt-label", "Positive Prompt");
    mainLabel.style.cssText = "font-size:12px;color:#888;margin-bottom:6px;";
    mainBox.appendChild(mainLabel);

    var mainText = sdPrompt || fallbackEn || "（无内容）";
    var mainContent = ce("div", "ip-prompt-text ip-sd-text", mainText);
    mainBox.appendChild(mainContent);
    wrap.appendChild(mainBox);

    if (sdNegative) {
      var negBox = ce("div", "ip-prompt-box");
      negBox.style.marginTop = "12px";
      var negLabel = ce("div", "ip-prompt-label", "Negative Prompt");
      negLabel.style.cssText = "font-size:12px;color:#b91c1c;margin-bottom:6px;";
      negBox.appendChild(negLabel);
      var negContent = ce("div", "ip-prompt-text ip-sd-neg", sdNegative);
      negBox.appendChild(negContent);
      wrap.appendChild(negBox);
    }

    var actions = ce("div", "ip-tab-actions");
    appendGotoGenButton(actions);
    var copyBtn = ce("button", "ip-btn ip-btn-outline ip-btn-sm", "复制 SD Prompt");
    copyBtn.addEventListener("click", function () {
      var copyStr = sdPrompt || fallbackEn || "";
      copyText(copyStr);
    });
    actions.appendChild(copyBtn);

    if (sdNegative) {
      var copyNegBtn = ce("button", "ip-btn ip-btn-outline ip-btn-sm", "复制 Negative");
      copyNegBtn.addEventListener("click", function () {
        copyText(sdNegative);
      });
      actions.appendChild(copyNegBtn);
    }

    wrap.appendChild(actions);
  }

  function createJsonFieldTextarea(key, value) {
    var ta = document.createElement("textarea");
    ta.className = "ip-json-edit" + (key === "brief" ? " ip-json-edit-brief" : "");
    ta.setAttribute("data-key", key);
    ta.value = value || "";
    ta.disabled = rewriting;
    ta.addEventListener("input", function () {
      syncJsonFromEditor();
    });
    return ta;
  }

  function renderJsonEditTab(wrap) {
    if (currentFormat === "detail") {
      appendDetailGrid(wrap);
    }

    var form = ce("div", "ip-json-edit-form");
    var keys = getJsonEditFieldKeys();
    var i;

    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var fieldBox = ce("div", "ip-json-field");
      if (i > 0) fieldBox.style.marginTop = "12px";
      var label = ce("div", "ip-json-field-label", JSON_FIELD_LABELS[key] || key);
      fieldBox.appendChild(label);
      fieldBox.appendChild(createJsonFieldTextarea(key, getJsonFieldDisplayValue(key)));
      if (key === "key_details") {
        var hint = ce("div", "ip-json-field-hint", "多个细节用顿号、逗号或换行分隔");
        fieldBox.appendChild(hint);
      }
      form.appendChild(fieldBox);
    }

    wrap.appendChild(form);

    var actions = ce("div", "ip-tab-actions");
    appendGotoGenButton(actions);
    if (currentFormat === "detail") {
      var copyDetailBtn = ce("button", "ip-btn ip-btn-outline ip-btn-sm", "复制详细描述");
      copyDetailBtn.disabled = rewriting;
      copyDetailBtn.addEventListener("click", copyDetailGridText);
      actions.appendChild(copyDetailBtn);
    }
    var copyBtn = ce("button", "ip-btn ip-btn-outline ip-btn-sm ip-json-copy", "复制 JSON");
    copyBtn.disabled = rewriting;
    copyBtn.addEventListener("click", function () {
      syncJsonFromEditor();
      copyText(JSON.stringify(pickJsonForFormat(currentJson), null, 2));
    });
    actions.appendChild(copyBtn);

    var saveBtn = ce("button", "ip-btn ip-btn-primary ip-btn-sm", "保存为当前结果");
    saveBtn.id = "ip-json-save";
    saveBtn.disabled = rewriting;
    saveBtn.addEventListener("click", applyJsonSave);
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
  }

  function renderJsonTab(wrap) {
    if (isJsonEditableFormat()) {
      renderJsonEditTab(wrap);
      return;
    }

    var jsonStr = JSON.stringify(pickJsonForFormat(currentJson), null, 2);
    var box = ce("div", "ip-json-box");
    var pre = ce("pre", "ip-json-pre", jsonStr);
    box.appendChild(pre);
    wrap.appendChild(box);

    var actions = ce("div", "ip-tab-actions");
    appendGotoGenButton(actions);
    var copyBtn = ce("button", "ip-btn ip-btn-outline ip-btn-sm", "复制 JSON");
    copyBtn.addEventListener("click", function () {
      copyText(jsonStr);
    });
    actions.appendChild(copyBtn);
    wrap.appendChild(actions);
  }

  function renderRawContent(wrap) {
    var box = ce("div", "ip-raw-block");
    box.textContent = currentRaw || "（无内容）";
    wrap.appendChild(box);

    var warnText = ce("div", "ip-status-text", "AI 返回了非 JSON 内容，以上为原始文本");
    wrap.appendChild(warnText);

    var actions = ce("div", "ip-tab-actions");
    appendGotoGenButton(actions);
    var copyBtn = ce("button", "ip-btn ip-btn-outline ip-btn-sm", "复制原文");
    copyBtn.addEventListener("click", function () {
      copyText(currentRaw || "");
    });
    actions.appendChild(copyBtn);
    wrap.appendChild(actions);
  }

  function normalizeImageUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch (e) {
      return url || "";
    }
  }

  function imageSrcMatches(img, target) {
    var candidates = [];
    if (img.currentSrc) candidates.push(normalizeImageUrl(img.currentSrc));
    if (img.src) candidates.push(normalizeImageUrl(img.src));
    var j;
    for (j = 0; j < candidates.length; j++) {
      if (candidates[j] === target) return true;
    }
    return false;
  }

  function findImageBySrc(url) {
    var target = normalizeImageUrl(url);
    if (!target) return null;

    if (lastContextImage && imageSrcMatches(lastContextImage, target)) {
      var ctxRect = lastContextImage.getBoundingClientRect();
      if (ctxRect.width > 0 && ctxRect.height > 0) return lastContextImage;
    }

    var best = null;
    var bestArea = 0;
    var imgs = document.images;
    var i;
    var j;

    for (i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var candidates = [];
      if (img.currentSrc) candidates.push(normalizeImageUrl(img.currentSrc));
      if (img.src) candidates.push(normalizeImageUrl(img.src));

      var matched = false;
      for (j = 0; j < candidates.length; j++) {
        if (candidates[j] === target) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;

      var rect = img.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      var visibleW = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      var visibleH = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      var area = visibleW * visibleH;
      if (area > bestArea) {
        bestArea = area;
        best = img;
      }
    }

    return best;
  }

  function compressDataUrlForAnalyze(dataUrl) {
    return ImgPrompterImgProc.compressFromDataUrl(dataUrl).then(function (result) {
      return result.base64;
    });
  }

  function prepareImageInContent(imgSrc, domImg) {
    if (/^data:image/i.test(imgSrc)) {
      return compressDataUrlForAnalyze(imgSrc);
    }

    if (domImg) {
      return ImgPrompterImgProc.captureDataUrlFromElement(domImg)
        .catch(function () {
          if (/^https?:\/\//i.test(imgSrc)) {
            return ImgPrompterImgProc.fetchImageBlobFromPage(imgSrc);
          }
          throw new Error("IMG_LOAD_FAIL");
        })
        .then(function (dataUrl) {
          return compressDataUrlForAnalyze(dataUrl);
        });
    }

    if (/^https?:\/\//i.test(imgSrc)) {
      return ImgPrompterImgProc.fetchImageBlobFromPage(imgSrc).then(function (dataUrl) {
        return compressDataUrlForAnalyze(dataUrl);
      });
    }

    return Promise.resolve("");
  }

  function processImage(imgSrc, pageUrl) {
    currentImgSrc = imgSrc || currentImgSrc;
    currentPageUrl = pageUrl || location.href;
    currentJson = null;
    currentRaw = "";
    activeTab = "tab-prompt";

    var domImg = findImageBySrc(currentImgSrc);
    var screenshotCrop = domImg ? ImgPrompterImgProc.getViewportCrop(domImg) : null;

    showProgress(currentImgSrc, "正在准备图片...");

    function sendAnalyze(payload) {
      var msg = { type: "imgprompter-analyze" };
      if (payload.imgSrc) msg.imgSrc = payload.imgSrc;
      if (payload.pageUrl) msg.pageUrl = payload.pageUrl;
      if (payload.screenshotCrop) msg.screenshotCrop = payload.screenshotCrop;
      if (payload.imageDataUrl) {
        msg.imageDataUrl = payload.imageDataUrl;
        if (payload.imagePrepared) msg.imagePrepared = true;
      }
      chrome.runtime.sendMessage(msg, function (resp) {
        if (chrome.runtime.lastError) {
          showError(mapImageError("NETWORK"), "分析失败");
          return;
        }
        if (resp && resp.ok) return;
        if (resp && resp.code) {
          showError(ImgPrompterErr.msg(resp.code), "分析失败");
        }
      });
    }

    function runAnalyze(imageDataUrl, imagePrepared) {
      var analyzePayload = {
        imgSrc: currentImgSrc,
        pageUrl: currentPageUrl,
        screenshotCrop: screenshotCrop,
      };
      if (imageDataUrl) {
        analyzePayload.imageDataUrl = imageDataUrl;
        analyzePayload.imagePrepared = !!imagePrepared;
      }
      sendAnalyze(analyzePayload);
    }

    prepareImageInContent(currentImgSrc, domImg).then(function (imageDataUrl) {
      runAnalyze(imageDataUrl, true);
    }).catch(function () {
      runAnalyze("", false);
    });
  }

  document.addEventListener("contextmenu", function (e) {
    if (e.target && e.target.tagName === "IMG") {
      lastContextImage = e.target;
    }
  }, true);

  function mapImageError(code) {
    var s = (code || "").toLowerCase();
    if (s === "img_too_large" || /too.large/i.test(s)) return ImgPrompterErr.msg("IMG_TOO_LARGE");
    if (s === "img_load_timeout" || /img.*timeout/i.test(s)) return ImgPrompterErr.msg("IMG_LOAD_TIMEOUT");
    if (s === "img_compress_fail" || /compress/i.test(s)) return ImgPrompterErr.msg("IMG_COMPRESS_FAIL");
    if (s === "img_screenshot_fail") return ImgPrompterErr.msg("IMG_SCREENSHOT_FAIL");
    if (/401|403|unauthorized|forbidden/i.test(s)) return "图片访问被拒绝，可能是网站限制，请换一张图片尝试";
    if (/404|not.found/i.test(s)) return "图片地址无效或已失效，请刷新页面后重试";
    if (/timeout|timed.out|abort/i.test(s)) return ImgPrompterErr.msg("TIMEOUT");
    if (/network|fetch|failed.to.fetch/i.test(s)) return ImgPrompterErr.msg("NETWORK");
    return ImgPrompterErr.msg("IMG_LOAD_FAIL");
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === "imgprompter-no-config") {
      showNoConfig();
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-start") {
      processImage(msg.src, msg.pageUrl);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-progress") {
      updateProgress(msg.text, msg.pct);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-error") {
      showError(msg.text, "分析失败");
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-result") {
      showResult(msg.json, msg.raw, false, msg.format);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-rewrite-done") {
      rewriting = false;
      showResult(msg.json, msg.raw, true, msg.format);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-rewrite-fail") {
      rewriting = false;
      restoreModifyUi();
      showToast(msg.text || "重写失败，已保留上次结果");
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-generate-progress") {
      onGenerateProgress(msg.text, msg.pct);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-generate-done") {
      onGenerateDone(msg.images || []);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "imgprompter-generate-fail") {
      onGenerateFail(msg.text, msg.code);
      sendResponse({ ok: true });
      return;
    }
  });
})();
