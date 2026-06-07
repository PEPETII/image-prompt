# ImgPrompter

浏览器扩展（Chrome / Edge，Manifest V3）。在网页图片上右键，即可调用你自己配置的 AI 平台进行识图分析，输出可直接用于生图的提示词。

## 功能

- 右键网页图片生成提示词
- 支持 `plain`、`json`、`detail`、`mj`、`sd` 五种输出格式
- 支持中文、英文、中英双语
- 支持结果二次重写和 6 种风格快捷改写
- 支持历史记录保存、查看、复制、清空
- 支持“去生图”并自动带入提示词
- 识图设置与生图设置分开保存
- 保留自定义 API 地址和自定义模型名称能力

## 支持平台

- 识图：OpenAI、Gemini、豆包、阿里、Kimi、硅基流动、小米 MiMo、自定义兼容接口
- 生图：OpenAI、Gemini、豆包、阿里（DashScope Qwen-Image）、硅基流动、自定义兼容接口

说明：

- 内置候选模型仅作为快捷选择，实际可用性取决于你的账号、地区、套餐和 API 权限。
- 即使选择了内置平台，仍然可以手动输入自定义模型名称。
- 维护者更新候选：编辑 `imgprompter/core/model_presets.js`（详细步骤见 [docs/model-config.md](./docs/model-config.md)）。

## 内置模型候选

### 识图

- OpenAI：`gpt-5.2`、`gpt-5-mini`、`gpt-5-nano`
- Gemini：`gemini-2.5-pro`、`gemini-2.5-flash`、`gemini-2.5-flash-lite`

### 生图

- OpenAI：`gpt-image-1.5`、`gpt-image-1`、`gpt-image-1-mini`、`image2`
- Gemini：`gemini-2.5-flash-image`、`gemini-2.5-flash-image-preview`、`gemini-2.0-flash-preview-image-generation`

## 安装

1. 打开 `chrome://extensions` 或 `edge://extensions`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择 `imgprompter/` 目录

## 使用

1. 打开扩展设置页，填写识图 API 地址、API Key、模型名称
2. 如需生图，再单独填写生图设置
3. 在网页图片上右键，点击“生成 AI 图片提示词”
4. 在页面内结果面板中查看、复制、编辑或去生图

## 输出格式

- `plain`：直接输出自然语言提示词
- `json`：稳定结构化 JSON
- `detail`：更详细的结构化 JSON
- `mj`：Midjourney prompt + 参数
- `sd`：Stable Diffusion 正向 prompt + negative prompt

## 配置说明

- API Key 仅保存在浏览器本地 `chrome.storage.local`
- 扩展不会把 API Key 上传到作者服务器
- 图片会发送到你自己配置的 AI 平台进行分析或生成
- 错误模型、错误 API 地址、余额不足、限流、超时、返回异常等都会走统一错误提示

## 隐私

- 扩展本身不提供中转服务器
- 不收集账号、图片或提示词到作者服务器
- 历史记录仅保存在本地浏览器
- 详细说明见 [PRIVACY.md](./PRIVACY.md)

## 目录

```text
imgprompter/
  manifest.json
  core/
    bg.js
    err.js
    imgproc.js
    model_presets.js
    net.js
    parse.js
    perf.js
    prompts.js
    store.js
  ui/
    overlay.css
    overlay.js
    popup.css
    popup.html
    popup.js
  res/
  docs/
```

## 开源协议

本项目按 MIT 协议开源。发布仓库时请同时包含根目录 `LICENSE`。
