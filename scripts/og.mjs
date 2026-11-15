// Genera site/public/og.png (la imagen al compartir un link) a partir de site/og.html.
// Uso: con `pnpm dev` corriendo, `node scripts/og.mjs [url-base]`. Necesita Playwright (npm i -g playwright).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const base = process.argv[2] ?? 'http://localhost:5179';
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`${base}/og.html`);
await page.waitForSelector('body[data-ready]', { timeout: 20000 });
await page.screenshot({ path: new URL('../site/public/og.png', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });
await browser.close();
console.log('site/public/og.png');
