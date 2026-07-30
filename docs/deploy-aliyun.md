# 阿里云轻量应用服务器 / ECS 部署

阿里云部署使用 `server.js`，它同时托管静态前端和同源 API：

- `/`、`/css/*`、`/js/*`、`/assets/*`
- `/api/chat`
- `/api/knowledge/upload`

这条路线不改动 Vercel Functions 代码，Vercel 仍然可以继续部署。

## 服务器建议

- 系统：Ubuntu 22.04 或 24.04。
- Node.js：20 或以上。
- 进程管理：PM2。
- 反向代理：Nginx。
- 域名：如果使用中国大陆服务器并绑定域名，需要 ICP 备案。

## 首次安装

在阿里云服务器上执行：

```bash
sudo apt update
sudo apt install -y git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

创建部署目录并拉代码：

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
git clone https://github.com/april4xxxx/nvdi-career-decision.git /var/www/nvdi-career-decision
cd /var/www/nvdi-career-decision
npm ci --omit=dev
```

创建服务器本地环境变量文件。这个文件不要提交到 Git：

```bash
cat > .env.production <<'EOF'
DEEPSEEK_API_KEY=你的 DeepSeek Key
DEEPSEEK_MODEL=deepseek-v4-pro
CHAT_RATE_LIMIT=24
EOF
chmod 600 .env.production
```

启动应用：

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

## Nginx

创建站点配置：

```bash
sudo tee /etc/nginx/sites-available/nvdi-career-decision >/dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.example.com;

    client_max_body_size 5m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/nvdi-career-decision /etc/nginx/sites-enabled/nvdi-career-decision
sudo nginx -t
sudo systemctl reload nginx
```

如果还没有备案域名，可以先用公网 IP 访问测试。正式对外访问建议备案域名并配置 HTTPS。

## 手动更新

```bash
cd /var/www/nvdi-career-decision
git pull --ff-only origin main
npm ci --omit=dev
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
```

## 验证

```bash
curl -I http://127.0.0.1:3000/
curl -s -X POST http://127.0.0.1:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{}'
```

第二条应返回 `EMPTY_MESSAGE`，说明 API 路由已经被 Node server 接住。

