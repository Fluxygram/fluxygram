import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import type { Diagram } from '@fluxygram/core';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';

/**
 * Grabador de video (MP4) y GIF. Corre dentro de record.html, en un iframe oculto del editor, con el reloj virtual
 * instalado antes que el componente. Por cada cuadro: avanza el reloj, alinea las animaciones CSS/WAAPI con él,
 * copia el SVG con sus estilos calculados, lo dibuja en un canvas con el título y el texto del paso, y lo codifica.
 */

interface Clock {
  now: number;
  advance: (ms: number) => void;
  real: { setTimeout: (fn: () => void, ms: number) => number };
}
declare global {
  interface Window {
    __fxClock: Clock;
  }
}

export interface RecordJob {
  id: string;
  diagram: Diagram;
  format: 'mp4' | 'gif';
  width: number;
  height: number;
  fps: number;
  lang: 'en' | 'es';
  watermark: string | null;
}

type Out =
  | { type: 'ready' }
  | { type: 'progress'; id: string; done: number; total: number }
  | { type: 'done'; id: string; buffer: ArrayBuffer; mime: string }
  | { type: 'error'; id: string; message: string };

const clock = window.__fxClock;
const el = document.getElementById('d') as FluxyGram;
const post = (msg: Out, transfer: Transferable[] = []) => parent.postMessage(msg, location.origin, transfer);
let cancelled = false;

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const msg = e.data as { type: string; job?: RecordJob };
  if (msg.type === 'cancel') cancelled = true;
  if (msg.type === 'record' && msg.job) {
    cancelled = false;
    record(msg.job).catch((err: Error) => post({ type: 'error', id: msg.job!.id, message: err.message || String(err) }));
  }
});
post({ type: 'ready' });

/* ---------- Fuentes: Inter incrustada, porque un SVG dibujado como imagen no carga fuentes externas ---------- */

let fontCss: Promise<string> | undefined;
function embeddedFonts(): Promise<string> {
  fontCss ??= (async () => {
    try {
      const css = await (await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')).text();
      const blocks = css.match(/\/\* latin \*\/\s*@font-face\s*{[^}]*}/g) ?? [];
      const cache = new Map<string, Promise<string>>();
      const toData = (url: string) => {
        let p = cache.get(url);
        if (!p) {
          p = fetch(url)
            .then((r) => r.blob())
            .then((b) => new Promise<string>((ok) => {
              const fr = new FileReader();
              fr.onload = () => ok(String(fr.result));
              fr.readAsDataURL(b);
            }));
          cache.set(url, p);
        }
        return p;
      };
      const out: string[] = [];
      for (const block of blocks) {
        const url = block.match(/url\((https:[^)]+)\)/)?.[1];
        if (url) out.push(block.replace(url, await toData(url)));
      }
      return out.join('\n');
    } catch {
      return ''; // sin red: la imagen usa la fuente del sistema
    }
  })();
  return fontCss;
}

/* ---------- Animaciones alineadas con el reloj virtual ---------- */

const starts = new WeakMap<Animation, number>();
function syncAnimations() {
  const list = new Set<Animation>([...document.getAnimations(), ...(el.shadowRoot?.getAnimations() ?? [])]);
  for (const a of list) {
    if (a.playState === 'paused') continue;
    if (!starts.has(a)) starts.set(a, clock.now);
    a.currentTime = clock.now - starts.get(a)!;
  }
}

/* ---------- Un cuadro: el SVG con sus estilos calculados ---------- */

const PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
  'stroke-linejoin', 'opacity', 'transform', 'transform-origin', 'transform-box', 'visibility', 'display', 'font-family', 'font-size',
  'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order', 'color',
];

function inlineStyles(source: Element, target: Element) {
  const cs = getComputedStyle(source);
  let style = '';
  for (const p of PROPS) {
    const v = cs.getPropertyValue(p);
    if (v) style += `${p}:${v};`;
  }
  target.setAttribute('style', style);
  const a = source.children;
  const b = target.children;
  for (let i = 0; i < a.length; i++) inlineStyles(a[i]!, b[i]!);
}

async function svgImage(svg: SVGSVGElement, w: number, h: number, fonts: string): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.removeAttribute('class');
  if (fonts) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = fonts;
    clone.insertBefore(style, clone.firstChild);
  }
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- Grabar ---------- */

const nextTick = () => new Promise<void>((ok) => clock.real.setTimeout(ok, 0));

async function waitForScene(): Promise<SVGSVGElement> {
  for (let i = 0; i < 200; i++) {
    const svg = el.shadowRoot?.querySelector<SVGSVGElement>('svg.fx-stage');
    if (svg) return svg;
    await nextTick();
  }
  throw new Error('scene not ready');
}

async function record(job: RecordJob) {
  const { width: W, height: H, fps } = job;
  el.setAttribute('lang', job.lang);
  if (job.diagram.theme) el.setAttribute('theme', job.diagram.theme);
  el.style.width = '1040px';
  el.diagram = job.diagram;
  const svg = await waitForScene();
  await document.fonts.ready;
  await Promise.all(['400', '500', '600'].map((w) => document.fonts.load(`${w} 24px Inter`)));
  const fonts = await embeddedFonts();

  // El mismo ritmo que la reproducción automática, más un momento al final para ver el resultado.
  const holds = el.stepDurations();
  const lead = 300;
  let at = lead;
  holds.forEach((hold, i) => {
    window.setTimeout(() => el.goTo(i), at);
    at += hold;
  });
  const total = Math.min(at + 1200, 120_000);
  const frames = Math.ceil((total / 1000) * fps);
  const frameMs = 1000 / fps;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: job.format === 'gif' })!;
  const hostStyle = getComputedStyle(el);
  const color = (name: string, fallback: string) => hostStyle.getPropertyValue(name).trim() || fallback;
  const bg = color('--fx-bg', '#09090c');
  const text = color('--fx-text', '#f3f3f6');
  const muted = color('--fx-muted', '#9b9ba8');
  const k = H / 720; // todo escala con el alto del video
  const title = job.diagram.title;
  const top = title ? 96 * k : 40 * k;
  const bottom = H - 96 * k;
  const [, , vbW, vbH] = (svg.getAttribute('viewBox') ?? '0 0 760 420').split(/\s+/).map(Number) as [number, number, number, number];
  const scale = Math.min((W - 96 * k) / vbW, (bottom - top) / vbH);
  const dw = Math.round(vbW * scale);
  const dh = Math.round(vbH * scale);
  const dx = Math.round((W - dw) / 2);
  const dy = Math.round(top + (bottom - top - dh) / 2);

  const encoder = job.format === 'mp4' ? await mp4Encoder(W, H, fps) : gifEncoder(W, H, fps);

  for (let f = 0; f < frames; f++) {
    if (cancelled) throw new Error('cancelled');
    clock.advance(f === 0 ? 0 : frameMs);
    syncAnimations();
    await Promise.resolve(); // eventos "finish" de las animaciones

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const img = await svgImage(svg, dw, dh, fonts);
    ctx.drawImage(img, dx, dy, dw, dh);

    if (title) {
      ctx.fillStyle = text;
      ctx.font = `600 ${Math.round(28 * k)}px Inter, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText(title, 48 * k, 62 * k, W - 220 * k);
    }
    // El texto del paso, con su entrada y salida (opacidad y desplazamiento) tal como en el componente.
    ctx.textAlign = 'center';
    ctx.font = `500 ${Math.round(24 * k)}px Inter, sans-serif`;
    for (const span of el.shadowRoot!.querySelectorAll<HTMLElement>('.fx-caption span')) {
      const cs = getComputedStyle(span);
      const opacity = Number(cs.opacity);
      if (!opacity || !span.textContent) continue;
      const shift = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform).m42;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = text;
      ctx.fillText(span.textContent, W / 2, H - 46 * k + shift * k, W - 120 * k);
    }
    ctx.globalAlpha = 1;
    if (job.watermark) {
      ctx.textAlign = 'right';
      ctx.font = `500 ${Math.round(15 * k)}px Inter, sans-serif`;
      ctx.fillStyle = muted;
      ctx.fillText(job.watermark, W - 24 * k, H - 14 * k);
    }

    await encoder.add(canvas, ctx, f);
    if (f % 5 === 0) {
      post({ type: 'progress', id: job.id, done: f + 1, total: frames });
      await nextTick();
    }
  }
  const out = await encoder.finish();
  post({ type: 'done', id: job.id, buffer: out.buffer, mime: out.mime }, [out.buffer]);
}

/* ---------- Codificadores ---------- */

interface Encoder {
  add: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, index: number) => Promise<void>;
  finish: () => Promise<{ buffer: ArrayBuffer; mime: string }>;
}

async function mp4Encoder(W: number, H: number, fps: number): Promise<Encoder> {
  if (typeof VideoEncoder === 'undefined') throw new Error('no_webcodecs');
  const bitrate = Math.round(W * H * fps * 0.14);
  let config: VideoEncoderConfig | undefined;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f']) {
    const c: VideoEncoderConfig = { codec, width: W, height: H, bitrate, framerate: fps };
    if ((await VideoEncoder.isConfigSupported(c)).supported) {
      config = c;
      break;
    }
  }
  if (!config) throw new Error('no_h264');
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
  let failure: Error | undefined;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure(config);
  const step = 1_000_000 / fps;
  return {
    async add(canvas, _ctx, index) {
      if (failure) throw failure;
      const frame = new VideoFrame(canvas, { timestamp: Math.round(index * step), duration: Math.round(step) });
      encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 8) await nextTick();
    },
    async finish() {
      await encoder.flush();
      if (failure) throw failure;
      muxer.finalize();
      return { buffer: muxer.target.buffer, mime: 'video/mp4' };
    },
  };
}

function gifEncoder(W: number, H: number, fps: number): Encoder {
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  return {
    async add(_canvas, ctx) {
      const { data } = ctx.getImageData(0, 0, W, H);
      const palette = quantize(data, 256, { format: 'rgb565' });
      const index = applyPalette(data, palette, 'rgb565');
      gif.writeFrame(index, W, H, { palette, delay });
    },
    async finish() {
      gif.finish();
      const bytes = gif.bytes();
      return { buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, mime: 'image/gif' };
    },
  };
}
