# 4CHMG2 Installation Guide

These instructions will walk you through setting up 4CHMG2 on a fresh Debian 12 (Bookworm) VPS. There is an automated install script for the impatient, and a full manual walkthrough for everyone else.

If something breaks, check the [Troubleshooting](#troubleshooting) section at the bottom before opening an issue.

---

## Table of Contents

- [Requirements](#requirements)
- [Quick Install (Automated)](#quick-install-automated)
- [Manual Installation](#manual-installation)
  - [Step 0: Clone the Repository & SSH Keys](#step-0-clone-the-repository--ssh-keys)
  - [Step 1: System Packages](#step-1-system-packages)
  - [Step 2: Firewall](#step-2-firewall)
  - [Step 3: Node.js via nvm](#step-3-nodejs-via-nvm)
  - [Step 4: Docker & FlareSolverr](#step-4-docker--flaresolverr)
  - [Step 5: Configuration (.env)](#step-5-configuration-env)
  - [Step 6: Install Dependencies](#step-6-install-dependencies)
  - [Step 7: Build the Application](#step-7-build-the-application)
  - [Step 8: nginx Reverse Proxy & SSL](#step-8-nginx-reverse-proxy--ssl)
  - [Step 9: pm2 Process Manager & Autostart](#step-9-pm2-process-manager--autostart)
  - [Step 10: SSH Hardening & fail2ban](#step-10-ssh-hardening--fail2ban)
- [Usage](#usage)
  - [Everyday Workflow](#everyday-workflow)
  - [Gulp Commands](#gulp-commands)
  - [pm2 Commands](#pm2-commands)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)
- [Uninstalling](#uninstalling)

---

## Requirements

Before you begin, make sure you have:

- **A VPS running Debian 12 (Bookworm).** Other Debian-based distros (Ubuntu 22.04+) will probably work but are untested.
- **Root access** or a user with `sudo` privileges.
- **A domain name** with a DNS `A` record pointing to your server's public IP address. SSL (HTTPS) will not work without this.
- **At least 2 GB of RAM.** 4 GB recommended. The Next.js build step and FlareSolverr (headless Chromium) are the heaviest consumers.
- **At least 20 GB of disk space.** SSD preferred.

### What Gets Installed

| Component | Purpose | Installed By |
|-----------|---------|--------------|
| **Node.js 22 LTS** | JavaScript runtime | nvm |
| **npm** | Package manager | Comes with Node.js |
| **nginx** | Reverse proxy, SSL termination, static file caching | apt |
| **certbot** | Free SSL certificates from Let's Encrypt | apt |
| **Docker** | Container runtime for FlareSolverr | Docker official repo |
| **FlareSolverr** | Cloudflare bypass for protected boards (easychan) | Docker container |
| **pm2** | Node.js process manager (auto-restart, logging, boot persistence) | npm (devDependency) |
| **gulp** | Build task runner (wraps next build + pm2 reload) | npm (devDependency) |
| **ufw** | Firewall | apt |
| **fail2ban** | Brute-force protection (SSH jail) | apt |

---

## Quick Install (Automated)

If you want to get up and running fast, the install script handles everything. It will prompt you for your domain, email (for SSL), and port.

> **Important:** The install script disables password authentication and moves SSH to port 2222. Copy your SSH key to the server **before** running the script.

```bash
# 1. Create a user for the application (skip if you already have a non-root user)
adduser 4chmg2
usermod -aG sudo 4chmg2

# 2. Copy your SSH key (run this from your LOCAL machine)
ssh-copy-id -i ~/.ssh/id_rsa.pub 4chmg2@your-server-ip

# 3. Switch to the app user
su - 4chmg2

# 4. Clone the repository
git clone https://github.com/YOUR_USERNAME/4chmg2.git
cd 4chmg2

# 5. Run the install script
sudo ./install.sh
```

The script will:
1. Install all system dependencies (nginx, certbot, docker, fail2ban, etc.)
2. Configure the firewall (SSH on port 2222 + HTTP/HTTPS only)
3. Install Docker and start FlareSolverr
4. Install Node.js 22 LTS via nvm
5. Write your `.env` configuration file
6. Run `npm install` and build the application
7. Configure nginx as a reverse proxy with SSL
8. Start the application with pm2 and configure it to survive reboots
9. Harden SSH (port 2222, key-only auth, no root login)
10. Configure fail2ban to protect SSH

When it finishes, your site should be live at `https://yourdomain.com`.

If SSH hardening was applied, connections will use port 2222:
```bash
ssh -p 2222 4chmg2@your-server-ip
```

If SSH keys were not found, the script will skip hardening and let you set it up later (see [Step 10](#step-10-ssh-hardening--fail2ban)).

If anything goes wrong, the script will tell you where it failed. You can fix the issue and re-run the script — it's safe to run multiple times.

---

## Manual Installation

### Step 0: Clone the Repository & SSH Keys

Create a dedicated user for the application. Do not run 4CHMG2 as root.

```bash
# Create user (as root)
adduser 4chmg2
usermod -aG sudo 4chmg2
```

> ### :warning: CRITICAL: Copy Your SSH Key Before Step 10
>
> Step 10 disables password authentication. If you run it without a working SSH key, **you will be locked out of your server**. The install script will detect this and offer to skip hardening, but you should set up your key now.
>
> **Option A: `ssh-copy-id` (if available)**
>
> Run this from your **local machine**:
> ```bash
> ssh-copy-id -i ~/.ssh/id_rsa.pub 4chmg2@your-server-ip
> ```
>
> **Option B: Manual copy (works everywhere)**
>
> 1. On your **local machine**, print your public key:
>    ```bash
>    cat ~/.ssh/id_rsa.pub
>    ```
>    If you don't have one, generate it first:
>    ```bash
>    ssh-keygen -t ed25519
>    cat ~/.ssh/id_ed25519.pub
>    ```
>
> 2. Copy the entire output (starts with `ssh-rsa` or `ssh-ed25519`).
>
> 3. On the **server** as root, create the `.ssh` directory for the app user and paste the key:
>    ```bash
>    mkdir -p /home/4chmg2/.ssh
>    nano /home/4chmg2/.ssh/authorized_keys
>    # Paste your public key, save, and exit
>    ```
>
> 4. Set the correct permissions (SSH is strict about this):
>    ```bash
>    chmod 700 /home/4chmg2/.ssh
>    chmod 600 /home/4chmg2/.ssh/authorized_keys
>    chown -R 4chmg2:4chmg2 /home/4chmg2/.ssh
>    ```
>
> **Verify key auth works** before continuing — from your local machine:
> ```bash
> ssh 4chmg2@your-server-ip
> ```
> You should get in without being asked for a password.

Then clone the repo:

```bash
# Switch to the new user
su - 4chmg2

# Clone the repo
git clone https://github.com/kpg-anon/4chmg2.git
cd 4chmg2
```

All subsequent commands assume you are in the repository directory (`~/4chmg2`) unless otherwise noted.

---

### Step 1: System Packages

Install the base packages needed for building and running the application.

```bash
sudo apt-get update
sudo apt-get install -y \
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
    fail2ban
```

**What these are for:**
- `build-essential` — C/C++ compiler toolchain, needed by some npm packages with native bindings
- `nginx` — Web server / reverse proxy that sits in front of Next.js
- `certbot` + `python3-certbot-nginx` — Automatic free SSL certificates from Let's Encrypt
- `ufw` — Simple firewall frontend
- `fail2ban` — Intrusion prevention (bans IPs after failed login attempts)
- Everything else — standard utilities needed by later steps

---

### Step 2: Firewall

Lock down the server to only allow SSH (on port 2222) and web traffic. Your Next.js server listens on a local port (default 3000) that should NOT be directly exposed to the internet. nginx handles all public traffic.

```bash
# Reset to clean state
sudo ufw --force reset

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH on port 2222 (step 10 will move SSH to this port)
sudo ufw allow 2222/tcp

# Allow HTTP and HTTPS (nginx)
sudo ufw allow 'Nginx Full'

# Enable the firewall
sudo ufw --force enable

# Verify
sudo ufw status
```

Expected output:
```
Status: active

To                         Action      From
--                         ------      ----
2222/tcp                   ALLOW       Anywhere
80,443/tcp (Nginx Full)    ALLOW       Anywhere
2222/tcp (v6)              ALLOW       Anywhere (v6)
80,443/tcp (Nginx Full (v6)) ALLOW     Anywhere (v6)
```

> **Note:** Keep your current SSH session open until you've completed Step 10 and verified you can connect on port 2222.

---

### Step 3: Node.js via nvm

We use [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) to install Node.js. This keeps Node.js in your home directory and makes version management easy.

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Load nvm into current shell (or restart your terminal)
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

# Install Node.js 22 LTS
nvm install 22

# Set as default
nvm alias default 22

# Verify
node --version   # Should print v22.x.x
npm --version    # Should print 10.x.x or later
```

**Why nvm instead of apt?** Debian's packaged Node.js is ancient. nvm gives you the latest LTS release and lets you switch versions without touching system packages. It also means you don't need root to install global npm packages.

**Why Node.js 22?** It's the current LTS (Long Term Support) release. Next.js 16 requires Node.js 18.18+. Node 22 gives you the best performance and will be supported until April 2027.

---

### Step 4: Docker & FlareSolverr

FlareSolverr is a proxy server that uses a headless Chromium browser to solve Cloudflare challenges. It's required for accessing Cloudflare-protected imageboards (currently easychan). We run it as a Docker container so it's isolated and easy to manage.

**If you don't plan to use Cloudflare-protected boards**, you can skip this step entirely. The application will work fine without it — those specific boards just won't load.

#### Install Docker

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER

# IMPORTANT: Log out and back in for the group change to take effect
# Or run: newgrp docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Verify
docker --version
```

#### Start FlareSolverr

```bash
docker run -d \
    --name flaresolverr \
    --restart unless-stopped \
    -p 127.0.0.1:8191:8191 \
    -e LOG_LEVEL=info \
    ghcr.io/flaresolverr/flaresolverr:latest
```

**Breakdown of flags:**
- `-d` — Run in the background (detached)
- `--name flaresolverr` — Name the container so you can manage it easily
- `--restart unless-stopped` — Auto-restart on crash or reboot (unless you manually stop it)
- `-p 127.0.0.1:8191:8191` — Expose port 8191 on localhost only (not the internet)
- `-e LOG_LEVEL=info` — Set log verbosity

**Verify it's running:**
```bash
docker ps
# Should show flaresolverr container with status "Up"

# Test it responds
curl -s http://127.0.0.1:8191 | head -1
# Should return HTML or JSON indicating FlareSolverr is running
```

**Using a different port:** If port 8191 is taken, change the first port number: `-p 127.0.0.1:21674:8191`. Then update `FLARESOLVERR_URL` in your `.env` file to match (e.g., `http://127.0.0.1:21674/v1`).

---

### Step 5: Configuration (.env)

All instance-specific configuration lives in a `.env` file. This file is gitignored and never committed — it contains your domain, port, and service URLs.

```bash
# Copy the example configuration
cp .env.example .env

# Edit with your values
nano .env
```

Here's what each variable does:

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `example.com` | Your public domain name. Used by nginx and the install script. No protocol prefix, no trailing slash. |
| `SSL_EMAIL` | `you@example.com` | Email address for Let's Encrypt SSL certificate registration. You'll get expiry warnings here. |
| `PORT` | `3000` | Port the Next.js server listens on. nginx proxies public traffic to this port. Pick any unused port. |
| `HOST` | `127.0.0.1` | Bind address. Use `127.0.0.1` when behind nginx (recommended). Use `0.0.0.0` only for direct access without nginx. |
| `FLARESOLVERR_URL` | `http://127.0.0.1:8191/v1` | FlareSolverr API endpoint. Change the port if you used a custom one in Step 4. |
| `RAYON_NUM_THREADS` | (unset) | Limits parallel threads during `next build`. Set to `2` on shared servers with low ulimits. On a dedicated VPS you can leave this unset. |
| `ALLOWED_DEV_ORIGINS` | (unset) | Comma-separated list of origins for Next.js dev server CORS. Only needed during development. |

**Example .env for a typical VPS:**
```env
DOMAIN=yourdomain.com
SSL_EMAIL=you@email.com
PORT=3000
HOST=127.0.0.1
FLARESOLVERR_URL=http://127.0.0.1:8191/v1
```

---

### Step 6: Install Dependencies

```bash
npm install
```

This installs all production and development dependencies from `package.json`, including:
- **Next.js** — the web framework
- **React** — UI library
- **Axios** — HTTP client for API proxy routes
- **gulp** — build task runner
- **pm2** — process manager
- **dotenv** — loads `.env` configuration
- **Tailwind CSS** — utility CSS framework

The `node_modules` directory will be around 300-500 MB. This is normal for a Next.js project.

---

### Step 7: Build the Application

```bash
npx gulp build
```

This runs `next build`, which:
1. Compiles all TypeScript to JavaScript
2. Optimizes and bundles React components
3. Generates static assets (CSS, JS chunks)
4. Creates the production server in `.next/`

The build takes 30-90 seconds depending on your server's CPU. You'll see output like:

```
> npx next build
   ▲ Next.js 16.x.x

   Creating an optimized production build ...
 ✓ Compiled successfully
 ✓ Linting and checking validity of types
 ✓ Collecting page data
 ✓ Generating static pages
 ✓ Collecting build traces
 ✓ Finalizing page optimization

Route (app)                    Size     First Load JS
┌ ○ /                          ...      ...
├ ○ /search                    ...      ...
├ ƒ /api/catalog               ...      ...
├ ƒ /api/proxy                 ...      ...
└ ... (more routes)

✓ Build completed
```

If the build fails, check:
- Node.js version is 22+ (`node --version`)
- All dependencies are installed (`npm install`)
- The `.env` file exists (even if empty)

---

### Step 8: nginx Reverse Proxy & SSL

nginx sits in front of the Next.js server and handles:
- **SSL/TLS termination** — HTTPS encryption via Let's Encrypt
- **HTTP to HTTPS redirect** — All HTTP traffic redirected to HTTPS (added by certbot)
- **Rate limiting** — 10 requests/second per IP with burst allowance
- **Gzip compression** — Compresses text responses
- **Static asset caching** — `/_next/static/` files cached for 1 year
- **Proxy buffering** — Buffers large media proxy responses
- **Security headers** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy

The nginx template starts as **HTTP-only**. When you run certbot in the next step, it automatically adds the HTTPS server block, SSL certificates, and HTTP-to-HTTPS redirect. This avoids the chicken-and-egg problem of needing certificates before nginx can start with SSL.

#### Configure nginx

```bash
# Copy the template to nginx's config directory
sudo cp nginx/4chmg2.conf.example /etc/nginx/sites-available/4chmg2

# Replace placeholders with your actual values
sudo sed -i "s/DOMAIN_PLACEHOLDER/yourdomain.com/g" /etc/nginx/sites-available/4chmg2
sudo sed -i "s/PORT_PLACEHOLDER/3000/g" /etc/nginx/sites-available/4chmg2
```

Replace `yourdomain.com` with your actual domain and `3000` with your port from `.env`.

```bash
# Enable the site
sudo ln -sf /etc/nginx/sites-available/4chmg2 /etc/nginx/sites-enabled/4chmg2

# Remove the default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test the configuration for syntax errors
sudo nginx -t
```

You should see:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

If the test fails, check `/etc/nginx/sites-available/4chmg2` for typos in your domain or port.

```bash
# Reload nginx to apply the new configuration
sudo systemctl reload nginx
```

#### Get an SSL Certificate

**Before this step**, make sure your domain's DNS `A` record points to your server's IP address. You can check with:

```bash
dig +short yourdomain.com
# Should return your server's public IP
```

If DNS isn't set up yet, skip certbot for now and come back to it later. The site will work on HTTP in the meantime.

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot will:
1. Verify you own the domain (via HTTP challenge)
2. Generate a free SSL certificate
3. Automatically modify your nginx config to use it
4. Set up automatic renewal (certificates expire every 90 days, certbot renews them automatically via a systemd timer)

**Verify auto-renewal is set up:**
```bash
sudo systemctl status certbot.timer
# Should show "active (waiting)"

# Test renewal (dry run, doesn't actually renew)
sudo certbot renew --dry-run
```

---

### Step 9: pm2 Process Manager & Autostart

pm2 keeps your Next.js server running in the background, restarts it if it crashes, and starts it automatically on server reboot.

#### Start the Application

```bash
# Start the server using the ecosystem config
npx pm2 start ecosystem.config.js

# Save the process list (so pm2 knows what to restart on boot)
npx pm2 save
```

**Verify it's running:**
```bash
npx pm2 list
```

You should see:
```
┌────┬──────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name     │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼──────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ 4chmg2   │ default     │ 0.2.0   │ fork    │ 12345    │ 5s     │ 0    │ online    │ 0%       │ 150mb    │ 4chmg2   │ disabled │
└────┴──────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

The status should be `online`. If it says `errored`, check the logs:
```bash
npx pm2 logs 4chmg2 --lines 30
```

#### Configure Autostart on Boot

This generates a systemd service that starts pm2 (and your saved processes) when the server boots.

```bash
# Generate the startup script (run as your app user, not root)
npx pm2 startup
```

pm2 will print a command that you need to run as root. It will look something like:
```
sudo env PATH=$PATH:/home/4chmg2/.nvm/versions/node/v22.x.x/bin pm2 startup systemd -u 4chmg2 --hp /home/4chmg2
```

**Copy and run that exact command.** Then save the process list again:
```bash
npx pm2 save
```

**Verify autostart works** by rebooting the server:
```bash
sudo reboot
```

After reconnecting via SSH:
```bash
npx pm2 list
# Should show 4chmg2 with status "online"
```

---

### Step 10: SSH Hardening & fail2ban

This step moves SSH to a non-standard port, disables password authentication, and sets up fail2ban to block brute-force attempts.

> :warning: **Before proceeding:** Make sure your SSH key is already copied to the server and that you can log in to the `4chmg2` user without a password. If you skipped this in Step 0, go back and do it now. This step disables password auth — **if your key isn't set up, you will be permanently locked out.**

#### Change SSH Port and Disable Password Auth

```bash
# Move SSH to port 2222
sudo sed -i 's/^#\?Port .*/Port 2222/' /etc/ssh/sshd_config

# Disable password authentication (key-only)
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config

# Disable root login
sudo sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
```

Verify the changes:
```bash
grep -E '^(Port|PasswordAuthentication|PermitRootLogin)' /etc/ssh/sshd_config
# Should show:
# Port 2222
# PasswordAuthentication no
# PermitRootLogin no
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

**Keep your current session open** and test the new port from your local machine:
```bash
ssh -p 2222 4chmg2@your-server-ip
```

Once confirmed, you can close the old session.

#### Configure fail2ban

fail2ban monitors SSH login attempts and temporarily bans IPs after repeated failures.

```bash
# Create local config (survives package upgrades)
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = 2222
logpath = %(sshd_log)s
backend = systemd
EOF

# Enable and start fail2ban
sudo systemctl enable fail2ban --now
```

Verify the SSH jail is active:
```bash
sudo fail2ban-client status sshd
```

You should see:
```
Status for the jail: sshd
|- Filter
|  |- Currently failed: 0
|  |- Total failed:     0
|  `- File list:        /var/log/auth.log
`- Actions
   |- Currently banned: 0
   |- Total banned:     0
   `- Banned IP list:
```

**Useful fail2ban commands:**

| Command | What it does |
|---------|--------------|
| `sudo fail2ban-client status sshd` | Show jail status and banned IPs |
| `sudo fail2ban-client set sshd unbanip 1.2.3.4` | Manually unban an IP |
| `sudo fail2ban-client set sshd banip 1.2.3.4` | Manually ban an IP |
| `sudo tail -f /var/log/fail2ban.log` | Stream fail2ban logs |

---

## Usage

### Everyday Workflow

The typical workflow after making code changes:

```bash
# 1. Make your code changes
nano src/components/Gallery.tsx  # or whatever editor you use

# 2. Build and reload
npx gulp
```

That's it. `npx gulp` (with no arguments) runs the default task, which:
1. Cleans any stale `.next/lock` files
2. Runs `next build` to compile your changes
3. Tells pm2 to reload the server (zero-downtime restart)

Your changes are live within 30-90 seconds (build time).

### Gulp Commands

| Command | What it does |
|---------|--------------|
| `npx gulp` | **Default.** Build + reload pm2. This is what you run after making changes. |
| `npx gulp build` | Build only (run `next build`). Does not restart the server. |
| `npx gulp restart` | Reload pm2 only. Use if you already built and just need to restart. |
| `npx gulp start` | Start the pm2 process for the first time. Runs `pm2 start` + `pm2 save`. |
| `npx gulp stop` | Stop the pm2 process. |
| `npx gulp reset` | Full setup: `npm install` + build + start pm2. Use after a fresh clone. |
| `npx gulp logs` | Show the last 50 lines of application logs. |
| `npx gulp status` | Show pm2 process status. |
| `npx gulp clean` | Remove stale `.next/lock` file (runs automatically before build). |

### pm2 Commands

For more advanced process management:

| Command | What it does |
|---------|--------------|
| `npx pm2 list` | Show all managed processes and their status. |
| `npx pm2 logs` | Stream live logs from all processes (Ctrl+C to stop). |
| `npx pm2 logs 4chmg2 --lines 100` | Show last 100 lines of 4chmg2 logs. |
| `npx pm2 monit` | Real-time monitoring dashboard (CPU, memory, logs). |
| `npx pm2 reload ecosystem.config.js` | Zero-downtime restart. |
| `npx pm2 restart ecosystem.config.js` | Hard restart (brief downtime). |
| `npx pm2 stop 4chmg2` | Stop the process. |
| `npx pm2 delete 4chmg2` | Remove from pm2's process list entirely. |
| `npx pm2 save` | Save current process list (for autostart on boot). |
| `npx pm2 flush` | Clear all log files. |

---

## Updating

When new changes are pushed to the repository:

```bash
# 1. Pull the latest code
git pull

# 2. Install any new dependencies (only needed if package.json changed)
npm install

# 3. Build and reload
npx gulp
```

If `package.json` hasn't changed, you can skip `npm install` and just run `npx gulp`.

**If there were changes to the nginx config template** (`nginx/4chmg2.conf.example`):

```bash
# Check what changed
git diff HEAD~1 nginx/4chmg2.conf.example

# Re-generate your config from the new template
sudo cp nginx/4chmg2.conf.example /etc/nginx/sites-available/4chmg2
sudo sed -i "s/DOMAIN_PLACEHOLDER/yourdomain.com/g" /etc/nginx/sites-available/4chmg2
sudo sed -i "s/PORT_PLACEHOLDER/3000/g" /etc/nginx/sites-available/4chmg2

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

**If there were changes to ecosystem.config.js:**

```bash
# Restart pm2 with the new config
npx pm2 restart ecosystem.config.js
npx pm2 save
```

---

## Troubleshooting

### Build fails with "ENOMEM" or out of memory

Your server doesn't have enough RAM for the build. Options:
1. Add swap space:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
2. Set `RAYON_NUM_THREADS=1` in `.env` to reduce build parallelism.

### Build fails with "EMFILE" or "too many open files"

Set `RAYON_NUM_THREADS=2` in your `.env` file. This limits the SWC compiler's thread count.

### pm2 shows status "errored"

Check what went wrong:
```bash
npx pm2 logs 4chmg2 --lines 50
```

Common causes:
- **Port already in use:** Another process is using your configured port. Check with `ss -tlnp | grep YOUR_PORT` and kill the conflicting process.
- **Missing .next directory:** You forgot to build. Run `npx gulp build` then `npx pm2 restart ecosystem.config.js`.
- **Bad .env:** Missing or malformed environment variables. Check `.env` syntax.

### nginx returns "502 Bad Gateway"

The Next.js server isn't running or isn't listening on the expected port.

1. Check pm2: `npx pm2 list` — is the process `online`?
2. Check the port matches: your `.env` PORT must match the PORT_PLACEHOLDER you used in the nginx config.
3. Check Next.js is actually listening: `curl -I http://127.0.0.1:YOUR_PORT`

### nginx returns "504 Gateway Timeout"

A request (usually to `/api/proxy`) took too long. This is common with FlareSolverr — the first request to a Cloudflare-protected site can take 30-60 seconds while the challenge is solved.

The nginx config has 120-second timeouts. If you're still getting 504s, check:
1. FlareSolverr is running: `docker ps | grep flaresolverr`
2. FlareSolverr is responsive: `curl http://127.0.0.1:8191`
3. The target site is actually up

### Certbot fails with "DNS problem"

Your domain's `A` record doesn't point to this server. Check:
```bash
dig +short yourdomain.com
# Must return your server's public IP

# Compare with your server's IP
curl -s ifconfig.me
```

If they don't match, update your DNS and wait for propagation (up to 24 hours, usually minutes).

### FlareSolverr container keeps restarting

Check Docker logs:
```bash
docker logs flaresolverr --tail 30
```

Common causes:
- **Not enough RAM:** FlareSolverr runs headless Chromium, which needs ~500 MB. If your server is low on RAM, other things may be OOM-killed.
- **Architecture mismatch:** The default FlareSolverr image is amd64 only. If you're on ARM, you'll need to build from source.

### Site works on HTTP but not HTTPS

Certbot didn't run or failed silently. Run it manually:
```bash
sudo certbot --nginx -d yourdomain.com
```

### Changes aren't showing up after `npx gulp`

1. Hard refresh your browser (Ctrl+Shift+R / Cmd+Shift+R) to bypass browser cache.
2. Check the build actually succeeded — `npx gulp` should end with "Build complete and server reloaded."
3. Check pm2 actually reloaded: `npx pm2 list` — the uptime should be recent (seconds/minutes, not hours/days).

### "command not found: npx" after SSH

nvm isn't loaded in your shell. Add this to your `~/.bashrc` if it's not already there:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
```

Then: `source ~/.bashrc`

---

## Uninstalling

To completely remove 4CHMG2 from your server:

```bash
# Stop and remove from pm2
npx pm2 stop 4chmg2
npx pm2 delete 4chmg2
npx pm2 save

# Remove pm2 startup service
npx pm2 unstartup

# Stop and remove FlareSolverr
docker stop flaresolverr
docker rm flaresolverr

# Remove nginx config
sudo rm /etc/nginx/sites-enabled/4chmg2
sudo rm /etc/nginx/sites-available/4chmg2
sudo systemctl reload nginx

# Remove SSL certificate
sudo certbot delete --cert-name yourdomain.com

# Remove the application directory
cd ~
rm -rf ~/4chmg2

# (Optional) Remove Docker entirely
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo rm -rf /var/lib/docker

# (Optional) Remove Node.js / nvm
rm -rf ~/.nvm
```
