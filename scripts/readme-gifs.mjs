// Graba los GIF del README a partir de site/demo.html: captura cuadros en tiempo real con Playwright
// y los arma con Python (Pillow) respetando el tiempo real entre cuadros.
// Uso: con `pnpm dev` corriendo, `node scripts/readme-gifs.mjs [url-base]`.
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ?? 'http://localhost:5179';
const WIDTH = 880;

const clips = [
  { name: 'demo-steps', query: 'example=how-it-works' },
  { name: 'demo-live', query: 'example=tracker&live' },
];

const browser = await playwright.chromium.launch();
for (const clip of clips) {
  const dir = join(tmpdir(), `fluxygram-${clip.name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 800 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/demo.html?${clip.query}`);
  await page.waitForSelector('body[data-start]', { timeout: 20000 });
  const box = await page.locator('fluxy-gram').boundingBox();
  const clipRect = { x: box.x - 12, y: box.y - 12, width: box.width + 24, height: box.height + 24 };
  const frames = [];
  const t0 = Date.now();
  while (!(await page.evaluate(() => 'done' in document.body.dataset)) && Date.now() - t0 < 40000) {
    const file = join(dir, `${String(frames.length).padStart(4, '0')}.png`);
    await page.screenshot({ path: file, clip: clipRect });
    frames.push({ file, t: Date.now() - t0 });
  }
  await page.close();
  const list = join(dir, 'frames.json');
  writeFileSync(list, JSON.stringify(frames));
  const out = join(root, '.github', 'assets', `${clip.name}.gif`);
  execFileSync('python', [join(root, 'scripts', 'frames-to-gif.py'), list, out], { stdio: 'inherit' });
}
await browser.close();
