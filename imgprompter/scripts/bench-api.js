var fs = require("fs");
var path = require("path");
var vm = require("vm");
var http = require("http");
var https = require("https");

var ROOT = path.join(__dirname, "..");
var CORE = path.join(ROOT, "core");

function loadModule(filePath, extraContext) {
  var code = fs.readFileSync(filePath, "utf8");
  var ctx = {
    console: console,
    ImgPrompterPrompts: null,
    ImgPrompterParse: null,
    ImgPrompterNet: null,
  };
  if (extraContext) {
    var k;
    for (k in extraContext) {
      if (Object.prototype.hasOwnProperty.call(extraContext, k)) ctx[k] = extraContext[k];
    }
  }
  vm.runInNewContext(code, ctx);
  return ctx;
}

function parseArgs(argv) {
  var out = {
    apiUrl: process.env.IMGPROMPTER_API_URL || "",
    apiKey: process.env.IMGPROMPTER_API_KEY || "",
    model: process.env.IMGPROMPTER_MODEL || "",
    lang: process.env.IMGPROMPTER_LANG || "zh",
    format: process.env.IMGPROMPTER_FORMAT || "json",
    thinking: process.env.IMGPROMPTER_THINKING === "1" || process.env.IMGPROMPTER_THINKING === "true",
    image: process.env.IMGPROMPTER_IMAGE || "",
    imageUrl: process.env.IMGPROMPTER_IMAGE_URL || "",
    rounds: 1,
  };
  var i;
  for (i = 2; i < argv.length; i++) {
    var a = argv[i];
    if (a === "--api-url" && argv[i + 1]) { out.apiUrl = argv[++i]; continue; }
    if (a === "--api-key" && argv[i + 1]) { out.apiKey = argv[++i]; continue; }
    if (a === "--model" && argv[i + 1]) { out.model = argv[++i]; continue; }
    if (a === "--lang" && argv[i + 1]) { out.lang = argv[++i]; continue; }
    if (a === "--format" && argv[i + 1]) { out.format = argv[++i]; continue; }
    if (a === "--thinking") { out.thinking = true; continue; }
    if (a === "--image" && argv[i + 1]) { out.image = argv[++i]; continue; }
    if (a === "--image-url" && argv[i + 1]) { out.imageUrl = argv[++i]; continue; }
    if (a === "--rounds" && argv[i + 1]) { out.rounds = Math.max(1, parseInt(argv[++i], 10) || 1); continue; }
  }
  return out;
}

function nowMs() {
  return Date.now();
}

function fmtMs(ms) {
  if (ms < 1000) return ms + " ms";
  return (ms / 1000).toFixed(2) + " s";
}

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function readImageDataUrl(imagePath) {
  var buf = fs.readFileSync(imagePath);
  var ext = path.extname(imagePath).toLowerCase();
  var mime = "image/jpeg";
  if (ext === ".png") mime = "image/png";
  else if (ext === ".webp") mime = "image/webp";
  else if (ext === ".gif") mime = "image/gif";
  return "data:" + mime + ";base64," + buf.toString("base64");
}

function fetchBuffer(url) {
  return new Promise(function (resolve, reject) {
    var lib = /^https:/i.test(url) ? https : http;
    var t0 = nowMs();
    lib.get(url, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode));
        return;
      }
      var chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () {
        var buf = Buffer.concat(chunks);
        resolve({ buffer: buf, ms: nowMs() - t0, bytes: buf.length });
      });
    }).on("error", reject);
  });
}

function bufferToDataUrl(buffer, contentType) {
  return "data:" + (contentType || "image/jpeg") + ";base64," + buffer.toString("base64");
}

function postJson(url, headers, body, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var u = new URL(url);
    var lib = u.protocol === "https:" ? https : http;
    var payload = JSON.stringify(body);
    var t0 = nowMs();
    var ttfb = null;
    var req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      method: "POST",
      headers: Object.assign({}, headers, {
        "Content-Length": Buffer.byteLength(payload),
      }),
    }, function (res) {
      var chunks = [];
      res.on("data", function (chunk) {
        if (ttfb === null) ttfb = nowMs() - t0;
        chunks.push(chunk);
      });
      res.on("end", function () {
        var text = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: res.statusCode,
          text: text,
          totalMs: nowMs() - t0,
          ttfbMs: ttfb === null ? nowMs() - t0 : ttfb,
          bodyBytes: Buffer.byteLength(payload),
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs || 60000, function () {
      req.destroy(new Error("Timeout"));
    });
    req.write(payload);
    req.end();
  });
}

function buildExtensionAnalyzeBody(cfg, imageDataUrl, Prompts, Net) {
  var provider = Net.detectProvider(cfg.apiUrl);
  var prompts = Prompts.buildAnalyzePrompt(cfg.lang, cfg.format);
  var body = {
    model: cfg.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompts.sysPrompt + "\n\n" + prompts.userPrompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  };
  if (cfg.thinking && provider !== "anthropic" && provider !== "gemini") {
    var m = (cfg.model || "").toLowerCase();
    if (/qwen|deepseek|glm|doubao|moonshot|kimi/.test(m)) {
      body.extra_body = { enable_thinking: true };
    }
  }
  return body;
}

function summarizeResponse(text) {
  try {
    var data = JSON.parse(text);
    var content = "";
    if (data.choices && data.choices[0] && data.choices[0].message) {
      content = data.choices[0].message.content || "";
    }
    var usage = data.usage || {};
    return {
      ok: true,
      contentLen: content.length,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    };
  } catch (e) {
    return { ok: false, preview: String(text || "").slice(0, 200) };
  }
}

function printCaseResult(name, result) {
  console.log("  HTTP " + result.status + " | 总耗时 " + fmtMs(result.totalMs) + " | 首字节 " + fmtMs(result.ttfbMs) + " | 请求体 " + fmtBytes(result.bodyBytes));
  var info = summarizeResponse(result.text);
  if (info.ok) {
    console.log("  tokens: prompt=" + info.promptTokens + " completion=" + info.completionTokens + " total=" + info.totalTokens + " | 回复长度 " + info.contentLen);
  } else if (result.status >= 400) {
    console.log("  错误: " + (info.preview || result.text.slice(0, 300)));
  }
}

function avg(arr) {
  if (!arr.length) return 0;
  var s = 0;
  var i;
  for (i = 0; i < arr.length; i++) s += arr[i];
  return Math.round(s / arr.length);
}

function runCase(name, fn, rounds) {
  return fn().then(function (first) {
    var totals = [first.totalMs];
    var ttfbs = [first.ttfbMs];
    var chain = Promise.resolve();
    var r;
    for (r = 2; r <= rounds; r++) {
      chain = chain.then(function () {
        return fn();
      }).then(function (res) {
        totals.push(res.totalMs);
        ttfbs.push(res.ttfbMs);
      });
    }
    return chain.then(function () {
      console.log("\n[" + name + "]");
      printCaseResult(name, first);
      if (rounds > 1) {
        console.log("  " + rounds + " 轮平均: 总耗时 " + fmtMs(avg(totals)) + " | 首字节 " + fmtMs(avg(ttfbs)));
      }
      return { name: name, totalMs: first.totalMs, ttfbMs: first.ttfbMs, avgTotalMs: avg(totals), bodyBytes: first.bodyBytes };
    });
  });
}

function main() {
  var args = parseArgs(process.argv);
  if (!args.apiUrl || !args.apiKey || !args.model) {
    console.log("用法: node scripts/bench-api.js --api-url URL --api-key KEY --model MODEL [选项]");
    console.log("");
    console.log("环境变量: IMGPROMPTER_API_URL, IMGPROMPTER_API_KEY, IMGPROMPTER_MODEL");
    console.log("可选: --lang zh --format json --thinking --image path.jpg --image-url https://... --rounds 3");
    process.exit(1);
  }

  var parseCtx = loadModule(path.join(CORE, "parse.js"));
  var promptsCtx = loadModule(path.join(CORE, "prompts.js"));
  var netCtx = loadModule(path.join(CORE, "net.js"), { ImgPrompterParse: parseCtx.ImgPrompterParse });
  var Prompts = promptsCtx.ImgPrompterPrompts;
  var Net = netCtx.ImgPrompterNet;

  var cfg = {
    apiUrl: args.apiUrl,
    apiKey: args.apiKey,
    model: args.model,
    lang: args.lang,
    format: args.format,
    thinking: args.thinking,
  };

  var provider = Net.detectProvider(cfg.apiUrl);
  var endpoint = Net.resolveEndpoint(cfg.apiUrl, provider);
  var headers = { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey };

  console.log("ImgPrompter API 速度测试");
  console.log("endpoint: " + endpoint);
  console.log("model: " + cfg.model);
  console.log("provider: " + provider);
  console.log("lang/format: " + cfg.lang + " / " + cfg.format + (cfg.thinking ? " (thinking=开)" : " (thinking=关)"));

  var imageDataUrlPromise = Promise.resolve("");
  if (args.image && fs.existsSync(args.image)) {
    imageDataUrlPromise = Promise.resolve(readImageDataUrl(args.image));
    console.log("图片: 本地 " + args.image);
  } else if (args.imageUrl) {
    console.log("图片: 远程 " + args.imageUrl);
    imageDataUrlPromise = fetchBuffer(args.imageUrl).then(function (r) {
      console.log("  下载耗时 " + fmtMs(r.ms) + " | 大小 " + fmtBytes(r.bytes));
      return bufferToDataUrl(r.buffer, "image/jpeg");
    });
  } else {
    var samplePath = path.join(__dirname, "bench-sample.jpg");
    if (fs.existsSync(samplePath)) {
      imageDataUrlPromise = Promise.resolve(readImageDataUrl(samplePath));
      console.log("图片: 内置样例 bench-sample.jpg");
    } else {
      console.log("图片: 未指定，视觉测试将跳过（可用 --image 或 --image-url）");
    }
  }

  imageDataUrlPromise.then(function (imageDataUrl) {
    var imageBytes = imageDataUrl ? Buffer.byteLength(imageDataUrl, "utf8") : 0;
    if (imageDataUrl) {
      console.log("  base64 data URL 大小约 " + fmtBytes(imageBytes));
    }

    var cases = [];

    cases.push(runCase("1. 官网式纯文本探测 (hi, max_tokens=5)", function () {
      return postJson(endpoint, headers, {
        model: cfg.model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      });
    }, args.rounds));

    cases.push(runCase("2. 扩展 testConnection 等价", function () {
      return postJson(endpoint, headers, {
        model: cfg.model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      }, 15000);
    }, args.rounds));

    if (imageDataUrl) {
      cases.push(runCase("3. 扩展真实识图请求 (完整 prompt + 图片)", function () {
        var body = buildExtensionAnalyzeBody(cfg, imageDataUrl, Prompts, Net);
        return postJson(endpoint, headers, body, 60000);
      }, args.rounds));

      if (cfg.thinking) {
        cases.push(runCase("4. 识图 + thinking 开启 (与设置一致)", function () {
          var body = buildExtensionAnalyzeBody(cfg, imageDataUrl, Prompts, Net);
          return postJson(endpoint, headers, body, 60000);
        }, args.rounds));
      } else {
        cases.push(runCase("4. 识图 + thinking 强制开启 (对比)", function () {
          var body = buildExtensionAnalyzeBody(Object.assign({}, cfg, { thinking: true }), imageDataUrl, Prompts, Net);
          return postJson(endpoint, headers, body, 60000);
        }, 1));
      }

      cases.push(runCase("5. 识图 plain 格式 (max_tokens=500, 无 JSON 约束)", function () {
        var plainCfg = Object.assign({}, cfg, { format: "plain", thinking: false });
        var body = buildExtensionAnalyzeBody(plainCfg, imageDataUrl, Prompts, Net);
        return postJson(endpoint, headers, body, 60000);
      }, 1));
    }

    var chain = Promise.resolve([]);
    var i;
    for (i = 0; i < cases.length; i++) {
      (function (idx) {
        chain = chain.then(function (acc) {
          return cases[idx].then(function (row) {
            acc.push(row);
            return acc;
          });
        });
      })(i);
    }

    return chain.then(function (rows) {
      console.log("\n========== 汇总 ==========");
      var j;
      for (j = 0; j < rows.length; j++) {
        if (!rows[j]) continue;
        console.log(rows[j].name + ": " + fmtMs(rows[j].totalMs) + " (请求体 " + fmtBytes(rows[j].bodyBytes) + ")");
      }
      console.log("\n说明:");
      console.log("- 官网测试通道通常是「纯文本 hi」，与扩展「识图+长 prompt+大 max_tokens」不可直接对比");
      console.log("- 扩展额外还有：图片下载、压缩、消息通信、storage 读写（本脚本未计入）");
      console.log("- doubao-seed 系列默认带 reasoning，completion tokens 会明显高于纯文本探测");
      if (imageDataUrl && imageBytes > 200 * 1024) {
        console.log("- 当前图片 base64 较大 (" + fmtBytes(imageBytes) + ")，上传时间会显著拉长 API 等待");
      }
    });
  }).catch(function (err) {
    console.error("测试失败:", err.message || err);
    process.exit(1);
  });
}

main();
