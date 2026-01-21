const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

function createUserAgent() {
  const ua = new UserAgent({
    deviceCategory: 'desktop',
  });
  return ua.toString();
}

async function createBrowser() {
  const userAgent = createUserAgent();

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1366,768',
    ],
    defaultViewport: {
      width: 1366,
      height: 768,
    },
  });

  const [page] = await browser.pages();
  if (page) {
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1366, height: 768 });
  }

  return browser;
}

module.exports = {
  createBrowser,
};

