import { createElement, type IconNode } from 'lucide';

type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;

/** Crea un elemento con atributos, eventos (`onclick`, `oninput`…) e hijos. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | false | undefined)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'value') (el as HTMLInputElement).value = String(v);
    else if (k === 'checked') (el as HTMLInputElement).checked = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== false && c !== undefined) el.append(c);
  return el;
}

export function icon(node: IconNode, size = 17) {
  const svg = createElement(node);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}
