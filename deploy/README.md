# EvoMesh Deployment

## TLS / HTTPS

EvoMesh serves HTTP on port 8123. For production, add TLS via reverse proxy.

### Option A: nginx + Let's Encrypt

```bash
apt install nginx certbot python3-certbot-nginx

# /etc/nginx/sites-available/evomesh
server {
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

ln -s /etc/nginx/sites-available/evomesh /etc/nginx/sites-enabled/
certbot --nginx -d your-domain.com
```

### Option B: Cloudflare Tunnel

```bash
cloudflared tunnel create evomesh
cloudflared tunnel route dns evomesh your-domain.com
cloudflared tunnel --url http://localhost:8123 run evomesh
```

## systemd Service

```bash
sudo cp deploy/evomesh.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now evomesh
```
