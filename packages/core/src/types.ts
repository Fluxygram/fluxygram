/** Tipos de diagrama soportados en la v1. Cada uno trae su propia gramática de movimiento. */
export type DiagramType = 'flow' | 'architecture' | 'timeline';

export type Direction = 'LR' | 'TB';

export type NodeKind = 'default' | 'decision' | 'start' | 'end';

export interface FluxNode {
  id: string;
  label: string;
  /** Una línea corta debajo del nombre. */
  description?: string;
  /** Nombre de un ícono incluido (ver ICON_NAMES en @fluxygram/element). */
  icon?: string;
  /** `decision` dibuja un rombo; `start` y `end` una píldora. Solo en `flow`. */
  kind?: NodeKind;
  /** Capa a la que pertenece (solo `architecture`). */
  group?: string;
  /** Fecha o etiqueta de tiempo (solo `timeline`), por ejemplo "1995" o "2026-03". */
  date?: string;
  /** Resalta el nodo con el color de acento. */
  accent?: boolean;
  /** Posición fijada a mano (esquina superior izquierda). Sin ella, el nodo se acomoda solo. */
  x?: number;
  y?: number;
}

export interface FluxEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
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
}

export interface Diagram {
  $schema?: string;
  type: DiagramType;
  title?: string;
  theme?: 'dark' | 'light';
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
}

export interface MotionPlan {
  steps: StepState[];
}
