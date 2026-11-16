// Junta la guía (la skill) y los ejemplos en src/data.ts, para que el servidor no lea archivos
// (así corre igual en Node y en un Cloudflare Worker). El archivo generado no va al repo.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const skill = readFileSync(resolve(root, 'skills/fluxygram/SKILL.md'), 'utf8').replace(/^---[\s\S]*?---\s*/, '');
const meta = JSON.parse(readFileSync(resolve(root, 'site/src/examples.json'), 'utf8'));
const examples = {};
for (const lang of ['en', 'es']) {
  examples[lang] = {};
  for (const f of readdirSync(resolve(root, `site/public/examples/${lang}`))) {
    const d = JSON.parse(readFileSync(resolve(root, `site/public/examples/${lang}/${f}`), 'utf8'));
    delete d.$schema;
    examples[lang][f.replace('.flux.json', '')] = d;
  }
}
const summaries = meta.map((m) => ({ name: m.name, live: !!m.live, about: m.lead.en }));
writeFileSync(
  resolve(import.meta.dirname, '../src/data.ts'),
  `// Generado por scripts/data.mjs. No editar.\nexport const GUIDE: string = ${JSON.stringify(skill)};\nexport const EXAMPLES: Record<'en' | 'es', Record<string, unknown>> = ${JSON.stringify(examples)};\nexport const SUMMARIES: { name: string; live: boolean; about: string }[] = ${JSON.stringify(summaries)};\n`,
);
console.log('mcp data ok');
