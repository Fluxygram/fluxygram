import * as L from 'lucide';
import type { IconNode } from 'lucide';

/**
 * Íconos incluidos, por categoría. Los nombres son palabras simples en inglés para que los agentes los adivinen
 * sin consultar. Los nombres de la primera versión se conservan: los diagramas existentes siguen funcionando.
 */
export const ICON_GROUPS: Record<string, Record<string, IconNode>> = {
  general: {
    check: L.CircleCheck, alert: L.TriangleAlert, info: L.Info, help: L.CircleHelp, flag: L.Flag, star: L.Star,
    heart: L.Heart, bookmark: L.Bookmark, tag: L.Tag, pin: L.MapPin, home: L.House, search: L.Search,
    settings: L.Settings, filter: L.Funnel, clock: L.Clock, calendar: L.Calendar, idea: L.Lightbulb, target: L.Target,
    trophy: L.Trophy, rocket: L.Rocket, zap: L.Zap, layers: L.Layers, workflow: L.Workflow, puzzle: L.Puzzle, box: L.Box,
  },
  people: {
    user: L.User, users: L.Users, verified: L.UserCheck, signup: L.UserPlus, admin: L.UserCog, bot: L.Bot,
    contact: L.Contact, deal: L.Handshake, building: L.Building, school: L.School, hospital: L.Hospital,
    student: L.GraduationCap, work: L.BriefcaseBusiness, brain: L.Brain,
  },
  devices: {
    browser: L.AppWindow, mobile: L.Smartphone, tablet: L.Tablet, monitor: L.Monitor, laptop: L.Laptop, watch: L.Watch,
    printer: L.Printer, camera: L.Camera, mic: L.Mic, speaker: L.Speaker, keyboard: L.Keyboard, gamepad: L.Gamepad2,
    tv: L.Tv, router: L.Router, wifi: L.Wifi, bluetooth: L.Bluetooth, cpu: L.Cpu, disk: L.HardDrive, usb: L.Usb,
  },
  infrastructure: {
    server: L.Server, cloud: L.Cloud, database: L.Database, network: L.Network, globe: L.Globe, cdn: L.Earth,
    container: L.Container, api: L.Webhook, plug: L.Plug, cable: L.Cable, gauge: L.Gauge, activity: L.Activity,
    queue: L.ListOrdered, balancer: L.Split, function: L.SquareFunction, storage: L.Archive, backup: L.ArchiveRestore,
    sync: L.RefreshCw, upload: L.Upload, download: L.Download, logs: L.ScrollText, dashboard: L.LayoutDashboard,
  },
  code: {
    code: L.Code, terminal: L.Terminal, braces: L.Braces, bug: L.Bug, git: L.GitBranch, merge: L.GitMerge,
    pullrequest: L.GitPullRequest, package: L.Package, tool: L.Wrench, build: L.Hammer, design: L.Palette, pen: L.PenTool,
  },
  data: {
    file: L.FileText, files: L.Files, folder: L.Folder, image: L.Image, video: L.Video, music: L.Music,
    table: L.Table, sheet: L.FileSpreadsheet, chart: L.ChartLine, bars: L.ChartColumn, pie: L.ChartPie,
    book: L.Book, notebook: L.Notebook, clipboard: L.Clipboard, inbox: L.Inbox,
  },
  commerce: {
    cart: L.ShoppingCart, card: L.CreditCard, wallet: L.Wallet, money: L.Banknote, coins: L.Coins, receipt: L.Receipt,
    store: L.Store, truck: L.Truck, gift: L.Gift, percent: L.Percent, bank: L.Landmark, barcode: L.Barcode,
    scan: L.ScanLine, scale: L.Scale,
  },
  communication: {
    mail: L.Mail, message: L.MessageSquare, chat: L.MessagesSquare, phone: L.Phone, notification: L.Bell, send: L.Send,
    share: L.Share2, megaphone: L.Megaphone, rss: L.Rss, at: L.AtSign, link: L.Link,
  },
  security: {
    shield: L.Shield, lock: L.Lock, unlock: L.LockOpen, key: L.Key, fingerprint: L.Fingerprint, eye: L.Eye,
    hidden: L.EyeOff, secure: L.ShieldCheck, threat: L.ShieldAlert, id: L.IdCard,
  },
  world: {
    sun: L.Sun, moon: L.Moon, leaf: L.Leaf, tree: L.TreePine, water: L.Droplets, fire: L.Flame, mountain: L.Mountain,
    map: L.Map, plane: L.Plane, car: L.Car, train: L.TrainFront, ship: L.Ship, factory: L.Factory, warehouse: L.Warehouse,
    health: L.Stethoscope, pill: L.Pill, fitness: L.Dumbbell, food: L.Utensils, coffee: L.Coffee,
  },
  status: {
    play: L.Play, pause: L.Pause, timer: L.Timer, hourglass: L.Hourglass, loading: L.LoaderCircle, error: L.CircleX,
    add: L.CirclePlus, remove: L.CircleMinus, next: L.ArrowRight, join: L.Merge, repeat: L.Repeat, random: L.Shuffle,
    up: L.TrendingUp, down: L.TrendingDown,
  },
};

export const ICONS: Record<string, IconNode> = Object.assign({}, ...Object.values(ICON_GROUPS));
export const ICON_NAMES = Object.keys(ICONS);
export const ICON_CATEGORIES = Object.keys(ICON_GROUPS);

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
