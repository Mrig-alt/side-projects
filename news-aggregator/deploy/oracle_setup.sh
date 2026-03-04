#!/usr/bin/env bash
# =============================================================================
# Oracle Cloud Always Free — Personal Intelligence Feed Setup Script
# =============================================================================
# Run this once on a fresh Oracle Cloud ARM VM (Ubuntu 22.04 recommended).
# The Always Free tier gives you: 4 Ampere cores, 24 GB RAM, 200 GB storage.
#
# Usage:
#   ssh ubuntu@<your-oracle-ip>
#   curl -fsSL https://raw.githubusercontent.com/YOU/REPO/main/deploy/oracle_setup.sh | bash
#   # OR: copy this file up and run: bash oracle_setup.sh
#
# After setup:
#   1. Edit /opt/intel-feed/.env with your API keys
#   2. sudo systemctl start intel-feed
#   3. sudo systemctl enable intel-feed   (auto-start on reboot)
# =============================================================================

set -euo pipefail

APP_DIR="/opt/intel-feed"
APP_USER="intel-feed"
REPO_URL="${REPO_URL:-}"   # set env var or clone manually

echo "=== Oracle Cloud setup: Personal Intelligence Feed ==="

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
echo "[1/7] Installing system packages..."
sudo apt-get update -q
sudo apt-get install -y -q \
    python3.11 python3.11-venv python3.11-dev \
    python3-pip git curl nginx certbot python3-certbot-nginx \
    build-essential libssl-dev

# ---------------------------------------------------------------------------
# 2. App user
# ---------------------------------------------------------------------------
echo "[2/7] Creating app user..."
if ! id "$APP_USER" &>/dev/null; then
    sudo useradd --system --shell /bin/bash --create-home "$APP_USER"
fi

# ---------------------------------------------------------------------------
# 3. App directory + code
# ---------------------------------------------------------------------------
echo "[3/7] Setting up app directory..."
sudo mkdir -p "$APP_DIR/data"
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [ -n "$REPO_URL" ]; then
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
else
    echo "  REPO_URL not set — copy your code to $APP_DIR manually"
    echo "  e.g.: rsync -av ./news-aggregator/ ubuntu@<ip>:$APP_DIR/"
fi

# ---------------------------------------------------------------------------
# 4. Python virtualenv + dependencies
# ---------------------------------------------------------------------------
echo "[4/7] Creating Python virtualenv..."
sudo -u "$APP_USER" python3.11 -m venv "$APP_DIR/.venv"
sudo -u "$APP_USER" "$APP_DIR/.venv/bin/pip" install --quiet --upgrade pip
if [ -f "$APP_DIR/requirements.txt" ]; then
    sudo -u "$APP_USER" "$APP_DIR/.venv/bin/pip" install --quiet -r "$APP_DIR/requirements.txt"
fi

# ---------------------------------------------------------------------------
# 5. .env file template
# ---------------------------------------------------------------------------
echo "[5/7] Creating .env template..."
if [ ! -f "$APP_DIR/.env" ]; then
    sudo -u "$APP_USER" tee "$APP_DIR/.env" > /dev/null <<'ENVEOF'
# ==============================================
# Personal Intelligence Feed — Environment vars
# Edit this file, then restart: sudo systemctl restart intel-feed
# ==============================================

# Required API keys
ANTHROPIC_API_KEY=
PERPLEXITY_API_KEY=
NEWS_API_KEY=

# Optional
OPENAI_API_KEY=

# Premium cookies — export from browser via Cookie-Editor extension
# Format: paste the full cookie header string
NYT_COOKIES=
FT_COOKIES=
WSJ_COOKIES=
ECONOMIST_COOKIES=

# App settings (defaults shown)
REFRESH_INTERVAL_MINUTES=30
MAX_ARTICLES_PER_FEED=8
MAX_ARTICLES_AGE_HOURS=48
PORT=8080
SUMMARY_AI=claude
FOLLOWUP_CHECK_HOUR_UTC=9

# SQLite database path (persistent Oracle volume)
DATABASE_PATH=/opt/intel-feed/data/feed.db
ENVEOF
    echo "  Created $APP_DIR/.env — EDIT THIS FILE with your API keys before starting"
fi

# ---------------------------------------------------------------------------
# 6. Systemd service
# ---------------------------------------------------------------------------
echo "[6/7] Installing systemd service..."
sudo tee /etc/systemd/system/intel-feed.service > /dev/null <<SERVICEEOF
[Unit]
Description=Personal Intelligence Feed
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$APP_DIR/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --workers 1
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=intel-feed

# Give the app time to do its initial RSS fetch before marking healthy
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload

# ---------------------------------------------------------------------------
# 7. Nginx reverse proxy
# ---------------------------------------------------------------------------
echo "[7/7] Configuring nginx..."
sudo tee /etc/nginx/sites-available/intel-feed > /dev/null <<'NGINXEOF'
server {
    listen 80;
    server_name _;   # replace _ with your domain if you have one

    # Increase timeouts for SSE (Server-Sent Events) connections
    proxy_read_timeout  3600s;
    proxy_send_timeout  3600s;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # Required for SSE — disable buffering so events stream immediately
        proxy_buffering    off;
        proxy_cache        off;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/intel-feed /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# ---------------------------------------------------------------------------
# Oracle firewall — open port 80 (nginx) and 8080 (direct, optional)
# ---------------------------------------------------------------------------
echo ""
echo "=== IMPORTANT: Open firewall ports in Oracle Cloud Console ==="
echo "  Go to: Networking > Virtual Cloud Networks > your VCN"
echo "         > Security Lists > Default > Add Ingress Rules"
echo "  Add: Source 0.0.0.0/0  Protocol TCP  Port 80"
echo "  Add: Source 0.0.0.0/0  Protocol TCP  Port 443  (for HTTPS later)"
echo ""
echo "Also run locally on the VM:"
echo "  sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT"
echo "  sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT"
echo "  sudo netfilter-persistent save"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Edit API keys:  sudo nano $APP_DIR/.env"
echo "  2. Start service:  sudo systemctl start intel-feed"
echo "  3. Enable on boot: sudo systemctl enable intel-feed"
echo "  4. Check logs:     sudo journalctl -u intel-feed -f"
echo "  5. Test locally:   curl http://localhost:8080/api/status"
echo "  6. Access from web: http://$(curl -s ifconfig.me)/"
echo ""
echo "Optional HTTPS (if you have a domain):"
echo "  sudo certbot --nginx -d your-domain.com"
