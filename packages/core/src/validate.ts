import { ENTER_STYLES, NODE_KINDS, NODE_STATES, SPEEDS, TRAVEL_STYLES, type Diagram } from './types';

export type Locale = 'en' | 'es';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; diagram: Diagram }
  | { ok: false; issues: ValidationIssue[] };

const TYPES = ['flow', 'architecture', 'timeline'];

type Params = Record<string, string>;
const MESSAGES: Record<string, Record<Locale, string>> = {
  notObject: { en: 'The diagram must be a JSON object.', es: 'El diagrama debe ser un objeto JSON.' },
  type: { en: '"type" must be one of: {types}.', es: '"type" debe ser uno de: {types}.' },
  nodes: { en: '"nodes" must be a list with at least one node.', es: '"nodes" debe ser una lista con al menos un nodo.' },
  id: { en: 'Missing "id", or it is not a string.', es: 'Falta "id" o no es texto.' },
  dupId: {
    en: 'The id "{id}" is repeated. Every node, edge and group needs a unique id.',
    es: 'El id "{id}" está repetido. Cada nodo, conexión y grupo necesita un id único.',
  },
  nodeObj: { en: 'Each node must be an object.', es: 'Cada nodo debe ser un objeto.' },
  label: { en: 'Each node needs a "label".', es: 'Cada nodo necesita un "label".' },
  oneOf: { en: '"{field}" must be one of: {list}.', es: '"{field}" debe ser uno de: {list}.' },
  kind: { en: '"kind" must be one of: {list}.', es: '"kind" debe ser uno de: {list}.' },
  pos: { en: '"x" and "y" must both be numbers.', es: '"x" e "y" deben ser números, los dos.' },
  date: { en: '"date" must be a string, like "1995" or "2026-03".', es: '"date" debe ser texto, por ejemplo "1995" o "2026-03".' },
  groups: { en: '"groups" must be a list.', es: '"groups" debe ser una lista.' },
  groupObj: { en: 'Each group must be an object.', es: 'Cada grupo debe ser un objeto.' },
  groupLabel: { en: 'Each group needs a "label".', es: 'Cada grupo necesita un "label".' },
  noGroup: { en: 'The group "{id}" does not exist in "groups".', es: 'El grupo "{id}" no existe en "groups".' },
  edges: { en: '"edges" must be a list.', es: '"edges" debe ser una lista.' },
  edgeObj: { en: 'Each edge must be an object.', es: 'Cada conexión debe ser un objeto.' },
  from: { en: '"from" points to "{id}", which is not a node.', es: '"from" apunta a "{id}", que no es un nodo.' },
  to: { en: '"to" points to "{id}", which is not a node.', es: '"to" apunta a "{id}", que no es un nodo.' },
  steps: { en: '"steps" must be a list.', es: '"steps" debe ser una lista.' },
  stepObj: { en: 'Each step must be an object.', es: 'Cada paso debe ser un objeto.' },
  seconds: { en: '"{field}" must be a number of seconds between 0.5 and 60.', es: '"{field}" debe ser una cantidad de segundos entre 0.5 y 60.' },
  stateVal: {
    en: '"{v}" is not a state. Use one of: {list}.',
    es: '"{v}" no es un estado. Usa uno de: {list}.',
  },
  stateObj: { en: '"state" must be an object like { "node-id": "success" }.', es: '"state" debe ser un objeto como { "id-del-nodo": "success" }.' },
  ref: {
    en: '"{id}" is not the id of any node, edge or group.',
    es: '"{id}" no es el id de ningún nodo, conexión o grupo.',
  },
};

export function message(locale: Locale, key: string, params: Params = {}) {
  const template = MESSAGES[key]?.[locale] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asList = (v: unknown): string[] =>
  v === undefined ? [] : Array.isArray(v) ? (v as string[]) : [v as string];

/**
 * Validates a diagram and returns readable errors, written for both people and agents.
 * No JSON Schema library, to keep the core dependency-free; the public schema (schema/v1.json)
 * describes the same rules for editors.
 */
export function validate(input: unknown, options: { locale?: Locale } = {}): ValidationResult {
  const locale = options.locale ?? 'en';
  const issues: ValidationIssue[] = [];
  const add = (path: string, key: string, params?: Params) => issues.push({ path, message: message(locale, key, params) });

  if (!isObj(input)) {
    add('', 'notObject');
    return { ok: false, issues };
  }

  if (typeof input.type !== 'string' || !TYPES.includes(input.type)) add('type', 'type', { types: TYPES.join(', ') });

  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    add('nodes', 'nodes');
    return { ok: false, issues };
  }

  const seconds = (v: unknown, path: string) => {
    if (v !== undefined && (typeof v !== 'number' || v < 0.5 || v > 60)) add(path, 'seconds', { field: path.split('.').pop()! });
  };
  const oneOf = (v: unknown, path: string, list: readonly string[]) => {
    if (v !== undefined && !list.includes(v as string)) add(path, 'oneOf', { field: path.split('.').pop()!, list: list.join(', ') });
  };
  if (input.motion !== undefined) {
    if (!isObj(input.motion)) add('motion', 'oneOf', { field: 'motion', list: '{ enter, travel, speed, camera, finale }' });
    else {
      oneOf(input.motion.enter, 'motion.enter', ENTER_STYLES);
      oneOf(input.motion.travel, 'motion.travel', TRAVEL_STYLES);
      oneOf(input.motion.speed, 'motion.speed', SPEEDS);
      oneOf(input.motion.camera, 'motion.camera', ['follow', 'fixed']);
      seconds(input.motion.hold, 'motion.hold');
    }
  }

  const ids = new Set<string>();
  const nodeIds = new Set<string>();
  const claim = (id: unknown, path: string) => {
    if (typeof id !== 'string' || id.trim() === '') return add(path, 'id');
    if (ids.has(id)) add(path, 'dupId', { id });
    ids.add(id);
  };

  input.nodes.forEach((n, i) => {
    const p = `nodes[${i}]`;
    if (!isObj(n)) return add(p, 'nodeObj');
    claim(n.id, `${p}.id`);
    if (typeof n.id === 'string') nodeIds.add(n.id);
    if (typeof n.label !== 'string' || n.label.trim() === '') add(`${p}.label`, 'label');
    if (n.date !== undefined && typeof n.date !== 'string') add(`${p}.date`, 'date');
    if (n.kind !== undefined && !NODE_KINDS.includes(n.kind as never)) add(`${p}.kind`, 'kind', { list: NODE_KINDS.join(', ') });
    oneOf(n.enter, `${p}.enter`, ENTER_STYLES);
    oneOf(n.state, `${p}.state`, NODE_STATES);
    if ((n.x !== undefined || n.y !== undefined) && (typeof n.x !== 'number' || typeof n.y !== 'number')) add(`${p}.x`, 'pos');
  });

  const groupIds = new Set<string>();
  if (input.groups !== undefined) {
    if (!Array.isArray(input.groups)) add('groups', 'groups');
    else
      input.groups.forEach((g, i) => {
        const p = `groups[${i}]`;
        if (!isObj(g)) return add(p, 'groupObj');
        claim(g.id, `${p}.id`);
        if (typeof g.id === 'string') groupIds.add(g.id);
        if (typeof g.label !== 'string') add(`${p}.label`, 'groupLabel');
      });
  }

  input.nodes.forEach((n, i) => {
    if (isObj(n) && n.group !== undefined && !groupIds.has(n.group as string)) add(`nodes[${i}].group`, 'noGroup', { id: String(n.group) });
  });

  if (input.edges !== undefined) {
    if (!Array.isArray(input.edges)) add('edges', 'edges');
    else
      input.edges.forEach((e, i) => {
        const p = `edges[${i}]`;
        if (!isObj(e)) return add(p, 'edgeObj');
        if (e.id !== undefined) claim(e.id, `${p}.id`);
        else ids.add(`${String(e.from)}->${String(e.to)}`);
        oneOf(e.travel, `${p}.travel`, TRAVEL_STYLES);
        oneOf(e.state, `${p}.state`, NODE_STATES);
        if (!nodeIds.has(e.from as string)) add(`${p}.from`, 'from', { id: String(e.from) });
        if (!nodeIds.has(e.to as string)) add(`${p}.to`, 'to', { id: String(e.to) });
      });
  }

  if (input.steps !== undefined) {
    if (!Array.isArray(input.steps)) add('steps', 'steps');
    else
      input.steps.forEach((s, i) => {
        const p = `steps[${i}]`;
        if (!isObj(s)) return add(p, 'stepObj');
        for (const key of ['show', 'hide', 'flow', 'highlight', 'focus'] as const) {
          asList(s[key]).forEach((ref) => {
            if (!ids.has(ref)) add(`${p}.${key}`, 'ref', { id: ref });
          });
        }
        seconds(s.duration, `${p}.duration`);
        if (s.state !== undefined) {
          if (!isObj(s.state)) add(`${p}.state`, 'stateObj');
          else
            for (const [id, v] of Object.entries(s.state)) {
              if (!ids.has(id)) add(`${p}.state`, 'ref', { id });
              if (!NODE_STATES.includes(v as never)) add(`${p}.state.${id}`, 'stateVal', { v: String(v), list: NODE_STATES.join(', ') });
            }
        }
      });
  }

  return issues.length ? { ok: false, issues } : { ok: true, diagram: input as unknown as Diagram };
}
