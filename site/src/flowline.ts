/**
 * La landing como un gran diagrama: una conexión sale del diagrama del hero y baja por el margen,
 * pasando por un nodo junto a cada sección, hasta la marca del final. Se dibuja a medida que se hace scroll,
 * con la partícula de Fluxygram en la punta; cada nodo se enciende cuando la línea llega a él.
 *
 * Solo decora: el SVG va detrás de todo, sin eventos del puntero y oculto para lectores de pantalla.
 */
const NS = 'http://www.w3.org/2000/svg';
const RADIUS = 18; // esquinas redondeadas, como las conexiones de los diagramas
const TRIGGER = 0.62; // la punta de la línea va a esta altura de la ventana

interface Stop {
  el: HTMLElement;
  /** Elemento junto al que va el nodo (el título de la sección). */
  anchor: HTMLElement;
}

export function mountFlowline(start: HTMLElement, stops: Stop[], end: HTMLElement) {
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('flowline');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(NS, 'path');
  track.classList.add('flowline-track');
  const line = document.createElementNS(NS, 'path');
  line.classList.add('flowline-line');
  const glow = document.createElementNS(NS, 'circle');
  glow.classList.add('flowline-glow');
  glow.setAttribute('r', '9');
  const dot = document.createElementNS(NS, 'circle');
  dot.classList.add('flowline-dot');
  dot.setAttribute('r', '3.5');
  svg.append(track, line);
  const nodes = [...stops, { el: end, anchor: end }].map(() => {
    const g = document.createElementNS(NS, 'g');
    g.classList.add('flowline-node');
    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', '7');
    const core = document.createElementNS(NS, 'circle');
    core.setAttribute('r', '3');
    core.classList.add('flowline-core');
    g.append(ring, core);
    svg.append(g);
    return g;
  });
  svg.append(glow, dot);
  document.body.prepend(svg);

  let total = 0;
  let samples: { y: number; len: number }[] = [];
  let nodeLens: number[] = [];

  const docTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
  const docLeft = (el: Element) => el.getBoundingClientRect().left + window.scrollX;

  function layout() {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.scrollHeight;
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // La columna de la línea: en el margen izquierdo del contenido, sin pisarlo.
    const contentLeft = docLeft(stops[0]!.anchor);
    const x = Math.round(contentLeft - Math.min(28, Math.max(10, contentLeft / 2)));

    const sb = start.getBoundingClientRect();
    const sx = Math.round(sb.left + sb.width / 2);
    const sy = Math.round(sb.bottom + window.scrollY);
    const turn = sy + 36;
    // El nodo va a la altura de la primera línea del título (los títulos largos ocupan dos).
    const firstLine = (el: HTMLElement) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      return Number.isFinite(lh) ? Math.min(lh, el.offsetHeight) / 2 : el.offsetHeight / 2;
    };
    const ys = [...stops.map((s) => docTop(s.anchor) + firstLine(s.anchor)), docTop(end) + 12].map(Math.round);

    // Del centro del hero baja, gira hacia el margen y sigue recto por cada sección.
    const r = Math.min(RADIUS, Math.abs(sx - x) / 2, (turn - sy) / 2);
    const dir = sx > x ? -1 : 1;
    let d = `M ${sx} ${sy} V ${turn - r} Q ${sx} ${turn} ${sx + dir * r} ${turn} H ${x - dir * r} Q ${x} ${turn} ${x} ${turn + r}`;
    d += ` V ${ys[ys.length - 1]}`;
    track.setAttribute('d', d);
    line.setAttribute('d', d);
    total = line.getTotalLength();
    line.style.strokeDasharray = `${total} ${total}`;

    // Longitud de la línea para cada altura: se muestrea una vez por cada cambio de tamaño.
    samples = [];
    for (let len = 0; len <= total; len += 6) samples.push({ y: line.getPointAtLength(len).y, len });
    samples.push({ y: line.getPointAtLength(total).y, len: total });

    nodeLens = ys.map((y) => lengthAt(y));
    nodes.forEach((g, i) => g.setAttribute('transform', `translate(${x} ${ys[i]})`));
    update();
  }

  /** Cuánta línea hace falta para llegar a una altura (la primera vez que la alcanza). */
  function lengthAt(y: number) {
    if (y <= samples[0]!.y) return 0;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!;
      const b = samples[i]!;
      if (b.y >= y) return b.y === a.y ? b.len : a.len + ((y - a.y) / (b.y - a.y)) * (b.len - a.len);
    }
    return total;
  }

  function update() {
    const tipY = window.scrollY + window.innerHeight * TRIGGER;
    // Al llegar al final de la página la línea se completa, aunque la marca no alcance la altura de la punta.
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    const drawn = atBottom ? total : Math.min(total, lengthAt(tipY));
    line.style.strokeDashoffset = String(total - drawn);
    const p = line.getPointAtLength(drawn);
    const visible = drawn > 1 && drawn < total - 1;
    for (const c of [dot, glow]) {
      c.setAttribute('cx', String(p.x));
      c.setAttribute('cy', String(p.y));
      c.classList.toggle('is-hidden', !visible);
    }
    nodes.forEach((g, i) => g.classList.toggle('is-on', drawn >= nodeLens[i]! - 1));
  }

  const schedule = (fn: () => void) => {
    let queued = false;
    return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
    };
  };
  window.addEventListener('scroll', schedule(update), { passive: true });
  // Los diagramas cargan y cambian de alto (pestañas, idioma): se recalcula el trazado cuando cambia la página.
  const relayout = schedule(layout);
  new ResizeObserver(relayout).observe(document.body);
  window.addEventListener('resize', relayout);
  void document.fonts?.ready.then(relayout);
  layout();
}
