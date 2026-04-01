#!/usr/bin/env bash
# =============================================================================
# 4CHMG2 Install Script
# =============================================================================
# Automated setup for a fresh Debian 12 (Bookworm) VPS.
#
# What this script does:
#   1.  Installs system packages (curl, git, nginx, certbot, docker, fail2ban)
#   2.  Configures firewall (SSH on port 2222 + HTTP/HTTPS)
#   3.  Installs Docker and starts FlareSolverr
#   4.  Installs Node.js 22 LTS via nvm
#   5.  Writes .env configuration
#   6.  Installs npm dependencies and builds the application
#   7.  Configures nginx reverse proxy with SSL
#   8.  Starts the server with pm2 and configures autostart
#   9.  Hardens SSH (port 2222, key-only, no root login)
#   10. Configures fail2ban SSH jail
#
# Usage:
#   chmod +x install.sh
#   sudo ./install.sh
#
# Prerequisites:
#   - Fresh Debian 12 VPS
#   - Root access (or sudo)
#   - Domain DNS A record pointing to this server's IP
#   - SSH key copied to the app user BEFORE running this script
#     (password auth will be disabled)
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors & helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No color

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Use: sudo ./install.sh"
fi

info "=========================================="
info " 4CHMG2 Installation Script"
info "=========================================="
echo ""

# ---------------------------------------------------------------------------
# Gather configuration
# ---------------------------------------------------------------------------
# Check if we're running from the repo directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
    error "Run this script from the 4CHMG2 repository root directory."
fi

APP_DIR="$SCRIPT_DIR"

# Determine the user who will run the app (the user who invoked sudo)
APP_USER="${SUDO_USER:-$(whoami)}"
if [[ "$APP_USER" == "root" ]]; then
    warn "No non-root user detected. Creating user '4chmg2'..."
    read -rp "Create dedicated user '4chmg2'? [Y/n]: " CREATE_USER
    CREATE_USER="${CREATE_USER:-Y}"
    if [[ "$CREATE_USER" =~ ^[Yy]$ ]]; then
        useradd -m -s /bin/bash 4chmg2 2>/dev/null || true
        APP_USER="4chmg2"
        success "User '4chmg2' created."
    else
        warn "Running as root is not recommended but continuing..."
        APP_USER="root"
    fi
fi

APP_HOME=$(eval echo "~$APP_USER")
info "Application user: $APP_USER"
info "Application directory: $APP_DIR"
echo ""

# Read domain and config
if [[ -f "$APP_DIR/.env" ]]; then
    info "Found existing .env file."
    set -a
    source "$APP_DIR/.env"
    set +a
fi

read -rp "Domain name [${DOMAIN:-example.com}]: " INPUT_DOMAIN
DOMAIN="${INPUT_DOMAIN:-${DOMAIN:-example.com}}"

read -rp "SSL email for Let's Encrypt [${SSL_EMAIL:-}]: " INPUT_EMAIL
SSL_EMAIL="${INPUT_EMAIL:-${SSL_EMAIL:-}}"

read -rp "Application port [${PORT:-3000}]: " INPUT_PORT
PORT="${INPUT_PORT:-${PORT:-3000}}"

read -rp "FlareSolverr port [8191]: " INPUT_FLARE_PORT
FLARE_PORT="${INPUT_FLARE_PORT:-8191}"

echo ""
info "Configuration:"
info "  Domain:          $DOMAIN"
info "  SSL Email:       $SSL_EMAIL"
info "  App Port:        $PORT"
info "  FlareSolverr:    http://127.0.0.1:${FLARE_PORT}/v1"
echo ""
read -rp "Continue with these settings? [Y/n]: " CONFIRM
CONFIRM="${CONFIRM:-Y}"
[[ "$CONFIRM" =~ ^[Yy]$ ]] || error "Aborted by user."

# ---------------------------------------------------------------------------
# Step 1: System packages
# ---------------------------------------------------------------------------
info "Step 1/9: Installing system packages..."

apt-get update -qq
apt-get install -y -qq \
    curl \
    wget \
    git \
    build-essential \
    nginx \
    certbot \
    python3-certbot-nginx \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    > /dev/null 2>&1

success "System packages installed."

# ---------------------------------------------------------------------------
# Step 2: Configure firewall
# ---------------------------------------------------------------------------
info "Step 2/10: Configuring firewall..."

ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow 2222/tcp > /dev/null 2>&1
ufw allow 'Nginx Full' > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1

success "Firewall configured (SSH 2222 + HTTP/HTTPS only)."

# ---------------------------------------------------------------------------
# Step 3: Install Docker (for FlareSolverr)
# ---------------------------------------------------------------------------
info "Step 3/10: Installing Docker..."

if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin > /dev/null 2>&1

    # Allow app user to use docker without sudo
    usermod -aG docker "$APP_USER" 2>/dev/null || true

    systemctl enable docker --now > /dev/null 2>&1
    success "Docker installed."
else
    success "Docker already installed."
fi

# ---------------------------------------------------------------------------
# Step 4: Start FlareSolverr
# ---------------------------------------------------------------------------
info "Step 4/10: Starting FlareSolverr..."

# Stop existing container if any
docker stop flaresolverr 2>/dev/null || true
docker rm flaresolverr 2>/dev/null || true

docker run -d \
    --name flaresolverr \
    --restart unless-stopped \
    -p "127.0.0.1:${FLARE_PORT}:8191" \
    -e LOG_LEVEL=info \
    ghcr.io/flaresolverr/flaresolverr:latest \
    > /dev/null 2>&1

success "FlareSolverr running on port $FLARE_PORT."

# ---------------------------------------------------------------------------
# Step 5: Install Node.js via nvm
# ---------------------------------------------------------------------------
info "Step 5/10: Installing Node.js 22 LTS..."

NVM_DIR="$APP_HOME/.nvm"

# Install nvm as the app user
sudo -u "$APP_USER" bash -c '
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
' > /dev/null 2>&1

# Install Node.js 22 LTS
sudo -u "$APP_USER" bash -c "
    export NVM_DIR='$NVM_DIR'
    source \"\$NVM_DIR/nvm.sh\"
    nvm install 22
    nvm alias default 22
    nvm use 22
" > /dev/null 2>&1

# Determine node/npm paths
NODE_PATH="$(sudo -u "$APP_USER" bash -c "export NVM_DIR='$NVM_DIR'; source \"\$NVM_DIR/nvm.sh\"; which node")"
NPX_PATH="$(sudo -u "$APP_USER" bash -c "export NVM_DIR='$NVM_DIR'; source \"\$NVM_DIR/nvm.sh\"; which npx")"
NODE_VERSION="$(sudo -u "$APP_USER" bash -c "export NVM_DIR='$NVM_DIR'; source \"\$NVM_DIR/nvm.sh\"; node --version")"

success "Node.js $NODE_VERSION installed."

# ---------------------------------------------------------------------------
# Step 6: Write .env file
# ---------------------------------------------------------------------------
info "Step 6/10: Writing .env configuration..."

cat > "$APP_DIR/.env" << ENVEOF
# 4CHMG2 Instance Configuration
# Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M:%S UTC")

DOMAIN=${DOMAIN}
SSL_EMAIL=${SSL_EMAIL}
PORT=${PORT}
HOST=127.0.0.1
FLARESOLVERR_URL=http://127.0.0.1:${FLARE_PORT}/v1
ENVEOF

chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

success ".env written (owner-read-only permissions)."

# ---------------------------------------------------------------------------
# Step 7: Install npm dependencies & build
# ---------------------------------------------------------------------------
info "Step 7/10: Installing dependencies and building..."

# Ensure app directory is owned by app user
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Create logs directory
sudo -u "$APP_USER" mkdir -p "$APP_DIR/logs"

# Install dependencies
info "Running npm install..."
sudo -u "$APP_USER" bash -c "
    export NVM_DIR='$NVM_DIR'
    source \"\$NVM_DIR/nvm.sh\"
    cd '$APP_DIR'
    npm install
" 2>&1 | tail -3

# Build
info "Running gulp build..."
sudo -u "$APP_USER" bash -c "
    export NVM_DIR='$NVM_DIR'
    source \"\$NVM_DIR/nvm.sh\"
    cd '$APP_DIR'
    npx gulp build
"

success "Application built."

# ---------------------------------------------------------------------------
# Step 8: Configure nginx
# ---------------------------------------------------------------------------
info "Step 8/10: Configuring nginx..."

# Generate nginx config from template
NGINX_CONF="/etc/nginx/sites-available/4chmg2"

if [[ ! -f "$APP_DIR/nginx/4chmg2.conf.example" ]]; then
    error "nginx template not found at $APP_DIR/nginx/4chmg2.conf.example"
fi

cp "$APP_DIR/nginx/4chmg2.conf.example" "$NGINX_CONF"
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_CONF"
sed -i "s/PORT_PLACEHOLDER/$PORT/g" "$NGINX_CONF"

# Ensure sites-enabled directory exists
mkdir -p /etc/nginx/sites-enabled

# Enable site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/4chmg2
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t 2>&1 || error "nginx config test failed. Check /etc/nginx/sites-available/4chmg2"

systemctl reload nginx

# Get SSL certificate
if [[ -n "$SSL_EMAIL" ]]; then
    info "Obtaining SSL certificate..."
    certbot --nginx -d "$DOMAIN" --email "$SSL_EMAIL" --agree-tos --non-interactive --redirect 2>&1 || {
        warn "Certbot failed. You can retry manually:"
        warn "  sudo certbot --nginx -d $DOMAIN"
        warn "Make sure your DNS A record points to this server first."
    }
else
    warn "No SSL email provided. Skipping certbot."
    warn "Run manually later: sudo certbot --nginx -d $DOMAIN"
fi

success "nginx configured."

# ---------------------------------------------------------------------------
# Step 9: Start pm2 and configure autostart
# ---------------------------------------------------------------------------
info "Step 9/10: Starting application with pm2..."

sudo -u "$APP_USER" bash -c "
    export NVM_DIR='$NVM_DIR'
    source \"\$NVM_DIR/nvm.sh\"
    cd '$APP_DIR'
    npx pm2 start ecosystem.config.js
    npx pm2 save
"

# Setup pm2 startup script (runs as root, launches pm2 for app user on boot)
env PATH="$(dirname "$NODE_PATH"):$PATH" "$(dirname "$NPX_PATH")/npx" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" 2>&1 | tail -3

success "pm2 started and configured for autostart on boot."

# ---------------------------------------------------------------------------
# Step 10: SSH hardening & fail2ban
# ---------------------------------------------------------------------------
info "Step 10/10: Hardening SSH and configuring fail2ban..."

# Check if the app user has an authorized SSH key
APP_SSH_DIR="$APP_HOME/.ssh"
APP_AUTH_KEYS="$APP_SSH_DIR/authorized_keys"

if [[ ! -f "$APP_AUTH_KEYS" ]] || [[ ! -s "$APP_AUTH_KEYS" ]]; then
    warn ""
    warn "═══════════════════════════════════════════════════════════════"
    warn " No SSH public key found for user '$APP_USER'."
    warn " SSH hardening will disable password authentication."
    warn " Without a key, you WILL be locked out of this server."
    warn "═══════════════════════════════════════════════════════════════"
    warn ""
    warn " To fix this, copy your public key to the server BEFORE"
    warn " enabling SSH hardening. See INSTALLATION.md for instructions."
    warn ""
    read -rp "Skip SSH hardening for now? [Y/n]: " SKIP_HARDENING
    SKIP_HARDENING="${SKIP_HARDENING:-Y}"
    if [[ "$SKIP_HARDENING" =~ ^[Yy]$ ]]; then
        warn "Skipping SSH hardening. Run the steps in INSTALLATION.md"
        warn "(Step 10) manually after copying your SSH key."
    else
        error "Aborting. Copy your SSH key first, then re-run the script."
    fi
else
    success "SSH key found for '$APP_USER'."

    # Change SSH port to 2222
    sed -i 's/^#\?Port .*/Port 2222/' /etc/ssh/sshd_config

    # Disable password authentication (requires SSH keys to be set up beforehand)
    sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config

    # Disable root login
    sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config

    systemctl restart sshd

    # Configure fail2ban
    cat > /etc/fail2ban/jail.local << 'F2BEOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = 2222
logpath = %(sshd_log)s
backend = systemd
F2BEOF

    systemctl enable fail2ban --now > /dev/null 2>&1

    success "SSH hardened (port 2222, key-only) and fail2ban enabled."
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=========================================="
echo " Installation Complete!"
echo -e "==========================================${NC}"
echo ""
echo "  Domain:        https://$DOMAIN"
echo "  App Port:      $PORT (proxied through nginx)"
echo "  FlareSolverr:  http://127.0.0.1:${FLARE_PORT}/v1"
echo "  App User:      $APP_USER"
echo "  App Dir:       $APP_DIR"
echo ""
echo "  Useful commands (run as $APP_USER):"
echo "    npx gulp           Build + reload (after making changes)"
echo "    npx gulp build     Build only"
echo "    npx gulp restart   Reload pm2 only"
echo "    npx gulp logs      View application logs"
echo "    npx gulp status    View pm2 process status"
echo "    npx pm2 list       List all pm2 processes"
echo "    npx pm2 logs       Stream live logs"
echo "    npx pm2 monit      Real-time monitoring dashboard"
echo ""
echo "  Config file:   $APP_DIR/.env"
echo "  nginx config:  /etc/nginx/sites-available/4chmg2"
echo "  SSL renewal:   Automatic via certbot timer"
echo ""
if [[ -f "$APP_AUTH_KEYS" ]] && [[ -s "$APP_AUTH_KEYS" ]]; then
    echo "  SSH Port:      2222"
    echo -e "  ${YELLOW}[IMPORTANT] SSH is now on port 2222 with key-only auth.${NC}"
    echo -e "  ${YELLOW}Connect with: ssh -p 2222 $APP_USER@\$(curl -s ifconfig.me)${NC}"
    echo ""
else
    echo -e "  ${YELLOW}[ACTION NEEDED] SSH hardening was skipped.${NC}"
    echo -e "  ${YELLOW}Copy your SSH key and follow Step 10 in INSTALLATION.md.${NC}"
    echo ""
fi
if [[ -z "$SSL_EMAIL" ]]; then
    echo -e "  ${YELLOW}[ACTION NEEDED] Run: sudo certbot --nginx -d $DOMAIN${NC}"
    echo ""
fi
