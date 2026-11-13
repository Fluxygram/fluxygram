/*
 * RubberSegment, ported from React Bits to plain TypeScript (no React, no Tailwind).
 * Original: https://reactbits.dev (RubberSegment-TS-TW) by David Haz. Uses `motion` for springs.
 *
 * This file is NOT covered by Fluxygram's licenses. It keeps the React Bits license:
 *
 * MIT + Commons Clause License Condition v1.0
 * Copyright (c) 2026 David Haz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, and distribute the Software as part of an application, website, or
 * product, subject to the following conditions: the above copyright notice and this
 * permission notice shall be included in all copies or substantial portions of the
 * Software. Commons Clause restriction: you may use this Software, including for any
 * commercial purpose, so long as you do not sell, sublicense, or redistribute the
 * components themselves, whether alone, in a bundle, or as a ported version.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
 * OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { animate, motionValue, type MotionValue } from 'motion';

export type RubberSegmentSize = 'sm' | 'md' | 'lg';
export type RubberSegmentItem = string | { value: string; label: string };

export interface RubberSegmentOptions {
  items: RubberSegmentItem[];
  value?: string;
  onChange?: (value: string, index: number) => void;
  trackColor?: string;
  thumbColor?: string;
  textColor?: string;
  activeTextColor?: string;
  /** Color del anillo de foco (por defecto, el del elemento deslizante). */
  focusColor?: string;
  size?: RubberSegmentSize;
  radius?: number;
  inset?: number;
  equalSlots?: boolean;
  stretch?: number;
  squash?: number;
  speed?: number;
  glide?: number;
  draggable?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export interface RubberSegment {
  el: HTMLDivElement;
  /** Cambio desde afuera: salta sin animación (como el `value` controlado del original). */
  set(value: string): void;
  get value(): string;
  destroy(): void;
}

type Slot = { l: number; r: number };
type Sample = [number, number];
type Drag = { id: number; x0: number; slot: number; onThumb: boolean; live: boolean; offset: number; w: number; hist: Sample[] };

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const SPRING_UI = { type: 'spring' as const, duration: 0.3, bounce: 0 };
const SPRING_MOMENTUM = { type: 'spring' as const, duration: 0.4, bounce: 0.2 };
const SPRING_RELAX = { type: 'spring' as const, duration: 0.16, bounce: 0 };
const DILATE = 0.19;
const HANDOFF = 0.15;
const FLICK = 110;
const MAX_VELOCITY = 2000;
const DEADZONE = 4;
const SLOP = 10;
const RUBBER = 0.55;
const SIZES: Record<RubberSegmentSize, { height: number; font: number; pad: number; min: number }> = {
  sm: { height: 28, font: 12, pad: 10, min: 36 },
  md: { height: 36, font: 13, pad: 14, min: 44 },
  lg: { height: 44, font: 14, pad: 18, min: 48 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rubber = (over: number, dim: number) => (over * dim * RUBBER) / (dim + RUBBER * Math.abs(over));
const project = (v: number, glide: number) => {
  const d = 1 - 0.1 * Math.pow(0.05, glide / 100);
  return ((v / 1000) * d) / (1 - d);
};
const velocityOf = (hist: Sample[], now: number) => {
  const recent = hist.filter(([t]) => now - t <= 100);
  if (recent.length < 2) return 0;
  const [t0, x0] = recent[0]!;
  const [t1, x1] = recent[recent.length - 1]!;
  return t1 - t0 >= 8 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0;
};
const nearestSlot = (slots: Slot[], x: number) => {
  let best = 0;
  const mid = (s: Slot) => (s.l + s.r) / 2;
  for (let i = 1; i < slots.length; i++) {
    if (Math.abs(mid(slots[i]!) - x) < Math.abs(mid(slots[best]!) - x)) best = i;
  }
  return best;
};

const CSS = `
.rs{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:auto;vertical-align:middle;user-select:none;-webkit-user-select:none;touch-action:pan-y;font-family:inherit;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;padding:var(--rs-inset);border-radius:var(--rs-radius);background:var(--rs-track)}
.rs[data-equal]{grid-auto-columns:minmax(0,1fr)}
.rs[data-held]{cursor:grabbing}
.rs[aria-disabled=true]{pointer-events:none;opacity:.5}
.rs-item,.rs-label{display:inline-flex;height:calc(var(--rs-h) - var(--rs-inset) * 2);min-width:var(--rs-min);align-items:center;justify-content:center;gap:6px;margin:0;border:0;background:transparent;padding:0 var(--rs-pad);border-radius:var(--rs-thumb-radius);font:inherit;font-size:var(--rs-font);font-weight:500;line-height:1;white-space:nowrap;outline:none;transition:opacity 160ms ease,transform 160ms var(--rs-ease-out)}
.rs-item{cursor:pointer;color:var(--rs-ink);opacity:.7}
.rs-item[aria-checked=true]{cursor:default}
.rs[data-draggable] .rs-item[aria-checked=true]{cursor:grab}
.rs[data-held] .rs-item{cursor:grabbing}
.rs-item[data-pressed]{transform:scale(.96)}
.rs-item:focus-visible{outline:2px solid var(--rs-focus);outline-offset:3px}
@media (hover:hover) and (pointer:fine){.rs-item[aria-checked=false]:hover{opacity:.9}}
@media (prefers-reduced-motion:reduce){.rs-item,.rs-label{transition:opacity 160ms ease}}
.rs-thumb{pointer-events:none;position:absolute;inset:var(--rs-inset);display:grid;grid-auto-flow:column;grid-auto-columns:auto;background:var(--rs-thumb);color:var(--rs-ink-active)}
.rs[data-equal] .rs-thumb{grid-auto-columns:minmax(0,1fr)}
.rs-label{cursor:default;color:inherit}
`;

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
}

export function createRubberSegment(opts: RubberSegmentOptions): RubberSegment {
  injectStyles();
  const {
    onChange,
    trackColor = '#27272a',
    thumbColor = '#fafafa',
    textColor = '#fafafa',
    activeTextColor = '#18181b',
    focusColor,
    size = 'md',
    radius = 10,
    inset = 3,
    equalSlots = true,
    stretch = 100,
    squash = 3,
    speed = 1,
    glide = 75,
    draggable = true,
    disabled = false,
    className = '',
    ariaLabel = 'Segmented control',
  } = opts;
  const list = opts.items.map((item) => (typeof item === 'string' ? { value: item, label: item } : item));
  let index = Math.max(0, list.findIndex((item) => item.value === (opts.value ?? list[0]?.value)));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const preset = SIZES[size] || SIZES.md;
  const thumbRadius = Math.max(0, radius - inset);

  const track = document.createElement('div');
  track.className = `rs${className ? ` ${className}` : ''}`;
  track.setAttribute('role', 'radiogroup');
  track.setAttribute('aria-label', ariaLabel);
  if (disabled) track.setAttribute('aria-disabled', 'true');
  if (equalSlots) track.dataset.equal = '';
  if (draggable && !disabled) track.dataset.draggable = '';
  const vars: Record<string, string> = {
    '--rs-track': trackColor,
    '--rs-thumb': thumbColor,
    '--rs-ink': textColor,
    '--rs-ink-active': activeTextColor,
    '--rs-focus': focusColor ?? thumbColor,
    '--rs-radius': `${radius}px`,
    '--rs-inset': `${inset}px`,
    '--rs-thumb-radius': `${thumbRadius}px`,
    '--rs-h': `${preset.height}px`,
    '--rs-font': `${preset.font}px`,
    '--rs-pad': `${preset.pad}px`,
    '--rs-min': `${preset.min}px`,
    '--rs-ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
  };
  for (const [k, v] of Object.entries(vars)) track.style.setProperty(k, v);

  const buttons = list.map((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rs-item';
    b.setAttribute('role', 'radio');
    b.textContent = item.label;
    b.disabled = disabled;
    b.addEventListener('pointerdown', (e) => onPointerDown(e, i));
    b.addEventListener('keydown', onKeyDown);
    return b;
  });
  const thumb = document.createElement('div');
  thumb.className = 'rs-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  for (const item of list) {
    const span = document.createElement('span');
    span.className = 'rs-label';
    span.textContent = item.label;
    thumb.append(span);
  }
  track.append(...buttons, thumb);

  const syncAria = () => {
    buttons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    });
  };
  syncAria();

  let slots: Slot[] = [];
  let box: DOMRect | null = null;
  let committed = index;
  let handoff: ReturnType<typeof setTimeout> | undefined;
  let drag: Drag | null = null;
  let gen = 0;

  const edgeL = motionValue(0);
  const edgeR = motionValue(0);
  const innerW = motionValue(0);
  const paint = () => {
    thumb.style.clipPath = `inset(0 ${Math.max(0, innerW.get() - edgeR.get())}px 0 ${Math.max(0, edgeL.get())}px round ${thumbRadius}px)`;
  };
  const unsubs = [edgeL.on('change', paint), edgeR.on('change', paint), innerW.on('change', paint)];

  const t = (seconds: number) => seconds / speed;

  const jumpTo = (i: number) => {
    const s = slots[i];
    if (!s) return;
    clearTimeout(handoff);
    gen += 1;
    edgeL.jump(s.l);
    edgeR.jump(s.r);
    paint();
  };

  const measure = () => {
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    box = rect;
    slots = list.map((_, i) => {
      const r = buttons[i]!.getBoundingClientRect();
      return { l: r.left - rect.left - inset, r: r.right - rect.left - inset };
    });
    innerW.set(rect.width - inset * 2);
    // Si el elemento deslizante está en pleno viaje (p. ej. el panel se redibujó y movió este
    // control), no se corta la animación: termina en el lugar correcto por su cuenta.
    if (!edgeL.isAnimating() && !edgeR.isAnimating() && handoff === undefined) jumpTo(committed);
  };

  const observer = new ResizeObserver(measure);
  observer.observe(track);
  if (document.fonts) document.fonts.ready.then(measure);

  const commit = (i: number) => {
    committed = i;
    if (i === index) return;
    index = i;
    syncAria();
    onChange?.(list[i]!.value, i);
  };

  const land = (to: number, v: number | null, flick: boolean, withSquash: boolean) => {
    const b = slots[to];
    if (!b) return;
    const g = ++gen;
    const dir = Math.sign((b.l + b.r) / 2 - (edgeL.get() + edgeR.get()) / 2) || 1;
    const [lead, leadTo, trail, trailTo] = dir > 0 ? [edgeR, b.r, edgeL, b.l] : [edgeL, b.l, edgeR, b.r];
    const velocityFor = (mv: MotionValue<number>) => clamp(v === null ? mv.getVelocity() : v, -MAX_VELOCITY, MAX_VELOCITY);
    animate(lead, leadTo, { ...(flick ? SPRING_MOMENTUM : SPRING_UI), duration: t(flick ? 0.4 : 0.3), velocity: velocityFor(lead) });
    const trailVelocity = velocityFor(trail);
    if (!withSquash || squash <= 0) {
      animate(trail, trailTo, { ...SPRING_UI, duration: t(0.3), velocity: trailVelocity });
      return;
    }
    animate(trail, trailTo + dir * squash, { ...SPRING_UI, duration: t(0.3), velocity: trailVelocity }).then(() => {
      if (gen === g) animate(trail, trailTo, { ...SPRING_RELAX, duration: t(0.16) });
    });
  };

  const travel = (from: number, to: number) => {
    const a = slots[from];
    const b = slots[to];
    if (!a || !b) return;
    clearTimeout(handoff);
    handoff = undefined;
    gen += 1;
    if (reduce) {
      edgeL.jump(b.l);
      edgeR.jump(b.r);
      return;
    }
    const u = stretch / 100;
    const tween = { duration: t(DILATE), ease: EASE_OUT };
    animate(edgeL, b.l + (Math.min(a.l, b.l) - b.l) * u, tween);
    animate(edgeR, b.r + (Math.max(a.r, b.r) - b.r) * u, tween);
    handoff = setTimeout(() => {
      handoff = undefined;
      land(to, null, false, true);
    }, t(HANDOFF) * 1000);
  };

  const localX = (e: { clientX: number }) => e.clientX - (box ? box.left : 0) - inset;

  function onPointerDown(e: PointerEvent, i: number) {
    if (disabled || drag || e.button !== 0) return;
    box = track.getBoundingClientRect();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* el puntero ya no existe */
    }
    const x = localX(e);
    const onThumb = draggable && x >= edgeL.get() && x <= edgeR.get();
    drag = { id: e.pointerId, x0: x, slot: i, onThumb, live: false, offset: 0, w: 0, hist: [[e.timeStamp, x]] };
    if (onThumb) {
      clearTimeout(handoff);
      handoff = undefined;
      gen += 1;
      edgeL.stop();
      edgeR.stop();
    } else if (!reduce) {
      (e.currentTarget as HTMLElement).dataset.pressed = '';
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.id || !d.onThumb) return;
    const x = localX(e);
    d.hist.push([e.timeStamp, x]);
    if (d.hist.length > 8) d.hist.shift();
    if (!d.live) {
      if (Math.abs(x - d.x0) < DEADZONE) return;
      d.live = true;
      d.offset = x - edgeL.get();
      d.w = edgeR.get() - edgeL.get();
      track.dataset.held = '';
    }
    const width = innerW.get();
    const l = x - d.offset;
    const maxL = width - d.w;
    if (reduce) {
      const c = clamp(l, 0, maxL);
      edgeL.set(c);
      edgeR.set(c + d.w);
    } else if (l < 0) {
      edgeL.set(0);
      edgeR.set(d.w - rubber(-l, d.w));
    } else if (l > maxL) {
      edgeR.set(width);
      edgeL.set(maxL + rubber(l - maxL, d.w));
    } else {
      edgeL.set(l);
      edgeR.set(l + d.w);
    }
  };

  const release = () => {
    const d = drag as Drag;
    drag = null;
    delete track.dataset.held;
    const el = buttons[d.slot];
    if (el) delete el.dataset.pressed;
    return d;
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    release();
    const x = localX(e);
    if (!d.live) {
      if (Math.abs(x - d.x0) <= SLOP && d.slot !== committed) {
        const from = committed;
        commit(d.slot);
        travel(from, d.slot);
      }
      return;
    }
    const v = velocityOf(d.hist, e.timeStamp);
    const flick = Math.abs(v) > FLICK;
    let to = nearestSlot(slots, (edgeL.get() + edgeR.get()) / 2 + project(v, glide));
    if (flick && to === committed) to = clamp(to + Math.sign(v), 0, list.length - 1);
    commit(to);
    if (reduce) jumpTo(to);
    else land(to, v, flick, flick);
  };

  const onPointerCancel = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    release();
    if (!d.live) return;
    if (reduce) jumpTo(committed);
    else land(committed, null, false, false);
  };

  function onKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    const last = list.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(last, index + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    if (next === index) return;
    commit(next);
    jumpTo(next);
    buttons[next]?.focus();
  }

  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', onPointerUp);
  track.addEventListener('pointercancel', onPointerCancel);
  track.addEventListener('lostpointercapture', onPointerCancel);

  return {
    el: track,
    get value() {
      return list[index]!.value;
    },
    set(value) {
      const i = list.findIndex((item) => item.value === value);
      if (i < 0 || drag || i === committed) return;
      index = i;
      committed = i;
      syncAria();
      jumpTo(i);
    },
    destroy() {
      clearTimeout(handoff);
      observer.disconnect();
      edgeL.stop();
      edgeR.stop();
      unsubs.forEach((u) => u());
      track.remove();
    },
  };
}
