/**
 * Marca propia (Pro): color principal, tema, fuente y logo. Se aplica a un <fluxy-gram> con variables CSS
 * (el componente ya lee --fx-accent, --fx-accent-soft y --fx-font), así que funciona igual en el editor,
 * en el grabador de video, en el HTML exportado y en los links cortos.
 */

export type BrandFont = 'inter' | 'system' | 'serif' | 'mono';

export interface Brand {
  accent: string;
  theme: 'dark' | 'light';
  font: BrandFont;
  /** Imagen como data URL (PNG, JPG, WebP o SVG), hasta 150 KB. */
  logo?: string;
}

export const DEFAULT_BRAND: Brand = { accent: '#2bff88', theme: 'dark', font: 'inter' };

export const FONT_STACKS: Record<BrandFont, string> = {
  inter: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
};

/** Pone la marca en un componente. Sin marca, lo deja como viene. */
export function applyBrand(el: HTMLElement, brand: Brand | null | undefined) {
  if (!brand) return;
  el.setAttribute('theme', brand.theme);
  el.style.setProperty('--fx-accent', brand.accent);
  el.style.setProperty('--fx-accent-soft', `color-mix(in oklab, ${brand.accent} ${brand.theme === 'dark' ? 16 : 12}%, ${brand.theme === 'dark' ? '#16161c' : '#ffffff'})`);
  el.style.setProperty('--fx-font', FONT_STACKS[brand.font] ?? FONT_STACKS.inter);
}

/** Lo mismo, como texto CSS para el HTML exportado. */
export function brandCss(brand: Brand): string {
  const soft = `color-mix(in oklab, ${brand.accent} ${brand.theme === 'dark' ? 16 : 12}%, ${brand.theme === 'dark' ? '#16161c' : '#ffffff'})`;
  return `--fx-accent: ${brand.accent}; --fx-accent-soft: ${soft}; --fx-font: ${FONT_STACKS[brand.font] ?? FONT_STACKS.inter};`;
}

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
