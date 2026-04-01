const { exec } = require('child_process');
const path = require('path');

// Load .env for RAYON_NUM_THREADS and other build-time vars
require('dotenv').config();

function run(cmd) {
  return new Promise((resolve, reject) => {
    console.log(`> ${cmd}`);
    const child = exec(cmd, {
      cwd: __dirname,
      env: { ...process.env },
    });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`Command failed with exit code ${code}: ${cmd}`));
      else resolve();
    });
  });
}

// Remove stale .next/lock file before building
async function clean() {
  const fs = require('fs');
  const lockPath = path.join(__dirname, '.next', 'lock');
  if (fs.existsSync(lockPath)) {
    fs.rmSync(lockPath, { recursive: true });
    console.log('Removed stale .next/lock');
  }
}

// Run next build
async function build() {
  await clean();
  const threads = process.env.RAYON_NUM_THREADS;
  const prefix = threads ? `RAYON_NUM_THREADS=${threads} ` : '';
  await run(`${prefix}npx next build`);
}

// Reload pm2 (zero-downtime restart)
async function restart() {
  await run('npx pm2 reload ecosystem.config.js');
}

// Start pm2 process (first time)
async function start() {
  await run('npx pm2 start ecosystem.config.js');
  await run('npx pm2 save');
}

// Stop pm2 process
async function stop() {
  await run('npx pm2 stop ecosystem.config.js');
}

// Full reset: install deps, build, start pm2
async function reset() {
  await run('npm install');
  await build();
  await start();
  console.log('\n4CHMG2 is running. Check status with: npx pm2 list');
}

// Default task: build + reload (the everyday workflow)
const defaultTask = async function defaultTask() {
  await build();
  await restart();
  console.log('\nBuild complete and server reloaded.');
};

// pm2 logs shortcut
async function logs() {
  await run('npx pm2 logs 4chmg2 --lines 50');
}

// pm2 status shortcut
async function status() {
  await run('npx pm2 list');
}

exports.build = build;
exports.restart = restart;
exports.start = start;
exports.stop = stop;
exports.reset = reset;
exports.logs = logs;
exports.status = status;
exports.clean = clean;
exports.default = defaultTask;
