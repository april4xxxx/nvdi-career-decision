# 女帝职场决策系统

一个将真实职场困境转化为“决策奏折、地图任务与成就”的交互式黑客松 Demo。

线上演示：[https://nvdi-career-decision.vercel.app](https://nvdi-career-decision.vercel.app)

## 当前能力

- 真实 DeepSeek-V4-Pro 对话，API Key 仅由 Vercel 服务端读取。
- 服务端返回结构化的对话、追问或决策奏折，并对字段与任务数值二次清洗。
- AI 任务进入原有地图任务系统；完成后自动结算精力、金币并解锁珍宝阁成就。
- 公共《女帝职场决策原则》自动参与每次对话。
- 支持 TXT、Markdown、PDF 真实文字提取；浏览器从用户典籍中选择相关片段提供给 AI。
- 用户上传文本只保存在自己的浏览器，服务端不建立长期文件存储。
- API 不可用时自动切回本地情景大脑，保证演示不中断。

## 本地预览

纯视觉与本地演示模式可直接使用静态服务器：

```bash
python3 -m http.server 4173
```

然后访问 `http://localhost:4173`。静态服务器不提供 `/api`，因此对话会自动使用本地演示大脑。

测试真实 API 时：

```bash
npm install
cp .env.example .env.local
# 在 .env.local 中填写 DeepSeek Key
vercel dev
```

不要把 `.env.local` 提交到 GitHub。

## 环境变量

| 名称 | 是否必填 | 用途 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 真实 AI 必填 | DeepSeek Key，仅由服务端读取 |
| `deepseek` | 兼容名称 | 当前 Vercel 已使用此名称；代码会自动识别 |
| `DEEPSEEK_MODEL` | 可选 | 默认 `deepseek-v4-pro` |
| `CHAT_RATE_LIMIT` | 可选 | 单服务实例每 10 分钟对话请求上限，默认 24 |

历史部署中的 `APP_SESSION_SECRET` 只服务于已移除的 OpenAI Vector Store 方案，当前版本不再读取，可在确认 1.2.0 稳定后从 Vercel 删除。

## 知识库工作方式

1. 公共知识原稿维护在 `knowledge/女帝职场决策原则.md`，核心规则随每次对话发送给 DeepSeek。
2. 用户在藏书阁上传 TXT、Markdown 或带可选文字的 PDF，最大 4MB。
3. `/api/knowledge/upload` 提取最多 60,000 字并立即返回，不把原文件写入数据库或对象存储。
4. 浏览器把提取结果保存在 `localStorage(nvdi-full-v1)`。
5. 发起对话时，浏览器以当前问题做轻量词法检索，最多选择 4 个相关片段、18,000 字发送到服务端。
6. DeepSeek 使用了典籍时，会在奏折 `sources` 中注明典籍名。

扫描图片型 PDF 没有可提取文字，当前会提示先进行 OCR 或转换为 TXT；这是黑客松版本的明确边界。

## Vercel 部署

当前 Vercel 项目：`april4xxxxs-projects/nvdi-career-decision`，生产域名为 `nvdi-career-decision.vercel.app`。

1. Framework Preset 选择 **Other**，项目根目录保持仓库根目录。
2. 在 Vercel Project Settings → Environment Variables 添加 `DEEPSEEK_API_KEY`；现有部署也兼容变量名 `deepseek`。
3. 每次修改环境变量后重新生产部署。
4. 依次验证：Onboarding、真实对话、追问、奏折、朱批同意、完成任务、珍宝阁解锁、典籍上传与典籍引用。

## API 约定

### `POST /api/chat`

浏览器发送当前消息、大臣、最近对话、有限应用状态和经过本地筛选的知识片段。服务端调用 DeepSeek Chat Completions，并返回：

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
    "mode": "deepseek",
    "model": "deepseek-v4-pro",
    "usedKnowledgeBase": true,
    "userKnowledgeDocuments": 1
  }
}
```

### `POST /api/knowledge/upload`

接收 `multipart/form-data` 中的 `file` 和可选 `title`，返回文件元数据与提取文本。服务端不需要接触 DeepSeek Key，也不长期保存文件。

## 安全与成本边界

- DeepSeek API Key 不下发浏览器、不写进仓库。
- 对话限制请求大小、消息长度、历史条数、输出 token 和请求频率。
- 用户文件限制为 TXT、Markdown、PDF，最大 4MB；提取文本最多 60,000 字。
- 每轮最多发送 18,000 字用户知识，避免无边界消耗上下文和费用。
- 用户知识存在浏览器 localStorage；清除网站数据会清除这些典籍。
- 当前内存限流只适合黑客松 Demo。公开流量增大时应换成持久限流，并增加验证码或登录。
