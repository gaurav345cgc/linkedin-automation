## Project Context: LinkedIn Leads MVP (VPN-Based)

### Goals
- Scrape public LinkedIn sales-focused job posts (US/UK/Canada) with Puppeteer + stealth.
- Rotate free VPN profiles (ProtonVPN/Windscribe) per cycle to avoid paid proxies.
- Deduplicate and store leads locally (SQLite), then auto-append new leads to Google Sheets (service account).
- Target 40–60 unique leads/day within 7–10 days; cron at 9 AM/3 PM IST.

### Environment & Stack
- Node.js 20+, npm.
- Key deps: puppeteer, puppeteer-extra, puppeteer-extra-plugin-stealth, node-cron, better-sqlite3, dotenv, user-agents, googleapis, express, cors, helmet.
- Dev/ops: nodemon, pm2.
- VPN: openvpn CLI with multiple `.ovpn` configs in `/vpn` (e.g., proton-us.ovpn, proton-nl.ovpn, proton-jp.ovpn).
- Env vars: `VPN_CONFIGS` (comma list of ovpn paths), `SHEET_ID`, `GOOGLE_SERVICE_KEY` (path to keys.json).

### Files & Modules (planned)
- `src/vpn.js`: connect/disconnect via openvpn; log watcher for “Initialization Sequence Completed”; timeout handling; PID tracking.
- `src/puppeteerConfig.js`: launch with stealth plugin, random UA; no proxy args (traffic via VPN).
- `src/scraper.js`: navigate LinkedIn job search URLs with keyword/location rotation; scroll & random delays; extract job cards (poster/profile URL, company, title, postedAgo, jobUrl); handles 403/429 with retries and VPN rotation hooks.
- `src/enrich.js` (or inline): visit company page to pull employee size and industry for top ~30% newest leads.
- `src/db.js`: better-sqlite3; table with unique profileUrl hash; insertIfNew, getTodays.
- `src/sheets.js`: Google Sheets API v4 append; values format: Timestamp, Poster Name, Poster URL, Company, Job Title, Posted Date, Employee Count, Industry, Status (default Pending); batchUpdate for status changes.
- `src/main.js`: orchestrate VPN cycle → scrape (cyclePages ~15) → enrich top slice → dedupe/store → append new rows to Sheet; includes delays and metrics.
- `src/server.js`: Express API (POST /run-scrape triggers main; GET /status; POST /update-status; GET /leads).
- `test-cycle.js`: single VPN connect + scrape smoke test (console leads).

### Phases (reference)
- Phase 0: repo init, deps, scripts, .env scaffold, folders.
- Phase 1: VPN manager + core scraping (no Sheets yet); validate IP changes and ~12+ leads sample.
- Phase 2: Enrichment + SQLite dedupe.
- Phase 3: Google Sheets append + status updates.
- Phase 4: Orchestration + cron (9/15 IST), logging/metrics.
- Phase 5: Express API endpoints for control/ops.
- Phase 6: VPS deploy with PM2; sudoers for openvpn; ufw open 1194/udp.
- Phase 7: Optimize/scale (extra VPN profiles, filters, alerts).

### Safety & Ops Notes
- Use random delays (3–12s), limited pages (~45/day in MVP), rotate VPN between cycles; watch for 403/429.
- Screenshot/log on failures; retry per VPN config on connect errors; sleep 5 min between VPN cycles.
- Keep Google Sheet headers: Timestamp, Poster Name, Poster URL, Company, Job Title, Posted Date, Employee Count, Industry, Status.

### Success Criteria (near term)
- Phase 0–1 complete locally: `npm run dev` server up; `node test-cycle.js` completes one VPN cycle with >70% parse rate and visible IP change.
- Within 7–10 days: steady 40–60 leads/day auto-appended to Sheet; dedupe holds; cron runs reliably.
