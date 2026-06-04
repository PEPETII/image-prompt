# ImgPrompter 自检报告

> 更新时间：2026-06-04

## 本轮已确认并已修复

- 识图模型候选从 `ui/popup.js` 收敛到 `core/store.js`
- 生图模型候选从 `ui/popup.js` 收敛到 `core/store.js`
- OpenAI / Gemini 模型候选按 2026-06-04 官方口径更新
- 保留自定义模型输入，不锁死下拉框
- `plain` / `json` / `detail` / `mj` / `sd` 的 prompt 约束已拆分
- `core/net.js` 增加结果归一化，降低 JSON 字段漂移
- 历史记录新增 `format` / `lang` 元数据，修复旧记录渲染串格式
- `core/imgproc.js` 对无需压缩的小图直接透传，减少重复编码
- `core/net.js` Chat 分支补齐 `max_tokens`
- 新增轻量分段耗时日志：图片读取、压缩、prompt 构建、API 请求、结果解析、历史保存、总耗时

## 已检查代码链路

- 设置读取与保存：`core/store.js`、`ui/popup.js`
- 右键入口与消息链路：`core/bg.js`、`ui/overlay.js`
- 图片读取与压缩：`core/imgproc.js`
- Prompt 构建：`core/prompts.js`
- 结果解析与错误处理：`core/net.js`、`core/parse.js`、`core/err.js`
- 历史记录：`core/store.js`、`core/bg.js`、`ui/popup.js`

## 需要人工验证

- Chrome 实际右键分析
- Edge 实际右键分析
- 截图兜底链路
- 各平台真实账号权限下的模型可用性
- 生图接口在不同 OpenAI 兼容网关上的返回兼容性

## 发布前仍应执行

- 在 Chrome 手工加载 `imgprompter/`
- 在 Edge 手工加载 `imgprompter/`
- 按 README 完整走一遍识图与生图流程
- 用 3 到 5 张不同类型图片做人工质量验证
