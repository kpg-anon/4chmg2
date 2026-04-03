const fs = require('fs');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');

function resolveEnvPath(baseDir = __dirname) {
  const candidates = [
    process.env.ENV_FILE,
    path.join(os.homedir(), '.config', '4chmg2', 'production.env'),
    path.join(baseDir, '.env'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function loadEnv(baseDir = __dirname) {
  const envPath = resolveEnvPath(baseDir);
  if (!envPath) return null;
  dotenv.config({ path: envPath });
  return envPath;
}

module.exports = { loadEnv, resolveEnvPath };
