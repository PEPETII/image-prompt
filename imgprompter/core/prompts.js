var ImgPrompterPrompts = (function () {
  "use strict";

  var STYLE_PRESETS = {
    realistic: "改成写实风格，强调真实光影、细节纹理、自然色彩和可落地的摄影镜头语言。",
    anime: "改成动漫风格，强调二次元角色塑造、线条感、色块关系和插画氛围。",
    cinematic: "改成电影感写实风格，强化镜头语言、叙事氛围、戏剧化光线和空间层次。",
    product: "改成产品摄影风格，强化商品主体、材质、棚拍光线、商业构图和展示用途。",
    cyberpunk: "改成赛博朋克风格，强化霓虹色彩、未来科技感、夜景光效和都市氛围。",
    "3dicon": "改成 3D 图标风格，强调圆润体块、干净背景、柔和渐变和图标化表现。",
  };

  var JSON_ANALYZE_FIELDS = [
    "brief",
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
    "key_details",
    "prompt_zh",
    "prompt_en",
    "negative_prompt",
  ];

  var JSON_CORE_FIELDS = JSON_ANALYZE_FIELDS;
  var DETAIL_FIELDS = JSON_ANALYZE_FIELDS;

  var JSON_STRUCTURE_FIELD_ORDER = [
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

  var JSON_GEN_FIELD_ORDER = JSON_STRUCTURE_FIELD_ORDER;

  function buildFieldTemplate(lang, fields) {
    var out = [];
    var i;
    var key;
    for (i = 0; i < fields.length; i++) {
      key = fields[i];
      if (key === "prompt_zh" && lang === "en") continue;
      if (key === "prompt_en" && lang === "zh") continue;
      if (key === "key_details") out.push('"key_details":[]');
      else out.push('"' + key + '":""');
    }
    return "{" + out.join(",") + "}";
  }

  function buildJsonFormat(lang, format) {
    if (format === "json" || format === "detail") return buildFieldTemplate(lang, JSON_ANALYZE_FIELDS);
    if (format === "mj") return '{"prompt_mj":"","mj_params":""}';
    if (format === "sd") return '{"prompt_sd":"","sd_negative":""}';
    return "";
  }

  function buildLanguageRule(lang, format) {
    if (format === "plain") {
      if (lang === "zh") return "只输出一段中文提示词。";
      if (lang === "en") return "只输出一段英文提示词。";
      return "先输出中文提示词，再输出英文提示词，中间只允许使用一行 --- 分隔。";
    }

    if (lang === "zh") {
      return "结构字段与 prompt_zh 使用中文；prompt_en 填空字符串；negative_prompt 可用中文。";
    }
    if (lang === "en") {
      return "All structural fields, prompt_en and negative_prompt must be in English; prompt_zh must be empty string.";
    }
    return "结构字段用中文；prompt_zh 中文；prompt_en 英文且符合英文生图习惯；negative_prompt 英文。";
  }

  function buildJsonAnalyzeSysPrompt() {
    return [
      "你是一名专业的视觉分析师、图像导演和 AI 生图提示词工程师。",
      "根据用户上传的图片，准确分析并反推可用于 AI 生图的高质量提示词。",
      "目标不是写夸张文案，而是还原真实视觉信息：主体、场景、动作、构图、光线、色彩、风格、镜头、材质、氛围和关键细节。",
      "分析原则：优先描述可见信息；不编造无法确认的品牌、人物身份、IP、地点；不用空泛词（高级感、好看、震撼、高清、精美等）除非能说明原因；",
      "无法判断的字段填空字符串或空数组；适合 Midjourney、Stable Diffusion、GPT Image、Gemini Image 等模型。",
      "必须输出严格合法 JSON，不要 Markdown，不要解释，不要 JSON 外任何文字。",
    ].join("");
  }

  function buildJsonAnalyzeUserPrompt(lang, format) {
    var jsonFmt = buildJsonFormat(lang, format);
    return [
      buildLanguageRule(lang, format),
      "重点分析：主体、外观服饰材质状态、场景环境、构图、光线、色彩、风格、镜头景别、材质纹理、情绪氛围、影响复现的关键细节。",
      "brief 不超过40字；key_details 3-8条；有文字只描述可见内容与排版，不猜小字。",
      "prompt_zh 为完整中文生图提示词，自然流畅，整合主体/场景/构图/光线/色彩/风格/镜头/材质/氛围，可直接复制生图。",
      "prompt_en 为完整英文生图提示词，符合英文生图习惯，不要仅中文直译。",
      "negative_prompt 根据画面类型写负面提示，不要固定套模板。",
      "输出前自检：prompt_zh 与 prompt_en 能否复现原图约80%以上的主体、风格、构图、光线与氛围。",
      "严格按以下 JSON 模板输出，不得增减字段：",
      jsonFmt,
    ].join("\n");
  }

  function buildPlainAnalyzeRules() {
    return "反推图为可生图提示词。只写可见内容，不脑补。海报/拼贴需标明。无Markdown无解释。";
  }

  function buildPlainAnalyzePrompt(lang) {
    return {
      sysPrompt: buildPlainAnalyzeRules() + "只输出一段可直接用于生图的自然语言提示词。",
      userPrompt: [
        buildLanguageRule(lang, "plain"),
        "输出一段可直接生图的自然语言提示词：主体、环境、构图、光线、色彩、风格。可见文字/地标优先写入。不要JSON。",
      ].join(" "),
    };
  }

  function buildJsonAnalyzePrompt(lang, format) {
    return {
      sysPrompt: buildJsonAnalyzeSysPrompt(),
      userPrompt: buildJsonAnalyzeUserPrompt(lang, format),
    };
  }

  function buildMjAnalyzePrompt() {
    return {
      sysPrompt: buildPlainAnalyzeRules() + "你必须输出适合 Midjourney 的结果 JSON。",
      userPrompt: [
        "只输出合法 JSON。",
        "prompt_mj 必须是英文、逗号分隔、标签式 Midjourney prompt，不要写完整自然语言句子。",
        "prompt_mj 重点覆盖 subject、environment、composition、lighting、palette、style、texture、camera feel、mood。",
        "mj_params 必须只包含 Midjourney 参数，例如 --ar、--stylize、--chaos、--v，不要重复正文内容。",
        "如果无法确定参数，可给出最稳妥的少量参数。",
        "输出模板：",
        buildJsonFormat("en", "mj"),
      ].join("\n"),
    };
  }

  function buildSdAnalyzePrompt() {
    return {
      sysPrompt: buildPlainAnalyzeRules() + "你必须输出适合 Stable Diffusion 的结果 JSON。",
      userPrompt: [
        "只输出合法 JSON。",
        "prompt_sd 必须是英文正向提示词，使用 Stable Diffusion 常见的紧凑标签式或短语式写法，不要写散文。",
        "prompt_sd 要突出主体、环境、构图、光线、色彩、材质、风格和清晰度特征。",
        "sd_negative 必须是英文 negative prompt，聚焦低质量、模糊、畸形、错误解剖、脏乱背景、错误手指等常见问题。",
        "输出模板：",
        buildJsonFormat("en", "sd"),
      ].join("\n"),
    };
  }

  function buildAnalyzePrompt(lang, format) {
    if (format === "plain") return buildPlainAnalyzePrompt(lang);
    if (format === "json" || format === "detail") return buildJsonAnalyzePrompt(lang, format);
    if (format === "mj") return buildMjAnalyzePrompt();
    if (format === "sd") return buildSdAnalyzePrompt();
    return buildJsonAnalyzePrompt(lang, "json");
  }

  function buildRewritePrompt(lang, format) {
    var base = [
      "你是专业的 AI 生图提示词重写助手。",
      "你必须保留用户明确要求保留的核心画面信息，并按修改要求整体重写。",
      "不要输出解释，不要输出 Markdown，不要输出模板之外的内容。",
    ].join("");

    if (format === "plain") {
      return {
        sysPrompt: base + "输出自然语言提示词。",
        userPrompt: [
          buildLanguageRule(lang, "plain"),
          "根据当前结果和修改要求，重写为更适合直接生成图片的自然语言提示词。",
          "保留原图的视觉 DNA：构图、光线、色彩、材质和氛围，除非用户明确要求改变。",
        ].join(" "),
      };
    }

    if (format === "json" || format === "detail") {
      return {
        sysPrompt: buildJsonAnalyzeSysPrompt(),
        userPrompt: [
          buildLanguageRule(lang, format),
          "请基于当前 JSON 结果和修改要求整体重写，保持字段稳定，并同步更新 prompt_zh、prompt_en 与 negative_prompt。",
          "输出模板：",
          buildJsonFormat(lang, format),
        ].join("\n"),
      };
    }

    if (format === "mj") {
      return {
        sysPrompt: base + "输出 Midjourney 结果 JSON。",
        userPrompt: [
          "只输出合法 JSON。",
          "根据当前结果和修改要求，重写 prompt_mj 与 mj_params。",
          "保持 Midjourney 风格：逗号分隔、短标签、少废话。",
          "输出模板：",
          buildJsonFormat("en", "mj"),
        ].join("\n"),
      };
    }

    return {
      sysPrompt: base + "输出 Stable Diffusion 结果 JSON。",
      userPrompt: [
        "只输出合法 JSON。",
        "根据当前结果和修改要求，重写 prompt_sd 与 sd_negative。",
        "保持 Stable Diffusion 风格：紧凑标签、强特征词、单独 negative prompt。",
        "输出模板：",
        buildJsonFormat("en", "sd"),
      ].join("\n"),
    };
  }

  function buildImageGenPromptFromJson(json, format, lang) {
    if (!json || typeof json !== "object") return "";
    var useLang = lang || "zh";
    var zh = String(json.prompt_zh || "").replace(/^\s+|\s+$/g, "");
    var en = String(json.prompt_en || "").replace(/^\s+|\s+$/g, "");
    if (useLang === "en" && en) return en;
    if (useLang === "both") {
      if (en) return en;
      if (zh) return zh;
    } else if (zh) {
      return zh;
    }
    var parts = [];
    var order = JSON_GEN_FIELD_ORDER;
    var i;
    var key;
    var val;
    for (i = 0; i < order.length; i++) {
      key = order[i];
      val = String(json[key] || "").replace(/^\s+|\s+$/g, "");
      if (val) parts.push(val);
    }
    if (json.key_details) {
      if (Array.isArray(json.key_details)) {
        val = json.key_details.join("、").replace(/^\s+|\s+$/g, "");
      } else {
        val = String(json.key_details || "").replace(/^\s+|\s+$/g, "");
      }
      if (val) parts.push(val);
    }
    var text = parts.join("，");
    if (!text) text = String(json.brief || "").replace(/^\s+|\s+$/g, "");
    return text;
  }

  return {
    STYLE_PRESETS: STYLE_PRESETS,
    JSON_ANALYZE_FIELDS: JSON_ANALYZE_FIELDS,
    JSON_CORE_FIELDS: JSON_CORE_FIELDS,
    DETAIL_FIELDS: DETAIL_FIELDS,
    buildJsonFormat: buildJsonFormat,
    buildAnalyzePrompt: buildAnalyzePrompt,
    buildRewritePrompt: buildRewritePrompt,
    buildImageGenPromptFromJson: buildImageGenPromptFromJson,
  };
})();
