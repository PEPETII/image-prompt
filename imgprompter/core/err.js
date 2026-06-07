var ImgPrompterErr = (function () {
  "use strict";

  var map = {
    API_URL_EMPTY: "请先填写 API 地址",
    API_URL_NOT_HTTPS: "API 地址必须是 HTTPS 开头",
    API_KEY_EMPTY: "请先填写 API Key",
    MODEL_EMPTY: "请先填写模型名称",
    API_KEY_INVALID: "API Key 无效，请检查后重新填写",
    API_URL_WRONG: "接口地址无法访问，请检查 API 地址",
    MODEL_MISSING: "该模型不存在，请确认模型名称",
    MODEL_NO_VISION: "当前模型可能不支持图片理解。请更换支持视觉输入的模型，或在设置页选择视觉模型",
    OPENAI_VISION_5X: "OpenAI 识图请使用 gpt-5 系列（如 gpt-5.2、gpt-5-mini），不支持 gpt-4 及更早模型",
    QUOTA_EXCEEDED: "API 配额或余额不足，请检查账户余额、套餐或计费状态",
    RATE_LIMITED: "请求频率受限，请稍后重试",
    API_OVERLOADED: "AI 服务当前过载，请稍后重试",
    CORS_BLOCKED: "请求被浏览器跨域策略拦截。这是浏览器扩展直连 API 时的常见问题，请确认该 API 支持浏览器跨域请求，或改用支持 CORS 的兼容网关",
    RESPONSE_NOT_JSON: "API 返回了非 JSON 格式的响应，请检查 API 地址是否正确",
    TIMEOUT: "请求超时，请检查网络或 API 服务状态，也可尝试更快模型",
    NETWORK: "网络连接失败，请检查网络设置",
    IMG_LOAD_FAIL: "图片读取失败，可能是网站防盗链、图片跨域限制或懒加载失败，请换一张图片或页面尝试",
    IMG_LOAD_TIMEOUT: "图片下载超时，请检查网络或换一张图片尝试",
    IMG_COMPRESS_FAIL: "图片压缩失败，请换一张图片尝试",
    IMG_TOO_LARGE: "图片过大（超过 8MB），请换一张较小的图片",
    IMG_SCREENSHOT_FAIL: "无法截取页面图片，请换一张图片或换一个页面尝试",
    INJECT_BLOCKED: "当前页面不允许注入脚本，请换一个页面尝试",
    AI_EMPTY: "AI 返回内容为空，请重试",
    AI_NOT_JSON: "AI 返回了非 JSON 内容，已显示原始文本",
    COPY_FAIL: "复制失败，请手动选中文字后复制",
    STORAGE_FAIL: "本地存储失败，请检查浏览器存储空间",
    BAD_REQUEST: "请求格式有误，请检查 API 地址和模型名称",
    GEN_CONFIG_EMPTY: "请先在设置页的「生图设置」中填写 API 地址、Key 和模型",
    GEN_PROMPT_EMPTY: "请先输入生图提示词",
    GEN_NO_IMAGE: "生图接口未返回图片，请检查模型是否支持生图",
    GEN_UNSUPPORTED: "当前 API 地址暂不支持自动生图，请改用 OpenAI 兼容或 Gemini 地址",
    IMG_SRC_EMPTY: "该历史记录没有可复用图片地址，只能查看结果",
    RECORD_EMPTY: "历史记录内容为空，无法打开",
  };

  function msg(code) {
    return map[code] || "未知错误，请稍后重试";
  }

  return { msg: msg };
})();
