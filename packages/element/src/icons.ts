import {
  AppWindow, Bell, Book, Bot, Building, ChartLine, CircleCheck, Clock, Cloud, Code, Cpu, CreditCard, Database,
  FileText, Flag, GitBranch, Globe, HardDrive, Heart, Image, Key, Layers, Lightbulb, Lock, Mail, MessageSquare,
  Monitor, Network, Package, Rocket, Search, Server, Settings, Shield, ShoppingCart, Smartphone, Sparkles, Store,
  TriangleAlert, Truck, User, Users, Webhook, Workflow, Zap,
  type IconNode,
} from 'lucide';

/** Íconos incluidos. Los nombres son simples y en inglés para que los agentes los adivinen sin consultar. */
export const ICONS: Record<string, IconNode> = {
  alert: TriangleAlert, api: Webhook, book: Book, bot: Bot, browser: AppWindow, building: Building, cart: ShoppingCart,
  chart: ChartLine, check: CircleCheck, clock: Clock, cloud: Cloud, code: Code, cpu: Cpu, card: CreditCard,
  database: Database, disk: HardDrive, file: FileText, flag: Flag, git: GitBranch, globe: Globe, heart: Heart,
  idea: Lightbulb, image: Image, key: Key, layers: Layers, lock: Lock, mail: Mail, message: MessageSquare,
  mobile: Smartphone, monitor: Monitor, network: Network, notification: Bell, package: Package, rocket: Rocket,
  search: Search, server: Server, settings: Settings, shield: Shield, sparkles: Sparkles, store: Store,
  truck: Truck, user: User, users: Users, workflow: Workflow, zap: Zap,
};

export const ICON_NAMES = Object.keys(ICONS);

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Dibuja un ícono de 24×24 escalado a `size`, en la posición dada. */
export function iconElement(name: string, x: number, y: number, size: number): SVGGElement | null {
  const node = ICONS[name];
  if (!node) return null;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'fx-icon');
  g.setAttribute('transform', `translate(${x} ${y}) scale(${size / 24})`);
  for (const [tag, attrs] of node) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    g.appendChild(el);
  }
  return g;
}
