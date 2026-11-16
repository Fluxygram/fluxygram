import type { FluxyGram } from '@fluxygram/element';
import type { Diagram } from '@fluxygram/core';

/**
 * Controles de los ejemplos "en vivo" (modo seguimiento): avanzan el proceso como lo haría el sistema de
 * quien lo usa y muestran el código del componente en cada momento. Lo usan la galería y las páginas de ejemplo.
 *
 * Dentro de `root` se buscan: botones [data-live="next|delay|fail|reset"] y un <pre data-live="code">.
 */
export interface Live {
  /** Etapas del camino feliz, en orden (puede repetir etapas si el proceso vuelve atrás). */
  path: string[];
  /** Etapa a la que salta "Simular un problema", si hay una conexión desde la etapa actual. */
  fail?: string;
  /** Se pasa el historial al componente: para ramas que se juntan o procesos que vuelven atrás. */
  history?: boolean;
}

type Status = 'pending' | 'success' | 'error' | 'warning';

export function mountLive(el: FluxyGram, root: HTMLElement) {
  const q = <T extends HTMLElement>(k: string) => root.querySelector<T>(`[data-live="${k}"]`)!;
  const next = q<HTMLButtonElement>('next');
  const delay = q<HTMLButtonElement>('delay');
  const fail = q<HTMLButtonElement>('fail');
  const code = q<HTMLElement>('code');
  let live: Live | null = null;
  let name = '';
  let diagram: Diagram | null = null;
  let at = 0; // posición en el camino feliz

  function go(index: number, status: Status = 'pending', stage?: string) {
    const l = live!;
    at = index;
    const visited = stage ? [...l.path.slice(0, index + 1), stage] : l.path.slice(0, index + 1);
    // La última etapa queda como terminada (verde).
    const final = !stage && index === l.path.length - 1;
    el.history = l.history ? visited : null;
    el.setStage(stage ?? l.path[index]!, final ? 'success' : status);
    update();
  }

  function update() {
    if (!live) return;
    const stage = el.stage;
    const ended = stage !== live.path[at] || at === live.path.length - 1;
    const canFail = !!live.fail && !ended && !!diagram?.edges?.some((e) => e.from === stage && e.to === live!.fail);
    next.disabled = ended;
    delay.disabled = ended;
    fail.disabled = !canFail;
    fail.hidden = !live.fail;
  }

  function showCode() {
    if (!live) return;
    const status = el.status;
    const history = live.history ? `\n  history="${el.history.join(',')}"` : '';
    code.textContent = `<fluxy-gram src="${name}.flux.json" mode="tracker"
  stage="${el.stage ?? ''}"${status !== 'pending' ? ` status="${status}"` : ''}${history}></fluxy-gram>`;
  }

  el.addEventListener('fluxy-stage', showCode);
  next.onclick = () => go(Math.min(at + 1, live!.path.length - 1));
  delay.onclick = () => go(at, 'warning');
  fail.onclick = () => go(at, 'error', live!.fail);
  q<HTMLButtonElement>('reset').onclick = () => go(0);

  return {
    /** Prepara el componente para un ejemplo en vivo. Llamar antes de asignar el diagrama. */
    start(exampleName: string, d: Diagram, l: Live) {
      name = exampleName;
      diagram = d;
      live = l;
      el.setAttribute('mode', 'tracker');
      go(0);
      showCode();
    },
    stop() {
      live = null;
      for (const a of ['mode', 'stage', 'status', 'history']) el.removeAttribute(a);
    },
  };
}
