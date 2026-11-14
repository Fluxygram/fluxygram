// Runs wrangler with Fluxygram's own Cloudflare credentials (stored in ./.cloudflare, gitignored),
// so this project never uses the global wrangler login of other projects on this machine.
//   pnpm cf:login     → log in with the Cloudflare account that owns Fluxygram
//   pnpm cf whoami    → check which account is in use
//   pnpm run deploy   → build + deploy the public preview (fluxygram-site on workers.dev).
//                       fluxygram.app is deployed from the private Cloud repo, never from here.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  XDG_CONFIG_HOME: resolve(root, '.cloudflare'),
  // Trust the OS certificate store too (antivirus / proxies that inspect HTTPS), without disabling verification.
  NODE_OPTIONS: [process.env.NODE_OPTIONS, '--use-system-ca'].filter(Boolean).join(' '),
};

const result = spawnSync('npx', ['wrangler', ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
