const { createBrowser } = require('./puppeteerConfig');
const keywords = require('../config/keywords');

const LOCATIONS = ['United States', 'United Kingdom', 'Canada'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoScroll(page, steps = 3) {
  for (let i = 0; i < steps; i += 1) {
    await page.evaluate(() => {
      window.scrollBy(0, 400);
    });
    await sleep(2000 + Math.random() * 3000);
  }
}

function buildSearchUrl(keyword, location) {
  const base = 'https://www.linkedin.com/jobs/search/';
  const params = new URLSearchParams({
    keywords: keyword,
    location,
    f_TPR: 'r259200', // past 3 days
  });
  return `${base}?${params.toString()}`;
}

async function extractJobsFromPage(page) {
  const jobs = await page.$$eval('.job-search-card, .base-card', (cards) =>
    cards.map((card) => {
      const titleEl =
        card.querySelector('.job-search-card__title') ||
        card.querySelector('.base-search-card__title');
      const companyEl =
        card.querySelector('.base-search-card__subtitle a') ||
        card.querySelector('.job-search-card__company-name');
      const dateEl =
        card.querySelector('.job-search-card__listdate') ||
        card.querySelector('.job-search-card__listdate--new') ||
        card.querySelector('time');
      const posterAnchor = card.querySelector('a[href^="/in/"]');
      const jobLink =
        card.querySelector('a[href*="/jobs/view/"]') ||
        card.querySelector('a.base-card__full-link');

      const name = posterAnchor ? posterAnchor.textContent.trim() : null;
      const profileUrl = posterAnchor ? posterAnchor.getAttribute('href') : null;
      const company = companyEl ? companyEl.textContent.trim() : null;
      const title = titleEl ? titleEl.textContent.trim() : null;
      const postedAgo = dateEl ? dateEl.textContent.trim() : null;
      const jobUrl = jobLink ? jobLink.getAttribute('href') : null;

      if (!jobUrl) return null;

      return {
        name,
        profileUrl: profileUrl && profileUrl.startsWith('http')
          ? profileUrl
          : profileUrl
          ? `https://www.linkedin.com${profileUrl}`
          : null,
        company,
        title,
        postedAgo,
        jobUrl: jobUrl.startsWith('http')
          ? jobUrl
          : `https://www.linkedin.com${jobUrl}`,
      };
    }).filter(Boolean),
  );

  return jobs;
}

async function scrapeJobs({ cyclePages = 15, maxLeads = 200 } = {}) {
  const browser = await createBrowser();
  const page = await browser.newPage();

  const pickedKeywords = [...keywords];
  // Shuffle keywords to randomize
  for (let i = pickedKeywords.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pickedKeywords[i], pickedKeywords[j]] = [pickedKeywords[j], pickedKeywords[i]];
  }

  const usedKeywords = pickedKeywords.slice(0, 6);

  const allLeads = [];

  try {
    for (const keyword of usedKeywords) {
      for (const location of LOCATIONS) {
        if (allLeads.length >= maxLeads) break;

        const url = buildSearchUrl(keyword, location);
        console.log('[scraper] Navigating to:', url);

        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });

        await sleep(4000 + Math.random() * 4000);
        await autoScroll(page, 3);

        const jobs = await extractJobsFromPage(page);
        console.log(
          `[scraper] Parsed ${jobs.length} jobs for "${keyword}" in "${location}"`,
        );

        for (const job of jobs) {
          allLeads.push(job);
          if (allLeads.length >= maxLeads || allLeads.length >= cyclePages * 10) {
            break;
          }
        }

        await sleep(3000 + Math.random() * 3000);

        if (allLeads.length >= maxLeads) break;
      }
      if (allLeads.length >= maxLeads) break;
    }
  } finally {
    await browser.close();
  }

  return allLeads;
}

module.exports = {
  scrapeJobs,
};
