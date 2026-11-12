import { t } from '../i18n';
import { h } from './dom';

const KEY = 'fluxygram:tour';

type Placement = 'right' | 'left' | 'top' | 'bottom' | 'center';

interface TourStep {
  /** Uno o varios selectores: el foco envuelve a todos. */
  targets: string[];
  place: Placement;
  key: string;
}

const STEPS: TourStep[] = [
  { targets: ['#palette'], place: 'right', key: 'tour.1' },
  { targets: ['#stage'], place: 'center', key: 'tour.2' },
  { targets: ['.ed-side'], place: 'left', key: 'tour.3' },
  { targets: ['#steps'], place: 'top', key: 'tour.4' },
  { targets: ['#download', '#export', '#share', '#preview'], place: 'bottom', key: 'tour.5' },
  { targets: ['#tour'], place: 'bottom', key: 'tour.6' },
];

export function tourSeen() {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return true; // sin almacenamiento no se puede recordar: mejor no insistir en cada visita
  }
}

/**
 * Intro guiada del editor. Un foco recorre cada zona (se mueve con transición, así se entiende de dónde viene)
 * y una tarjeta explica qué se hace ahí. Se recuerda que ya se vio; el botón "?" la abre de nuevo.
 */
export function startTour() {
  document.querySelector('.ed-tour')?.remove();
  let i = 0;

  const spot = h('div', { class: 'ed-tour-spot' });
  const title = h('h3', { class: 'ed-tour-title', id: 'ed-tour-title' });
  const text = h('p', { class: 'ed-tour-text' });
  const count = h('span', { class: 'ed-tour-count' });
  const back = h('button', { type: 'button', class: 'ed-btn' }, t('tour.back'));
  const next = h('button', { type: 'button', class: 'ed-btn ed-primary' });
  const skip = h('button', { type: 'button', class: 'ed-tour-skip' }, t('tour.skip'));
  const card = h('div', { class: 'ed-tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ed-tour-title' },
    title, text, h('div', { class: 'ed-tour-foot' }, count, h('span', { class: 'ed-spacer' }), skip, back, next),
  );
  const root = h('div', { class: 'ed-tour' }, spot, card);
  document.body.append(root);

  const finish = () => {
    try {
      localStorage.setItem(KEY, 'done');
    } catch {
      /* almacenamiento no disponible */
    }
    root.classList.add('is-leaving');
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', place);
    setTimeout(() => root.remove(), 200);
  };

  const place = () => {
    const step = STEPS[i]!;
    const rects = step.targets
      .map((s) => document.querySelector(s)?.getBoundingClientRect())
      .filter((r): r is DOMRect => !!r && r.width > 0);
    if (!rects.length) return;
    const pad = 6;
    const x1 = Math.min(...rects.map((r) => r.left)) - pad;
    const y1 = Math.min(...rects.map((r) => r.top)) - pad;
    const x2 = Math.max(...rects.map((r) => r.right)) + pad;
    const y2 = Math.max(...rects.map((r) => r.bottom)) + pad;
    Object.assign(spot.style, { left: `${x1}px`, top: `${y1}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px` });

    const cw = Math.min(340, innerWidth - 32);
    const ch = card.offsetHeight || 180;
    const gap = 14;
    let left: number;
    let top: number;
    switch (step.place) {
      case 'right':
        left = x2 + gap;
        top = y1;
        break;
      case 'left':
        left = x1 - gap - cw;
        top = y1 + 40;
        break;
      case 'top':
        left = x1 + 24;
        top = y1 - gap - ch;
        break;
      case 'bottom':
        left = x2 - cw;
        top = y2 + gap;
        break;
      default:
        left = (x1 + x2) / 2 - cw / 2;
        top = (y1 + y2) / 2 - ch / 2;
    }
    card.style.width = `${cw}px`;
    card.style.left = `${Math.max(16, Math.min(left, innerWidth - cw - 16))}px`;
    card.style.top = `${Math.max(16, Math.min(top, innerHeight - ch - 16))}px`;
  };

  const show = (n: number) => {
    i = Math.max(0, Math.min(STEPS.length - 1, n));
    const step = STEPS[i]!;
    title.textContent = t(`${step.key}.title`);
    text.textContent = t(`${step.key}.text`);
    count.textContent = `${i + 1} / ${STEPS.length}`;
    back.hidden = i === 0;
    next.textContent = i === STEPS.length - 1 ? t('tour.done') : t('tour.next');
    // La tarjeta entra de nuevo en cada paso: el cambio de texto no "salta".
    card.classList.remove('is-in');
    void card.offsetWidth;
    card.classList.add('is-in');
    place();
    next.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish();
    else if (e.key === 'ArrowRight') next.click();
    else if (e.key === 'ArrowLeft' && i > 0) show(i - 1);
  };

  next.onclick = () => (i === STEPS.length - 1 ? finish() : show(i + 1));
  back.onclick = () => show(i - 1);
  skip.onclick = finish;
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', place);
  show(0);
}
