import { layout, plan, validate, type Diagram, type Locale, type ValidationIssue } from '@fluxygram/core';
import { attachInteractions } from './interact';
import { Player } from './player';
import { STYLES } from './styles';
import { buildScene } from './svg';

const ICON = {
  prev: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  recenter: '<svg viewBox="0 0 24 24"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><circle cx="12" cy="12" r="2.5"/></svg>',
};

let uid = 0;

const STRINGS = {
  en: {
    play: 'Play', pause: 'Pause', replay: 'Replay', prev: 'Previous step', next: 'Next step',
    goTo: 'Go to step {n}', errors: 'This diagram has errors', parse: 'The JSON could not be read: {e}',
    load: 'The diagram could not be loaded: {e}', recenter: 'Back to the step view',
  },
  es: {
    play: 'Reproducir', pause: 'Pausar', replay: 'Repetir', prev: 'Paso anterior', next: 'Paso siguiente',
    goTo: 'Ir al paso {n}', errors: 'Este diagrama tiene errores', parse: 'El JSON no se pudo leer: {e}',
    load: 'No se pudo cargar el diagrama: {e}', recenter: 'Volver a la vista del paso',
  },
} satisfies Record<Locale, Record<string, string>>;

/** Idioma: atributo lang del elemento o de la página, y si no hay, el del navegador. */
export function detectLocale(el?: Element): Locale {
  const lang = el?.closest('[lang]')?.getAttribute('lang') || navigator.language || 'en';
  return lang.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * <fluxy-gram src="diagram.flux.json"></fluxy-gram>
 *
 * Attributes: src, theme (dark | light), autoplay="false", controls="false", lang (en | es).
 * Also accepts the JSON inside a child <script type="application/json">, or through the `.diagram` property.
 * Methods: next(), prev(), goTo(i), play(), pause(), replay(). Event: `fluxy-step` with { index, count }.
 */
export class FluxyGram extends HTMLElement {
  static observedAttributes = ['src'];

  private root: ShadowRoot;
  private body: HTMLDivElement;
  private player?: Player;
  private data?: Diagram;
  private timer?: Animation;
  private playing = false;
  private started = false;
  private seen = false;
  private io?: IntersectionObserver;
  private uid = `fx${++uid}`;
  private narrow = false;
  private detach?: () => void;
  private hoverPaused = false;
  private ro?: ResizeObserver;

  private get locale(): Locale {
    return detectLocale(this);
  }

  private t(key: keyof (typeof STRINGS)['en'], params: Record<string, string> = {}) {
    return STRINGS[this.locale][key].replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');
  }

  private els: {
    title?: HTMLElement;
    count?: HTMLElement;
    caption?: HTMLElement;
    segs: HTMLButtonElement[];
    play?: HTMLButtonElement;
    prev?: HTMLButtonElement;
    next?: HTMLButtonElement;
    recenter?: HTMLButtonElement;
  } = { segs: [] };

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.body = document.createElement('div');
    this.root.append(style, this.body);
  }

  get diagram(): Diagram | undefined {
    return this.data;
  }

  set diagram(value: Diagram | string | undefined) {
    if (value === undefined) return;
    try {
      this.render(typeof value === 'string' ? JSON.parse(value) : value);
    } catch (err) {
      this.showIssues([{ path: '', message: this.t('parse', { e: (err as Error).message }) }]);
    }
  }

  connectedCallback() {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.io = new IntersectionObserver(
      ([entry]) => {
        this.seen = !!entry?.isIntersecting;
        if (this.seen) this.start();
        else if (this.playing) this.timer?.pause();
        if (this.seen && this.playing && !this.hoverPaused) this.timer?.play();
      },
      { threshold: 0.35 },
    );
    this.io.observe(this);

    // Si el ancho cruza el umbral móvil, se vuelve a calcular el escenario.
    this.ro = new ResizeObserver(() => {
      const narrow = this.clientWidth > 0 && this.clientWidth < 560;
      if (narrow !== this.narrow && this.data) {
        const at = this.player?.index ?? -1;
        this.render(this.data);
        if (at > 0) this.show(at);
      }
    });
    this.ro.observe(this);

    if (this.data) return;
    const inline = this.querySelector('script[type="application/json"]');
    if (inline?.textContent) this.diagram = inline.textContent;
    else if (this.getAttribute('src')) void this.load(this.getAttribute('src')!);
  }

  disconnectedCallback() {
    this.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.io?.disconnect();
    this.ro?.disconnect();
    this.detach?.();
    this.timer?.cancel();
    this.player?.destroy();
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (name === 'src' && value && old !== value && this.isConnected) void this.load(value);
  }

  /* ---------- API pública ---------- */

  next() {
    this.pause();
    this.step(1);
  }
  prev() {
    this.pause();
    this.step(-1);
  }
  goTo(i: number) {
    this.pause();
    this.show(i);
  }
  play() {
    if (!this.player) return;
    if (this.player.index >= this.player.count - 1) return this.replay();
    this.playing = true;
    this.updateButtons();
    this.armTimer();
  }
  pause() {
    this.playing = false;
    this.timer?.cancel();
    this.timer = undefined;
    this.updateButtons();
    this.updateSegments();
  }
  replay() {
    if (!this.player) return;
    this.player.reset();
    this.playing = true;
    // Un cuadro de respiro para que las transiciones de salida no se pisen con las de entrada.
    setTimeout(() => this.show(0), 60);
  }

  /* ---------- Carga y render ---------- */

  private loadedSrc?: string;

  private async load(src: string) {
    if (src === this.loadedSrc) return;
    this.loadedSrc = src;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      this.render(await res.json());
    } catch (err) {
      this.showIssues([{ path: src, message: this.t('load', { e: (err as Error).message }) }]);
    }
  }

  private render(input: unknown) {
    const result = validate(input, { locale: this.locale });
    if (!result.ok) return this.showIssues(result.issues);

    this.timer?.cancel();
    this.player?.destroy();
    this.data = result.diagram;
    if (this.data.theme && !this.hasAttribute('theme')) this.setAttribute('theme', this.data.theme);

    // En pantallas angostas, un escenario más chico: los nodos se ven más grandes y la cámara recorre el resto.
    this.narrow = this.clientWidth > 0 && this.clientWidth < 560;
    const lay = layout(this.data, { maxStageWidth: this.narrow ? 420 : 760 });
    const motion = plan(this.data, lay);
    const scene = buildScene(lay, this.uid);
    if (this.data.title) scene.svg.setAttribute('aria-label', this.data.title);

    this.body.replaceChildren();
    if (this.data.title) {
      const head = document.createElement('div');
      head.className = 'fx-head';
      head.innerHTML = '<p class="fx-title"></p><span class="fx-count" aria-live="polite"></span>';
      this.els.title = head.querySelector('.fx-title')!;
      this.els.title.textContent = this.data.title;
      this.els.count = head.querySelector('.fx-count')!;
      this.body.append(head);
    }
    this.body.append(scene.svg);

    const caption = document.createElement('div');
    caption.className = 'fx-caption';
    caption.setAttribute('aria-live', 'polite');
    this.els.caption = caption;
    const hasCaptions = motion.steps.some((s) => s.caption);
    if (hasCaptions) this.body.append(caption);

    this.player = new Player(scene, lay, motion, (text, dir) => this.setCaption(text, dir));
    this.style.setProperty('--fx-speed', String(this.player.speed));
    this.player.onFreeChange = (free) => this.els.recenter?.classList.toggle('is-on', free);
    this.detach?.();
    this.detach = attachInteractions(scene.svg, this.player, {
      onInteract: () => this.pause(),
      onBackgroundClick: () => this.next(),
      onHover: (active) => {
        // Mientras se explora un nodo, el autoplay espera.
        this.hoverPaused = active;
        if (active) this.timer?.pause();
        else if (this.playing && this.seen && !document.hidden) this.timer?.play();
      },
    });
    if (this.getAttribute('controls') !== 'false' && motion.steps.length > 1) this.buildControls(motion.steps.length);

    this.started = false;
    this.playing = this.getAttribute('autoplay') !== 'false';
    this.updateButtons();
    if (this.seen) this.start();
  }

  private start() {
    if (this.started || !this.player) return;
    this.started = true;
    this.show(0);
  }

  private step(delta: number) {
    if (!this.player) return;
    this.show((this.player.index < 0 ? -1 : this.player.index) + delta);
  }

  private show(i: number) {
    if (!this.player) return;
    this.started = true;
    this.player.go(i);
    const { index, count } = this.player;
    if (this.els.count) this.els.count.textContent = count > 1 ? `${index + 1} / ${count}` : '';
    this.updateSegments();
    this.updateButtons();
    this.dispatchEvent(new CustomEvent('fluxy-step', { detail: { index, count } }));
    if (this.playing) this.armTimer();
  }

  /** El segmento de progreso del paso actual es también el reloj del autoplay. */
  private armTimer() {
    this.timer?.cancel();
    const player = this.player;
    if (!player || player.index < 0) return;
    if (player.index >= player.count - 1) {
      this.playing = false;
      this.updateButtons();
      return;
    }
    const seg = this.els.segs[player.index]?.querySelector('i');
    const target = seg ?? this.body;
    const hold = this.holdFor(player.index);
    this.timer = target.animate(seg ? [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }] : [{ opacity: 1 }, { opacity: 1 }], {
      duration: hold,
      easing: 'linear',
      fill: 'forwards',
    });
    if (!this.seen || document.hidden || this.hoverPaused) this.timer.pause();
    this.timer.onfinish = () => {
      if (this.playing) this.step(1);
    };
  }

  private holdFor(i: number) {
    const s = this.player?.steps[i];
    if (!s) return 2600;
    const words = s.caption ? s.caption.split(/\s+/).length : 0;
    const t = 1700 + s.entering.length * 90 + words * 220 + (s.flowing.length ? 1500 : 0);
    return Math.max(2400, Math.min(6500, t)) * (this.player?.speed ?? 1);
  }

  /* ---------- UI ---------- */

  private setCaption(text: string | undefined, dir: 1 | -1) {
    const box = this.els.caption;
    if (!box) return;
    const current = box.querySelector('span:not(.is-leaving)');
    if (current?.textContent === (text ?? '')) return;
    if (current) {
      current.classList.add('is-leaving');
      (current as HTMLElement).style.transform = `translateY(${-6 * dir}px)`;
      setTimeout(() => current.remove(), 220);
    }
    if (!text) return;
    const span = document.createElement('span');
    span.textContent = text;
    span.className = 'is-entering';
    span.style.transform = `translateY(${6 * dir}px)`;
    box.append(span);
    // Forzar un reflow fija el estado inicial sin depender de requestAnimationFrame
    // (que se pausa en pestañas o paneles en segundo plano).
    void span.offsetWidth;
    span.classList.remove('is-entering');
    span.style.transform = '';
  }

  private buildControls(count: number) {
    const bar = document.createElement('div');
    bar.className = 'fx-controls';

    const button = (label: string, icon: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.className = 'fx-btn';
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.innerHTML = icon;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return b;
    };

    this.els.play = button(this.t('play'), ICON.play, () => (this.playing ? this.pause() : this.play()));
    this.els.prev = button(this.t('prev'), ICON.prev, () => this.prev());
    this.els.next = button(this.t('next'), ICON.next, () => this.next());

    const track = document.createElement('div');
    track.className = 'fx-track';
    this.els.segs = Array.from({ length: count }, (_, i) => {
      const seg = document.createElement('button');
      seg.className = 'fx-seg';
      seg.type = 'button';
      seg.setAttribute('aria-label', this.t('goTo', { n: String(i + 1) }));
      seg.append(document.createElement('i'));
      seg.addEventListener('click', (e) => {
        e.stopPropagation();
        this.goTo(i);
      });
      track.append(seg);
      return seg;
    });

    this.els.recenter = button(this.t('recenter'), ICON.recenter, () => this.player?.resetView());
    this.els.recenter.classList.add('fx-recenter');
    bar.append(this.els.play, this.els.prev, track, this.els.next, this.els.recenter);
    this.body.append(bar);
  }

  private updateSegments() {
    const index = this.player?.index ?? -1;
    this.els.segs.forEach((seg, i) => {
      const fill = seg.querySelector('i')!;
      if (!(this.playing && i === index)) fill.getAnimations().forEach((a) => a.cancel());
      seg.classList.toggle('is-done', i < index || (i === index && !this.playing) || (i === index && index === this.els.segs.length - 1));
      seg.setAttribute('aria-current', i === index ? 'step' : 'false');
    });
  }

  private updateButtons() {
    const p = this.player;
    if (!p || !this.els.play) return;
    const atEnd = p.index >= p.count - 1;
    this.els.play.innerHTML = this.playing ? ICON.pause : atEnd ? ICON.replay : ICON.play;
    this.els.play.setAttribute('aria-label', this.t(this.playing ? 'pause' : atEnd ? 'replay' : 'play'));
    this.els.prev!.disabled = p.index <= 0;
    this.els.next!.disabled = atEnd;
  }

  private showIssues(issues: ValidationIssue[]) {
    this.player?.destroy();
    this.player = undefined;
    this.detach?.();
    this.detach = undefined;
    const box = document.createElement('div');
    box.className = 'fx-error';
    box.innerHTML = '<strong></strong><ul></ul>';
    box.querySelector('strong')!.textContent = this.t('errors');
    const ul = box.querySelector('ul')!;
    for (const issue of issues) {
      const li = document.createElement('li');
      if (issue.path) {
        const code = document.createElement('code');
        code.textContent = issue.path;
        li.append(code, ' ');
      }
      li.append(issue.message);
      ul.append(li);
    }
    this.body.replaceChildren(box);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.target !== this) return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => this.next(),
      Escape: () => this.player?.resetView(),
      ArrowLeft: () => this.prev(),
      ' ': () => (this.playing ? this.pause() : this.play()),
      Home: () => this.goTo(0),
      End: () => this.goTo((this.player?.count ?? 1) - 1),
    };
    const action = keys[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  private onVisibility = () => {
    // Igual que Sonner: si la pestaña no está visible, el reloj se detiene.
    if (document.hidden) this.timer?.pause();
    else if (this.playing && this.seen && !this.hoverPaused) this.timer?.play();
  };
}

export function define(tag = 'fluxy-gram') {
  if (!customElements.get(tag)) customElements.define(tag, FluxyGram);
}
