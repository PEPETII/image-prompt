# 项目规则 — 修改代码时必须遵守

## 核心原则

- **严格遵循现有代码风格**，不引入新范式、新习惯或"更好"的写法
- **最小改动**：只修改任务直接涉及的行，不顺手重构、不整理无关代码
- **不添加注释**：除非用户明确要求，禁止添加任何代码注释、TODO、说明文字
- **不引入依赖**：禁止添加任何 npm 包、CDN、框架、工具库，只用原生 API

## 技术约束

- 纯原生 JavaScript（ES5 风格，var + function + IIFE）
- 不使用 ES6 module（import/export），使用 importScripts() 或全局命名空间
- 全局模块使用 ImgPrompterXxx 命名空间（如 ImgPrompterStore）
- CSS 类名使用 ip- 前缀
- 消息类型使用 imgprompter- 前缀
- 不使用箭头函数、模板字符串、解构、async/await、class 语法
- 不使用 const/let，统一使用 var

## 设置 → 结果面板 Tab → Tab 内容 映射规则

### 格式决定显示哪些 Tab

| format 值 | 显示的 Tab（按顺序） |
|-----------|---------------------|
| plain | 提示词 |
| json | JSON |
| detail | JSON |
| mj | Midjourney → 提示词 → JSON |
| sd | Stable Diffusion → 提示词 → JSON |

### 语言 + 格式决定 Tab 内容

| 语言设置 | 格式 | Tab | 内容 |
|----------|------|-----|------|
| 中文 (zh) | plain | 提示词 | 中文提示词 (prompt_zh) |
| 英文 (en) | plain | 提示词 | 英文提示词 (prompt_en) |
| 双语 (both) | plain | 提示词 | 中文 + 英文（上下排列） |
| 任意 | json | JSON | 完整 JSON（含 prompt_zh/prompt_en + 核心字段） |
| 任意 | detail | JSON | 完整 JSON（含 prompt_zh/prompt_en + 详细字段） |
| 中文 (zh) | mj | 提示词 | 中文提示词 |
| 中文 (zh) | mj | Midjourney | prompt_mj + mj_params |
| 英文 (en) | sd | 提示词 | 英文提示词 |
| 英文 (en) | sd | Stable Diffusion | prompt_sd + sd_negative |

### 各格式对应的 JSON 字段结构

| format | lang = zh | lang = en | lang = both |
|--------|-----------|-----------|-------------|
| json | brief, prompt_zh, subject, scene, style, composition, lighting | brief, prompt_en, subject, scene, style, composition, lighting | brief, prompt_zh, prompt_en, subject, scene, style, composition, lighting |
| detail | brief, prompt_zh, + 详细字段 | brief, prompt_en, + 详细字段 | brief, prompt_zh, prompt_en, + 详细字段 |
| mj | prompt_mj, mj_params | prompt_mj, mj_params | prompt_mj, mj_params |
| sd | prompt_sd, sd_negative | prompt_sd, sd_negative | prompt_sd, sd_negative |
| plain | 不输出 JSON，用 --- 分隔纯文本 | 不输出 JSON，用 --- 分隔纯文本 | 不输出 JSON，用 --- 分隔纯文本 |

### plain 格式解析规则

- AI 返回内容用 --- 分隔中英文
- prompt_zh = 第一段（lines[0]）
- prompt_en = 最后一段（lines[lines.length - 1]）
- lang=zh 时 prompt_en 为空
- lang=en 时 prompt_zh 为空

### MJ/SD 格式 fallback 规则

- renderMjTab: prompt_mj 为空时 fallback 到 prompt_en
- renderSdTab: prompt_sd 为空时 fallback 到 prompt_en

## UI 约束

- overlay 使用 Shadow DOM 隔离（host: imgprompter-host，root: imgprompter-root）
- popup 是普通 HTML 页面，不使用 Shadow DOM
- overlay CSS 通过 fetch 动态加载后注入 shadow root
- overlay 支持拖动（pointer events）、关闭、格式切换
- 修改输入框支持 Enter 提交
- 不改变现有 DOM 结构，除非任务明确要求
- 文案使用中文，除非任务要求英文

## 模块加载方式

### bg.js（Service Worker）通过 importScripts 加载

- store.js, err.js, prompts.js, parse.js, net.js
- 注意：不是 ES module，是全局脚本

### content_scripts（manifest.json 声明）加载顺序

- core/err.js → core/prompts.js → core/imgproc.js → ui/overlay.js
- 注意：store.js 和 net.js 不在 content scripts 中

## 消息通信完整列表

### bg → overlay

| 消息 type | 说明 |
|-----------|------|
| imgprompter-start | 携带图片 URL，触发分析流程 |
| imgprompter-no-config | 用户未配置 API |
| imgprompter-progress | 进度更新（text + pct） |
| imgprompter-result | 分析完成（json/raw/format） |
| imgprompter-error | 错误展示 |
| imgprompter-rewrite-done | 重写成功 |
| imgprompter-rewrite-fail | 重写失败 |

### overlay → bg

| 消息 type | 说明 |
|-----------|------|
| imgprompter-fetch-image | 通过 SW 代理 fetch 图片（解决跨域） |
| imgprompter-analyze | 发送 base64 图片数据，启动分析 |
| imgprompter-rewrite | 发送当前 JSON + 修改指令，启动重写 |

### popup → bg

| 消息 type | 说明 |
|-----------|------|
| imgprompter-get-config | 获取配置 |
| imgprompter-get-history | 获取历史 |
| imgprompter-clear-history | 清空历史 |
| imgprompter-open-popup | 在新标签页打开 popup.html |

### 关键规则

- 所有 bg.js onMessage handler 必须同步返回 true（保持消息通道开放，用于异步响应）
- sendToTab() 先尝试 sendMessage，失败则动态注入 content scripts 后重试

## 图片处理规则

| 参数 | 值 |
|------|-----|
| 最大原始图片 | 8MB |
| 压缩触发边长 | 超过 768px |
| 压缩目标边长 | 长边缩放到 768px |
| JPEG 质量 | 0.80 |
| 图片加载超时 | 15s |
| bg fetch 代理超时 | 20s |
| 不超过 768px 的图片 | 不压缩，直接使用 |

## API 规则

| 参数 | 值 |
|------|-----|
| 测试超时 | 15s |
| 分析/重写超时 | 60s |
| Provider 检测 | URL 含 anthropic.com → anthropic，否则 → openai |
| Responses API 检测 | URL 以 /responses 结尾时使用 Responses 格式 |

### max_tokens 按格式

| format | max_tokens |
|--------|-----------|
| plain | 500 |
| mj | 700 |
| sd | 800 |
| json | 1000 |
| detail | 1500 |

### 端点自动补全规则

- anthropic: /v1/messages 结尾 → 不变；/v1 结尾 → 追加 /messages；其他 → 追加 /v1/messages
- openai: /chat/completions 结尾 → 不变；/responses 结尾 → 不变；/v[数字] 结尾 → 追加 /chat/completions；其他 → 追加 /chat/completions

### 思考模式（thinking）参数注入

- 配置项: cfg.thinking（布尔值，默认 false）
- Qwen 模型（model 含 qwen）: 注入 enable_thinking: true
- OpenAI o1/o3 系列: 注入 reasoning_effort: "medium"（Chat）或 reasoning: { effort: "medium" }（Responses）
- Anthropic: 注入 thinking: { type: "enabled", budget_tokens: 4096 }，同时 max_tokens 提升至至少 8192
- 注意：不要对非 o 系列 OpenAI 兼容模型注入 reasoning_effort，会导致异常变慢

## 存储规则

| 参数 | 值 |
|------|-----|
| 配置 key | imgprompter_cfg |
| 历史 key | imgprompter_hist |
| 最大历史条数 | 20 |
| 新记录位置 | unshift 到头部 |
| data URL 图片 | 不存入历史 |
| URL 长度限制 | 超过 512 字符截断 |

### 历史记录保存字段（按 format + lang）

| format | lang = zh | lang = en | lang = both |
|--------|-----------|-----------|-------------|
| plain/json/detail | prompt_zh | prompt_en | prompt_zh + prompt_en |
| mj | prompt_mj, mj_params | prompt_mj, mj_params | prompt_mj, mj_params |
| sd | prompt_sd, sd_negative | prompt_sd, sd_negative | prompt_sd, sd_negative |
| 所有格式 | time, imgSrc, brief, json（完整对象） |

## 配置验证规则

- API URL 不能为空，必须以 https:// 开头
- API Key 不能为空
- 模型名称不能为空
- 默认 lang: zh
- 默认 format: json
- 默认 thinking: false

## JSON 解析规则（parse.js）

1. 先 strip markdown code block（```json ... ```）
2. 尝试 JSON.parse
3. 失败则提取 { 到 } 之间的内容再尝试
4. 仍失败则返回 raw 文本（ok: false）

## 风格预设（6 种）

realistic, anime, cinematic, product, cyberpunk, 3dicon

## 安全约束

- API Key 仅存 chrome.storage.local，日志不输出完整密钥
- API URL 必须 HTTPS
- 不向用户配置的 API 之外的任何地址发送数据

## 禁止行为

- 不添加 README、文档、CHANGELOG（除非用户要求）
- 不修改 manifest.json 的权限/版本（除非任务要求）
- 不改变现有消息类型命名或通信流程
- 不在代码中添加 emoji
- 不创建新的目录结构（除非任务要求）
- 不修改 store-assets/ 目录内容
- 不修改 .npmcache/ 目录内容
- 不改变 Tab 显示逻辑（格式决定 Tab，语言决定内容）

## 添加新功能指引

| 功能 | 修改位置 |
|------|---------|
| 新 API 提供商 | core/net.js 的 detectProvider + buildXxx + parseXxx |
| 新风格预设 | core/prompts.js 的 STYLE_PRESETS |
| 新输出格式 | core/prompts.js 模板 + ui/overlay.js tabs + core/net.js max_tokens + core/bg.js 历史保存 + ui/popup.js 历史渲染 |
| 新设置项 | ui/popup.js 表单 + core/store.js 配置对象 |
| 新错误码 | core/err.js 映射表 + core/net.js mapErrorToCode |
