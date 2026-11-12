import type { Layout, MotionPlan, Rect } from '@fluxygram/core';
import type { Scene } from './svg';
import { el } from './svg';

const NODE_STAGGER = 70;
const EDGE_STAGGER = 80;
const EDGE_DRAW = 760;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Flow {
  path: SVGPathElement;
  length: number;
  start: number;
  duration: number;
  group: SVGGElement;
  dots: SVGCircleElement[];
  glow: SVGCircleElement;
}

/** Lleva la escena de un paso a otro. Todo el estado visual vive en clases CSS, así que cualquier salto es interrumpible. */
export class Player {
  index = -1;
  private flows: Flow[] = [];
  private raf = 0;

  constructor(
    private scene: Scene,
    private layout: Layout,
    private plan: MotionPlan,
    private onCaption: (text: string | undefined, direction: 1 | -1) => void,
  ) {}

  get count() {
    return this.plan.steps.length;
  }

  get steps() {
    return this.plan.steps;
  }

  go(i: number) {
    const target = Math.max(0, Math.min(this.count - 1, i));
    if (target === this.index) return;
    const forward = target > this.index;
    const first = this.index === -1;
    const state = this.plan.steps[target]!;
    this.index = target;

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

    // Resaltado: lo destacado toma el color de acento y el resto se atenúa.
    const hl = new Set(state.highlighted);
    for (const [id, slot] of this.scene.slots) {
      slot.classList.toggle('is-dim', hl.size > 0 && !hl.has(id));
      const part = this.scene.parts.get(id)!;
      const original = this.layout.nodes.find((n) => n.id === id)?.node.accent ?? false;
      part.classList.toggle('is-accent', original || hl.has(id));
    }

    for (const [id, part] of this.scene.parts) {
      if (!this.scene.paths.has(id)) continue;
      const flowing = state.flowing.includes(id);
      part.classList.toggle('is-flowing', flowing);
      part.classList.toggle('is-dim', hl.size > 0 && !flowing && !hl.has(id));
    }

    this.moveCamera(state.camera, first);
    this.onCaption(state.caption, forward ? 1 : -1);
    this.startFlows(state.flowing, edgeDelay);
  }

  reset() {
    this.index = -1;
    for (const part of this.scene.parts.values()) {
      part.style.setProperty('--d', '0ms');
      part.classList.remove('is-in', 'is-flowing');
    }
    for (const slot of this.scene.slots.values()) slot.classList.remove('is-dim');
    this.scene.axis?.classList.remove('is-in');
    this.stopFlows();
  }

  destroy() {
    this.stopFlows();
  }

  /** Encuadra un rectángulo del mundo en el escenario. */
  private moveCamera(r: Rect, instant = false) {
    const { w: W, h: H } = this.layout.stage;
    const s = Math.min(W / r.w, H / r.h);
    const tx = W / 2 - s * (r.x + r.w / 2);
    const ty = H / 2 - s * (r.y + r.h / 2);
    const cam = this.scene.camera;
    // En el primer paso la cámara ya está en su lugar: no hay de dónde venir.
    if (instant) cam.style.transition = 'none';
    cam.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    if (instant) {
      cam.getBoundingClientRect();
      cam.style.transition = '';
    }
  }

  /* ---------- Partículas ---------- */

  private startFlows(ids: string[], edgeDelay: Map<string, number>) {
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
      const wait = edgeDelay.has(id) ? edgeDelay.get(id)! + EDGE_DRAW - 120 : 120;
      const duration = Math.min(1700, Math.max(800, length * 4.2));
      this.flows.push({ path, length, start: now + wait, duration, group, dots, glow });
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
  }

  private stopFlows() {
    cancelAnimationFrame(this.raf);
    for (const f of this.flows) f.group.remove();
    this.flows = [];
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
