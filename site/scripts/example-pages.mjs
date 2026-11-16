/**
 * Genera una página pública por ejemplo y por idioma, para que los buscadores encuentren cada diagrama:
 *   /examples/<nombre>  (inglés)   y   /ejemplos/<nombre>  (español)
 * Cada página trae el diagrama animado, el paso a paso como texto, cómo hacer uno igual y ejemplos
 * relacionados. También reescribe public/sitemap.xml con todas las páginas.
 *
 * Corre antes de Vite (dev y build). Las páginas generadas no van al repo (están en .gitignore).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE = resolve(import.meta.dirname, '..');
const ORIGIN = 'https://fluxygram.app';
const DIRS = { en: 'examples', es: 'ejemplos' };
const LANGS = ['en', 'es'];

const examples = JSON.parse(readFileSync(resolve(SITE, 'src/examples.json'), 'utf8'));
const load = (lang, name) => JSON.parse(readFileSync(resolve(SITE, `public/examples/${lang}/${name}.flux.json`), 'utf8'));

// Nombres de los temas: los mismos de la galería (public/i18n.js tiene primero inglés y luego español).
const i18n = readFileSync(resolve(SITE, 'public/i18n.js'), 'utf8');
const themeName = (lang, theme) => {
  const all = [...i18n.matchAll(new RegExp(`["']uses\\.${theme}["']: ["']([^"']+)["']`, 'g'))];
  return all[lang === 'en' ? 0 : 1]?.[1] ?? theme;
};

const KIND = {
  en: {
    flow: 'animated flowchart',
    architecture: 'animated architecture diagram',
    timeline: 'animated timeline',
    tree: 'animated tree diagram',
    cycle: 'animated cycle diagram',
    sequence: 'animated sequence diagram',
    mindmap: 'animated mind map',
    live: 'live status tracker',
  },
  es: {
    flow: 'diagrama de flujo animado',
    architecture: 'diagrama de arquitectura animado',
    timeline: 'línea de tiempo animada',
    tree: 'diagrama de árbol animado',
    cycle: 'diagrama de ciclo animado',
    sequence: 'diagrama de secuencia animado',
    mindmap: 'mapa mental animado',
    live: 'seguimiento en vivo',
  },
};

const T = {
  en: {
    examples: 'Examples',
    edit: 'Open in the editor',
    present: 'Present',
    steps: 'Step by step',
    shows: 'What it shows',
    make: 'Make one like this',
    makeLead: 'Three ways, all free. No account needed.',
    editorTitle: 'In the editor',
    editorText: 'Open this diagram in the editor and change the text, the blocks or the order of the steps. Export it as a GIF or an HTML page.',
    agentTitle: 'With your AI agent',
    agentText: 'Install the Fluxygram skill in Claude, Cursor, Codex or Gemini and ask for it in plain words:',
    agentPrompt: (title) => `Use the Fluxygram skill to make an animated diagram: ${title}.`,
    agentLink: 'How to install the skill',
    embedTitle: 'On your site',
    embedText: 'Download the JSON and show it anywhere with one script:',
    download: 'Download the JSON',
    liveTitle: 'Connect it to your system',
    liveText: 'Your site only changes the stage attribute when the process moves. The diagram animates by itself. Try it:',
    next: 'Next stage',
    delay: 'Simulate a delay',
    fail: 'Simulate a problem',
    reset: 'Start over',
    json: 'See the JSON behind this diagram',
    more: 'More examples',
    all: 'See all examples →',
    copy: 'Copy',
    pricing: 'Pricing',
    privacy: 'Privacy',
    terms: 'Terms',
    docs: 'https://docs.fluxygram.app/',
    playground: 'Editor',
    switchTo: 'Español',
  },
  es: {
    examples: 'Ejemplos',
    edit: 'Abrir en el editor',
    present: 'Presentar',
    steps: 'Paso a paso',
    shows: 'Qué muestra',
    make: 'Haz uno así',
    makeLead: 'Tres formas, todas gratis. No necesitas cuenta.',
    editorTitle: 'En el editor',
    editorText: 'Abre este diagrama en el editor y cambia los textos, los bloques o el orden de los pasos. Expórtalo como GIF o como página HTML.',
    agentTitle: 'Con tu agente de IA',
    agentText: 'Instala la skill de Fluxygram en Claude, Cursor, Codex o Gemini y pídelo con tus palabras:',
    agentPrompt: (title) => `Usa la skill de Fluxygram para hacer un diagrama animado: ${title}.`,
    agentLink: 'Cómo instalar la skill',
    embedTitle: 'En tu sitio',
    embedText: 'Descarga el JSON y muéstralo donde quieras con un solo script:',
    download: 'Descargar el JSON',
    liveTitle: 'Conéctalo a tu sistema',
    liveText: 'Tu sitio solo cambia el atributo stage cuando el proceso avanza. El diagrama se anima solo. Pruébalo:',
    next: 'Siguiente etapa',
    delay: 'Simular un retraso',
    fail: 'Simular un problema',
    reset: 'Empezar de nuevo',
    json: 'Ver el JSON de este diagrama',
    more: 'Más ejemplos',
    all: 'Ver todos los ejemplos →',
    copy: 'Copiar',
    pricing: 'Precios',
    privacy: 'Privacidad',
    terms: 'Términos',
    docs: 'https://docs.fluxygram.app/es/',
    playground: 'Editor',
    switchTo: 'English',
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pageUrl = (lang, name) => `${ORIGIN}/${DIRS[lang]}/${name}`;

/** Texto del paso a paso: los pies de cada paso si los hay; si no, los bloques en orden. */
function storyItems(d) {
  const captions = (d.steps ?? []).map((s) => s.caption).filter(Boolean);
  if (captions.length) return { steps: true, items: captions };
  return { steps: false, items: d.nodes.map((n) => (n.description ? `${n.label}: ${n.description}` : n.label)) };
}

function related(ex) {
  const same = examples.filter((x) => x.name !== ex.name && x.theme === ex.theme);
  const rest = examples.filter((x) => x.name !== ex.name && x.theme !== ex.theme);
  return [...same, ...rest].slice(0, 6);
}

function page(ex, lang) {
  const t = T[lang];
  const d = load(lang, ex.name);
  const kind = KIND[lang][ex.live ? 'live' : d.type];
  const title = d.title;
  const lead = ex.lead[lang];
  const url = pageUrl(lang, ex.name);
  const docTitle = `${title}: ${kind} | Fluxygram`;
  const story = storyItems(d);
  const jsonPath = `/examples/${lang}/${ex.name}.flux.json`;
  const embed = `<script type="module" src="https://cdn.jsdelivr.net/npm/fluxygram@0.3"></script>\n<fluxy-gram src="${ex.name}.flux.json"${ex.live ? ` mode="tracker" stage="${ex.live.path[0]}"` : ''}></fluxy-gram>`;
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: title,
      description: lead,
      inLanguage: lang,
      url,
      image: `${ORIGIN}/og.png`,
      isAccessibleForFree: true,
      genre: kind,
      author: { '@type': 'Organization', name: 'Fluxygram', url: ORIGIN },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Fluxygram', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: t.examples, item: `${ORIGIN}/gallery` },
        { '@type': 'ListItem', position: 3, name: title, item: url },
      ],
    },
  ];
  const liveBlock = ex.live
    ? `
        <div class="ex-live" id="live">
          <h2>${esc(t.liveTitle)}</h2>
          <p>${esc(t.liveText)}</p>
          <div class="gal-live-buttons">
            <button type="button" class="btn btn-primary" data-live="next">${esc(t.next)}</button>
            <button type="button" class="btn" data-live="delay">${esc(t.delay)}</button>
            <button type="button" class="btn" data-live="fail">${esc(t.fail)}</button>
            <button type="button" class="btn" data-live="reset">${esc(t.reset)}</button>
          </div>
          <pre class="code gal-live-code" data-live="code"></pre>
        </div>`
    : '';
  const rel = related(ex)
    .map((r) => {
      const rd = load(lang, r.name);
      return `            <li><a href="/${DIRS[lang]}/${r.name}"><strong>${esc(rd.title)}</strong><span>${esc(KIND[lang][r.live ? 'live' : rd.type])}</span></a></li>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="${lang}" data-lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(docTitle)}</title>
    <meta name="description" content="${esc(lead)}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="canonical" href="${url}" />
    <link rel="alternate" hreflang="en" href="${pageUrl('en', ex.name)}" />
    <link rel="alternate" hreflang="es" href="${pageUrl('es', ex.name)}" />
    <link rel="alternate" hreflang="x-default" href="${pageUrl('en', ex.name)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Fluxygram" />
    <meta property="og:locale" content="${lang === 'es' ? 'es_ES' : 'en_US'}" />
    <meta property="og:title" content="${esc(docTitle)}" />
    <meta property="og:description" content="${esc(lead)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ORIGIN}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#09090c" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/src/site.css" />
    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
  </head>
  <body>
    <header class="wrap nav">
      <a class="brand" href="/"><img src="/mark.svg" alt="" width="32" height="32" />fluxygram</a>
      <nav class="nav-links">
        <a href="/gallery" data-i18n="nav.examples">${esc(t.examples)}</a>
        <a href="/play" data-i18n="nav.playground">${esc(t.playground)}</a>
        <a href="${t.docs}" data-docs-link data-i18n="nav.docs">Docs</a>
        <a href="/pricing" data-i18n="nav.pricing">${esc(t.pricing)}</a>
        <button class="lang-switch" type="button" data-lang-switch>${esc(t.switchTo)}</button>
        <div class="site-account" id="account" hidden></div>
      </nav>
    </header>

    <main class="wrap ex-page" data-example="${ex.name}">
      <nav class="ex-crumbs" aria-label="Breadcrumb"><a href="/gallery">${esc(t.examples)}</a> <span aria-hidden="true">/</span> ${esc(themeName(lang, ex.theme))}</nav>
      <div class="section-head ex-head">
        <h1>${esc(title)}</h1>
        <p>${esc(lead)}</p>
      </div>

      <div class="example ex-stage">
        <fluxy-gram id="diagram" src="${jsonPath}"${ex.live ? ' mode="tracker"' : ''}></fluxy-gram>
        <div class="ex-actions">
          <span class="ex-kind">${esc(kind)}</span>
          <a class="btn btn-primary" id="edit" href="/play">${esc(t.edit)}</a>
        </div>
      </div>
${liveBlock}
      <section class="ex-section">
        <h2>${esc(story.steps ? t.steps : t.shows)}</h2>
        <${story.steps ? 'ol' : 'ul'} class="ex-story">
${story.items.map((s) => `          <li>${esc(s)}</li>`).join('\n')}
        </${story.steps ? 'ol' : 'ul'}>
      </section>

      <section class="ex-section">
        <h2>${esc(t.make)}</h2>
        <p class="ex-sub">${esc(t.makeLead)}</p>
        <div class="ex-ways">
          <div class="card">
            <h3>${esc(t.editorTitle)}</h3>
            <p>${esc(t.editorText)}</p>
            <a class="ex-link" id="edit2" href="/play">${esc(t.edit)} →</a>
          </div>
          <div class="card">
            <h3>${esc(t.agentTitle)}</h3>
            <p>${esc(t.agentText)}</p>
            <div class="ag-copy"><pre class="code">${esc(t.agentPrompt(title))}</pre></div>
            <a class="ex-link" href="/#agents">${esc(t.agentLink)} →</a>
          </div>
          <div class="card">
            <h3>${esc(t.embedTitle)}</h3>
            <p>${esc(t.embedText)}</p>
            <div class="ag-copy"><pre class="code">${esc(embed)}</pre></div>
            <a class="ex-link" href="${jsonPath}" download="${ex.name}.flux.json">${esc(t.download)} →</a>
          </div>
        </div>
        <details class="ex-json">
          <summary>${esc(t.json)}</summary>
          <pre class="code">${esc(JSON.stringify(d, null, 2))}</pre>
        </details>
      </section>

      <section class="ex-section">
        <h2>${esc(t.more)}</h2>
        <ul class="ex-related">
${rel}
        </ul>
        <a class="ex-link" href="/gallery">${esc(t.all)}</a>
      </section>
    </main>

    <footer>
      <div class="wrap">
        <span data-i18n="footer.tag">Fluxygram</span>
        <span class="footer-legal"><a href="/pricing">${esc(t.pricing)}</a> · <a href="/privacy">${esc(t.privacy)}</a> · <a href="/terms">${esc(t.terms)}</a></span>
      </div>
    </footer>

    <script src="/i18n.js"></script>
    <script type="module" src="/src/example-page.ts"></script>
  </body>
</html>
`;
}

for (const lang of LANGS) {
  const dir = resolve(SITE, DIRS[lang]);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const ex of examples) writeFileSync(resolve(dir, `${ex.name}.html`), page(ex, lang));
}

// Sitemap: páginas fijas + cada ejemplo en los dos idiomas (enlazados entre sí con hreflang).
const fixed = [
  ['/', 'weekly', '1.0'],
  ['/gallery', 'weekly', '0.8'],
  ['/pricing', 'monthly', '0.7'],
  ['/play', 'monthly', '0.8'],
  ['/privacy', 'yearly', '0.2'],
  ['/terms', 'yearly', '0.2'],
];
const lines = fixed.map(([p, f, pr]) => `  <url><loc>${ORIGIN}${p}</loc><changefreq>${f}</changefreq><priority>${pr}</priority></url>`);
for (const ex of examples) {
  for (const lang of LANGS) {
    const alts = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l, ex.name)}"/>`).join('');
    lines.push(`  <url><loc>${pageUrl(lang, ex.name)}</loc>${alts}<changefreq>monthly</changefreq><priority>0.6</priority></url>`);
  }
}
writeFileSync(
  resolve(SITE, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${lines.join('\n')}
</urlset>
`,
);
console.log(`example pages: ${examples.length * LANGS.length}`);
