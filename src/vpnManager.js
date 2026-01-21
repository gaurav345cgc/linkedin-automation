const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const VPN_CONFIGS = (process.env.VPN_CONFIGS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isWindows = process.platform === 'win32';
const useSudo = process.env.VPN_USE_SUDO !== 'false' && !isWindows;

let currentPidFile = null;

function getVpnConfigs() {
  return VPN_CONFIGS;
}

function waitForLogReady(logFile, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const checkLog = () => {
      if (!fs.existsSync(logFile)) {
        if (Date.now() - start > timeoutMs) {
          return reject(new Error('VPN log file not created within timeout'));
        }
        return setTimeout(checkLog, 500);
      }
      const content = fs.readFileSync(logFile, 'utf8');
      if (content.includes('Initialization Sequence Completed')) {
        return resolve();
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('VPN initialization timeout'));
      }
      setTimeout(checkLog, 1000);
    };

    checkLog();
  });
}

async function connectVpn(configPath) {
  if (isWindows) {
    console.warn('[vpnManager] VPN is not supported on Windows dev env. Skipping connect.');
    return null;
  }

  if (!configPath) {
    if (!VPN_CONFIGS.length) {
      throw new Error('No VPN_CONFIGS provided in environment');
    }
    // Default to first config if none explicitly passed
    // eslint-disable-next-line prefer-destructuring
    configPath = VPN_CONFIGS[0];
  }

  const absConfig = path.isAbsolute(configPath)
    ? configPath
    : path.join(process.cwd(), configPath);

  if (!fs.existsSync(absConfig)) {
    throw new Error(
      `OpenVPN config not found: ${absConfig}. Fix VPN_CONFIGS to point to real .ovpn paths (e.g. "${path.join(
        'vpn',
        'proton-us.ovpn',
      )}").`,
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(LOG_DIR, `openvpn-${timestamp}.log`);
  const pidFile = path.join(os.tmpdir(), `openvpn-${timestamp}.pid`);
  currentPidFile = pidFile;

  const baseArgs = [
    '--config',
    absConfig,
    '--daemon',
    '--log-append',
    logFile,
    '--writepid',
    pidFile,
  ];

  const cmd = useSudo ? 'sudo' : 'openvpn';
  const args = useSudo ? ['openvpn', ...baseArgs] : baseArgs;

  console.log('[vpnManager] Starting OpenVPN with config:', absConfig);

  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (buf) => {
    const s = String(buf).trim();
    if (s) console.log('[vpnManager:stdout]', s);
  });
  child.stderr.on('data', (buf) => {
    const s = String(buf).trim();
    if (s) console.error('[vpnManager:stderr]', s);
  });

  child.on('error', (err) => {
    console.error('[vpnManager] openvpn spawn error:', err.message);
  });

  child.on('close', (code) => {
    if (code && code !== 0) {
      console.error('[vpnManager] openvpn process exited with code:', code);
    }
  });

  await waitForLogReady(logFile);

  console.log('[vpnManager] VPN connected. Log file:', logFile);
  return { logFile, pidFile };
}

async function disconnectVpn() {
  if (isWindows) {
    console.warn('[vpnManager] VPN is not supported on Windows dev env. Skipping disconnect.');
    return;
  }

  if (!currentPidFile || !fs.existsSync(currentPidFile)) {
    console.warn('[vpnManager] No VPN pid file found, nothing to disconnect.');
    return;
  }

  const pidStr = fs.readFileSync(currentPidFile, 'utf8').trim();
  const pid = Number(pidStr);

  if (!pid || Number.isNaN(pid)) {
    console.warn('[vpnManager] Invalid PID in pid file:', pidStr);
    return;
  }

  console.log('[vpnManager] Disconnecting VPN, PID:', pid);

  try {
    process.kill(pid);
  } catch (err) {
    console.warn('[vpnManager] process.kill failed, trying sudo kill:', err.message);
    if (useSudo) {
      await new Promise((resolve) => {
        const killer = spawn('sudo', ['kill', String(pid)], { stdio: 'ignore' });
        killer.on('close', () => resolve());
      });
    }
  }

  try {
    fs.unlinkSync(currentPidFile);
  } catch (err) {
    // ignore
  }

  currentPidFile = null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withVpnCycle({ configPath, scrapeFn, waitBeforeScrapeMs = 10000, sleepAfterMs = 5 * 60 * 1000 }) {
  const vpnInfo = await connectVpn(configPath);
  try {
    await sleep(waitBeforeScrapeMs);
    const result = await scrapeFn();
    await disconnectVpn();
    if (sleepAfterMs > 0) {
      await sleep(sleepAfterMs);
    }
    return result;
  } catch (err) {
    console.error('[vpnManager] Error during VPN cycle:', err.message);
    await disconnectVpn();
    throw err;
  }
}

module.exports = {
  getVpnConfigs,
  connectVpn,
  disconnectVpn,
  withVpnCycle,
  sleep,
};

