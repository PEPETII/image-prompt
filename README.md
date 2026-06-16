
使用方法：
第一步：点击edge浏览器右上角的积木按钮然后点击“管理扩展”按钮
<img width="587" height="870" alt="image" src="https://github.com/user-attachments/assets/f0a31add-6f1c-4ecb-8cda-9346cc9f99f9" />

第二步：点击标红区域
<img width="2509" height="1234" alt="屏幕截图 2026-06-16 234150" src="https://github.com/user-attachments/assets/e2745b24-2d87-4ed2-aa00-1e60bced8cba" />

第三步：选择下载的文件夹即可
<img width="1104" height="260" alt="屏幕截图 2026-06-16 234412" src="https://github.com/user-attachments/assets/1c3935ef-1db8-452c-aefc-8197bead3354" />

第四步：导入成功
<img width="2503" height="1242" alt="屏幕截图 2026-06-16 234506" src="https://github.com/user-attachments/assets/aec040cd-c912-4ba7-8753-824a5a05ddda" />

第五步：依旧右上角积木按钮点击框选区域，选择固定
<img width="616" height="874" alt="屏幕截图 2026-06-16 234609" src="https://github.com/user-attachments/assets/e142f4db-9109-4dfc-ad98-e7107ee1b1b0" />

第六步：点击固定后出现的图标（已框选）就可以使用了
<img width="655" height="956" alt="屏幕截图 2026-06-16 234727" src="https://github.com/user-attachments/assets/7acac13a-22c9-4a24-ae8f-2190d5b6d1cd" />




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
