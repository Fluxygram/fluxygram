import type { Layout, MotionPlan, Rect } from '@fluxygram/core';
import type { Scene } from './svg';
import { el } from './svg';

const NODE_STAGGER = 70;
const EDGE_STAGGER = 80;
const EDGE_DRAW = 760;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Flow {
  path: SVGPathElement;
  length: number;
  start: number;
  duration: number;
  group: SVGGElement;
  dots: SVGCircleElement[];
  glow: SVGCircleElement;
  /** Nodo al que llega: late cuando la partícula lo alcanza. */
  to: string;
  /** Vuelta en la que ya lató, para latir una sola vez por recorrido. */
  pulsed: number;
  /** Etiqueta que viaja con la partícula (lo que "lleva" la conexión). */
  tag?: SVGGElement;
}

/** Transformación de la cámara: punto del mundo (x, y) → (x·s + tx, y·s + ty) en el escenario. */
export interface View {
  tx: number;
  ty: number;
  s: number;
}

/**
 * Lleva la escena de un paso a otro. Todo el estado visual vive en clases CSS, así que cualquier salto es interrumpible.
 * También maneja la cámara libre (mover, zoom, enfocar un nodo) y el resaltado al pasar el mouse.
 */
export class Player {
  index = -1;
  /** true cuando la persona movió la cámara por su cuenta. */
  free = false;
  onFreeChange?: (free: boolean) => void;

  private flows: Flow[] = [];
  private raf = 0;
  private base: View = { tx: 0, ty: 0, s: 1 };
  private view: View = { tx: 0, ty: 0, s: 1 };
  private hovered?: string;
  private appliedStates: Record<string, string> = {};
  private neighbors = new Map<string, { nodes: string[]; edges: string[] }>();

  constructor(
    private scene: Scene,
    private layout: Layout,
    private plan: MotionPlan,
    private onCaption: (text: string | undefined, direction: 1 | -1) => void,
  ) {
    for (const n of layout.nodes) this.neighbors.set(n.id, { nodes: [], edges: [] });
    for (const e of layout.edges) {
      this.neighbors.get(e.edge.from)?.nodes.push(e.edge.to);
      this.neighbors.get(e.edge.from)?.edges.push(e.id);
      this.neighbors.get(e.edge.to)?.nodes.push(e.edge.from);
      this.neighbors.get(e.edge.to)?.edges.push(e.id);
    }
  }

  get count() {
    return this.plan.steps.length;
  }

  get steps() {
    return this.plan.steps;
  }

  get stage() {
    return this.layout.stage;
  }

  go(i: number) {
    const target = Math.max(0, Math.min(this.count - 1, i));
    if (target === this.index) return;
    const forward = target > this.index;
    const first = this.index === -1;
    const state = this.plan.steps[target]!;
    this.index = target;
    this.hovered = undefined;

    // Orden de entrada: primero grupos y nodos, después las conexiones que los unen.
    const enteringNodes = state.entering.filter((id) => !this.scene.paths.has(id));
    const enteringEdges = state.entering.filter((id) => this.scene.paths.has(id));
    const nodeDelay = new Map(enteringNodes.map((id, k) => [id, Math.min(k, 8) * NODE_STAGGER]));
    const edgeBase = enteringNodes.length ? 200 + Math.min(enteringNodes.length - 1, 8) * NODE_STAGGER : 0;
    const edgeDelay = new Map(enteringEdges.map((id, k) => [id, edgeBase + Math.min(k, 8) * EDGE_STAGGER]));

    for (const [id, part] of this.scene.parts) {
      const visible = state.visible.has(id);
      const delay = forward ? (nodeDelay.get(id) ?? edgeDelay.get(id) ?? 0) : 0;
      part.style.setProperty('--d', `${delay}ms`);
      part.classList.toggle('is-in', visible);
    }
    this.scene.axis?.classList.add('is-in');

    this.emphasize(new Set(state.highlighted), state.flowing);
    this.applyStates(state.states, nodeDelay);
    this.moveCamera(state.camera, first);
    this.onCaption(state.caption, forward ? 1 : -1);
    this.startFlows(state.flowing, edgeDelay);
  }

  reset() {
    this.index = -1;
    this.applyStates({}, new Map(), false);
    for (const part of this.scene.parts.values()) {
      part.style.setProperty('--d', '0ms');
      part.classList.remove('is-in', 'is-flowing', 'is-dim');
    }
    for (const slot of this.scene.slots.values()) slot.classList.remove('is-dim');
    this.scene.axis?.classList.remove('is-in');
    this.stopFlows();
  }

  destroy() {
    this.stopFlows();
  }

  /* ---------- Estados ---------- */

  /** Pinta el estado de cada nodo; los que cambian en este paso laten con el color de su nuevo estado. */
  private applyStates(states: Record<string, string>, delays: Map<string, number>, pulse = true) {
    for (const n of this.layout.nodes) {
      const part = this.scene.parts.get(n.id);
      if (!part) continue;
      const next = states[n.id];
      const prev = this.appliedStates[n.id];
      if (next) part.setAttribute('data-state', next);
      else part.removeAttribute('data-state');
      if (pulse && next && next !== prev) {
        setTimeout(() => this.pulse(n.id, `var(--fx-${next})`), (delays.get(n.id) ?? 0) + 120);
      }
    }
    this.appliedStates = { ...states };
  }

  /** Un anillo que se expande y se desvanece alrededor de un nodo. */
  pulse(id: string, color = 'var(--fx-accent)', strength = 0.75) {
    if (reducedMotion()) return;
    const n = this.layout.nodes.find((x) => x.id === id);
    if (!n) return;
    const decision = n.node.kind === 'decision';
    const ring = decision
      ? el('path', { class: 'fx-pulse', d: `M${n.x + n.w / 2} ${n.y} L${n.x + n.w} ${n.y + n.h / 2} L${n.x + n.w / 2} ${n.y + n.h} L${n.x} ${n.y + n.h / 2} Z` }, this.scene.overlay)
      : el('rect', { class: 'fx-pulse', x: n.x, y: n.y, width: n.w, height: n.h, rx: n.node.kind === 'start' || n.node.kind === 'end' ? n.h / 2 : 12 }, this.scene.overlay);
    ring.style.stroke = color;
    const anim = ring.animate(
      [
        { opacity: strength, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(1.16)' },
      ],
      { duration: 720, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
    anim.onfinish = () => ring.remove();
    anim.oncancel = () => ring.remove();
  }

  /* ---------- Resaltado ---------- */

  /** Lo destacado toma el color de acento y el resto se atenúa; las conexiones con partículas se pintan de acento. */
  private emphasize(hl: Set<string>, flowing: string[]) {
    for (const [id, slot] of this.scene.slots) {
      slot.classList.toggle('is-dim', hl.size > 0 && !hl.has(id));
      const part = this.scene.parts.get(id)!;
      const original = this.layout.nodes.find((n) => n.id === id)?.node.accent ?? false;
      part.classList.toggle('is-accent', original || hl.has(id));
    }
    for (const [id, part] of this.scene.parts) {
      if (!this.scene.paths.has(id)) continue;
      const flows = flowing.includes(id);
      part.classList.toggle('is-flowing', flows);
      part.classList.toggle('is-dim', hl.size > 0 && !flows && !hl.has(id));
    }
  }

  /** Al pasar el mouse por un nodo: él y sus vecinos destacan, y las partículas recorren sus conexiones. */
  hover(id: string | undefined) {
    if (id === this.hovered) return;
    const state = this.plan.steps[this.index];
    if (!state) return;
    if (id && !state.visible.has(id)) id = undefined;
    this.hovered = id;

    if (!id) {
      this.emphasize(new Set(state.highlighted), state.flowing);
      this.startFlows(state.flowing, new Map());
      return;
    }
    const near = this.neighbors.get(id) ?? { nodes: [], edges: [] };
    const edges = near.edges.filter((e) => state.visible.has(e));
    const nodes = near.nodes.filter((n) => state.visible.has(n));
    this.emphasize(new Set([id, ...nodes]), edges);
    this.startFlows(edges, new Map(), 0);
  }

  /* ---------- Cámara ---------- */

  private apply(v: View, animate: boolean) {
    const cam = this.scene.camera;
    this.view = v;
    if (!animate) cam.style.transition = 'none';
    cam.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.s})`;
    if (!animate) {
      cam.getBoundingClientRect();
      cam.style.transition = '';
    }
  }

  private viewFor(r: Rect): View {
    const { w: W, h: H } = this.layout.stage;
    const s = Math.min(W / r.w, H / r.h);
    return { s, tx: W / 2 - s * (r.x + r.w / 2), ty: H / 2 - s * (r.y + r.h / 2) };
  }

  private setFree(free: boolean) {
    if (free === this.free) return;
    this.free = free;
    this.onFreeChange?.(free);
  }

  /** Encuadra un rectángulo del mundo. En el primer paso la cámara ya está en su lugar: no hay de dónde venir. */
  private moveCamera(r: Rect, instant = false) {
    this.base = this.viewFor(r);
    this.setFree(false);
    this.apply(this.base, !instant);
  }

  /** Mueve la cámara en unidades del escenario, sin transición (sigue al dedo). */
  panBy(dx: number, dy: number) {
    this.setFree(true);
    this.apply({ ...this.view, tx: this.view.tx + dx, ty: this.view.ty + dy }, false);
  }

  /** Zoom alrededor de un punto del escenario, para que lo que está bajo el cursor no se mueva. */
  /** Devuelve false si ya estaba en el límite (para dejar que la rueda desplace la página). */
  zoomAt(factor: number, px: number, py: number, animate = false): boolean {
    const s = clamp(this.view.s * factor, this.base.s * MIN_ZOOM, this.base.s * MAX_ZOOM);
    const k = s / this.view.s;
    if (Math.abs(k - 1) < 1e-4) return false;
    this.setFree(true);
    this.apply({ s, tx: px - (px - this.view.tx) * k, ty: py - (py - this.view.ty) * k }, animate);
    return true;
  }

  /** La cámara se acerca a un nodo, con contexto alrededor. */
  focusNode(id: string) {
    const n = this.layout.nodes.find((x) => x.id === id);
    if (!n) return;
    const { w: W, h: H } = this.layout.stage;
    const aspect = W / H;
    const rw = Math.max(n.w * 2.2, W * 0.45, n.h * 2.2 * aspect);
    const rh = rw / aspect;
    this.setFree(true);
    this.apply(this.viewFor({ x: n.x + n.w / 2 - rw / 2, y: n.y + n.h / 2 - rh / 2, w: rw, h: rh }), true);
  }

  /** Vuelve a la vista que corresponde al paso actual. */
  resetView() {
    this.setFree(false);
    this.apply(this.base, true);
  }

  /* ---------- Partículas ---------- */

  private startFlows(ids: string[], edgeDelay: Map<string, number>, idleWait = 120) {
    this.stopFlows();
    if (!ids.length || reducedMotion()) return;
    const now = performance.now();
    for (const id of ids) {
      const path = this.scene.paths.get(id);
      if (!path) continue;
      const length = path.getTotalLength();
      const group = el('g', { class: 'fx-particle', opacity: 0 }, this.scene.particles);
      const glow = el('circle', { class: 'glow', r: 11 }, group);
      const dots = [0, 1, 2, 3, 4].map((k) =>
        el('circle', { class: 'core', r: 4.5 * (1 - k * 0.17), opacity: 1 - k * 0.2 }, group),
      );
      // Si la conexión se está dibujando en este paso, la partícula sale cuando termina de dibujarse.
      const wait = edgeDelay.has(id) ? edgeDelay.get(id)! + EDGE_DRAW - 120 : idleWait;
      const duration = Math.min(1700, Math.max(800, length * 4.2));
      const laid = this.layout.edges.find((e) => e.id === id);
      let tag: SVGGElement | undefined;
      if (laid?.edge.carries) {
        const text = laid.edge.carries;
        const w = Math.ceil(text.length * 6.6) + 14;
        tag = el('g', { class: 'fx-tag' }, group);
        el('rect', { x: -w / 2, y: -27, width: w, height: 18, rx: 9 }, tag);
        const label = el('text', { 'text-anchor': 'middle', y: -14.5 }, tag);
        label.textContent = text;
      }
      this.flows.push({ path, length, start: now + wait, duration, group, dots, glow, to: laid?.edge.to ?? '', pulsed: -1, tag });
    }
    const tick = (t: number) => {
      for (const f of this.flows) this.drawFlow(f, t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private drawFlow(f: Flow, now: number) {
    const elapsed = now - f.start;
    if (elapsed < 0) return;
    const period = f.duration + 520;
    const local = elapsed % period;
    const cycle = Math.floor(elapsed / period);
    if (local >= f.duration * 0.94 && f.pulsed !== cycle) {
      f.pulsed = cycle;
      this.pulse(f.to, 'var(--fx-accent)', 0.5);
    }
    if (local > f.duration) {
      f.group.setAttribute('opacity', '0');
      return;
    }
    const p = local / f.duration;
    // Aparece y se desvanece en los extremos para que no "salte" al reiniciar.
    const fade = Math.min(1, p / 0.08, (1 - p) / 0.1);
    f.group.setAttribute('opacity', String(fade));
    const head = easeInOut(p);
    f.dots.forEach((dot, k) => {
      const t = Math.max(0, head - k * 0.022);
      const pt = f.path.getPointAtLength(t * f.length);
      dot.setAttribute('cx', String(pt.x));
      dot.setAttribute('cy', String(pt.y));
    });
    const pt = f.path.getPointAtLength(head * f.length);
    f.glow.setAttribute('cx', String(pt.x));
    f.glow.setAttribute('cy', String(pt.y));
    f.tag?.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
  }

  private stopFlows() {
    cancelAnimationFrame(this.raf);
    for (const f of this.flows) f.group.remove();
    this.flows = [];
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
