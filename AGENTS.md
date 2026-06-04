# ImgPrompter Agent 协作指南

## 项目概述

Chrome / Edge 浏览器扩展（Manifest V3），右键图片调用 AI 视觉模型反推生图提示词。原生 JavaScript，无构建步骤，无框架依赖。

详细规则与禁止行为见 `.github/copilot-instructions.md`。本文档只补充该文件未覆盖或已偏离实际代码的关键事实。

## 加载与调试

- 加载：`chrome://extensions` → 开发者模式 → 加载已解压扩展 → 选择 `imgprompter/` 目录（不是仓库根）
- Service Worker 日志：扩展详情页 → 点击「背景页」
- Content Script / overlay 日志：目标页面 DevTools Console
- 无 `npm` / `build` / `test` / `lint` 命令 —— 验证只能通过在浏览器里实际加载扩展
- 仓库根 `.npmcache/` 可能缓存过 `@playwright/mcp`（与扩展运行时无关）；Agent 默认**不能**代你操控 Chrome 扩展 UI，除非 Cursor 单独启用 Playwright/Browser MCP

## 目录与入口

```
imgprompter/                 扩展主体（chrome 加载的就是这一层）
  manifest.json              MV3 清单（version / default_locale / permissions）
  core/
    bg.js                    Service Worker（importScripts 加载其余 core 模块）
    store.js                 chrome.storage.local + 配置迁移 / 多平台 Profile
    net.js                   AI API 调用（多 provider）
    imgproc.js               图片读取与压缩（OffscreenCanvas / canvas）
    prompts.js               提示词模板 + 6 种风格预设
    parse.js                 安全 JSON 解析（strip markdown + 提取 {...}）
    err.js                   错误码 → 用户友好文案
  ui/
    popup.html/js/css        设置页（API 配置 + 历史记录，**不使用** Shadow DOM）
    overlay.js/css           页面内结果面板（Shadow DOM 隔离）
  res/                       图标
  docs/                      自检报告
  _locales/zh_CN/            i18n 字符串（manifest 引用 __MSG_*__）
imgprompter-*.zip            商店发布包，不要修改或重新生成
.npmcache/                   npm 缓存，不要修改
```

## 模块加载（关键，易错）

- **bg.js** 用 `importScripts("store.js", "err.js", "prompts.js", "parse.js", "imgproc.js", "net.js")` 加载（非 ES module）
- **content_scripts**（manifest 声明）：`core/err.js → core/prompts.js → core/imgproc.js → ui/overlay.js`
  - **`store.js` 和 `net.js` 不会在 content script 上下文出现**，content script 通过 `chrome.runtime.sendMessage` 访问它们
- 所有模块挂载在全局命名空间 `ImgPrompterXxx`（如 `ImgPrompterStore`, `ImgPrompterNet`, `ImgPrompterPrompts`）

## 消息通信

| 消息 type | 方向 | 关键 payload / 说明 |
|---|---|---|
| `imgprompter-start` | bg → overlay | `{ src }` 触发分析 |
| `imgprompter-no-config` | bg → overlay | 用户未配置 API（在右键点击时由 `bg.js` 发出） |
| `imgprompter-progress` | bg → overlay | `{ text, pct }` |
| `imgprompter-result` | bg → overlay | `{ json, raw?, provider, format }` |
| `imgprompter-rewrite-done` / `imgprompter-rewrite-fail` | bg → overlay | 同上结构 |
| `imgprompter-error` | bg → overlay | `{ text, code }` |
| `imgprompter-fetch-image` | overlay → bg | `{ url }` 返回 `{ ok, dataUrl }` 或 `{ ok:false, error }`（20s 超时） |
| `imgprompter-analyze` | overlay → bg | `{ imageDataUrl? , imgSrc? }` 二选一 |
| `imgprompter-rewrite` | overlay → bg | `{ currentJson, instruction, imgSrc }` |
| `imgprompter-get-config` | overlay → bg | `showResult` 时读取 `lang`（content script 无 `store.js`） |
| `imgprompter-get-history` / `imgprompter-clear-history` | popup → bg | 历史列表 |
| `imgprompter-open-popup` | popup → bg | 在新标签页打开 `ui/popup.html` |

**所有 `bg.js` 的 `onMessage` handler 必须同步返回 `true`**，否则消息通道会在异步响应前关闭。

## 核心模块要点

### store.js（配置）

**存储 key 不变**：`imgprompter_cfg`（配置）、`imgprompter_hist`（历史，逻辑未改）。

**磁盘结构（schemaVersion: 2）**——仅存 v2，无顶层冗余 `apiUrl`：

```javascript
{
  schemaVersion: 2,
  platform: "ali",              // 当前激活平台，与 popup「AI 平台」下拉 value 一致
  lang, format, thinking,      // 全局项
  profiles: {
    openai, gemini, doubao, ali, kimi, siliconflow, zhipu, deepseek, anthropic, custom
    // 每桶: { apiUrl, apiKey, model }
  }
}
```

**`getConfig(cb)` 流程**（每次读取都会跑一遍，有变更则自动写回）：

`load → applyDefaults → migrateV1ToV2 → repairCfg → flatten → save? → cb(effective)`

- **v1 迁移**：无 `schemaVersion` 或 `< 2` 时，把旧扁平 `apiUrl/apiKey/model` 写入 `profiles[inferPlatformFromUrl]`。
- **repair**：`MODEL_RENAMES` 替换旧模型名；模型与 URL 服务商不一致时按 `DEFAULT_API_URLS` 纠正 `apiUrl`（不改 Key）；非 `custom` 且 URL 推断平台与 `platform` 不一致时同步 `platform` 并复制 profile 到目标桶。
- **对外扁平化**：`effective` 含顶层 `apiUrl/apiKey/model`（当前 `platform` 桶）+ `profiles` + `schemaVersion`；`net.js` / `bg.js` 只依赖扁平三项，**无需改调用方**。

**`saveConfig(cfg)`**：接受 popup 提交的 v2（含 `profiles`）或带扁平字段的合并请求；经 `normalizeIncomingCfg` 写入。

**平台推断**（与 `net.js` `detectProvider` 对齐，用于迁移/修复）：URL 子串 → 平台；模型名启发式（`claude`→anthropic、`gemini`→gemini、`qwen`→ali 等）。`store.js` 内 `DEFAULT_API_URLS` 与 popup `PLATFORM_PRESETS` 的 apiUrl 保持一致（修复用，未抽共享模块）。

**维护**：新平台需同时改 `store.js` 的 `PLATFORM_KEYS` / `DEFAULT_API_URLS` / `inferPlatformFromModel`、`popup.html` 下拉、`popup.js` `PLATFORM_PRESETS`、`net.js` 的 `detectProvider` 与请求/解析分支（Gemini 类需 `buildGeminiEndpoint` 等，勿只改 `resolveEndpoint`）。

### bg.js (Service Worker)

- `onInstalled` / `onStartup`：注册菜单后调用 `ImgPrompterStore.getConfig()`，触发配置迁移写回
- 右键点击即查 config → 缺一项就发 `imgprompter-no-config`，否则发 `imgprompter-start`
- `sendToTab()` 先 `sendMessage`，失败时通过 `chrome.scripting.executeScript` 注入 4 个 content script 后重试
- `imgSrc` 以 `data:image/` 开头时**跳过 fetch 代理**，直接交给 `ImgPrompterImgProc.compressFromDataUrl`
- `fetchImageBuffer` / `imgprompter-fetch-image` handler 均：20s 超时，8MB 上限（同时检查 `content-length` 和实际 `byteLength`），错误码 `IMG_TOO_LARGE` / `IMG_LOAD_TIMEOUT`
- 历史保存：`safeImgSrc` 排除 data URL 且长度 > 512 时清空

### net.js (API 层)

**Provider 检测**（按 URL 子串匹配，按顺序判）：
`generativelanguage.googleapis.com|ai.google.dev` → `gemini`；`anthropic.com` → `anthropic`；`doubao|volces|volcengine` → `doubao`；`dashscope|aliyun|alibaba` → `ali`；`moonshot|kimi` → `kimi`；`siliconflow|siliconcloud` → `siliconflow`；`zhipu|chatglm|bigmodel` → `zhipu`；`deepseek` → `deepseek`；`openai.com` → `openai`；其余 → `openai`（兼容网关）

**端点自动补全**：每个 provider 有自己的补全规则（anthropic → `/v1/messages`，openai → `/chat/completions`，doubao → `/api/v3/chat/completions` 等等；`/responses` 结尾会切换到 OpenAI Responses 格式）

**Gemini**（`provider === "gemini"`，不走 `resolveEndpoint`）：

- URL：`{apiUrl}/models/{model}:generateContent`（`buildGeminiEndpoint`；默认 base `https://generativelanguage.googleapis.com/v1beta`）
- 认证头：`x-goog-api-key`（非 Bearer）
- 请求体：`contents[].parts` 图文为 `inline_data`；系统提示与用户提示合并为单段 `text`
- JSON 格式：`generationConfig.responseMimeType = "application/json"`；plain 不设 MIME
- 解析：`parseGeminiResponse` 取 `candidates[0].content.parts[].text`
- 分析 / 重写 / 测试与 OpenAI 分支共用 `finishVisionResult` 做 plain 与 `ImgPrompterParse` 后处理
- **不**注入 thinking 参数（仅 OpenAI 兼容系与 Anthropic 有 thinking 逻辑）

**超时**：`TEST_TIMEOUT_MS = 15000`，`CALL_TIMEOUT_MS = 60000`

**`max_tokens` 按 format**：`plain=500, mj=700, sd=800, json=1000, detail=1500`（缺省 1000）

**Thinking 注入**（仅当 `cfg.thinking === true`）：
- Qwen / DeepSeek / GLM / Doubao / Moonshot / Kimi → OpenAI 风格 `extra_body: { enable_thinking: true }`；Responses API 形式为顶层 `enable_thinking: true`
- OpenAI `o1` / `o3` / `gpt-5` 系列 → `reasoning_effort: "medium"`（Responses API 为 `reasoning: { effort: "medium" }`）
- Anthropic → `thinking: { type: "enabled", budget_tokens: 4096 }` 且 `max_tokens` 提升到至少 8192

**错误码映射**：`classifyHttpError` → `mapErrorToCode` → `ImgPrompterErr.msg`，所有错误经此三层转换

### prompts.js

- `buildAnalyzePrompt(lang, format)` / `buildRewritePrompt(lang, format)` 返回 `{ sysPrompt, userPrompt }`
- `STYLE_PRESETS` 6 种 key：`realistic, anime, cinematic, product, cyberpunk, 3dicon`
- `JSON_CORE_FIELDS` (5) 与 `DETAIL_FIELDS` (11，含 `key_details: []`) 决定 JSON 模板字段顺序

### overlay.js (UI)

- Shadow DOM 隔离：host `imgprompter-host`，root `imgprompter-root`
- CSS 通过 `fetch(chrome.runtime.getURL("ui/overlay.css"))` 动态加载后注入 shadow root
- `showResult` → 先发 `imgprompter-get-config` 写入 `currentLang`，再 `showResultPanel` 建 DOM
- Tabs 由 `format` 决定（顺序不可改）：`plain`→[提示词]；`json`/`detail`→[JSON]；`mj`→[MJ, 提示词, JSON]；`sd`→[SD, 提示词, JSON]
- **「提示词」Tab（`plain` / `mj` / `sd`）可编辑**（`json` / `detail` 无此 Tab，仅顶部只读 preview）：
  - `zh`：单 textarea `#ip-prompt-zh`；`en`：`#ip-prompt-en`；`both`：上下两段
  - `input` 与切 Tab 前 `syncPromptFromEditor()` 写入 `currentJson.prompt_zh` / `prompt_en`
  - **「保存为当前结果」**：`applyPromptSave()` 同步字段、`plain` 时更新 `currentRaw`（`---` 规则与 net 一致）、刷新 preview 与当前 JSON Tab；**不写** `imgprompter_hist`、**不调** API
  - **指令式重写**（底部风格按钮 +「修改」）保留：`requestRewrite` 前 `syncPromptFromEditor()`；重写中 `setPromptEditorDisabled(true)`
- MJ/SD 专用 Tab 仍为只读；Tab 展示语义见 `.github/copilot-instructions.md`（MJ/SD 缺字段时 fallback `prompt_en`）
- `plain` 格式：AI 返回用 `---` 分隔，`lines[0]` → `prompt_zh`，`lines[last]` → `prompt_en`
- 修改输入框 Enter 提交，6 种风格按钮复用 `imgprompter-rewrite`

### popup.js（设置页）

- 直接加载 `store.js`（非经 bg 消息读配置）；保存走 `ImgPrompterStore.saveConfig(buildSaveConfig())`
- **多 Profile 草稿**：内存 `profileDrafts` 镜像 `cfg.profiles`；切换「AI 平台」前 `updateDraftFromForm(上一平台)`，再 `hydrateProfileFields(新平台)`
- **预设**：仅当目标桶 profile 全空时，才用 `PLATFORM_PRESETS` 填默认 `apiUrl`（及可选 model），**不覆盖**已有 Key/模型
- **测试连接**：`getFormFlatConfig()` 扁平对象，与运行时 `getConfig` 返回的扁平字段一致

## 存储与配置（摘要）

| 字段 | 值 |
|---|---|
| config key | `imgprompter_cfg`（v2 含 `profiles`，见上文 store.js） |
| history key | `imgprompter_hist` |
| history 上限 | 20 条，新记录 `unshift` |
| imgSrc 入库限制 | 非 data URL 且 ≤ 512 字符 |
| 运行时必填（扁平） | `apiUrl`（`https://`）、`apiKey`、`model`（来自当前 `platform` 桶） |
| 默认值 | `platform: custom`、`lang: zh`、`format: json`、`thinking: false` |

## 图片处理（imgproc.js）

| 参数 | 值 |
|---|---|
| 最大原始字节 | 8 MB |
| 压缩触发边长 | 长边 > 768px |
| JPEG 质量 | 0.80 |
| `Image` 加载超时 | 15s |
| 优先使用 `createImageBitmap` + `OffscreenCanvas`（Service Worker / 更快），不可用时回退到 `<canvas>` |

## 禁止行为

- 不在代码中加注释（除非用户明确要求）
- 不引入 npm/CDN/框架
- 不修改 `manifest.json` 的 `version` / 权限（除非任务要求）
- 不修改 `.npmcache/`、根目录 `*.zip` 商店包
- 不添加 emoji
- 不创建新的目录结构（除非任务要求）
- 不改变消息 type 命名、Tabs 顺序、provider 切换逻辑

## 添加新功能

| 功能 | 修改位置 |
|---|---|
| 新 API provider | `core/net.js` 的 `detectProvider` + 端点/body/parse（OpenAI 系用 `resolveEndpoint`；Gemini 用 `buildGemini*`）；`core/store.js` 的 `PLATFORM_KEYS` / `DEFAULT_API_URLS` / 模型推断；`ui/popup.html` + `popup.js` 平台项与预设 |
| 提示词 Tab 本地编辑行为 | `ui/overlay.js`（`renderPromptTab` / `syncPromptFromEditor` / `applyPromptSave`）+ `ui/overlay.css`（`.ip-prompt-edit`）；勿改 Tab 顺序与历史写入规则 |
| 旧模型名迁移 | `core/store.js` 的 `MODEL_RENAMES` |
| 新风格预设 | `core/prompts.js` 的 `STYLE_PRESETS` |
| 新输出格式 | `core/prompts.js` 模板 + `ui/overlay.js` tabs + `core/net.js` `MAX_TOKENS_MAP` + `core/bg.js` `saveToHistory` + `ui/popup.js` 历史渲染 |
| 新设置项 | `ui/popup.js` 表单 + `core/store.js` |
| 新错误码 | `core/err.js` 映射 + `core/net.js` `mapErrorToCode` |
