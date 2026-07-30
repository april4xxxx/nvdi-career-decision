# Vercel 部署

Vercel 是当前线上默认部署方式，继续使用仓库根目录的 `vercel.json`。

## 适用场景

- 海外或可接受跨境访问波动的用户。
- 希望继续使用 Vercel Functions 托管 `/api/chat` 和 `/api/knowledge/upload`。
- 希望 push 到 GitHub 后由 Vercel 自动部署。

## 配置

1. Vercel Project 连接 GitHub 仓库 `april4xxxx/nvdi-career-decision`。
2. Framework Preset 选择 `Other`。
3. Root Directory 保持仓库根目录。
4. Environment Variables 配置：
   - `DEEPSEEK_API_KEY`：必填。
   - `deepseek`：兼容旧变量名，二选一即可。
   - `DEEPSEEK_MODEL`：可选，默认 `deepseek-v4-pro`。
   - `CHAT_RATE_LIMIT`：可选，默认 `24`。

## 部署

正常修改代码后 push 到 `main`，Vercel 会自动部署。

```bash
git push origin main
```

## 验证

部署完成后验证：

- 首页可以打开。
- 对话可走真实 DeepSeek。
- 追问、奏折、朱批同意、任务完成可用。
- 典籍上传支持 TXT、Markdown、可提取文字的 PDF。

