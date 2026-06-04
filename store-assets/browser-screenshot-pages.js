const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const outDir = __dirname;
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function shell(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:1280px;height:800px;overflow:hidden}
body{font-family:"Microsoft YaHei","Segoe UI",sans-serif;background:#f5efe4;color:#19212b}
.page{position:relative;width:1280px;height:800px;overflow:hidden;background:linear-gradient(135deg,#f7efdf 0%,#e8f5ed 54%,#dfe8ff 100%)}
.page:before{content:"";position:absolute;inset:0;opacity:.15;background-image:radial-gradient(#1f2937 .6px,transparent .6px);background-size:8px 8px}
.orb{position:absolute;border-radius:50%;filter:blur(2px);opacity:.82}
.o1{width:360px;height:360px;left:-130px;top:-120px;background:#ffbe6f}
.o2{width:460px;height:460px;right:-160px;bottom:-180px;background:#88d8b2}
.wrap{position:relative;z-index:1;display:grid;grid-template-columns:470px 1fr;gap:54px;padding:58px 68px}
.intro{padding-top:18px}
.badge{display:inline-flex;border:1px solid rgba(20,30,44,.16);background:rgba(255,255,255,.66);border-radius:999px;padding:10px 16px;font-weight:800;color:#344055}
h1{font-size:56px;line-height:1;margin:22px 0 18px;letter-spacing:-.055em}
.sub{font-size:22px;line-height:1.48;color:#4b5665}
.panel{background:rgba(255,255,255,.76);border:1px solid rgba(40,55,70,.14);box-shadow:0 24px 64px rgba(44,58,76,.18);border-radius:34px;padding:30px;min-height:600px;backdrop-filter:blur(14px)}
.popup{width:430px;min-height:600px;background:#fff;border-radius:28px;box-shadow:0 22px 60px rgba(32,45,64,.2);overflow:hidden}
.popupHead{display:flex;align-items:center;gap:14px;padding:24px 26px;background:#17202a;color:#fff}
.logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#ffbe6f,#88d8b2)}
.tabs{display:flex;padding:14px;background:#f4f6f8;gap:10px}
.tab{padding:10px 20px;border-radius:999px;background:#17202a;color:#fff;font-weight:800}.tab.alt{background:#fff;color:#435063}
.field{margin:20px 24px}.label{font-weight:900;margin-bottom:8px}.input{height:46px;border:1px solid #d7dde5;border-radius:14px;background:#f9fafb;padding:12px 14px;color:#586273}.hint{font-size:13px;color:#737f8e;margin-top:7px}
.btnRow{display:flex;gap:10px;margin:26px 24px}.btn{padding:13px 16px;border-radius:14px;background:#17202a;color:#fff;font-weight:900}.btn.light{background:#eef2f5;color:#263241}.btn.danger{background:#b54949}
.browser{background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 22px 60px rgba(32,45,64,.18)}
.bar{height:54px;background:#eef2f5;display:flex;align-items:center;gap:8px;padding:0 20px}.dot{width:12px;height:12px;border-radius:50%}.addr{height:30px;border-radius:999px;background:#fff;flex:1;margin-left:12px}
.photo{height:390px;margin:28px;border-radius:28px;background:linear-gradient(145deg,#25415d,#5fa587 55%,#f0c66c);position:relative;overflow:hidden}
.photo:before{content:"";position:absolute;left:20%;top:14%;width:34%;height:66%;border-radius:48% 48% 42% 42%;background:linear-gradient(#f7d6b2,#b46a52)}
.menu{position:absolute;left:92px;top:322px;width:260px;border-radius:18px;background:#fff;padding:12px;box-shadow:0 18px 45px rgba(0,0,0,.24)}.menuItem{padding:15px;border-radius:12px;font-weight:900}.menuItem.active{background:#17202a;color:#fff}
.overlay{position:absolute;right:88px;top:164px;width:390px;background:#fff;border-radius:28px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:24px}
.progress{height:14px;border-radius:999px;background:#e6ebf1;overflow:hidden;margin:22px 0}.progress div{height:100%;background:linear-gradient(90deg,#315b4b,#8aa8ff)}
.prompt{font-family:"Cascadia Mono","Consolas",monospace;line-height:1.55}
.json{background:#17202a;color:#eaf2ff;border-radius:22px;padding:24px;white-space:pre-wrap;font-size:17px}
.chips{display:flex;flex-wrap:wrap;gap:12px}.chip{border-radius:999px;background:#17202a;color:#fff;padding:12px 18px;font-weight:900}.chip.green{background:#315b4b}.chip.blue{background:#495a99}.chip.gold{background:#9a6a31}
.hist{display:grid;gap:16px}.histCard{display:flex;gap:16px;align-items:center;background:#fff;border-radius:20px;padding:16px}.thumb{width:78px;height:58px;border-radius:14px;background:linear-gradient(145deg,#25415d,#5fa587 55%,#f0c66c)}
</style>
</head>
<body><div class="page"><div class="orb o1"></div><div class="orb o2"></div>${body}</div></body>
</html>`;
}

const pages = [
  ["real-screenshot-1-settings", "设置页", `<div class="wrap"><div class="intro"><div class="badge">Screenshot 1</div><h1>配置你的 AI API</h1><div class="sub">API 地址、API Key 与模型名称由用户自行配置，保存在浏览器本地。</div></div><div class="panel"><div class="popup"><div class="popupHead"><div class="logo"></div><div style="font-size:22px;font-weight:900">看图写提示词</div></div><div class="tabs"><div class="tab">设置</div><div class="tab alt">历史</div></div><div class="field"><div class="label">API 地址</div><div class="input">https://api.example.com/v1</div><div class="hint">请填写完整的 HTTPS 地址</div></div><div class="field"><div class="label">API Key</div><div class="input">••••••••••••••••••••</div><div class="hint">不上传到作者服务器；调用配置的 API 时用于认证</div></div><div class="field"><div class="label">模型名称</div><div class="input">gpt-4o</div></div><div class="btnRow"><div class="btn light">测试连接</div><div class="btn">保存配置</div><div class="btn danger">清除</div></div></div></div></div>`],
  ["real-screenshot-2-context-menu", "右键菜单", `<div class="wrap"><div class="intro"><div class="badge">Screenshot 2</div><h1>右键图片开始分析</h1><div class="sub">在网页图片上选择“生成 AI 图片提示词”，只在用户主动操作时处理图片。</div></div><div class="panel"><div class="browser"><div class="bar"><span class="dot" style="background:#f56"></span><span class="dot" style="background:#fdc14d"></span><span class="dot" style="background:#4bc57d"></span><div class="addr"></div></div><div class="photo"></div><div class="menu"><div class="menuItem">复制图片</div><div class="menuItem active">生成 AI 图片提示词</div><div class="menuItem">另存为...</div></div></div></div></div>`],
  ["real-screenshot-3-progress", "分析进度", `<div class="wrap"><div class="intro"><div class="badge">Screenshot 3</div><h1>分析过程可见</h1><div class="sub">读取图片、压缩图片、调用 AI 与解析结果都有明确进度提示。</div></div><div class="panel"><div class="browser"><div class="bar"><span class="dot" style="background:#f56"></span><span class="dot" style="background:#fdc14d"></span><span class="dot" style="background:#4bc57d"></span><div class="addr"></div></div><div class="photo"></div><div class="overlay"><div style="font-size:24px;font-weight:900">AI 图片提示词分析</div><div class="progress"><div style="width:68%"></div></div><div class="sub" style="font-size:18px">AI 正在分析图片，请稍候...</div></div></div></div></div>`],
  ["real-screenshot-4-result", "结果面板", `<div class="wrap"><div class="intro"><div class="badge">Screenshot 4</div><h1>生成结构化提示词</h1><div class="sub">支持中文、英文和 JSON 结果，可直接复制到 AI 绘图工具。</div></div><div class="panel"><div class="overlay" style="position:static;width:auto;box-shadow:none"><div style="font-size:24px;font-weight:900;margin-bottom:20px">看图写提示词</div><div class="prompt" style="font-size:18px;background:#f5f7fa;border-radius:18px;padding:20px">中文提示词：电影感写实人像，柔和侧光，浅景深，细腻皮肤质感，温暖色调...</div><pre class="json" style="margin-top:18px">{
  "subject": "portrait",
  "lighting": "soft side light",
  "style": "cinematic realistic",
  "mood": "warm and calm"
}</pre><div class="btnRow" style="margin-left:0"><div class="btn">复制中文</div><div class="btn light">复制 JSON</div></div></div></div></div>`],
  ["real-screenshot-5-rewrite", "二次修改", `<div class="wrap"><div class="intro"><div class="badge">Screenshot 5</div><h1>二次修改提示词</h1><div class="sub">通过快捷风格或自定义要求，整体重写提示词。</div></div><div class="panel"><div style="font-size:26px;font-weight:900;margin-bottom:24px">风格快捷修改</div><div class="chips"><span class="chip">写实</span><span class="chip blue">动漫</span><span class="chip green">电影感</span><span class="chip gold">产品摄影</span><span class="chip blue">赛博朋克</span><span class="chip green">3D 图标</span></div><div style="margin-top:34px;background:#fff;border-radius:20px;padding:20px;font-size:22px;color:#596574">输入修改要求，例如：改成水彩画风格...</div><div style="margin-top:30px" class="btn">修改</div></div></div>`],
  ["real-screenshot-6-history", "历史记录", `<div class="wrap"><div class="intro"><div class="badge">Screenshot 6</div><h1>保留最近历史</h1><div class="sub">最近 20 条结果保存在浏览器本地，可复制或清空。</div></div><div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px"><div style="font-size:28px;font-weight:900">分析历史</div><div class="btn danger">清空历史</div></div><div class="hist"><div class="histCard"><div class="thumb"></div><div><b>电影感人像</b><br><span style="color:#6b7684">复制中文 / 复制 JSON</span></div></div><div class="histCard"><div class="thumb"></div><div><b>产品摄影静物</b><br><span style="color:#6b7684">复制中文 / 复制 JSON</span></div></div><div class="histCard"><div class="thumb"></div><div><b>赛博朋克街景</b><br><span style="color:#6b7684">复制中文 / 复制 JSON</span></div></div></div></div></div>`],
];

for (const [name, title, body] of pages) {
  fs.writeFileSync(path.join(outDir, `${name}.html`), shell(title, body), "utf8");
}

for (const [name] of pages) {
  const html = path.join(outDir, `${name}.html`);
  const png = path.join(outDir, `${name}-1280x800.png`);
  cp.execFileSync(edge, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1280,800",
    `--screenshot=${png}`,
    `file:///${html.replace(/\\/g, "/")}`,
  ], { stdio: "inherit" });
}
