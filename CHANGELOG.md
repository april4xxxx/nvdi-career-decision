# Changelog

## 1.2.1 - 2026-07-20

### Deployment

- 创建公开 GitHub 仓库 `april4xxxx/nvdi-career-decision`，并推送完整提交历史。
- 将 Vercel 项目连接到 GitHub `main` 分支，后续推送自动触发生产部署。
- Vercel GitHub App 权限限定为仅访问本项目仓库。

## 1.2.0 - 2026-07-20

### Changed

- 真实对话提供方由 OpenAI Responses API 改为 DeepSeek Chat Completions。
- 默认模型固定为官方模型 ID `deepseek-v4-pro`，并兼容 Vercel 现有变量名 `deepseek`。
- 公共决策原则改为每轮直接注入上下文，不再依赖外部 Vector Store。
- 用户典籍改为服务端真实提取文字、浏览器本地保存和对话前轻量相关片段检索。
- DeepSeek 的 JSON 输出继续经过原有奏折结构清洗，任务、金币、精力和成就链路保持不变。

### Added

- 新增 TXT、Markdown 和可选文字 PDF 的提取结果、字符数与截断状态。
- 新增 PDF 提取依赖 `pdf-parse@^2.4.5`、Vercel Node 图形兼容依赖 `@napi-rs/canvas@0.1.80` 和依赖锁文件。
- Vercel Function 显式包含 `pdf.worker.mjs`，避免 Node File Trace 遗漏 PDF.js worker。

### Removed

- 移除 OpenAI Files、Vector Store、File Search、知识库令牌签名和公共知识库播种脚本。

### Security

- 用户原文件不长期保存在服务端；提取文本仅返回并保存在当前浏览器。
- 每轮用户知识上下文限制为最多 6 份输入、18,000 字，前端实际最多选择 4 个相关片段。

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
- 根据 2026-07-20 OpenAI 官方模型解析结果，将默认 API 模型校正为 `gpt-5.6-sol`。

### Security

- API Key 只由 Vercel 服务端读取。
- 对话加入输入裁剪、输出约束和基础限流。
- 用户 Vector Store ID 经 HMAC 签名后才允许在对话检索中使用。
- 上传限制为 4MB，并为聊天与知识索引函数配置 30 秒执行时间以适配 Vercel Hobby 运行约束。
