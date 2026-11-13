import { createRubberSegment, type RubberSegment } from '../vendor/rubber-segment';

/** Colores del sitio para los controles segmentados (fondo oscuro, selección gris, foco neón). */
export const SEGMENT_THEME = {
  trackColor: '#09090c',
  thumbColor: '#2a2a33',
  textColor: '#d4d4dd',
  activeTextColor: '#f3f3f6',
  focusColor: '#2bff88',
} as const;

type Entry = { seg: RubberSegment; sig: string; onChange: (value: string) => void };
const kept = new Map<string, Entry>();

/**
 * Control segmentado del editor. El panel se redibuja completo en cada cambio; para que la
 * animación del elemento deslizante no se corte, el mismo control se reutiliza por `key`.
 */
export function segment(
  key: string,
  items: { value: string; label: string }[],
  value: string,
  onChange: (value: string) => void,
  ariaLabel: string,
): HTMLElement {
  const sig = items.map((i) => `${i.value}:${i.label}`).join('|');
  let entry = kept.get(key);
  if (!entry || entry.sig !== sig) {
    entry?.seg.destroy();
    const fresh: Entry = {
      sig,
      onChange,
      seg: createRubberSegment({
        ...SEGMENT_THEME,
        items,
        value,
        size: 'sm',
        radius: 9,
        inset: 3,
        ariaLabel,
        className: 'ed-rs',
        onChange: (v) => fresh.onChange(v),
      }),
    };
    entry = fresh;
    kept.set(key, entry);
  }
  entry.onChange = onChange;
  entry.seg.set(value);
  return entry.seg.el;
}
