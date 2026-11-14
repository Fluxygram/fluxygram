import type { Diagram } from '@fluxygram/core';
import { ArrowLeftRight, BrainCircuit, CloudUpload, FolderOpen, Layers, LogOut, Milestone, Network, RefreshCw, Trash2, Workflow, X, type IconNode } from 'lucide';
import { layout } from '@fluxygram/core';
import { h, icon } from './editor/dom';
import type { Model } from './editor/model';
import { copyText } from './editor/io';
import { t } from './i18n';
import { tourSeen } from './editor/tour';

/**
 * Conector con Fluxygram Cloud. Solo habla con /api/* del mismo sitio; no tiene claves ni lógica de negocio.
 * - Sin servidor (404 o error de red, como en fluxygram.app sin Cloud o en una instalación propia): no hace nada.
 * - Con servidor y sin sesión: un botón "Iniciar sesión".
 * - Con sesión: Guardar, Mis diagramas, Link corto y el menú de la cuenta.
 */

interface Me {
  user: { id: string; name: string | null; email: string | null; avatar: string | null; plan: 'free' | 'pro' };
  providers: string[];
  limits: { diagrams: number | null; used: number };
}
interface Saved {
  id: string;
  title: string;
  type: string;
  updatedAt: number;
}
interface Options {
  model: Model;
  toast: (text: string, ms?: number) => void;
  clean: (d: Diagram) => Diagram;
  /** Donde va la cuenta (o "Iniciar sesión"): el extremo derecho de la barra. */
  host: HTMLElement;
  /** Donde va "Guardar en tu cuenta": junto a Abrir y Descargar. */
  saveHost: HTMLElement;
}

export interface CloudSession {
  /** Con sesión, "Compartir" crea un link corto en lugar del link largo. */
  share: () => Promise<void>;
}

const ID_KEY = 'fluxygram:cloud-id';
const store = {
  get: () => {
    try {
      return localStorage.getItem(ID_KEY);
    } catch {
      return null;
    }
  },
  set: (id: string | null) => {
    try {
      if (id) localStorage.setItem(ID_KEY, id);
      else localStorage.removeItem(ID_KEY);
    } catch {
      /* sin almacenamiento: el diagrama se guarda como nuevo cada vez */
    }
  },
};

async function api(path: string, init: RequestInit = {}) {
  return fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
}

const PROVIDER_NAMES: Record<string, string> = { github: 'GitHub', google: 'Google' };

export async function initCloud({ model, toast, clean, host, saveHost }: Options): Promise<CloudSession | undefined> {
  let res: Response;
  try {
    res = await api('/me');
  } catch {
    return; // sin red o sin servidor
  }
  const isJson = res.headers.get('Content-Type')?.includes('application/json');
  if (!isJson || (res.status !== 200 && res.status !== 401)) return; // sin Cloud: el editor queda como siempre
  const body = (await res.json()) as Partial<Me> & { providers?: string[] };

  if (new URLSearchParams(location.search).get('cloud') === 'login-failed') {
    toast(t('cloud.loginFailed'), 4000);
    history.replaceState(null, '', location.pathname + location.hash);
  }

  if (res.status === 401) {
    if (body.providers?.length) renderSignIn(host, body.providers);
    return;
  }
  return renderSignedIn(host, saveHost, body as Me, { model, toast, clean });
}

/* ---------- Sin sesión ---------- */

// Logos oficiales para los botones de inicio de sesión (GitHub mark y la "G" de Google en sus cuatro colores).
const LOGOS: Record<string, string> = {
  github:
    '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>',
  google:
    '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
};

function providerLogo(provider: string) {
  const span = h('span', { class: 'ed-cloud-logo' });
  span.innerHTML = LOGOS[provider] ?? '';
  return span;
}

function renderSignIn(host: HTMLElement, providers: string[]) {
  const menu = h('div', { class: 'ed-cloud-menu', hidden: true, role: 'menu' },
    ...providers.map((p) =>
      h('button', { type: 'button', role: 'menuitem', class: 'ed-cloud-provider', onclick: () => signIn(p) },
        providerLogo(p),
        p === 'dev' ? t('cloud.devLogin') : t('cloud.with', { p: PROVIDER_NAMES[p] ?? p })),
    ),
  );
  const button = h('button', { type: 'button', class: 'ed-btn', 'aria-haspopup': 'menu', onclick: () => {
    hint?.dismiss();
    toggle(menu);
  } }, t('cloud.signIn'));
  const wrap = h('div', { class: 'ed-cloud-wrap' }, button, menu);
  host.replaceChildren(wrap);
  host.hidden = false;
  const hint = showHint(wrap, () => toggle(menu));
}

/* ---------- Aviso para iniciar sesión: una sola vez, nunca encima del recorrido guiado ---------- */

const HINT_KEY = 'fluxygram:cloud-hint';

function showHint(wrap: HTMLElement, openMenu: () => void): { dismiss: () => void } | undefined {
  try {
    if (localStorage.getItem(HINT_KEY)) return undefined;
  } catch {
    return undefined; // sin almacenamiento no se podría recordar que ya se vio: mejor no mostrarlo
  }
  if (!tourSeen()) return undefined; // la primera visita es para el recorrido; el aviso espera a la siguiente

  const remember = () => {
    try {
      localStorage.setItem(HINT_KEY, 'seen');
    } catch {
      /* sin almacenamiento */
    }
  };
  const card = h('div', { class: 'ed-cloud-hint', role: 'status' },
    h('p', {}, t('cloud.hint')),
    h('div', { class: 'ed-cloud-hint-actions' },
      h('button', { type: 'button', class: 'ed-btn', onclick: () => dismiss() }, t('cloud.hintLater')),
      h('button', { type: 'button', class: 'ed-btn ed-primary', onclick: () => {
        dismiss();
        openMenu();
      } }, t('cloud.signIn')),
    ),
  );
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss();
  function dismiss() {
    remember();
    document.removeEventListener('keydown', onKey);
    card.classList.add('is-out');
    setTimeout(() => card.remove(), 160);
  }
  // Aparece un momento después de cargar, cuando la persona ya vio el editor.
  const timer = setTimeout(() => {
    wrap.append(card);
    document.addEventListener('keydown', onKey);
  }, 1200);
  return {
    dismiss: () => {
      clearTimeout(timer);
      if (card.isConnected) dismiss();
      else remember();
    },
  };
}

async function signIn(provider: string) {
  if (provider === 'dev') {
    await api('/auth/dev', { method: 'POST', body: '{}' });
    location.reload();
    return;
  }
  location.href = `/api/auth/${provider}?next=${encodeURIComponent(location.pathname)}`;
}

/* ---------- Con sesión ---------- */

function renderSignedIn(host: HTMLElement, saveHost: HTMLElement, me: Me, { model, toast, clean }: Omit<Options, 'host' | 'saveHost'>): CloudSession {
  let cloudId = store.get();
  let opening = false;
  let lastSaved: string | null = null;
  // Un diagrama abierto desde un link (#d=) no es el que estaba guardado en la cuenta.
  if (location.hash.includes('d=')) cloudId = null;
  // Cargar otro diagrama (nuevo, ejemplo, archivo) lo desvincula del guardado.
  model.on((reason) => {
    if (reason === 'load' && !opening) {
      lastSaved = null;
      cloudId = null;
      store.set(null);
    }
  });

  const save = async (): Promise<string | null> => {
    if (!model.diagram.nodes.length) {
      toast(t('ed.needNodes'));
      return null;
    }
    const payload = JSON.stringify({ diagram: clean(model.diagram) });
    // Sin cambios desde el último guardado: misma versión (y el mismo link corto al compartir).
    if (cloudId && payload === lastSaved) return cloudId;
    let r = cloudId ? await api(`/diagrams/${cloudId}`, { method: 'PUT', body: payload }) : null;
    if (!r || r.status === 404) r = await api('/diagrams', { method: 'POST', body: payload });
    if (r.status === 402) {
      const { limit } = (await r.json()) as { limit: number };
      toast(t('cloud.limit', { n: String(limit) }), 5000);
      return null;
    }
    if (r.status === 400) {
      toast(t('cloud.invalid'), 4000);
      return null;
    }
    if (!r.ok) {
      toast(t('cloud.error'));
      return null;
    }
    const { id } = (await r.json()) as { id: string };
    cloudId = id;
    lastSaved = payload;
    store.set(id);
    return id;
  };

  const saveButton = h('button', { type: 'button', class: 'ed-icon', title: t('cloud.save'), 'aria-label': t('cloud.save'), onclick: async () => {
    if (await save()) toast(t('cloud.saved'));
  } }, icon(CloudUpload));

  // "Compartir" con sesión: guarda y copia un link corto (/d/…) en lugar del link largo.
  const share = async () => {
    const id = await save();
    if (!id) return;
    const r = await api('/links', { method: 'POST', body: JSON.stringify({ diagramId: id }) });
    if (!r.ok) return toast(t('cloud.error'));
    const { url } = (await r.json()) as { url: string };
    await copyText(url);
    toast(`${t('cloud.linkCopied')}: ${url.replace(/^https?:\/\//, '')}`, 4000);
  };

  const openList = () => showList({
    toast,
    limit: me.limits.diagrams,
    currentId: () => cloudId,
    onOpen: async (id) => {
      const r = await api(`/diagrams/${id}`);
      if (!r.ok) return toast(t('cloud.error'));
      const { diagram } = (await r.json()) as { diagram: Diagram };
      opening = true;
      model.load(diagram);
      opening = false;
      lastSaved = JSON.stringify({ diagram: clean(model.diagram) });
      cloudId = id;
      store.set(id);
    },
    onDelete: (id) => {
      if (id === cloudId) {
        cloudId = null;
        lastSaved = null;
        store.set(null);
      }
    },
    onSaveCurrent: async () => {
      const ok = !!(await save());
      if (ok) toast(t('cloud.saved'));
      return ok;
    },
  });

  const name = me.user.name || me.user.email || '?';
  const avatar = me.user.avatar
    ? h('img', { src: me.user.avatar, alt: '', width: 22, height: 22, referrerpolicy: 'no-referrer' })
    : h('span', { class: 'ed-cloud-initial' }, name.slice(0, 1).toUpperCase());
  const menu = h('div', { class: 'ed-cloud-menu', hidden: true, role: 'menu' },
    h('p', { class: 'ed-cloud-who' }, h('strong', {}, name), me.user.email && me.user.email !== name ? h('span', {}, me.user.email) : undefined),
    h('button', { type: 'button', role: 'menuitem', onclick: () => {
      menu.hidden = true;
      void openList();
    } }, icon(FolderOpen, 15), ' ', t('cloud.mine')),
    h('button', { type: 'button', role: 'menuitem', onclick: async () => {
      await api('/auth/logout', { method: 'POST', body: '{}' });
      store.set(null);
      location.reload();
    } }, icon(LogOut, 15), ' ', t('cloud.signOut')),
  );
  const account = h('button', { type: 'button', class: 'ed-cloud-account', title: name, 'aria-label': name, 'aria-haspopup': 'menu', onclick: () => toggle(menu) }, avatar);

  saveHost.replaceChildren(saveButton);
  saveHost.hidden = false;
  host.replaceChildren(h('div', { class: 'ed-cloud-wrap' }, account, menu));
  host.hidden = false;
  return { share };
}

function toggle(menu: HTMLElement) {
  menu.hidden = !menu.hidden;
  if (!menu.hidden) {
    const close = (e: Event) => {
      if (!menu.parentElement?.contains(e.target as Node)) {
        menu.hidden = true;
        document.removeEventListener('pointerdown', close);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', close));
  }
}

/* ---------- Mis diagramas ---------- */

const TYPE_ICONS: Record<string, IconNode> = {
  flow: Workflow, architecture: Layers, timeline: Milestone, tree: Network, cycle: RefreshCw, sequence: ArrowLeftRight, mindmap: BrainCircuit,
};
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Miniatura estática: la misma posición de bloques que el diagrama real, sin animación ni texto. */
function thumbnail(diagram: Diagram): SVGSVGElement | null {
  let lay;
  try {
    lay = layout(diagram);
  } catch {
    return null;
  }
  const pad = 24;
  const b = lay.bounds;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.append(el);
  };
  for (const g of lay.groups) add('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 14, class: 'th-group' });
  for (const l of lay.lifelines ?? []) add('line', { x1: l.x, y1: l.y1, x2: l.x, y2: l.y2, class: 'th-life' });
  if (lay.axis) add('line', { x1: lay.axis.x1, y1: lay.axis.y, x2: lay.axis.x2, y2: lay.axis.y, class: 'th-edge' });
  for (const e of lay.edges) add('path', { d: e.d, class: 'th-edge' });
  for (const n of lay.nodes) {
    const round = n.node.kind === 'start' || n.node.kind === 'end' ? n.h / 2 : 10;
    add('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: round, class: n.node.accent ? 'th-node th-accent' : 'th-node' });
  }
  return svg;
}

interface ListOptions {
  toast: (text: string, ms?: number) => void;
  limit: number | null;
  currentId: () => string | null;
  onOpen: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
  onSaveCurrent: () => Promise<boolean>;
}

async function showList(o: ListOptions) {
  const res = await api('/diagrams');
  if (!res.ok) return o.toast(t('cloud.error'));
  let items = ((await res.json()) as { diagrams: Saved[] }).diagrams;

  const lang = document.documentElement.lang || undefined;
  const rel = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const ago = (seconds: number) => {
    const diff = seconds - Date.now() / 1000;
    const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) if (Math.abs(diff) >= size) return rel.format(Math.round(diff / size), unit);
    return rel.format(0, 'minute');
  };
  // Miniaturas: cada diagrama se pide una sola vez, y solo cuando su tarjeta entra en pantalla.
  const thumbs = new Map<string, Promise<SVGSVGElement | null>>();
  const thumbFor = (id: string) => {
    let p = thumbs.get(id);
    if (!p) {
      p = api(`/diagrams/${id}`)
        .then(async (r) => (r.ok ? thumbnail(((await r.json()) as { diagram: Diagram }).diagram) : null))
        .catch(() => null);
      thumbs.set(id, p);
    }
    return p;
  };
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      watcher.unobserve(el);
      void thumbFor(el.dataset.id!).then((svg) => svg && !el.firstChild && el.append(svg.cloneNode(true)));
    }
  }, { rootMargin: '200px' });

  // Búsqueda, orden y "mostrar más": todo en el navegador, sobre la lista completa.
  const PAGE = 24;
  let query = '';
  let sort: 'recent' | 'name' = 'recent';
  let shown = PAGE;
  const norm = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const search = h('input', {
    type: 'search', class: 'ed-cloud-search', placeholder: t('cloud.search'), 'aria-label': t('cloud.search'),
    oninput: (e: Event) => {
      query = (e.target as HTMLInputElement).value;
      shown = PAGE;
      render();
    },
  });
  const order = h('select', { class: 'ed-cloud-sort', 'aria-label': t('cloud.sort'), onchange: (e: Event) => {
    sort = (e.target as HTMLSelectElement).value as typeof sort;
    render();
  } },
    h('option', { value: 'recent' }, t('cloud.sortRecent')),
    h('option', { value: 'name' }, t('cloud.sortName')),
  );
  const tools = h('div', { class: 'ed-cloud-tools' }, search, order);

  const usage = h('p', { class: 'ed-cloud-usage' });
  const grid = h('ul', { class: 'ed-cloud-grid' });
  const close = () => {
    watcher.disconnect();
    modal.remove();
  };

  const render = () => {
    usage.textContent = o.limit !== null
      ? t('cloud.used', { used: String(items.length), limit: String(o.limit) })
      : t('cloud.count', { n: String(items.length) });
    if (!items.length) {
      grid.replaceChildren(
        h('li', { class: 'ed-cloud-empty' },
          icon(CloudUpload, 28),
          h('strong', {}, t('cloud.emptyTitle')),
          h('span', {}, t('cloud.empty')),
          h('button', { type: 'button', class: 'ed-btn ed-primary', onclick: async () => {
            if (await o.onSaveCurrent()) {
              const again = await api('/diagrams');
              if (again.ok) items = ((await again.json()) as { diagrams: Saved[] }).diagrams;
              render();
            }
          } }, t('cloud.saveCurrent')),
        ),
      );
      tools.hidden = true;
      return;
    }
    tools.hidden = items.length <= 3; // con pocos diagramas, buscar no hace falta
    const q = norm(query.trim());
    const matches = items
      .filter((d) => !q || norm(d.title || t('cloud.untitled')).includes(q) || norm(t(`type.${d.type}`)).includes(q))
      .sort((a, b) => (sort === 'name' ? (a.title || '').localeCompare(b.title || '', lang) : b.updatedAt - a.updatedAt));
    if (!matches.length) {
      grid.replaceChildren(h('li', { class: 'ed-cloud-none' }, t('cloud.noMatch', { q: query.trim() })));
      return;
    }
    const rest = matches.length - shown;
    grid.replaceChildren(
      ...matches.slice(0, shown).map(card),
      ...(rest > 0
        ? [h('li', { class: 'ed-cloud-more' }, h('button', { type: 'button', class: 'ed-btn', onclick: () => {
            shown += PAGE;
            render();
          } }, t('cloud.showMore', { n: String(Math.min(rest, PAGE)) })))]
        : []),
    );
  };

  const card = (d: Saved) => {
    const thumb = h('div', { class: 'ed-cloud-thumb', 'data-id': d.id });
    watcher.observe(thumb);
    let armed = false;
    const del = h('button', { type: 'button', class: 'ed-cloud-del', title: t('cloud.delete'), 'aria-label': t('cloud.delete'), onclick: async () => {
      // Borrar no se puede deshacer: el primer clic pide confirmación.
      if (!armed) {
        armed = true;
        del.classList.add('is-armed');
        del.replaceChildren(t('cloud.confirmShort'));
        setTimeout(() => {
          if (!del.isConnected) return;
          armed = false;
          del.classList.remove('is-armed');
          del.replaceChildren(icon(Trash2, 15));
        }, 3000);
        return;
      }
      const r = await api(`/diagrams/${d.id}`, { method: 'DELETE' });
      if (!r.ok) return o.toast(t('cloud.error'));
      o.onDelete(d.id);
      items = items.filter((x) => x.id !== d.id);
      render();
    } }, icon(Trash2, 15));
    const current = o.currentId() === d.id;
    return h('li', { class: current ? 'ed-cloud-card is-current' : 'ed-cloud-card' },
      h('button', { type: 'button', class: 'ed-cloud-open', onclick: async () => {
        close();
        await o.onOpen(d.id);
      } },
        thumb,
        h('span', { class: 'ed-cloud-card-body' },
          h('strong', {}, d.title || t('cloud.untitled')),
          h('span', { class: 'ed-cloud-meta' }, icon(TYPE_ICONS[d.type] ?? Workflow, 13), `${t(`type.${d.type}`)} · ${ago(d.updatedAt)}`),
        ),
        current ? h('span', { class: 'ed-cloud-badge' }, t('cloud.current')) : undefined,
      ),
      del,
    );
  };

  render();
  const modal: HTMLDivElement = h('div', { class: 'ed-modal' },
    h('div', { class: 'ed-picker ed-cloud-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('cloud.mine') },
      h('button', { type: 'button', class: 'ed-icon ed-modal-close', title: t('ed.close'), 'aria-label': t('ed.close'), onclick: () => close() }, icon(X)),
      h('h2', { class: 'ed-picker-title' }, t('cloud.mine')),
      usage,
      tools,
      grid,
    ),
  );
  modal.addEventListener('click', (e) => e.target === modal && close());
  modal.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && close());
  document.body.append(modal);
  (tools.hidden ? modal.querySelector<HTMLElement>('.ed-cloud-open, .ed-cloud-empty button') : search)?.focus();
}
