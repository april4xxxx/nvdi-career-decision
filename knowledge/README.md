# 知识库目录

这里放需要成为“公共治国之策”的 `.md`、`.txt` 或 `.pdf` 文件。

运行：

```bash
OPENAI_API_KEY="你的项目 Key" npm run knowledge:seed
```

脚本会新建 OpenAI Vector Store、上传本目录文件，并输出 `OPENAI_VECTOR_STORE_ID`。将该 ID 配置到 Vercel 环境变量后重新部署。

不要把个人隐私、公司机密、API Key 或未获授权的材料放进公共知识库。用户在页面内上传的典籍会进入单独的用户 Vector Store，不会加入这里的公共库。
