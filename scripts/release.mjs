/**
 * Lanzamiento en un solo paso. Correr en la terminal (npm pide aprobar con Windows Hello):
 *
 *   pnpm release 0.4.0        sube la versión en todo, revisa, hace commit + tag, publica en npm,
 *                             espera a que npm la muestre, publica en el registro oficial de MCP y hace push
 *   pnpm release 0.4.0 --dry  solo sube la versión y revisa (sin commit ni publicar), para mirar el diff
 *   pnpm release              publica la versión actual tal como está (npm + registro), sin subir nada
 *
 * Después: desplegar fluxygram.app desde el repo de Cloud (pnpm deploy:production) y las docs (pnpm deploy:docs).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const target = args.find((a) => !a.startsWith('--'));

// Paquetes publicados en npm, más el plugin de Obsidian (no va a npm, pero lleva la misma versión).
const PACKAGES = ['core', 'element', 'fluxygram', 'markdown', 'astro', 'docusaurus', 'mcp', 'obsidian'];
const REGISTRY_DIR = join(root, '.cloudflare/mcp-registry');

const env = { ...process.env, NODE_OPTIONS: '--use-system-ca', npm_config_auth_type: process.env.npm_config_auth_type ?? 'web' };
const run = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit', env, ...opts });
};
const out = (cmd) => execSync(cmd, { cwd: root, env, encoding: 'utf8' }).trim();
const step = (msg) => console.log(`\n=== ${msg}`);
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const writeJson = (p, data) => writeFileSync(join(root, p), `${JSON.stringify(data, null, 2)}\n`);

const current = readJson('packages/mcp/package.json').version;
const version = target ?? current;

/* ---------- 1. Subir la versión ---------- */

if (target) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(target)) fail(`"${target}" no es una versión (ejemplo: 0.4.0)`);
  const num = (v) => v.split(/[.-]/).slice(0, 3).map(Number);
  const [a, b] = [num(target), num(current)];
  const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  if (newer <= 0 && !target.includes('-')) fail(`${target} no es mayor que la actual (${current})`);
  if (!dry && out('git status --porcelain')) fail('Hay cambios sin commit. Haz commit o guárdalos antes de lanzar.');

  step(`Versión ${current} → ${target}`);
  for (const name of PACKAGES) {
    const p = `packages/${name}/package.json`;
    const pkg = readJson(p);
    pkg.version = target;
    writeJson(p, pkg);
  }
  const manifest = readJson('packages/obsidian/manifest.json');
  manifest.version = target;
  writeJson('packages/obsidian/manifest.json', manifest);

  const server = readJson('packages/mcp/server.json');
  server.version = target;
  for (const pkg of server.packages ?? []) pkg.version = target;
  writeJson('packages/mcp/server.json', server);

  // El script del CDN de la documentación apunta a major.minor (fluxygram@0.3): cambia solo si cambian.
  const short = (v) => v.split('.').slice(0, 2).join('.');
  if (short(target) !== short(current)) {
    const cdn = /(cdn\.jsdelivr\.net\/npm\/fluxygram)@\d+\.\d+(?![\d])/g;
    const files = ['README.md', 'packages/fluxygram/README.md', 'site/index.html', 'site/scripts/example-pages.mjs', ...mdx('docs/src/content/docs')];
    for (const f of files) {
      const text = readFileSync(join(root, f), 'utf8');
      const next = text.replace(cdn, `$1@${short(target)}`);
      if (next !== text) {
        writeFileSync(join(root, f), next);
        console.log(`  CDN → fluxygram@${short(target)} en ${f}`);
      }
    }
  }
}

function mdx(dir) {
  const found = [];
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) found.push(...mdx(rel));
    else if (entry.endsWith('.mdx') || entry.endsWith('.md')) found.push(rel);
  }
  return found;
}

/* ---------- 2. Revisar y construir ---------- */

step('Revisión de tipos y build de los paquetes');
run('pnpm typecheck');
run('pnpm build:packages');

if (dry) {
  console.log(`\n✓ Listo (--dry). Revisa el diff con "git diff". Para deshacerlo: git checkout -- .`);
  process.exit(0);
}

if (target) {
  step(`Commit y tag v${target}`);
  run('git add -A');
  run(`git commit -m "Release v${target}"`);
  run(`git tag v${target}`);
}

/* ---------- 3. npm ---------- */

step('Publicar en npm (aprueba cada paquete en el navegador)');
// pnpm salta los paquetes cuya versión ya está publicada y los marcados "private".
run('pnpm publish -r --filter "@fluxygram/*" --filter fluxygram --access public --no-git-checks');

/* ---------- 4. Registro oficial de MCP ---------- */

step('Esperar a que npm muestre @fluxygram/mcp');
// npm deja una versión provisional (0.0.0-stage) mientras revisa los paquetes; el registro de MCP
// comprueba el paquete en npm, así que hay que esperar a que la versión real aparezca.
const deadline = Date.now() + 30 * 60_000;
for (;;) {
  const res = await fetch('https://registry.npmjs.org/@fluxygram%2fmcp', { headers: { accept: 'application/vnd.npm.install-v1+json' } }).catch(() => null);
  const versions = res?.ok ? Object.keys((await res.json()).versions ?? {}) : [];
  if (versions.includes(version)) break;
  if (Date.now() > deadline) fail(`npm todavía no muestra @fluxygram/mcp@${version}. Cuando aparezca, corre "pnpm release" de nuevo (sin versión) para terminar.`);
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, 20_000));
}
console.log(`\n  @fluxygram/mcp@${version} ya está en npm`);

step('Publicar en el registro oficial de MCP');
const listed = await fetch(`https://registry.modelcontextprotocol.io/v0.1/servers?search=app.fluxygram/mcp&version=${version}`)
  .then((r) => r.json())
  .then((j) => (j.servers ?? []).some((s) => (s.server ?? s).version === version))
  .catch(() => false);
const publisher = join(REGISTRY_DIR, process.platform === 'win32' ? 'mcp-publisher.exe' : 'mcp-publisher');
const keyFile = join(REGISTRY_DIR, 'key.hex');
if (listed) {
  console.log(`  app.fluxygram/mcp@${version} ya estaba en el registro`);
} else if (!existsSync(publisher) || !existsSync(keyFile)) {
  console.log(`  ⚠ Falta mcp-publisher o la clave en .cloudflare/mcp-registry/. Publica a mano desde packages/mcp.`);
} else {
  const key = readFileSync(keyFile, 'utf8').trim();
  const mcpDir = join(root, 'packages/mcp');
  // La clave va como argumento (esta versión de mcp-publisher no lee archivos); no se imprime.
  execSync(`"${publisher}" login dns --domain fluxygram.app --private-key ${key}`, { cwd: mcpDir, stdio: ['ignore', 'ignore', 'inherit'], env });
  run(`"${publisher}" publish`, { cwd: mcpDir });
}

/* ---------- 5. Push ---------- */

if (target) {
  step('Push del commit y el tag');
  run('git push --follow-tags origin main');
}

console.log(`
✓ Fluxygram ${version} publicado.
  Falta: desplegar fluxygram.app (repo de Cloud: subir el submódulo public y pnpm deploy:production) y las docs (pnpm deploy:docs).`);
