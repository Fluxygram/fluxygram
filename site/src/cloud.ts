import type { Diagram } from '@fluxygram/core';
import { CloudUpload, FolderOpen, LogOut, X } from 'lucide';
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

function renderSignIn(host: HTMLElement, providers: string[]) {
  const menu = h('div', { class: 'ed-cloud-menu', hidden: true, role: 'menu' },
    ...providers.map((p) =>
      h('button', { type: 'button', role: 'menuitem', onclick: () => signIn(p) },
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

  const openList = () => showList({ model, toast, onOpen: async (id) => {
    const r = await api(`/diagrams/${id}`);
    if (!r.ok) return toast(t('cloud.error'));
    const { diagram } = (await r.json()) as { diagram: Diagram };
    opening = true;
    model.load(diagram);
    opening = false;
    lastSaved = JSON.stringify({ diagram: clean(model.diagram) });
    cloudId = id;
    store.set(id);
  }, onDelete: (id) => {
    if (id === cloudId) {
      cloudId = null;
      store.set(null);
    }
  } });

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

async function showList(o: { model: Model; toast: (t: string) => void; onOpen: (id: string) => Promise<void>; onDelete: (id: string) => void }) {
  const r = await api('/diagrams');
  if (!r.ok) return o.toast(t('cloud.error'));
  const { diagrams } = (await r.json()) as { diagrams: Saved[] };

  const close = () => modal.remove();
  const fmt = new Intl.DateTimeFormat(document.documentElement.lang || undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const list = h('ul', { class: 'ed-cloud-list' });
  const fill = (items: Saved[]) => {
    list.replaceChildren(
      ...(items.length
        ? items.map((d) => {
            let armed = false;
            const del = h('button', { type: 'button', class: 'ed-btn ed-danger', onclick: async () => {
              // Borrar no se puede deshacer: el primer clic pide confirmación.
              if (!armed) {
                armed = true;
                del.textContent = t('cloud.confirmDelete');
                setTimeout(() => {
                  armed = false;
                  del.textContent = t('cloud.delete');
                }, 3000);
                return;
              }
              const res = await api(`/diagrams/${d.id}`, { method: 'DELETE' });
              if (!res.ok) return o.toast(t('cloud.error'));
              o.onDelete(d.id);
              fill(items.filter((x) => x.id !== d.id));
            } }, t('cloud.delete'));
            return h('li', {},
              h('button', { type: 'button', class: 'ed-cloud-item', onclick: async () => {
                close();
                await o.onOpen(d.id);
              } },
                h('strong', {}, d.title || t('cloud.untitled')),
                h('span', {}, `${t(`type.${d.type}`)} · ${fmt.format(new Date(d.updatedAt * 1000))}`),
              ),
              del,
            );
          })
        : [h('li', { class: 'ed-cloud-empty' }, t('cloud.empty'))]),
    );
  };
  fill(diagrams);

  const modal: HTMLDivElement = h('div', { class: 'ed-modal' },
    h('div', { class: 'ed-picker ed-cloud-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('cloud.mine') },
      h('button', { type: 'button', class: 'ed-icon ed-modal-close', title: t('ed.close'), 'aria-label': t('ed.close'), onclick: () => close() }, icon(X)),
      h('h2', { class: 'ed-picker-title' }, t('cloud.mine')),
      list,
    ),
  );
  modal.addEventListener('click', (e) => e.target === modal && close());
  modal.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && close());
  document.body.append(modal);
  modal.querySelector<HTMLElement>('button')?.focus();
}
