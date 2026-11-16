import type { Diagram } from '@fluxygram/core';
import { X } from 'lucide';
import { h, icon } from './dom';
import { t } from '../i18n';
import { loadMe, showUpgrade } from '../cloud';
import type { RecordJob } from '../record';

/**
 * Exportar el diagrama como video (MP4) o GIF. La grabación corre en un iframe oculto (/record) con un reloj
 * virtual, así sale igual en cualquier equipo; aquí solo están las opciones, el progreso y la descarga.
 * Plan gratis: GIF pequeño con marca de agua. Pro: MP4 hasta 1080p y GIF grande, sin marca.
 */

type Format = 'mp4' | 'gif';
interface Size { label: string; width: number; height: number; fps: number; pro: boolean }
const SIZES: Record<Format, Size[]> = {
  mp4: [
    { label: '720p', width: 1280, height: 720, fps: 30, pro: true },
    { label: '1080p', width: 1920, height: 1080, fps: 30, pro: true },
  ],
  gif: [
    { label: '640 × 360', width: 640, height: 360, fps: 12, pro: false },
    { label: '960 × 540', width: 960, height: 540, fps: 15, pro: true },
  ],
};

export async function openVideoExport(diagram: Diagram, lang: 'en' | 'es', fileName: string) {
  const me = await loadMe();
  const pro = !!(me?.signedIn && me.user.plan === 'pro');
  const canBuy = !!(me?.signedIn ? me.billing?.available : me && me.providers.length);
  let format: Format = pro ? 'mp4' : 'gif';
  let size = 0;
  let frame: HTMLIFrameElement | undefined;
  let busy = false;

  const close = () => {
    if (busy) frame?.contentWindow?.postMessage({ type: 'cancel' }, location.origin);
    frame?.remove();
    modal.remove();
    window.removeEventListener('message', onMessage);
  };

  const locked = (f: Format, i: number) => !pro && SIZES[f][i]!.pro;
  const formatSeg = h('div', { class: 'ed-seg', role: 'radiogroup', 'aria-label': t('video.format') });
  const sizeSeg = h('div', { class: 'ed-seg', role: 'radiogroup', 'aria-label': t('video.size') });
  const note = h('p', { class: 'ed-video-note' });
  const bar = h('div', { class: 'ed-video-bar', hidden: true }, h('i', {}));
  const status = h('p', { class: 'ed-video-status', 'aria-live': 'polite' });
  const go = h('button', { type: 'button', class: 'ed-btn ed-btn-primary', onclick: () => void start() }, t('video.export'));

  const proTag = () => h('span', { class: 'ed-video-pro' }, 'Pro');
  const render = () => {
    formatSeg.replaceChildren(...(['mp4', 'gif'] as Format[]).map((f) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(format === f), onclick: () => {
        format = f;
        size = SIZES[f].findIndex((_, i) => !locked(f, i));
        if (size < 0) size = 0;
        render();
      } }, f === 'mp4' ? t('video.mp4') : 'GIF', !pro && SIZES[f].every((s) => s.pro) ? proTag() : undefined),
    ));
    sizeSeg.replaceChildren(...SIZES[format].map((s, i) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(size === i), onclick: () => {
        size = i;
        render();
      } }, s.label, locked(format, i) ? proTag() : undefined),
    ));
    const blocked = locked(format, size);
    note.textContent = blocked ? t('video.proOnly') : pro ? t('video.noMark') : t('video.freeNote');
    go.textContent = blocked ? t('pro.see') : t('video.export');
  };

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin || e.source !== frame?.contentWindow) return;
    const msg = e.data as { type: string; done?: number; total?: number; buffer?: ArrayBuffer; mime?: string; message?: string };
    if (msg.type === 'ready') {
      const s = SIZES[format][size]!;
      const job: RecordJob = {
        id: String(Date.now()),
        diagram,
        format,
        width: s.width,
        height: s.height,
        fps: s.fps,
        lang,
        watermark: pro ? null : t('video.watermark'),
      };
      frame!.contentWindow!.postMessage({ type: 'record', job }, location.origin);
    } else if (msg.type === 'progress') {
      const pct = Math.round(((msg.done ?? 0) / (msg.total || 1)) * 100);
      (bar.firstElementChild as HTMLElement).style.transform = `scaleX(${pct / 100})`;
      status.textContent = t('video.recording', { p: String(pct) });
    } else if (msg.type === 'done' && msg.buffer) {
      const url = URL.createObjectURL(new Blob([msg.buffer], { type: msg.mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      finish(t('video.done'));
    } else if (msg.type === 'error') {
      const reason = msg.message === 'no_webcodecs' || msg.message === 'no_h264' ? t('video.noMp4') : msg.message === 'cancelled' ? '' : t('video.failed');
      finish(reason);
    }
  };

  const finish = (text: string) => {
    busy = false;
    frame?.remove();
    frame = undefined;
    bar.hidden = true;
    status.textContent = text;
    go.disabled = false;
    formatSeg.inert = false;
    sizeSeg.inert = false;
  };

  const start = async () => {
    if (locked(format, size)) {
      if (canBuy) showUpgrade(t('video.proReason'), 'video');
      return;
    }
    busy = true;
    go.disabled = true;
    formatSeg.inert = true;
    sizeSeg.inert = true;
    bar.hidden = false;
    (bar.firstElementChild as HTMLElement).style.transform = 'scaleX(0)';
    status.textContent = t('video.preparing');
    // Fuera de la pantalla pero con tamaño real: el componente se dibuja igual que en una página.
    frame = h('iframe', { src: '/record.html', title: 'recorder', 'aria-hidden': 'true', tabindex: '-1', class: 'ed-video-frame' });
    document.body.append(frame);
  };

  window.addEventListener('message', onMessage);
  render();
  const modal: HTMLDivElement = h('div', { class: 'ed-modal' },
    h('div', { class: 'ed-picker ed-video-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('video.title') },
      h('button', { type: 'button', class: 'ed-icon ed-modal-close', title: t('ed.close'), 'aria-label': t('ed.close'), onclick: close }, icon(X)),
      h('h2', { class: 'ed-picker-title' }, t('video.title')),
      h('p', { class: 'ed-video-lead' }, t('video.lead')),
      h('div', { class: 'ed-video-row' }, h('span', {}, t('video.format')), formatSeg),
      h('div', { class: 'ed-video-row' }, h('span', {}, t('video.size')), sizeSeg),
      note,
      bar,
      status,
      h('div', { class: 'ed-pro-actions' }, h('button', { type: 'button', class: 'ed-btn', onclick: close }, t('ed.close')), go),
    ),
  );
  modal.addEventListener('click', (e) => e.target === modal && !busy && close());
  modal.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && close());
  document.body.append(modal);
  go.focus();
}
