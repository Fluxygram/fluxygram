import type { Player } from './player';

interface Hooks {
  /** La persona tomó el control (arrastrar, zoom, enfocar): se pausa el autoplay. */
  onInteract(): void;
  /** Clic en el fondo, sin arrastrar. */
  onBackgroundClick(): void;
  /** El mouse entra o sale de un nodo: el reloj del autoplay espera mientras tanto. */
  onHover(active: boolean): void;
}

const DRAG_THRESHOLD = 4; // px de pantalla antes de considerar que es un arrastre
const FRICTION = 0.92; // por cuadro de 16 ms
const MIN_SPEED = 0.01; // unidades del escenario por ms

const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Arrastrar para mover (con inercia), pellizcar o Ctrl/⌘ + rueda para zoom, clic en un nodo para acercarse,
 * y resaltado de conexiones al pasar el mouse. Volver a la vista del paso: botón o Escape.
 */
export function attachInteractions(svg: SVGSVGElement, player: Player, hooks: Hooks): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = false;
  let downAt: { x: number; y: number } | undefined;
  let pinchDist = 0;
  let velocity = { x: 0, y: 0 };
  let lastMove = 0;
  let inertia = 0;

  /** Unidades del escenario por pixel de pantalla (el SVG se escala al ancho del componente). */
  const unit = () => player.stage.w / svg.getBoundingClientRect().width;
  const toStage = (clientX: number, clientY: number) => {
    const r = svg.getBoundingClientRect();
    const k = player.stage.w / r.width;
    return { x: (clientX - r.left) * k, y: (clientY - r.top) * k };
  };
  const nodeAt = (target: EventTarget | null) => {
    const slot = (target as Element | null)?.closest?.('.fx-slot');
    const id = slot?.getAttribute('data-id') ?? undefined;
    return id && slot?.querySelector('.fx-node.is-in') ? id : undefined;
  };
  const stopInertia = () => cancelAnimationFrame(inertia);

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    stopInertia();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY };
      dragged = false;
      velocity = { x: 0, y: 0 };
      lastMove = e.timeStamp;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      dragged = true;
    }
  };

  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      // Sin botón presionado: solo resaltado al pasar el mouse.
      if (e.pointerType === 'mouse' && finePointer()) hover(nodeAt(e.target));
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const mid = toStage((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      if (pinchDist > 0) player.zoomAt(dist / pinchDist, mid.x, mid.y);
      pinchDist = dist;
      hooks.onInteract();
      return;
    }

    if (!dragged && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < DRAG_THRESHOLD) return;
    if (!dragged) {
      dragged = true;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* puntero ya liberado */
      }
      svg.classList.add('is-dragging');
      hover(undefined);
      hooks.onInteract();
    }
    const k = unit();
    const dx = (e.clientX - prev.x) * k;
    const dy = (e.clientY - prev.y) * k;
    player.panBy(dx, dy);
    const dt = Math.max(1, e.timeStamp - lastMove);
    // Promedio suave de la velocidad para que la inercia no dependa del último evento.
    velocity = { x: velocity.x * 0.6 + (dx / dt) * 0.4, y: velocity.y * 0.6 + (dy / dt) * 0.4 };
    lastMove = e.timeStamp;
  };

  const onUp = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 1) pinchDist = 0;
    if (pointers.size > 0) return;
    svg.classList.remove('is-dragging');
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);

    // Inercia: si se soltó en movimiento, la cámara sigue y frena sola.
    const idle = e.timeStamp - lastMove > 80;
    if (dragged && !idle && Math.hypot(velocity.x, velocity.y) > MIN_SPEED) {
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(32, now - last);
        last = now;
        const decay = Math.pow(FRICTION, dt / 16);
        velocity = { x: velocity.x * decay, y: velocity.y * decay };
        player.panBy(velocity.x * dt, velocity.y * dt);
        if (Math.hypot(velocity.x, velocity.y) > MIN_SPEED) inertia = requestAnimationFrame(step);
      };
      inertia = requestAnimationFrame(step);
    }
  };

  const onClick = (e: MouseEvent) => {
    if (dragged) {
      dragged = false;
      return;
    }
    const id = nodeAt(e.target);
    if (id) {
      player.focusNode(id);
      hooks.onInteract();
    } else {
      hooks.onBackgroundClick();
    }
  };

  // La rueda sola sigue desplazando la página; Ctrl/⌘ + rueda (y el pellizco del trackpad) hace zoom.
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    stopInertia();
    const p = toStage(e.clientX, e.clientY);
    player.zoomAt(Math.exp(-e.deltaY * 0.0022), p.x, p.y);
    hooks.onInteract();
  };

  let hovering: string | undefined;
  const hover = (id: string | undefined) => {
    if (id === hovering) return;
    hovering = id;
    player.hover(id);
    hooks.onHover(!!id);
  };
  const onLeave = () => {
    if (!pointers.size) hover(undefined);
  };

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('pointerleave', onLeave);
  svg.addEventListener('click', onClick);
  svg.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    stopInertia();
    svg.removeEventListener('pointerdown', onDown);
    svg.removeEventListener('pointermove', onMove);
    svg.removeEventListener('pointerup', onUp);
    svg.removeEventListener('pointercancel', onUp);
    svg.removeEventListener('pointerleave', onLeave);
    svg.removeEventListener('click', onClick);
    svg.removeEventListener('wheel', onWheel);
  };
}
