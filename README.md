# ImgPrompter Repository

本仓库当前只以 `imgprompter/` 作为正式开源项目目录。

## 项目用途

ImgPrompter 是一个 Chrome / Edge 浏览器扩展，用于：

- 右键网页图片进行识图
- 反推可直接用于生图的提示词
- 将结果按 `plain`、`json`、`detail`、`mj`、`sd` 格式输出
- 从结果面板继续发起生图

## 安装方法

1. 打开 `chrome://extensions` 或 `edge://extensions`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择仓库中的 `imgprompter/` 目录

## 使用方法

1. 打开扩展设置页
2. 配置识图 API 地址、API Key、模型名称
3. 如需生图，再配置生图平台
4. 在网页图片上右键生成提示词
5. 在结果面板中复制、改写或去生图

## API Key 与隐私

- API Key 仅保存在本地浏览器
- 本项目不提供远程中转服务器
- 图片会发送到用户自行配置的 AI 平台
- 不同模型能否可用，以用户自己的 API 权限、地区和套餐为准

## 支持平台与输出格式

- 平台说明、模型候选、输出格式见 [imgprompter/README.md](./imgprompter/README.md)
- 隐私说明见 [imgprompter/PRIVACY.md](./imgprompter/PRIVACY.md)

## 开源协议

本仓库按 MIT 协议开源，见 [LICENSE](./LICENSE)。
