# 女帝职场决策系统

一个将真实职场困境转化为“决策奏折、地图任务与成就”的交互式黑客松 Demo。

线上演示：[https://nvdi-career-decision.vercel.app](https://nvdi-career-decision.vercel.app)

## 当前能力

- 真实 OpenAI Responses API 对话，服务端返回结构化奏折。
- 对话、追问、决策三种输出，与现有朱批交互兼容。
- AI 任务进入原有地图任务系统；完成后自动结算精力、金币和珍宝阁成就。
- 公共预置知识库，以及每位浏览器用户独立的上传知识库。
- 支持 TXT、Markdown、PDF 典籍上传并建立 File Search 索引。
- API 不可用时自动切回本地情景大脑，保证演示不中断。

## 本地预览

纯视觉与本地演示模式可直接用任意静态服务器打开：

```bash
python3 -m http.server 4173
```

然后访问 `http://localhost:4173`。静态服务器不提供 `/api`，因此对话会自动使用本地演示大脑。

测试真实 API 时使用 Vercel 本地运行环境：

```bash
npm install -g vercel
cp .env.example .env.local
# 在 .env.local 中填写配置
vercel dev
```

不要把 `.env.local` 提交到 GitHub。

## 环境变量

| 名称 | 是否必填 | 用途 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 真实 AI 必填 | OpenAI 项目 Key，仅由服务端读取 |
| `OPENAI_MODEL` | 可选 | 默认 `gpt-5.6-sol`，可按账号可用模型调整 |
| `OPENAI_VECTOR_STORE_ID` | 可选 | 公共预置知识库 ID |
| `APP_SESSION_SECRET` | 用户上传必填 | 签名用户私有 Vector Store 令牌，建议至少 32 位随机字符串 |
| `CHAT_RATE_LIMIT` | 可选 | 单服务实例每 10 分钟对话请求上限，默认 24 |

## 建立公共知识库

1. 把获得授权的 `.md`、`.txt`、`.pdf` 放进 `knowledge/`。
2. 在本机临时设置 `OPENAI_API_KEY`。
3. 运行：

```bash
npm run knowledge:seed
```

4. 把脚本输出的 `OPENAI_VECTOR_STORE_ID` 添加到 Vercel。

## 部署到 GitHub + Vercel

当前 Vercel 项目：`april4xxxxs-projects/nvdi-career-decision`，生产域名为 `nvdi-career-decision.vercel.app`。

1. 将本目录初始化为独立 Git 仓库并推送到 GitHub。
2. 在 Vercel 选择 **New Project**，导入该仓库。
3. Framework Preset 选择 **Other**；项目根目录保持仓库根目录。
4. 在 Vercel Project Settings → Environment Variables 添加所需变量。
5. 部署后依次验证：Onboarding、真实对话、追问、生成奏折、朱批同意、完成任务、珍宝阁解锁、典籍上传、引用典籍。

每次推送 `main` 后 Vercel 会自动重新部署。环境变量改变后也需要重新部署才会应用。

## API 约定

### `POST /api/chat`

浏览器发送当前消息、大臣、最近对话、有限的应用状态和已签名的知识库令牌。服务端调用 Responses API，并返回：

```json
{
  "result": {
    "type": "dialogue | question | decision",
    "topic": "主题",
    "message": "普通回复",
    "question": null,
    "decision": null
  },
  "meta": {
    "mode": "openai",
    "model": "实际模型",
    "usedKnowledgeBase": true
  }
}
```

### `POST /api/knowledge/upload`

接收 `multipart/form-data`：`file` 和可选 `knowledgeToken`。服务端为用户创建或复用私有 Vector Store，上传文件并返回签名令牌。浏览器只保存签名令牌，不能伪造任意 Vector Store ID。

## 安全边界

- API Key 永远不下发浏览器、不写进仓库。
- 对话限制请求大小、消息长度、历史条数、输出 token 和请求频率。
- 用户文件限制为 TXT、Markdown、PDF，最大 4MB，以适配 Vercel Function 请求体限制。
- 用户 Vector Store ID 使用服务端 HMAC 签名，防止客户端任意指定知识库。
- 当前内存限流只适合黑客松 Demo。公开流量增大时应换成 Redis 等持久限流，并增加验证码或登录。
- 浏览器进度仍保存在 `localStorage`。跨设备同步属于下一阶段，需要数据库和用户认证。

## 验证

```bash
npm test
```

完整改造过程与设计取舍见 [docs/改造记录.md](docs/改造记录.md)，版本摘要见 [CHANGELOG.md](CHANGELOG.md)。
