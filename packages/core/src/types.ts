/** Tipos de diagrama soportados en la v1. Cada uno trae su propia gramática de movimiento. */
export type DiagramType = 'flow' | 'architecture' | 'timeline';

export type Direction = 'LR' | 'TB';

export type NodeKind = 'default' | 'decision' | 'start' | 'end' | 'data' | 'database' | 'note';
export const NODE_KINDS: NodeKind[] = ['default', 'decision', 'start', 'end', 'data', 'database', 'note'];

/** Cómo entra un bloque: aparecer subiendo, crecer, trazarse como un dibujo, o llegar deslizándose. */
export type EnterStyle = 'fade' | 'scale' | 'draw' | 'slide';
export const ENTER_STYLES: EnterStyle[] = ['fade', 'scale', 'draw', 'slide'];

/** Qué recorre una conexión: una partícula, una onda de luz, guiones que avanzan, o paquetes. */
export type TravelStyle = 'particle' | 'pulse' | 'dash' | 'packets';
export const TRAVEL_STYLES: TravelStyle[] = ['particle', 'pulse', 'dash', 'packets'];

export type Speed = 'slow' | 'normal' | 'fast';
export const SPEEDS: Speed[] = ['slow', 'normal', 'fast'];

/** Animación por defecto del diagrama. Cada bloque y conexión puede tener la suya. */
export interface Motion {
  enter?: EnterStyle;
  travel?: TravelStyle;
  speed?: Speed;
  /** `follow`: la cámara sigue la acción. `fixed`: todo siempre a la vista. */
  camera?: 'follow' | 'fixed';
  /** Segundos que se queda cada paso en la reproducción automática. Sin valor: se calcula según el paso. */
  hold?: number;
  finale?: boolean;
}

/** Estado de un nodo en un paso. `default` lo devuelve a su aspecto normal. */
export type NodeState = 'success' | 'error' | 'warning' | 'pending' | 'default';
export const NODE_STATES: NodeState[] = ['success', 'error', 'warning', 'pending', 'default'];

export interface FluxNode {
  id: string;
  label: string;
  /** Una línea corta debajo del nombre. */
  description?: string;
  /** Nombre de un ícono incluido (ver ICON_NAMES en @fluxygram/element). */
  icon?: string;
  /**
   * Forma del bloque: `decision` rombo, `start`/`end` píldora, `data` paralelogramo (entrada/salida),
   * `database` cilindro, `note` nota con esquina doblada (anotación).
   */
  kind?: NodeKind;
  /** Capa a la que pertenece (solo `architecture`). */
  group?: string;
  /** Fecha o etiqueta de tiempo (solo `timeline`), por ejemplo "1995" o "2026-03". */
  date?: string;
  /** Resalta el nodo con el color de acento. */
  accent?: boolean;
  /** Entrada propia de este bloque (si no, la del diagrama). */
  enter?: EnterStyle;
  /** Estado desde el principio (los pasos pueden cambiarlo). */
  state?: NodeState;
  /** Posición fijada a mano (esquina superior izquierda). Sin ella, el nodo se acomoda solo. */
  x?: number;
  y?: number;
}

export interface FluxEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  /** Lo que viaja por la conexión: se muestra junto a la partícula ("token", "$", "evento"). */
  carries?: string;
  /** Recorrido propio de esta conexión (si no, el del diagrama). */
  travel?: TravelStyle;
  /** Estado desde el principio: tiñe la línea, la partícula y la etiqueta (ej. un camino que falla). */
  state?: NodeState;
}

export interface FluxGroup {
  id: string;
  label: string;
}

export interface FluxStep {
  /** Elementos (nodos, conexiones o grupos) que aparecen en este paso. Los pasos son acumulativos. */
  show?: string[];
  /** Elementos que desaparecen en este paso. */
  hide?: string[];
  /** La cámara se acerca a este elemento. */
  focus?: string;
  /** Conexiones por las que viaja una partícula mientras el paso está activo. */
  flow?: string | string[];
  /** Elementos que destacan; el resto se atenúa. */
  highlight?: string | string[];
  /** Texto que acompaña el paso. Mejor si tiene menos de 12 palabras. */
  caption?: string;
  /** Segundos que se queda este paso en la reproducción automática (anula motion.hold). */
  duration?: number;
  /** Notas del presentador: solo se ven en la vista del presentador, nunca en el diagrama. */
  notes?: string;
  /** Cambia el estado de nodos o conexiones: { "pay": "success", "e3": "error" }. Se mantiene hasta que otro paso lo cambie. */
  state?: Record<string, NodeState>;
}

export interface Diagram {
  $schema?: string;
  type: DiagramType;
  title?: string;
  theme?: 'dark' | 'light';
  /** Final automático que aleja la cámara y muestra todo funcionando. Por defecto true. (También motion.finale.) */
  finale?: boolean;
  /** Animación por defecto: entrada de bloques, recorrido de conexiones, velocidad, cámara, final. */
  motion?: Motion;
  /** Dirección del layout para `flow` (por defecto LR). */
  direction?: Direction;
  nodes: FluxNode[];
  edges?: FluxEdge[];
  groups?: FluxGroup[];
  steps?: FluxStep[];
}

/* ---------- Resultado del layout ---------- */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaidNode extends Rect {
  id: string;
  node: FluxNode;
}

export interface LaidEdge {
  id: string;
  edge: FluxEdge;
  /** Path SVG (`d`). */
  d: string;
  /** Punto final y ángulo de llegada, para dibujar la punta de flecha. */
  end: { x: number; y: number; angle: number };
  /** Posición sugerida para la etiqueta. */
  labelAt?: { x: number; y: number };
}

export interface LaidGroup extends Rect {
  id: string;
  group: FluxGroup;
}

export interface LaidAxis {
  /** Línea base de la línea de tiempo. */
  x1: number;
  x2: number;
  y: number;
}

export interface Layout {
  type: DiagramType;
  bounds: Rect;
  /** Tamaño del escenario (viewBox). En `timeline` es una ventana más angosta que el contenido. */
  stage: { w: number; h: number };
  nodes: LaidNode[];
  edges: LaidEdge[];
  groups: LaidGroup[];
  axis?: LaidAxis;
  motion?: Motion;
}

/* ---------- Plan de movimiento ---------- */

export interface StepState {
  /** Todo lo que está visible en este paso (acumulado). */
  visible: Set<string>;
  /** Lo que entra en este paso, en orden de lectura (para el escalonado). */
  entering: string[];
  flowing: string[];
  highlighted: string[];
  /** Rectángulo del mundo que la cámara encuadra. */
  camera: Rect;
  caption?: string;
  /** Estado de cada nodo o conexión que no está en su aspecto normal (acumulado). */
  states: Record<string, Exclude<NodeState, 'default'>>;
  /** El paso final automático (vista completa con todo funcionando). */
  finale?: boolean;
  /** Segundos fijados para este paso (si se pidió). */
  duration?: number;
}

export interface MotionPlan {
  steps: StepState[];
}
