import type { Diagram, DiagramType, FluxEdge, FluxGroup, FluxNode, FluxStep, Motion, NodeState } from '@fluxygram/core';

export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'group'; id: string }
  | null;

export type StepMode = 'show' | 'flow' | 'highlight' | 'focus' | 'state';

/** Orden en que un clic recorre los estados de un nodo en el modo "Estado". */
const STATE_CYCLE: (NodeState | undefined)[] = [undefined, 'success', 'error', 'warning', 'pending'];

export const edgeKey = (e: FluxEdge) => e.id ?? `${e.from}->${e.to}`;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Estado del editor. El diagrama es siempre un JSON válido de Fluxygram (salvo cuando no tiene nodos):
 * el lienzo, el inspector y la pestaña JSON son tres vistas del mismo objeto.
 */
export class Model {
  diagram: Diagram;
  selection: Selection = null;
  /** Paso que se está editando; null = edición del diagrama. */
  step: number | null = null;
  stepMode: StepMode = 'show';

  private past: string[] = [];
  private future: string[] = [];
  private listeners = new Set<(reason: string) => void>();

  constructor(diagram: Diagram) {
    this.diagram = normalize(diagram);
  }

  on(fn: (reason: string) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason = 'change') {
    for (const fn of this.listeners) fn(reason);
  }

  /** Guarda el estado actual para deshacer. Llamar antes de un cambio que deba poder revertirse. */
  checkpoint() {
    this.past.push(JSON.stringify(this.diagram));
    if (this.past.length > 100) this.past.shift();
    this.future = [];
  }

  /** Aplica un cambio con su punto de deshacer. */
  change(fn: (d: Diagram) => void, reason = 'change') {
    this.checkpoint();
    fn(this.diagram);
    this.emit(reason);
  }

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(JSON.stringify(this.diagram));
    this.diagram = JSON.parse(prev) as Diagram;
    this.fixSelection();
    this.emit('history');
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(JSON.stringify(this.diagram));
    this.diagram = JSON.parse(next) as Diagram;
    this.fixSelection();
    this.emit('history');
  }

  /** Reemplaza el diagrama entero (abrir archivo, ejemplo, JSON pegado). */
  load(diagram: Diagram) {
    this.checkpoint();
    this.diagram = normalize(clone(diagram));
    this.selection = null;
    this.step = null;
    this.emit('load');
  }

  select(sel: Selection) {
    this.selection = sel;
    this.emit('select');
  }

  private fixSelection() {
    const s = this.selection;
    if (!s) return;
    const exists =
      s.kind === 'node' ? this.node(s.id) : s.kind === 'edge' ? this.edge(s.id) : this.group(s.id);
    if (!exists) this.selection = null;
    if (this.step !== null && this.step >= (this.diagram.steps?.length ?? 0)) this.step = null;
  }

  /* ---------- Consultas ---------- */

  node(id: string) {
    return this.diagram.nodes.find((n) => n.id === id);
  }
  edge(id: string) {
    return this.diagram.edges?.find((e) => edgeKey(e) === id);
  }
  group(id: string) {
    return this.diagram.groups?.find((g) => g.id === id);
  }
  get currentStep(): FluxStep | undefined {
    return this.step === null ? undefined : this.diagram.steps?.[this.step];
  }

  private nextId(prefix: string) {
    const used = new Set([
      ...this.diagram.nodes.map((n) => n.id),
      ...(this.diagram.edges ?? []).map(edgeKey),
      ...(this.diagram.groups ?? []).map((g) => g.id),
    ]);
    let i = 1;
    while (used.has(`${prefix}${i}`)) i++;
    return `${prefix}${i}`;
  }

  /* ---------- Operaciones ---------- */

  setType(type: DiagramType) {
    this.change((d) => {
      d.type = type;
      if (type === 'architecture' && !d.groups?.length) {
        d.groups = [{ id: this.nextId('g'), label: 'Layer 1' }];
      }
      if (type === 'architecture') for (const n of d.nodes) n.group ??= d.groups![0]!.id;
      if (type === 'timeline') for (const n of d.nodes) delete n.x, delete n.y;
    }, 'type');
  }

  addNode(partial: Partial<FluxNode>, label: string) {
    const id = this.nextId('n');
    this.change((d) => {
      const node: FluxNode = { id, label, ...partial };
      if (d.type === 'architecture') node.group ??= d.groups?.[d.groups.length - 1]?.id;
      if (d.type === 'timeline') {
        delete node.x;
        delete node.y;
      }
      d.nodes.push(node);
    }, 'add');
    this.select({ kind: 'node', id });
    return id;
  }

  addEdge(from: string, to: string) {
    if (from === to) return;
    const exists = this.diagram.edges?.some((e) => e.from === from && e.to === to);
    if (exists) return;
    const id = this.nextId('e');
    this.change((d) => {
      (d.edges ??= []).push({ id, from, to });
    }, 'add');
    this.select({ kind: 'edge', id });
  }

  addGroup(label: string) {
    const id = this.nextId('g');
    this.change((d) => {
      (d.groups ??= []).push({ id, label });
    }, 'add');
    this.select({ kind: 'group', id });
  }

  /** Mueve un nodo sin punto de deshacer (se llama en cada movimiento del arrastre). */
  moveNode(id: string, x: number, y: number) {
    const n = this.node(id);
    if (!n) return;
    n.x = Math.round(x);
    n.y = Math.round(y);
    this.emit('move');
  }

  updateNode(id: string, patch: Partial<FluxNode>) {
    this.change((d) => {
      const n = d.nodes.find((x) => x.id === id);
      if (!n) return;
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === false) delete (n as unknown as Record<string, unknown>)[k];
        else (n as unknown as Record<string, unknown>)[k] = v;
      }
    }, 'edit');
  }

  updateEdge(id: string, patch: Partial<FluxEdge>) {
    this.change((d) => {
      const e = d.edges?.find((x) => edgeKey(x) === id);
      if (!e) return;
      if ('label' in patch) {
        if (patch.label) e.label = patch.label;
        else delete e.label;
      }
      if ('carries' in patch) {
        if (patch.carries) e.carries = patch.carries;
        else delete e.carries;
      }
      if ('travel' in patch) {
        if (patch.travel) e.travel = patch.travel;
        else delete e.travel;
      }
      if (patch.from && patch.to) {
        e.from = patch.from;
        e.to = patch.to;
      }
    }, 'edit');
  }

  updateGroup(id: string, patch: Partial<FluxGroup>) {
    this.change((d) => {
      const g = d.groups?.find((x) => x.id === id);
      if (g && patch.label !== undefined) g.label = patch.label;
    }, 'edit');
  }

  moveGroup(id: string, delta: -1 | 1) {
    const groups = this.diagram.groups ?? [];
    const i = groups.findIndex((g) => g.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= groups.length) return;
    this.change((d) => {
      const list = d.groups!;
      [list[i], list[j]] = [list[j]!, list[i]!];
    }, 'edit');
  }

  remove(sel: Selection) {
    if (!sel) return;
    this.change((d) => {
      if (sel.kind === 'node') {
        d.nodes = d.nodes.filter((n) => n.id !== sel.id);
        const gone = (d.edges ?? []).filter((e) => e.from === sel.id || e.to === sel.id).map(edgeKey);
        d.edges = (d.edges ?? []).filter((e) => e.from !== sel.id && e.to !== sel.id);
        scrubSteps(d, [sel.id, ...gone]);
      } else if (sel.kind === 'edge') {
        d.edges = (d.edges ?? []).filter((e) => edgeKey(e) !== sel.id);
        scrubSteps(d, [sel.id]);
      } else {
        const rest = (d.groups ?? []).filter((g) => g.id !== sel.id);
        if (!rest.length) return;
        d.groups = rest;
        for (const n of d.nodes) if (n.group === sel.id) n.group = rest[0]!.id;
        scrubSteps(d, [sel.id]);
      }
    }, 'remove');
    this.selection = null;
    this.emit('select');
  }

  /** Cambia la animación por defecto del diagrama. Un valor vacío vuelve al comportamiento por defecto. */
  setMotion(patch: Partial<Motion>) {
    this.change((d) => {
      const m: Record<string, unknown> = { ...(d.motion ?? {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete m[k];
        else m[k] = v;
      }
      // El final vive en motion; se limpia el campo antiguo para no tener dos fuentes.
      delete d.finale;
      if (Object.keys(m).length) d.motion = m as Motion;
      else delete d.motion;
    }, 'motion');
  }

  /** Quita todas las posiciones fijadas: vuelve el acomodo automático. */
  autoLayout() {
    this.change((d) => {
      for (const n of d.nodes) delete n.x, delete n.y;
    }, 'layout');
  }

  /* ---------- Pasos ---------- */

  addStep() {
    this.change((d) => {
      (d.steps ??= []).push({ show: [] });
    }, 'steps');
    this.step = this.diagram.steps!.length - 1;
    this.stepMode = 'show';
    this.emit('step');
  }

  removeStep(i: number) {
    this.change((d) => {
      d.steps?.splice(i, 1);
      if (!d.steps?.length) delete d.steps;
    }, 'steps');
    this.step = this.diagram.steps?.length ? Math.min(i, this.diagram.steps.length - 1) : null;
    this.emit('step');
  }

  moveStep(i: number, delta: -1 | 1) {
    const steps = this.diagram.steps ?? [];
    const j = i + delta;
    if (j < 0 || j >= steps.length) return;
    this.change((d) => {
      const list = d.steps!;
      [list[i], list[j]] = [list[j]!, list[i]!];
    }, 'steps');
    this.step = j;
    this.emit('step');
  }

  setStep(i: number | null) {
    this.step = i;
    this.selection = null;
    this.emit('step');
  }

  setStepMode(mode: StepMode) {
    this.stepMode = mode;
    this.emit('step');
  }

  setStepDuration(seconds: number | undefined) {
    const i = this.step;
    if (i === null) return;
    this.change((d) => {
      const s = d.steps![i]!;
      if (seconds) s.duration = seconds;
      else delete s.duration;
    }, 'steps');
  }

  setCaption(text: string) {
    const i = this.step;
    if (i === null) return;
    this.change((d) => {
      const s = d.steps![i]!;
      if (text) s.caption = text;
      else delete s.caption;
    }, 'caption');
  }

  /** Clic sobre un elemento en modo paso: lo agrega o lo quita según el modo activo. */
  toggleInStep(id: string, isEdge: boolean) {
    const i = this.step;
    if (i === null) return;
    const mode = this.stepMode;
    if (mode === 'flow' && !isEdge) return;
    if ((mode === 'highlight' || mode === 'focus') && isEdge) return;
    this.change((d) => {
      const s = d.steps![i]!;
      if (mode === 'state') {
        const current = s.state?.[id];
        const next = STATE_CYCLE[(STATE_CYCLE.indexOf(current) + 1) % STATE_CYCLE.length];
        const map = { ...(s.state ?? {}) };
        if (next) map[id] = next;
        else delete map[id];
        if (Object.keys(map).length) s.state = map;
        else delete s.state;
        return;
      }
      if (mode === 'focus') {
        if (s.focus === id) delete s.focus;
        else s.focus = id;
        return;
      }
      const key = mode as 'show' | 'flow' | 'highlight';
      const list = toList(s[key]);
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      if (next.length) s[key] = next;
      else delete s[key];
    }, 'steps');
  }
}

export const toList = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function scrubSteps(d: Diagram, ids: string[]) {
  for (const s of d.steps ?? []) {
    for (const key of ['show', 'hide', 'flow', 'highlight'] as const) {
      const list = toList(s[key]).filter((x) => !ids.includes(x));
      if (list.length) s[key] = list;
      else delete s[key];
    }
    if (s.focus && ids.includes(s.focus)) delete s.focus;
    if (s.state) {
      for (const id of ids) delete s.state[id];
      if (!Object.keys(s.state).length) delete s.state;
    }
  }
}

/** Da ids explícitos a las conexiones para que los pasos puedan referirse a ellas de forma estable. */
function normalize(d: Diagram): Diagram {
  d.nodes ??= [];
  for (const e of d.edges ?? []) e.id ??= `${e.from}->${e.to}`;
  return d;
}

export function emptyDiagram(): Diagram {
  return { type: 'flow', title: '', nodes: [], edges: [] };
}
