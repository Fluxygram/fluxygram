import type { Diagram } from '@fluxygram/core';

/* ---------- Links para compartir: el diagrama va comprimido en la URL, sin servidor ---------- */

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
};

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeDiagram(d: Diagram): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(d)) as Uint8Array<ArrayBuffer>;
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeDiagram(code: string): Promise<unknown> {
  const bytes = await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Lee `#d=…` de la URL actual. */
export async function diagramFromHash(): Promise<unknown | undefined> {
  const code = new URLSearchParams(location.hash.slice(1)).get('d');
  if (!code) return undefined;
  try {
    return await decodeDiagram(code);
  } catch {
    return undefined;
  }
}

export async function shareUrl(d: Diagram, page: 'view' | 'play' = 'view') {
  return `${location.origin}/${page}#d=${await encodeDiagram(d)}`;
}

/* ---------- Archivos ---------- */

export const slug = (text: string | undefined) =>
  (text || 'diagram')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'diagram';

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => resolve(input.files?.[0]);
    input.click();
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Un solo archivo HTML que funciona sin internet: el componente y el diagrama van adentro. */
export async function exportHtml(d: Diagram, lang: string) {
  const js = await (await fetch('/fluxygram.js')).text();
  // Nada dentro de un <script> puede cerrar la etiqueta antes de tiempo.
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const json = JSON.stringify(d, null, 2).replace(/<\/script/gi, '<\\/script');
  const title = escapeHtml(d.title || 'Fluxygram');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  html, body { margin: 0; min-height: 100%; background: #09090c; }
  body { display: grid; place-items: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
  fluxy-gram { width: min(100%, 1040px); }
  .credit { position: fixed; right: 16px; bottom: 12px; font: 12px system-ui, sans-serif; color: #6e6e7a; text-decoration: none; }
</style>
</head>
<body>
<fluxy-gram gestures="full"><script type="application/json">${json}</script></fluxy-gram>
<a class="credit" href="https://github.com/Fluxygram/fluxygram">Fluxygram</a>
<script type="module">${safeJs}</script>
</body>
</html>
`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
