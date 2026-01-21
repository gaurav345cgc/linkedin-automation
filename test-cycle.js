require('dotenv').config();

const https = require('https');
const { connectVpn, disconnectVpn, sleep, getVpnConfigs } = require('./src/vpnManager');
const { scrapeJobs } = require('./src/scraper');

function fetchIp() {
  return new Promise((resolve) => {
    https
      .get('https://ifconfig.me/ip', (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data.trim());
        });
      })
      .on('error', () => resolve('unknown'));
  });
}

async function main() {
  console.log('VPN_CONFIGS:', process.env.VPN_CONFIGS || '(not set)');

  const beforeIp = await fetchIp();
  console.log('IP before VPN:', beforeIp);

  const vpnConfigs = getVpnConfigs();
  const configToUse = vpnConfigs[0];

  try {
    await connectVpn(configToUse);
    console.log('VPN connected, waiting 10s before scraping...');
    await sleep(10000);

    const afterIp = await fetchIp();
    console.log('IP after VPN:', afterIp);

    const leads = await scrapeJobs({ cyclePages: 15, maxLeads: 150 });
    console.log(`Total leads parsed: ${leads.length}`);
    console.log('Sample leads (first 12):');
    console.log(leads.slice(0, 12));
  } catch (err) {
    console.error('Error in test-cycle:', err);
  } finally {
    await disconnectVpn();
    console.log('VPN disconnected, exiting.');
    process.exit(0);
  }
}

main();

