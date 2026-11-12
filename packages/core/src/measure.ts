import type { DiagramType, FluxNode } from './types';

/**
 * Medidas aproximadas del texto sin acceso al DOM, para que el layout corra igual en
 * el navegador, en Node (CLI) y en un Worker. Calibradas para Inter / system-ui.
 */
const LABEL_PX = 8.4; // 14px, peso 600
const DESC_PX = 7.1; // 12.5px, peso 400
const ICON_W = 30;

export const textWidth = (text: string, px: number) => Math.ceil(text.length * px);

export function nodeSize(node: FluxNode, type: DiagramType): { w: number; h: number } {
  const label = textWidth(node.label, LABEL_PX);
  const desc = node.description ? textWidth(node.description, DESC_PX) : 0;
  const icon = node.icon ? ICON_W : 0;

  if (type === 'timeline') {
    const w = Math.min(240, Math.max(160, Math.max(label, desc) + 36));
    return { w, h: node.description ? 92 : 72 };
  }

  if (node.kind === 'decision') {
    return { w: Math.max(150, label + 84), h: 84 };
  }

  const inner = Math.max(label + icon, desc);
  const extra = node.kind === 'data' ? 24 : node.kind === 'note' ? 16 : 0;
  const w = Math.min(320, Math.max(node.kind === 'start' || node.kind === 'end' ? 120 : 140, inner + 44 + extra));
  const h = (node.description ? 64 : 48) + (node.kind === 'database' ? 14 : 0);
  return { w, h };
}
