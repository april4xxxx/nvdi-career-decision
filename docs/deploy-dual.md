# 双部署同步方案

目标：同一个主项目、同一个 `main` 分支，同时部署到 Vercel 和阿里云。

## 拓扑

```text
本地开发
  |
  | git push origin main
  v
GitHub main
  |                         |
  | Vercel Git 集成          | GitHub Actions
  v                         v
Vercel 生产环境              阿里云轻量应用服务器 / ECS
```

## 分工

- Vercel：继续读取 `vercel.json`，托管静态文件和 Vercel Functions。
- 阿里云：运行 `server.js`，用 PM2 托管同一套静态文件和 API。
- GitHub：作为唯一代码源。所有生产改动先进入 `main`。

## GitHub Secrets

在 GitHub 仓库 Settings -> Secrets and variables -> Actions 中添加：

| 名称 | 用途 |
| --- | --- |
| `ALIYUN_HOST` | 阿里云服务器公网 IP 或域名 |
| `ALIYUN_USER` | SSH 用户，例如 `root` 或 `deploy` |
| `ALIYUN_SSH_KEY` | 可登录服务器的私钥内容 |
| `ALIYUN_APP_DIR` | 可选，服务器上的项目目录 |

当前 workflow 默认服务器项目目录为：

```text
/var/www/nvdi-career-decision
```

如果要改目录，推荐在 GitHub Actions Secrets 里设置 `ALIYUN_APP_DIR`，也可以直接修改 `.github/workflows/deploy-aliyun.yml`。

## 首次部署顺序

1. 按 [阿里云部署文档](deploy-aliyun.md) 完成服务器安装、首次 clone、`.env.production`、PM2 和 Nginx。
2. 按 [Vercel 部署文档](deploy-vercel.md) 确认 Vercel 仍能从 `main` 自动部署。
3. 在 GitHub 添加 `ALIYUN_HOST`、`ALIYUN_USER`、`ALIYUN_SSH_KEY`。
4. push 到 `main`，确认 Vercel 和 GitHub Actions 都成功。

## 日常发布

```bash
npm test
git push origin main
```

随后：

- Vercel 自动部署。
- GitHub Actions 自动 SSH 到阿里云执行 `git pull --ff-only`、`npm ci --omit=dev`、`pm2 startOrReload`。

## 回滚

优先用 Git 回滚：

```bash
git revert <commit-sha>
git push origin main
```

Vercel 和阿里云会跟随新的 `main` 自动回到回滚后的代码。
