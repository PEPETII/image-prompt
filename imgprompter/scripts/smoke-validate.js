const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

function runFiles(files) {
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    URL,
    atob: (value) => Buffer.from(String(value), "base64").toString("binary"),
    btoa: (value) => Buffer.from(String(value), "binary").toString("base64"),
  });

  files.forEach((file) => {
    const code = fs.readFileSync(path.join(root, file), "utf8");
    vm.runInContext(code, context, { filename: file });
  });

  return context;
}

function createChromeStub() {
  const storage = {};
  return {
    runtime: {
      lastError: null,
    },
    storage: {
      local: {
        get(key, cb) {
          if (Array.isArray(key)) {
            const out = {};
            key.forEach((item) => {
              out[item] = storage[item];
            });
            cb(out);
            return;
          }
          if (typeof key === "string") {
            cb({ [key]: storage[key] });
            return;
          }
          cb({ ...storage });
        },
        set(data, cb) {
          Object.assign(storage, data);
          if (cb) cb();
        },
        remove(key, cb) {
          if (Array.isArray(key)) {
            key.forEach((item) => delete storage[item]);
          } else {
            delete storage[key];
          }
          if (cb) cb();
        },
      },
    },
    __storage: storage,
  };
}

function runStoreFiles(files) {
  const chrome = createChromeStub();
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    chrome,
  });

  files.forEach((file) => {
    const code = fs.readFileSync(path.join(root, file), "utf8");
    vm.runInContext(code, context, { filename: file });
  });

  return context;
}

function validateManifest() {
  const manifest = readJson("manifest.json");
  assert(manifest.manifest_version === 3, "manifest_version must be 3");
  assert(manifest.background && manifest.background.service_worker === "core/bg.js", "service worker must be core/bg.js");
  assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, "content_scripts must exist");
  assert(manifest.action && manifest.action.default_popup === "ui/popup.html", "default_popup must be ui/popup.html");
  assert(manifest.options_ui && manifest.options_ui.page === "ui/popup.html", "options_ui page must be ui/popup.html");
}

function validateProvidersAndPrompts() {
  const context = runFiles([
    "core/providers/index.js",
    "core/providers/openai_compatible.js",
    "core/providers/openai.js",
    "core/providers/gemini.js",
    "core/providers/ali.js",
    "core/prompts.js",
    "core/err.js",
  ]);

  const providers = context.ImgPrompterProviders;
  const prompts = context.ImgPrompterPrompts;
  const err = context.ImgPrompterErr;

  assert(providers, "ImgPrompterProviders missing");
  assert(prompts, "ImgPrompterPrompts missing");
  assert(err, "ImgPrompterErr missing");

  assert(providers.detectProvider("https://api.openai.com/v1") === "openai", "openai provider detection failed");
  assert(providers.detectProvider("https://generativelanguage.googleapis.com/v1beta") === "gemini", "gemini provider detection failed");
  assert(providers.detectProvider("https://dashscope.aliyuncs.com/compatible-mode/v1") === "ali", "ali provider detection failed");
  assert(providers.detectProvider("https://example.com/v1") === "openai", "custom openai-compatible provider detection failed");

  const compat = providers.get("openai_compatible");
  const openai = providers.get("openai");
  const gemini = providers.get("gemini");
  const ali = providers.get("ali");

  assert(compat.resolveEndpoint("https://api.openai.com/v1", "openai") === "https://api.openai.com/v1/chat/completions", "openai-compatible endpoint resolution failed");
  assert(openai.resolveEndpoint("https://api.openai.com/v1", "openai") === "https://api.openai.com/v1/responses", "openai responses endpoint resolution failed");
  assert(gemini.resolveEndpoint("https://generativelanguage.googleapis.com/v1beta", "gemini-2.5-flash") === "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "gemini endpoint resolution failed");
  assert(ali.resolveImageEndpoint("https://dashscope.aliyuncs.com/compatible-mode/v1").indexOf("/services/aigc/multimodal-generation/generation") > -1, "ali image endpoint resolution failed");

  const plainPrompt = prompts.buildAnalyzePrompt("zh", "plain");
  const jsonPrompt = prompts.buildAnalyzePrompt("both", "json");
  const mjPrompt = prompts.buildAnalyzePrompt("en", "mj");

  assert(plainPrompt && plainPrompt.sysPrompt && plainPrompt.userPrompt, "plain prompt build failed");
  assert(jsonPrompt.userPrompt.indexOf("\"prompt_zh\"") > -1, "json prompt template missing prompt_zh");
  assert(jsonPrompt.userPrompt.indexOf("\"prompt_en\"") > -1, "json prompt template missing prompt_en");
  assert(mjPrompt.userPrompt.indexOf("\"prompt_mj\"") > -1, "mj prompt template missing prompt_mj");

  assert(prompts.STYLE_PRESETS.realistic, "style preset realistic missing");
  assert(prompts.STYLE_PRESETS["3dicon"], "style preset 3dicon missing");

  assert(err.msg("API_KEY_EMPTY"), "error mapping missing API_KEY_EMPTY");
  assert(err.msg("IMG_LOAD_FAIL"), "error mapping missing IMG_LOAD_FAIL");
}

function validateStoreConfigFlow() {
  const context = runStoreFiles([
    "core/model_presets.js",
    "core/store.js",
  ]);

  const store = context.ImgPrompterStore;
  const chrome = context.chrome;
  assert(store, "ImgPrompterStore missing");

  let savedErr = null;
  store.saveConfig({
    platform: "custom",
    apiUrl: "https://api.example.com/v1",
    apiKey: "sk-test",
    model: "gpt-5-mini",
    lang: "en",
    format: "json",
    thinking: false,
    imageQualityMode: "high",
    genPlatform: "openai",
    genApiUrl: "https://api.openai.com/v1",
    genApiKey: "sk-gen",
    genModel: "gpt-image-1.5",
  }, function (err) {
    savedErr = err;
  });
  assert(savedErr === null, "saveConfig returned error");

  let effective = null;
  store.getConfig(function (cfg) {
    effective = cfg;
  });

  assert(effective, "getConfig did not return config");
  assert(effective.platform === "custom", "effective platform mismatch");
  assert(effective.apiUrl === "https://api.example.com/v1", "effective apiUrl mismatch");
  assert(effective.model === "gpt-5-mini", "effective model mismatch");
  assert(effective.lang === "en", "effective lang mismatch");
  assert(effective.imageQualityMode === "high", "effective imageQualityMode mismatch");
  assert(effective.genPlatform === "openai", "effective genPlatform mismatch");
  assert(effective.genModel === "gpt-image-1.5", "effective genModel mismatch");

  assert(chrome.__storage.imgprompter_cfg, "config was not written to storage");
  assert(store.isOpenAIVisionModel5x("gpt-5-mini") === true, "OpenAI 5x model check failed");
  assert(store.isOpenAIVisionContext("openai", "https://api.openai.com/v1") === true, "OpenAI vision context check failed");
}

function main() {
  validateManifest();
  validateProvidersAndPrompts();
  validateStoreConfigFlow();
  console.log("smoke ok");
}

main();
