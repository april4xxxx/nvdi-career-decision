# Changelog

## 1.1.0 - 2026-07-20

### Added

- 新增 Vercel `POST /api/chat`，通过 OpenAI Responses API 返回结构化职场决策。
- 新增 Vercel `POST /api/knowledge/upload`，支持 TXT、Markdown、PDF 进入用户私有知识库。
- 新增公共知识库初始化脚本和首份决策原则知识文件。
- 新增前端 API 适配器、知识库来源展示、上传状态和 AI 不可用回退提示。
- 新增环境变量模板、部署说明、安全说明和 Node 自动测试。

### Changed

- 对话从固定情景库优先切换为真实 AI；API 不可用时仍使用原情景库。
- 藏书阁“上传典籍”由纯演示表单改为真实文件上传与索引。
- 状态仓库新增签名知识库令牌，保持上传典籍与后续 AI 对话互通。

### Security

- API Key 只由 Vercel 服务端读取。
- 对话加入输入裁剪、输出约束和基础限流。
- 用户 Vector Store ID 经 HMAC 签名后才允许在对话检索中使用。
- 上传限制为 4MB，并为聊天与知识索引函数配置 30 秒执行时间以适配 Vercel Hobby 运行约束。
