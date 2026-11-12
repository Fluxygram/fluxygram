import { layout, plan, type Layout, type Rect } from '@fluxygram/core';
import { buildScene, STYLES } from '@fluxygram/element';
import { toList, type Model } from './model';

const NS = 'http://www.w3.org/2000/svg';
const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Estilos extra del lienzo: todo visible, sin animaciones de entrada, y adornos de edición. */
const CANVAS_CSS = /* css */ `
:host { border: 0; border-radius: 0; height: 100%; }
.fx-stage { height: 100%; cursor: default; touch-action: none; }
.fx-camera { transition: none; }
.fx-node, .fx-group, .fx-edge-line, .fx-edge-head, .fx-edge-label { transition: none !important; }
.fx-stage.is-panning { cursor: grabbing; }
.fx-slot { cursor: grab; }
.fx-stage.is-dragging .fx-slot { cursor: grabbing; }
.ed-hit { fill: none; stroke: transparent; stroke-width: 16; cursor: pointer; pointer-events: stroke; }
.ed-sel { fill: none; stroke: var(--fx-accent); stroke-width: 2; pointer-events: none; }
.ed-sel-edge { fill: none; stroke: var(--fx-accent); stroke-width: 3; pointer-events: none; opacity: .5; }
.ed-group-sel { fill: none; stroke: var(--fx-accent); stroke-width: 1.5; stroke-dasharray: 6 5; pointer-events: none; }
.ed-handle { fill: var(--fx-bg); stroke: var(--fx-accent); stroke-width: 2; cursor: crosshair; }
.ed-handle:hover { fill: var(--fx-accent); }
.ed-wire { fill: none; stroke: var(--fx-accent); stroke-width: 1.5; stroke-dasharray: 5 5; pointer-events: none; }
.ed-group-hit { fill: transparent; cursor: pointer; }
.ed-off { opacity: .16; }
.ed-new { fill: none; stroke: var(--fx-accent); stroke-width: 1.5; stroke-dasharray: 5 4; pointer-events: none; }
.ed-focus { fill: none; stroke: var(--fx-accent); stroke-width: 1; stroke-dasharray: 2 4; pointer-events: none; }
.ed-pin { fill: var(--fx-muted); pointer-events: none; }
`;

interface Camera {
  tx: number;
  ty: number;
  s: number;
}

/**
 * Lienzo del editor. Dibuja con el mismo código que <fluxy-gram> (buildScene) y agrega encima la capa de edición:
 * selección, manijas para conectar, zonas de clic de las conexiones y el estado de cada elemento en el paso activo.
 */
export class Canvas {
  readonly host: HTMLDivElement;
  private root: ShadowRoot;
  private svg: SVGSVGElement;
  private lay?: Layout;
  private cam: Camera = { tx: 0, ty: 0, s: 1 };
  private fitted = false;
  /** true cuando la persona movió o acercó la vista: desde entonces no se reencuadra sola. */
  private userMoved = false;
  private hoverNode?: string;
  private drag?:
    | { kind: 'node'; id: string; dx: number; dy: number; moved: boolean; startX: number; startY: number }
    | { kind: 'pan'; x: number; y: number; moved: boolean }
    | { kind: 'wire'; from: string; path: SVGPathElement };

  constructor(private model: Model) {
    this.host = document.createElement('div');
    this.host.className = 'ed-canvas';
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES + CANVAS_CSS;
    // Un único <svg> que vive todo el tiempo: así un arrastre no pierde el puntero cuando se redibuja.
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'fx-stage');
    this.root.append(style, this.svg);
    this.bind(this.svg);
    new ResizeObserver(() => {
      if (!this.userMoved) this.fitted = false;
      this.render();
    }).observe(this.host);
    model.on((reason) => {
      if (reason === 'load' || reason === 'type') {
        this.fitted = false;
        this.userMoved = false;
      }
      this.render();
    });
  }

  /** Centro de la vista actual en coordenadas del mundo (donde aparece un nodo agregado con clic). */
  viewCenter() {
    const r = this.host.getBoundingClientRect();
    return this.toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  /** Coordenadas de pantalla → mundo. */
  toWorld(clientX: number, clientY: number) {
    const r = this.host.getBoundingClientRect();
    return { x: (clientX - r.left - this.cam.tx) / this.cam.s, y: (clientY - r.top - this.cam.ty) / this.cam.s };
  }

  contains(clientX: number, clientY: number) {
    const r = this.host.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  /** Grupo (capa) bajo un punto del mundo, para soltar nodos dentro de una capa. */
  groupAt(x: number, y: number) {
    return this.lay?.groups.find((g) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h)?.id;
  }

  fit() {
    this.fitted = false;
    this.userMoved = false;
    this.render();
  }

  zoomBy(f: number) {
    const r = this.host.getBoundingClientRect();
    this.zoomAt(f, r.width / 2, r.height / 2);
  }

  /* ---------- Dibujo ---------- */

  render() {
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    if (!W || !H) return;
    const d = this.model.diagram;

    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (!d.nodes.length) {
      this.lay = undefined;
      this.svg.replaceChildren();
      return;
    }

    const lay = layout(d, { maxStageWidth: 1e6 });
    this.lay = lay;
    const scene = buildScene(lay, 'ed');
    for (const part of scene.parts.values()) part.classList.add('is-in');
    scene.axis?.classList.add('is-in');

    if (!this.fitted) this.fitTo(lay.bounds, W, H);
    scene.camera.style.transform = `translate(${this.cam.tx}px, ${this.cam.ty}px) scale(${this.cam.s})`;

    const deco = scene.particles; // entre conexiones y nodos
    const top = document.createElementNS(NS, 'g');
    scene.camera.append(top);

    // Zonas de clic de las conexiones (la línea visible es muy fina).
    for (const e of lay.edges) {
      const hit = document.createElementNS(NS, 'path');
      hit.setAttribute('class', 'ed-hit');
      hit.setAttribute('d', e.d);
      hit.dataset.edge = e.id;
      deco.append(hit);
    }
    // Zonas de clic de los grupos (en su encabezado, para no tapar los nodos).
    for (const g of lay.groups) {
      const hit = document.createElementNS(NS, 'rect');
      hit.setAttribute('class', 'ed-group-hit');
      Object.entries({ x: g.x, y: g.y, width: g.w, height: 30, rx: 16 }).forEach(([k, v]) => hit.setAttribute(k, String(v)));
      hit.dataset.group = g.id;
      scene.camera.querySelector('.fx-groups')?.append(hit);
    }
    // Un punto pequeño en los nodos fijados a mano.
    for (const n of lay.nodes) {
      if (typeof n.node.x !== 'number') continue;
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'ed-pin');
      Object.entries({ cx: n.x + n.w - 8, cy: n.y + 8, r: 2 }).forEach(([k, v]) => dot.setAttribute(k, String(v)));
      top.append(dot);
    }

    if (this.model.step !== null) this.decorateStep(lay, scene.parts, scene.slots, top);
    else this.decorateSelection(lay, top);

    this.svg.replaceChildren(...scene.svg.childNodes);
    if (this.drag?.kind === 'wire') this.svg.querySelector('.fx-camera')?.append(this.drag.path);
  }

  private decorateSelection(lay: Layout, top: SVGGElement) {
    const sel = this.model.selection;
    if (sel?.kind === 'node') {
      const n = lay.nodes.find((x) => x.id === sel.id);
      if (n) top.append(rect('ed-sel', { x: n.x - 5, y: n.y - 5, width: n.w + 10, height: n.h + 10, rx: 15 }));
    }
    if (sel?.kind === 'edge') {
      const e = lay.edges.find((x) => x.id === sel.id);
      if (e) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('class', 'ed-sel-edge');
        p.setAttribute('d', e.d);
        top.prepend(p);
      }
    }
    if (sel?.kind === 'group') {
      const g = lay.groups.find((x) => x.id === sel.id);
      if (g) top.append(rect('ed-group-sel', { x: g.x - 4, y: g.y - 4, width: g.w + 8, height: g.h + 8, rx: 19 }));
    }
    // Manijas para conectar: en el nodo seleccionado o bajo el mouse (no en líneas de tiempo).
    if (lay.type === 'timeline') return;
    const ids = new Set([sel?.kind === 'node' ? sel.id : undefined, this.hoverNode].filter(Boolean) as string[]);
    for (const id of ids) {
      const n = lay.nodes.find((x) => x.id === id);
      if (!n) continue;
      for (const [cx, cy] of [
        [n.x + n.w, n.y + n.h / 2],
        [n.x + n.w / 2, n.y + n.h],
      ] as const) {
        const h = document.createElementNS(NS, 'circle');
        h.setAttribute('class', 'ed-handle');
        Object.entries({ cx, cy, r: 6 }).forEach(([k, v]) => h.setAttribute(k, String(v)));
        h.dataset.handle = id;
        top.append(h);
      }
    }
  }

  /** En modo paso: lo que aún no aparece se ve tenue, lo que entra en este paso lleva un borde punteado. */
  private decorateStep(lay: Layout, parts: Map<string, SVGGElement>, slots: Map<string, SVGGElement>, top: SVGGElement) {
    const d = this.model.diagram;
    const i = this.model.step!;
    const step = d.steps![i]!;
    const state = plan(d, lay).steps[i];
    if (!state) return;
    const entering = new Set(state.entering);
    const hl = new Set(toList(step.highlight));
    const flow = new Set(toList(step.flow));

    for (const [id, part] of parts) {
      const st = state.states[id];
      if (st) part.setAttribute('data-state', st);
      const visible = state.visible.has(id);
      const target = slots.get(id) ?? part;
      target.classList.toggle('ed-off', !visible);
      part.classList.toggle('is-accent', hl.has(id) || !!lay.nodes.find((n) => n.id === id)?.node.accent);
      if (flow.has(id)) part.classList.add('is-flowing');
    }
    for (const n of lay.nodes) {
      if (entering.has(n.id)) top.append(rect('ed-new', { x: n.x - 6, y: n.y - 6, width: n.w + 12, height: n.h + 12, rx: 16 }));
      if (step.focus === n.id) top.append(rect('ed-focus', { x: n.x - 14, y: n.y - 14, width: n.w + 28, height: n.h + 28, rx: 22 }));
    }
  }

  /* ---------- Cámara ---------- */

  private fitTo(b: Rect, W: number, H: number) {
    const s = Math.min(1.1, Math.max(0.3, Math.min((W - 80) / b.w, (H - 80) / b.h)));
    this.cam = { s, tx: W / 2 - s * (b.x + b.w / 2), ty: H / 2 - s * (b.y + b.h / 2) };
    this.fitted = true;
  }

  private applyCam() {
    const cam = this.svg?.querySelector<SVGGElement>('.fx-camera');
    if (cam) cam.style.transform = `translate(${this.cam.tx}px, ${this.cam.ty}px) scale(${this.cam.s})`;
  }

  private zoomAt(f: number, px: number, py: number) {
    this.userMoved = true;
    const s = Math.min(3, Math.max(0.2, this.cam.s * f));
    const k = s / this.cam.s;
    this.cam = { s, tx: px - (px - this.cam.tx) * k, ty: py - (py - this.cam.ty) * k };
    this.applyCam();
  }

  /* ---------- Interacción ---------- */

  private bind(svg: SVGSVGElement) {
    svg.addEventListener('pointerdown', this.onDown);
    svg.addEventListener('pointermove', this.onMove);
    svg.addEventListener('pointerup', this.onUp);
    svg.addEventListener('pointercancel', this.onUp);
    svg.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const t = e.target as Element;
    const svg = this.svg;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* puntero inválido o ya liberado */
    }
    const w = this.toWorld(e.clientX, e.clientY);
    const stepMode = this.model.step !== null;

    const handle = (t as SVGElement).dataset?.handle;
    if (handle && !stepMode) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'ed-wire');
      svg.querySelector('.fx-camera')?.append(path);
      this.drag = { kind: 'wire', from: handle, path };
      return;
    }

    const nodeId = t.closest('.fx-slot')?.getAttribute('data-id');
    if (nodeId && e.button === 0) {
      if (stepMode) return this.model.toggleInStep(nodeId, false);
      const n = this.lay?.nodes.find((x) => x.id === nodeId);
      if (this.model.selection?.kind !== 'node' || this.model.selection.id !== nodeId) {
        this.model.select({ kind: 'node', id: nodeId });
      }
      if (n && this.model.diagram.type !== 'timeline') {
        this.drag = { kind: 'node', id: nodeId, dx: w.x - n.x, dy: w.y - n.y, moved: false, startX: e.clientX, startY: e.clientY };
      }
      return;
    }

    const edgeId = (t as SVGElement).dataset?.edge;
    if (edgeId && e.button === 0) {
      if (stepMode) return this.model.toggleInStep(edgeId, true);
      return this.model.select({ kind: 'edge', id: edgeId });
    }

    const groupId = (t as SVGElement).dataset?.group;
    if (groupId && e.button === 0 && !stepMode) return this.model.select({ kind: 'group', id: groupId });

    this.drag = { kind: 'pan', x: e.clientX, y: e.clientY, moved: false };
    svg.classList.add('is-panning');
  };

  private onMove = (e: PointerEvent) => {
    const drag = this.drag;
    if (!drag) {
      // Manijas al pasar el mouse por un nodo.
      const id = (e.target as Element).closest?.('.fx-slot')?.getAttribute('data-id') ?? undefined;
      const onHandle = !!(e.target as SVGElement).dataset?.handle;
      if (!onHandle && id !== this.hoverNode && this.model.step === null) {
        this.hoverNode = id;
        this.render();
      }
      return;
    }
    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = this.userMoved = true;
      this.cam.tx += dx;
      this.cam.ty += dy;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.applyCam();
      return;
    }
    if (drag.kind === 'node') {
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 3) return;
      if (!drag.moved) {
        this.model.checkpoint();
        drag.moved = true;
        this.svg?.classList.add('is-dragging');
      }
      const w = this.toWorld(e.clientX, e.clientY);
      this.model.moveNode(drag.id, snap(w.x - drag.dx), snap(w.y - drag.dy));
      return;
    }
    if (drag.kind === 'wire') {
      const n = this.lay?.nodes.find((x) => x.id === drag.from);
      if (!n) return;
      const w = this.toWorld(e.clientX, e.clientY);
      const x1 = n.x + n.w;
      const y1 = n.y + n.h / 2;
      drag.path.setAttribute('d', `M${x1} ${y1} C${x1 + 60} ${y1} ${w.x - 60} ${w.y} ${w.x} ${w.y}`);
    }
  };

  private onUp = (e: PointerEvent) => {
    const drag = this.drag;
    this.drag = undefined;
    this.svg?.classList.remove('is-panning', 'is-dragging');
    if (!drag) return;
    if (drag.kind === 'pan' && !drag.moved && this.model.step === null) this.model.select(null);
    if (drag.kind === 'node' && drag.moved && this.model.diagram.type === 'architecture') {
      // Soltar un nodo dentro de otra capa lo cambia de capa.
      const n = this.model.node(drag.id);
      const lay = this.lay?.nodes.find((x) => x.id === drag.id);
      const g = lay ? this.groupAt(lay.x + lay.w / 2, lay.y + lay.h / 2) : undefined;
      if (n && g && n.group !== g) {
        n.group = g;
        this.model.emit('edit');
      }
    }
    if (drag.kind === 'node' && drag.moved) this.model.emit('moved');
    if (drag.kind === 'wire') {
      drag.path.remove();
      const el = this.root.elementFromPoint(e.clientX, e.clientY);
      const to = el?.closest('.fx-slot')?.getAttribute('data-id');
      if (to) this.model.addEdge(drag.from, to);
      else this.render();
    }
  };

  // Rueda: desplaza. Ctrl/⌘ + rueda o pellizco: zoom alrededor del cursor.
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.host.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      this.zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    } else {
      this.userMoved = true;
      this.cam.tx -= e.deltaX;
      this.cam.ty -= e.deltaY;
      this.applyCam();
    }
  };
}

function rect(cls: string, attrs: Record<string, number>) {
  const r = document.createElementNS(NS, 'rect');
  r.setAttribute('class', cls);
  for (const [k, v] of Object.entries(attrs)) r.setAttribute(k, String(v));
  return r;
}
