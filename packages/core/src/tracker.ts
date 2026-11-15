import type { Layout, NodeState, StepState } from './types';

/** Cómo va la etapa actual: en curso (por defecto), terminada o con un problema. */
export type TrackerStatus = 'pending' | 'success' | 'error' | 'warning';

/**
 * Modo seguimiento: en vez de contar el diagrama paso a paso, muestra en qué etapa va un proceso real
 * (un pedido, un trámite, un envío).
 *
 * - Las etapas por las que ya pasó (todo lo que lleva hasta `stage` siguiendo las conexiones) quedan en verde.
 * - La etapa actual toma el estado `status` (en curso, por defecto) y una partícula llega hasta ella.
 * - El resto del diagrama se atenúa: se ve el camino completo, pero destaca lo recorrido.
 *
 * Sin `stage` (o con un id que no existe), todo el diagrama se ve neutro: el proceso aún no empezó.
 *
 * Con `history` (las etapas por las que realmente pasó, en orden), solo esas quedan en verde: sirve cuando
 * hay ramas que se juntan (no se marcan las dos) o ciclos (un ticket que vuelve a "en progreso").
 */
export function trackerState(
  layout: Layout,
  stage: string | undefined,
  status: TrackerStatus = 'pending',
  history?: readonly string[],
): StepState {
  const visible = new Set<string>([...layout.groups.map((g) => g.id), ...layout.nodes.map((n) => n.id), ...layout.edges.map((e) => e.id)]);
  const base: StepState = { visible, entering: [], flowing: [], highlighted: [], camera: layout.bounds, states: {} };
  if (!stage || !layout.nodes.some((n) => n.id === stage)) return base;

  if (history?.length) return fromHistory(layout, base, stage, status, history);

  // Todo lo que lleva hasta la etapa actual: se recorren las conexiones hacia atrás.
  const incoming = new Map<string, { edge: string; from: string }[]>();
  for (const e of layout.edges) {
    const list = incoming.get(e.edge.to) ?? [];
    list.push({ edge: e.id, from: e.edge.from });
    incoming.set(e.edge.to, list);
  }
  const done = new Set<string>();
  const pathEdges = new Set<string>();
  const queue = [stage];
  while (queue.length) {
    const id = queue.shift()!;
    for (const { edge, from } of incoming.get(id) ?? []) {
      if (from === stage) continue; // un ciclo que vuelve a la etapa actual no la marca como terminada
      pathEdges.add(edge);
      if (!done.has(from)) {
        done.add(from);
        queue.push(from);
      }
    }
  }

  const arriving = (incoming.get(stage) ?? []).filter((x) => done.has(x.from)).map((x) => x.edge);
  const states: Record<string, Exclude<NodeState, 'default'>> = {};
  for (const id of done) states[id] = 'success';
  for (const id of pathEdges) states[id] = 'success';
  states[stage] = status;
  // La conexión que llega a la etapa actual toma su color cuando hay un problema o ya terminó.
  for (const id of arriving) {
    if (status === 'pending') delete states[id];
    else states[id] = status;
  }

  return {
    ...base,
    flowing: status === 'success' ? [] : arriving,
    highlighted: [...done, stage, ...pathEdges],
    states,
  };
}

/** Con historial: verde solo lo recorrido de verdad, y las conexiones entre etapas seguidas. */
function fromHistory(layout: Layout, base: StepState, stage: string, status: TrackerStatus, history: readonly string[]): StepState {
  const ids = new Set(layout.nodes.map((n) => n.id));
  const walk = history.filter((id) => ids.has(id));
  if (walk[walk.length - 1] !== stage) walk.push(stage);
  const done = new Set(walk.slice(0, -1).filter((id) => id !== stage));
  const pathEdges = new Set<string>();
  let arriving: string | undefined;
  for (let i = 0; i + 1 < walk.length; i++) {
    const edge = layout.edges.find((e) => e.edge.from === walk[i] && e.edge.to === walk[i + 1]);
    if (!edge) continue;
    if (i + 2 === walk.length) arriving = edge.id;
    else pathEdges.add(edge.id);
  }
  if (arriving) pathEdges.delete(arriving); // la última conexión es la que llega a la etapa actual

  const states: Record<string, Exclude<NodeState, 'default'>> = {};
  for (const id of done) states[id] = 'success';
  for (const id of pathEdges) states[id] = 'success';
  states[stage] = status;
  if (arriving && status !== 'pending') states[arriving] = status;
  return {
    ...base,
    flowing: arriving && status !== 'success' ? [arriving] : [],
    highlighted: [...done, stage, ...pathEdges, ...(arriving ? [arriving] : [])],
    states,
  };
}
