const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const outDir = __dirname;
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function htmlShell(width, height, body, extra = "") {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
body{font-family:"Microsoft YaHei","Segoe UI",sans-serif;background:#f6f1e7;color:#1e2329}
.canvas{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:linear-gradient(135deg,#f7efe0 0%,#e9f5ef 52%,#dfe9ff 100%)}
.grain{position:absolute;inset:0;opacity:.2;background-image:radial-gradient(#111 0.5px,transparent 0.5px);background-size:7px 7px;mix-blend-mode:multiply}
.blob{position:absolute;border-radius:999px;filter:blur(2px);opacity:.85}
.b1{background:#ffbe6f}.b2{background:#85d6b5}.b3{background:#8aa8ff}.b4{background:#ff8c8c}
.card{position:absolute;background:rgba(255,255,255,.78);border:1px solid rgba(40,55,70,.12);box-shadow:0 24px 60px rgba(48,60,72,.18);backdrop-filter:blur(14px)}
.badge{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(32,45,60,.14);background:rgba(255,255,255,.62);border-radius:999px;color:#354256;font-weight:700}
.title{font-weight:900;letter-spacing:-.06em;color:#161b22}
.subtitle{color:#44505f;line-height:1.45}
.pill{display:inline-flex;align-items:center;border-radius:999px;background:#17202a;color:#fff;font-weight:700}
.imageMock{background:linear-gradient(145deg,#25415d,#5fa587 55%,#f0c66c);position:relative;overflow:hidden}
.imageMock:before{content:"";position:absolute;left:16%;top:14%;width:42%;height:60%;border-radius:48% 48% 42% 42%;background:linear-gradient(#f7d6b2,#b46a52)}
.imageMock:after{content:"";position:absolute;right:8%;bottom:8%;width:68%;height:32%;border-radius:50% 50% 0 0;background:rgba(255,255,255,.34)}
.prompt{font-family:"Cascadia Mono","Consolas",monospace;color:#27313c;line-height:1.45}
.toolbar{display:flex;gap:10px;align-items:center}
.dot{width:10px;height:10px;border-radius:50%}
${extra}
</style>
</head>
<body>${body}</body>
</html>`;
}

function writeHtml(name, width, height, body, extra) {
  const file = path.join(outDir, `${name}.html`);
  fs.writeFileSync(file, htmlShell(width, height, body, extra), "utf8");
  return file;
}

function screenshot(htmlFile, pngName, width, height) {
  const pngPath = path.join(outDir, pngName);
  const url = `file:///${htmlFile.replace(/\\/g, "/")}`;
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${width},${height}`,
    `--screenshot=${pngPath}`,
    url,
  ];
  cp.execFileSync(edge, args, { stdio: "inherit" });
  return pngPath;
}

const small = writeHtml(
  "small-promotional-tile",
  440,
  280,
  `<div class="canvas">
    <div class="grain"></div>
    <div class="blob b1" style="width:170px;height:170px;left:-58px;top:-54px"></div>
    <div class="blob b2" style="width:210px;height:210px;right:-92px;bottom:-74px"></div>
    <div class="card imageMock" style="width:142px;height:96px;right:34px;top:42px;border-radius:24px"></div>
    <div class="card" style="width:178px;height:112px;right:26px;bottom:34px;border-radius:22px;padding:16px">
      <div class="toolbar"><span class="dot" style="background:#f56"></span><span class="dot" style="background:#fdc14d"></span><span class="dot" style="background:#4bc57d"></span></div>
      <div class="prompt" style="font-size:10px;margin-top:10px">portrait, soft light,<br>cinematic details,<br>structured prompt</div>
    </div>
    <div style="position:absolute;left:34px;top:34px;width:230px">
      <div class="badge" style="font-size:12px;padding:7px 11px">AI 图片提示词</div>
      <div class="title" style="font-size:42px;line-height:.95;margin-top:18px">看图写<br>提示词</div>
      <div class="subtitle" style="font-size:15px;margin-top:14px">右键图片，生成结构化 AI 生图提示词</div>
    </div>
  </div>`
);

const large = writeHtml(
  "large-promotional-tile",
  1400,
  560,
  `<div class="canvas">
    <div class="grain"></div>
    <div class="blob b1" style="width:380px;height:380px;left:-110px;top:-130px"></div>
    <div class="blob b2" style="width:520px;height:520px;right:-170px;bottom:-210px"></div>
    <div class="blob b3" style="width:260px;height:260px;left:720px;top:70px"></div>
    <div style="position:absolute;left:88px;top:72px;width:560px">
      <div class="badge" style="font-size:18px;padding:11px 18px">浏览器扩展 · 自配 AI API</div>
      <div class="title" style="font-size:88px;line-height:.92;margin-top:32px">看图写提示词</div>
      <div class="subtitle" style="font-size:27px;margin-top:28px">网页图片右键分析，生成中文、英文与 JSON 结构化 AI 生图提示词。</div>
      <div style="display:flex;gap:16px;margin-top:34px">
        <div class="pill" style="font-size:18px;padding:14px 22px">右键图片</div>
        <div class="pill" style="font-size:18px;padding:14px 22px;background:#315b4b">结构化输出</div>
        <div class="pill" style="font-size:18px;padding:14px 22px;background:#495a99">本地保存配置</div>
      </div>
    </div>
    <div class="card imageMock" style="width:350px;height:236px;right:308px;top:86px;border-radius:38px"></div>
    <div class="card" style="width:432px;height:300px;right:86px;top:170px;border-radius:36px;padding:30px">
      <div class="toolbar"><span class="dot" style="background:#f56"></span><span class="dot" style="background:#fdc14d"></span><span class="dot" style="background:#4bc57d"></span><span style="font-weight:800;margin-left:10px;color:#44505f">Prompt Result</span></div>
      <div class="prompt" style="font-size:20px;margin-top:28px">主体：人物肖像<br>光线：柔和侧光<br>风格：电影感写实<br>输出：中文 / English / JSON</div>
    </div>
  </div>`
);

function screenshotPage(name, heading, sub, body, visual) {
  return writeHtml(
    name,
    1280,
    800,
    `<div class="canvas">
      <div class="grain"></div>
      <div class="blob b1" style="width:360px;height:360px;left:-130px;top:-120px"></div>
      <div class="blob b2" style="width:430px;height:430px;right:-150px;bottom:-160px"></div>
      <div style="position:absolute;left:64px;top:54px">
        <div class="badge" style="font-size:17px;padding:10px 16px">看图写提示词</div>
        <div class="title" style="font-size:58px;line-height:1;margin-top:20px">${heading}</div>
        <div class="subtitle" style="font-size:22px;margin-top:18px;width:560px">${sub}</div>
      </div>
      <div class="card" style="left:64px;bottom:58px;width:492px;height:350px;border-radius:32px;padding:30px">${body}</div>
      <div class="card" style="right:72px;top:86px;width:570px;height:620px;border-radius:40px;padding:34px">${visual}</div>
    </div>`
  );
}

const screenshots = [
  screenshotPage(
    "screenshot-1-settings",
    "配置你的 AI API",
    "API 地址、密钥和模型均由用户自行填写，配置保存在浏览器本地。",
    `<div style="font-size:18px;font-weight:900;margin-bottom:20px">设置页</div>
     <div class="prompt" style="font-size:17px">API 地址<br><span style="background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px 14px;display:block;margin:8px 0 18px">https://api.example.com/v1</span>API Key<br><span style="background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px 14px;display:block;margin:8px 0 18px">••••••••••••••••</span>模型名称<br><span style="background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px 14px;display:block;margin-top:8px">gpt-4o</span></div>`,
    `<div class="title" style="font-size:36px">本地配置</div><div class="subtitle" style="font-size:20px;margin-top:14px">不内置密钥，不代理请求。</div><div style="margin-top:38px;display:grid;gap:18px"><div class="pill" style="font-size:22px;padding:18px 24px">保存配置</div><div class="pill" style="font-size:22px;padding:18px 24px;background:#315b4b">测试连接</div><div class="pill" style="font-size:22px;padding:18px 24px;background:#9a3f3f">清除配置</div></div>`
  ),
  screenshotPage(
    "screenshot-2-context-menu",
    "右键图片开始分析",
    "在网页图片上打开右键菜单，选择生成 AI 图片提示词。",
    `<div class="imageMock" style="height:230px;border-radius:26px"></div><div style="margin-top:22px;background:#fff;border-radius:18px;padding:18px 20px;font-size:20px;font-weight:800;box-shadow:0 16px 35px rgba(0,0,0,.12)">生成 AI 图片提示词</div>`,
    `<div class="imageMock" style="height:350px;border-radius:32px"></div><div style="margin-top:26px;font-size:22px;font-weight:900">只在用户主动右键时处理图片</div><div class="subtitle" style="font-size:19px;margin-top:10px">不会主动扫描网页或收集浏览记录。</div>`
  ),
  screenshotPage(
    "screenshot-3-progress",
    "分析进度可见",
    "读取图片、压缩图片、调用 AI 与解析结果都有明确状态提示。",
    `<div style="font-size:24px;font-weight:900">AI 图片提示词分析</div><div style="height:16px;background:#e8edf2;border-radius:999px;margin-top:34px;overflow:hidden"><div style="width:68%;height:100%;background:linear-gradient(90deg,#315b4b,#8aa8ff)"></div></div><div class="subtitle" style="font-size:20px;margin-top:26px">AI 正在分析图片，请稍候...</div>`,
    `<div class="title" style="font-size:34px">错误也能看懂</div><div style="margin-top:32px;display:grid;gap:18px"><div class="pill" style="font-size:20px;padding:17px 22px">图片下载超时</div><div class="pill" style="font-size:20px;padding:17px 22px;background:#9a6a31">模型不支持图片</div><div class="pill" style="font-size:20px;padding:17px 22px;background:#9a3f3f">API Key 无效</div></div>`
  ),
  screenshotPage(
    "screenshot-4-result",
    "生成结构化提示词",
    "结果可复制，适合继续用于 AI 绘图工具。",
    `<div class="prompt" style="font-size:18px">中文提示词<br><br>电影感写实人像，柔和侧光，浅景深，细腻皮肤质感，温暖色调...</div><button style="margin-top:28px;border:0;border-radius:14px;background:#17202a;color:#fff;padding:14px 22px;font-size:18px;font-weight:800">复制中文</button>`,
    `<pre class="prompt" style="font-size:18px;white-space:pre-wrap;background:#17202a;color:#eff6ff;border-radius:24px;padding:26px;height:100%">{
  "subject": "portrait",
  "lighting": "soft side light",
  "style": "cinematic realistic",
  "mood": "warm and calm"
}</pre>`
  ),
  screenshotPage(
    "screenshot-5-rewrite",
    "二次修改提示词",
    "用快捷风格或自定义要求重写结果。",
    `<div style="display:flex;flex-wrap:wrap;gap:12px"><span class="pill" style="font-size:18px;padding:12px 18px">写实</span><span class="pill" style="font-size:18px;padding:12px 18px;background:#495a99">动漫</span><span class="pill" style="font-size:18px;padding:12px 18px;background:#315b4b">电影感</span><span class="pill" style="font-size:18px;padding:12px 18px;background:#9a6a31">产品摄影</span></div><div style="margin-top:30px;background:#fff;border-radius:16px;padding:18px;font-size:20px;color:#44505f">改成水彩画风格...</div>`,
    `<div class="title" style="font-size:38px">整体重写</div><div class="subtitle" style="font-size:22px;margin-top:18px">让主体、光线、构图和风格保持一致，而不是简单替换单词。</div><div class="imageMock" style="height:310px;border-radius:30px;margin-top:38px"></div>`
  ),
  screenshotPage(
    "screenshot-6-history",
    "保留最近历史",
    "最近 20 条分析记录保存在浏览器本地，可复制或清空。",
    `<div style="display:grid;gap:16px"><div style="background:#fff;border-radius:18px;padding:18px"><b>电影感人像</b><br><span style="color:#667">5/18 05:42</span></div><div style="background:#fff;border-radius:18px;padding:18px"><b>产品摄影静物</b><br><span style="color:#667">5/18 05:36</span></div><div style="background:#fff;border-radius:18px;padding:18px"><b>赛博朋克街景</b><br><span style="color:#667">5/18 05:20</span></div></div>`,
    `<div class="title" style="font-size:38px">本地历史</div><div class="subtitle" style="font-size:22px;margin-top:18px">不上传到作者服务器。用户可以随时清空历史记录和 API 配置。</div><div style="margin-top:42px"><span class="pill" style="font-size:22px;padding:18px 28px;background:#9a3f3f">清空历史</span></div>`
  ),
];

screenshot(small, "small-promotional-tile-440x280.png", 440, 280);
screenshot(large, "large-promotional-tile-1400x560.png", 1400, 560);
screenshots.forEach((file, idx) => {
  screenshot(file, `screenshot-${idx + 1}-1280x800.png`, 1280, 800);
});

console.log("Generated store assets in", outDir);
