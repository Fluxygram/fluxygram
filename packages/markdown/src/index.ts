/**
 * Fluxygram diagrams inside Markdown: a code block with the language `fluxygram` becomes an animated
 * <fluxy-gram> diagram.
 *
 *     ```fluxygram theme=light
 *     { "type": "flow", "nodes": [...], "edges": [...] }
 *     ```
 *
 *     ```fluxygram src="/diagrams/checkout.flux.json"
 *     ```
 *
 * Works with remark (Docusaurus, Astro, Next.js MDX, anything unified) and markdown-it (VitePress).
 * The page still needs the component itself: `import '@fluxygram/element'` in the browser, or the CDN script.
 *
 * The JSON goes into the `src` attribute as a data: URL, so the output is a single plain tag that survives
 * React, Vue and MDX (none of them keep a <script> inside a custom element).
 */

/** Languages that turn a code block into a diagram. */
export const LANGS = ['fluxygram', 'flux'];

/** Attributes that can follow the language, as `key=value`, `key="value"` or a bare flag. */
export const ATTRIBUTES = ['src', 'theme', 'mode', 'stage', 'status', 'caption', 'history', 'autoplay', 'controls', 'lang', 'gestures'] as const;

export type FluxygramAttributes = Partial<Record<(typeof ATTRIBUTES)[number], string>>;

/** Reads `theme=light mode="tracker" caption` into attributes. Unknown keys are ignored. */
export function parseMeta(meta: string | null | undefined): FluxygramAttributes {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  for (const m of (meta ?? '').matchAll(re)) {
    const key = m[1]!.toLowerCase();
    if ((ATTRIBUTES as readonly string[]).includes(key)) out[key] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/** True when a code block's language (the first word of its info string) is a Fluxygram one. */
export function isFluxygram(lang: string | null | undefined): boolean {
  return !!lang && LANGS.includes(lang.trim().split(/\s+/)[0]!.toLowerCase());
}

/**
 * Attributes for the <fluxy-gram> tag of a code block. The JSON (if any) wins over a `src` in the meta.
 * Throws if the JSON is not valid, with a message that points at the block.
 */
export function fenceAttributes(code: string, meta?: string | null): FluxygramAttributes {
  const attrs = parseMeta(meta);
  const body = code.trim();
  if (body) {
    let json: string;
    try {
      json = JSON.stringify(JSON.parse(body));
    } catch (err) {
      throw new Error(`fluxygram: the code block is not valid JSON (${(err as Error).message})`);
    }
    attrs.src = `data:application/json,${encodeURIComponent(json)}`;
  }
  if (!attrs.src) throw new Error('fluxygram: the code block needs the diagram JSON or a src="…" after the language');
  return attrs;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The <fluxy-gram> tag as HTML. */
export function fenceHtml(code: string, meta?: string | null): string {
  const attrs = fenceAttributes(code, meta);
  const list = Object.entries(attrs).map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${escapeAttr(v!)}"`));
  return `<fluxy-gram${list.join('')}></fluxy-gram>\n`;
}

/* ---------- remark ---------- */

interface MdNode {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

/**
 * remark plugin. Replaces each ```fluxygram block with a <fluxy-gram> element (through `data.hName`, which
 * remark-rehype and MDX both understand).
 *
 *     import { remarkFluxygram } from '@fluxygram/markdown';
 *     remarkPlugins: [remarkFluxygram]
 */
export function remarkFluxygram() {
  return (tree: MdNode) => {
    const walk = (node: MdNode) => {
      const kids = node.children;
      if (!kids) return;
      for (let i = 0; i < kids.length; i++) {
        const child = kids[i]!;
        if (child.type === 'code' && isFluxygram(child.lang)) {
          // The info string can be "fluxygram theme=light": remark puts the rest in `meta`.
          const rest = (child.lang ?? '').trim().split(/\s+/).slice(1).join(' ');
          const attrs = fenceAttributes(child.value ?? '', [rest, child.meta ?? ''].join(' '));
          kids[i] = { type: 'paragraph', children: [], data: { hName: 'fluxy-gram', hProperties: attrs, hChildren: [] } };
        } else walk(child);
      }
    };
    walk(tree);
  };
}

/* ---------- markdown-it ---------- */

interface MdItToken {
  info: string;
  content: string;
}
interface MdIt {
  renderer: {
    rules: Record<string, ((tokens: MdItToken[], idx: number, ...rest: unknown[]) => string) | undefined>;
  };
}

/**
 * markdown-it plugin (VitePress and anything else built on markdown-it).
 *
 *     import { markdownItFluxygram } from '@fluxygram/markdown';
 *     md.use(markdownItFluxygram)
 */
export function markdownItFluxygram(md: MdIt) {
  const fallback = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, ...rest) => {
    const token = tokens[idx]!;
    const [lang, ...meta] = token.info.trim().split(/\s+/);
    if (isFluxygram(lang)) return fenceHtml(token.content, meta.join(' '));
    return fallback ? fallback(tokens, idx, ...rest) : `<pre><code>${token.content}</code></pre>`;
  };
}

export default remarkFluxygram;
