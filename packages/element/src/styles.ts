/**
 * Estilos del componente. El movimiento sigue estas reglas:
 * - Solo se animan transform, opacity y stroke-dashoffset.
 * - Transiciones CSS (no keyframes): si el usuario salta de paso, la animación se redirige sin reiniciar.
 * - Entradas con ease-out fuerte; la cámara y las líneas con ease-in-out; las salidas son más rápidas que las entradas.
 * - Nada aparece desde escala 0: opacidad + escala 0.96 + 10px.
 */
export const STYLES = /* css */ `
:host {
  --fx-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --fx-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --fx-ease-camera: cubic-bezier(0.65, 0, 0.35, 1);

  --fx-bg: #fbfbfc;
  --fx-surface: #ffffff;
  --fx-border: #e3e3e8;
  --fx-text: #17171c;
  --fx-muted: #6e6e7a;
  --fx-edge: #b4b4be;
  --fx-grid: #dedee4;
  --fx-group: #f1f1f5;
  --fx-accent: #0a9e52;
  --fx-accent-soft: #e7fbef;
  --fx-shadow: 0 1px 2px rgb(23 23 28 / 0.04), 0 4px 12px rgb(23 23 28 / 0.04);

  display: block;
  position: relative;
  container-type: inline-size;
  color: var(--fx-text);
  background: var(--fx-bg);
  border: 1px solid var(--fx-border);
  border-radius: 16px;
  overflow: hidden;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  outline: none;
}
:host([hidden]) { display: none; }

/* Oscuro por defecto; theme="light" para incrustarlo en páginas claras. */
${darkTokens(':host')}
:host([theme='light']) {
  --fx-bg: #fbfbfc;
  --fx-surface: #ffffff;
  --fx-border: #e3e3e8;
  --fx-text: #17171c;
  --fx-muted: #6e6e7a;
  --fx-edge: #b4b4be;
  --fx-grid: #dedee4;
  --fx-group: #f1f1f5;
  --fx-accent: #0a9e52;
  --fx-accent-soft: #e7fbef;
  color-scheme: light;
}

:host(:focus-visible) { box-shadow: 0 0 0 2px var(--fx-accent); }

.fx-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  padding: 16px 20px 0;
}
.fx-title { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.fx-count { font-size: 12px; color: var(--fx-muted); font-variant-numeric: tabular-nums; }

.fx-stage {
  display: block; width: 100%; height: auto; user-select: none; -webkit-user-select: none;
  cursor: grab;
  /* Un dedo en vertical sigue desplazando la página; horizontal mueve el diagrama y dos dedos hacen zoom. */
  touch-action: pan-y;
}
.fx-stage.is-dragging { cursor: grabbing; }
.fx-stage:not(.is-dragging) .fx-node.is-in { cursor: pointer; }
.fx-node:not(.is-in) { pointer-events: none; }

.fx-recenter {
  opacity: 0; transform: scale(0.9); pointer-events: none;
  transition: opacity 160ms ease-out, transform 160ms ease-out, background-color 160ms ease, color 160ms ease;
}
.fx-recenter.is-on { opacity: 1; transform: none; pointer-events: auto; color: var(--fx-accent); }
.fx-recenter.is-on:active { transform: scale(0.94); }

/* ---------- Cámara ---------- */
.fx-camera {
  transform-box: view-box;
  transform-origin: 0 0;
  transition: transform 1000ms var(--fx-ease-camera);
}
:host([data-instant]) .fx-camera { transition: none; }

/* ---------- Grupos (capas) ---------- */
.fx-group-box { fill: var(--fx-group); }
.fx-group-label {
  fill: var(--fx-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
}
.fx-group {
  opacity: 0; transform: translateY(8px); transform-box: fill-box;
  transition: opacity 240ms ease-out, transform 240ms ease-out;
}
.fx-group.is-in {
  opacity: 1; transform: none;
  transition: opacity 520ms var(--fx-ease-out) var(--d, 0ms), transform 620ms var(--fx-ease-out) var(--d, 0ms);
}

/* ---------- Eje (línea de tiempo) ---------- */
.fx-axis line {
  stroke: var(--fx-border); stroke-width: 2; stroke-linecap: round;
  stroke-dasharray: 1; stroke-dashoffset: 1;
  transition: stroke-dashoffset 1400ms var(--fx-ease-in-out);
}
.fx-axis.is-in line { stroke-dashoffset: 0; }

/* ---------- Conexiones ---------- */
.fx-edge-line {
  fill: none; stroke: var(--fx-edge); stroke-width: 1.5; stroke-linecap: round;
  stroke-dasharray: 1; stroke-dashoffset: 1;
  transition: stroke-dashoffset 260ms ease-out, stroke 300ms ease;
}
.fx-edge.is-in .fx-edge-line {
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 760ms var(--fx-ease-in-out) var(--d, 0ms), stroke 300ms ease;
}
.fx-edge-head {
  fill: var(--fx-edge); opacity: 0;
  transition: opacity 160ms ease-out, fill 300ms ease;
}
.fx-edge.is-in .fx-edge-head {
  opacity: 1;
  transition: opacity 240ms ease-out calc(var(--d, 0ms) + 640ms), fill 300ms ease;
}
.fx-edge { transition: opacity 320ms ease; }
.fx-edge.is-dim { opacity: 0.35; }
.fx-edge.is-flowing .fx-edge-line { stroke: var(--fx-accent); }
.fx-edge.is-flowing .fx-edge-head { fill: var(--fx-accent); }

.fx-edge-label { opacity: 0; transition: opacity 160ms ease-out; }
.fx-edge.is-in .fx-edge-label { opacity: 1; transition: opacity 320ms ease-out calc(var(--d, 0ms) + 420ms); }
.fx-edge-label rect { fill: var(--fx-bg); }
.fx-edge-label text { fill: var(--fx-muted); font-size: 11.5px; font-weight: 500; }

/* ---------- Partículas ---------- */
.fx-particle { pointer-events: none; }
.fx-particle .core { fill: var(--fx-accent); }
.fx-particle .glow { fill: var(--fx-accent); opacity: 0.16; }

/* ---------- Nodos ---------- */
.fx-slot { transition: opacity 320ms ease; }
.fx-slot.is-dim { opacity: 0.4; }

.fx-node {
  opacity: 0; transform: translateY(10px) scale(0.96);
  transform-box: fill-box; transform-origin: center;
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
.fx-node.is-in {
  opacity: 1; transform: none;
  transition: opacity 460ms var(--fx-ease-out) var(--d, 0ms), transform 620ms var(--fx-ease-out) var(--d, 0ms);
}
.fx-shape {
  fill: var(--fx-surface); stroke: var(--fx-border); stroke-width: 1;
  filter: drop-shadow(0 1px 1.5px rgb(23 23 28 / 0.05)) drop-shadow(0 4px 10px rgb(23 23 28 / 0.04));
  transition: fill 320ms ease, stroke 320ms ease;
}
.fx-label { fill: var(--fx-text); font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
.fx-desc { fill: var(--fx-muted); font-size: 12.5px; }
.fx-date { fill: var(--fx-accent); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.fx-icon { fill: none; stroke: var(--fx-muted); stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; transition: stroke 320ms ease; }
.fx-stem { stroke: var(--fx-border); stroke-width: 1.5; }
.fx-dot { fill: var(--fx-surface); stroke: var(--fx-edge); stroke-width: 2; transition: fill 320ms ease, stroke 320ms ease; }

.fx-node.is-accent .fx-shape { fill: var(--fx-accent-soft); stroke: var(--fx-accent); stroke-width: 1.5; }
.fx-node.is-accent .fx-icon { stroke: var(--fx-accent); }
.fx-node.is-accent .fx-dot { fill: var(--fx-accent); stroke: var(--fx-accent); }

/* ---------- Texto del paso ---------- */
.fx-caption {
  position: relative; height: 28px; margin: 0 20px 4px;
  font-size: 14px; line-height: 28px; text-align: center; color: var(--fx-text);
}
.fx-caption span {
  position: absolute; inset: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: opacity 360ms var(--fx-ease-out), transform 360ms var(--fx-ease-out), filter 360ms var(--fx-ease-out);
}
.fx-caption span.is-entering { opacity: 0; transform: translateY(6px); filter: blur(2px); }
.fx-caption span.is-leaving {
  opacity: 0; transform: translateY(-6px); filter: blur(2px);
  transition-duration: 200ms; transition-timing-function: ease-out;
}

@container (max-width: 559px) {
  .fx-head { padding: 14px 16px 0; }
  .fx-caption { height: 44px; margin: 0 16px 4px; font-size: 13px; line-height: 20px; }
  .fx-caption span { display: flex; align-items: center; justify-content: center; white-space: normal; }
  .fx-controls { gap: 8px; padding: 6px 10px 12px; }
}

/* ---------- Controles ---------- */
.fx-controls {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 16px 14px;
}
.fx-btn {
  display: inline-grid; place-items: center;
  width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px;
  background: transparent; color: var(--fx-muted); cursor: pointer;
  transition: transform 140ms ease-out, background-color 160ms ease, color 160ms ease;
}
.fx-btn:active { transform: scale(0.94); }
.fx-btn:focus-visible { outline: 2px solid var(--fx-accent); outline-offset: 1px; }
.fx-btn:disabled { opacity: 0.35; cursor: default; }
.fx-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
@media (hover: hover) and (pointer: fine) {
  .fx-btn:not(:disabled):hover { background: var(--fx-group); color: var(--fx-text); }
}

.fx-track { flex: 1; display: flex; gap: 4px; }
.fx-seg {
  position: relative; flex: 1; height: 4px; padding: 0; border: 0; border-radius: 2px;
  background: var(--fx-border); overflow: hidden; cursor: pointer;
}
.fx-seg::before { content: ''; position: absolute; inset: -10px 0; } /* área táctil más grande */
.fx-seg i {
  position: absolute; inset: 0; border-radius: inherit; background: var(--fx-accent);
  transform-origin: left; transform: scaleX(0);
}
.fx-seg.is-done i { transform: scaleX(1); }

/* ---------- Errores ---------- */
.fx-error { margin: 20px; padding: 14px 16px; border-radius: 10px; background: var(--fx-group); font-size: 13px; line-height: 1.5; }
.fx-error strong { display: block; margin-bottom: 6px; }
.fx-error code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; color: var(--fx-accent); }
.fx-error ul { margin: 0; padding-left: 18px; }

/* ---------- Movimiento reducido: fundidos, sin desplazamientos ---------- */
@media (prefers-reduced-motion: reduce) {
  .fx-camera { transition: none; }
  .fx-node, .fx-node.is-in, .fx-group, .fx-group.is-in { transform: none; }
  .fx-node.is-in, .fx-group.is-in { transition: opacity 240ms ease; }
  .fx-edge-line, .fx-edge.is-in .fx-edge-line, .fx-axis line { stroke-dasharray: none; stroke-dashoffset: 0; transition: stroke 240ms ease; }
  .fx-edge .fx-edge-line { opacity: 0; transition: opacity 240ms ease; }
  .fx-edge.is-in .fx-edge-line { opacity: 1; }
  .fx-caption span, .fx-caption span.is-entering, .fx-caption span.is-leaving { transform: none; filter: none; }
}
`;

function darkTokens(selector: string) {
  return `${selector} {
    --fx-bg: #0c0c10;
    --fx-surface: #16161c;
    --fx-border: #2a2a33;
    --fx-text: #f3f3f6;
    --fx-muted: #9b9ba8;
    --fx-edge: #4d4d59;
    --fx-grid: #23232b;
    --fx-group: #131318;
    --fx-accent: #2bff88;
    --fx-accent-soft: #0b2a1a;
    color-scheme: dark;
  }`;
}
