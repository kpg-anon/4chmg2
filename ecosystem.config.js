const { loadEnv } = require('./load-env');

loadEnv(__dirname);

module.exports = {
  apps: [{
    name: '4chmg2',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
      HOST: process.env.HOST || '127.0.0.1',
      FLARESOLVERR_URL: process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1',
    },
    // Fork mode — Next.js handles its own internal worker management
    exec_mode: 'fork',
    instances: 1,
    // Auto-restart on crash
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    // Memory limit — restart if exceeded (adjust based on VPS RAM)
    max_memory_restart: '1G',
    // Logging
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    merge_logs: true,
    // Don't watch — we use gulp to trigger rebuilds manually
    watch: false,
  }],
};
