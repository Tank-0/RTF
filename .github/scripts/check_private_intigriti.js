const fs = require('fs');
const { chromium } = require('playwright');
const { execSync } = require('child_process');

const LOGIN_URL = 'https://app.intigriti.com/researcher/login';
const PROGRAM_URL = 'https://app.intigriti.com/researcher/programs/flexmail/flexmailbugbountyprogram/detail';
const STATUS_FILE = '.github/status/last_status.txt';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Logging into Intigriti...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 60000 });

    // Fill login form
    await page.fill('input[name="email"]', process.env.INTIGRITI_EMAIL);
    await page.fill('input[name="password"]', process.env.INTIGRITI_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard redirect
    await page.waitForURL('**/researcher/dashboard', { timeout: 60000 });

    console.log('Login successful. Navigating to program...');
    await page.goto(PROGRAM_URL, { waitUntil: 'networkidle', timeout: 60000 });

    const bodyText = await page.locator('body').innerText();
    const isSuspended = bodyText.includes('This program is currently suspended');
    const status = isSuspended ? 'suspended' : 'open';

    console.log(`Detected status: ${status}`);

    let prevStatus = null;
    try { prevStatus = fs.readFileSync(STATUS_FILE, 'utf8').trim(); } catch {}

    if (prevStatus !== status) {
      fs.writeFileSync(STATUS_FILE, status);

      if (status === 'open') {
        console.log('Sending Telegram alert...');
        const message = encodeURIComponent(`🚨 The Flexmail Intigriti program is OPEN! 🚀`);
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&text=${message}`;
        const res = await fetch(url);
        console.log('Telegram response:', await res.json());
      } else {
        console.log('Program suspended, no alert.');
      }

      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
      execSync('git add ' + STATUS_FILE);
      execSync(`git commit -m "Program status updated: ${status}" || true`);
      execSync('git push');
    } else {
      console.log('No status change.');
    }

    await browser.close();
  } catch (e) {
    console.error('Error:', e);
    await browser.close();
    process.exit(1);
  }
})();
