// Fluxygram site i18n. Runs synchronously at the end of <body>, before first paint.
// Language: saved choice > browser language > English.
(function () {
  var STRINGS = {
    en: {
      'meta.title': 'Fluxygram — diagrams that explain themselves',
      'meta.description': 'Describe anything in JSON. Fluxygram draws it and tells it step by step, with motion that helps people understand.',
      'nav.examples': 'Examples',
      'nav.playground': 'Playground',
      'nav.schema': 'Schema',
      'hero.title': 'Diagrams that explain themselves.',
      'hero.lead': 'Describe anything in JSON. Fluxygram draws it and tells it step by step, with motion that helps people understand instead of distracting them.',
      'hero.play': 'Open the playground',
      'hero.github': 'View on GitHub',
      'examples.title': 'Every kind of diagram moves its own way.',
      'examples.lead': 'Pick the type and Fluxygram applies its motion grammar. Steps are optional: without them, the diagram still tells its story.',
      'examples.flow': 'Flow',
      'examples.architecture': 'Architecture',
      'examples.timeline': 'Timeline',
      'examples.json': 'See the JSON behind this diagram',
      'motion.title': 'Motion with a purpose.',
      'motion.lead': 'Every animation answers a question: what appears, where it goes, what changes.',
      'motion.flow': 'The path builds up step by step and a particle travels along each new stretch.',
      'motion.architecture': 'Layers appear from the bottom up and requests travel between services.',
      'motion.timeline': 'The camera moves from milestone to milestone and each moment lands in place.',
      'agents.title': 'Built for agents.',
      'agents.lead': 'Fluxygram ships a skill that teaches any agent the format, how to pick the right diagram type and how to tell a good story in steps. Ask in plain language, get an animated diagram.',
      'agents.c1': '// 1. Embed the component (npm package coming soon)',
      'agents.c2': '// 2. Or ask your agent',
      'agents.ask': '"Make me an animated diagram of how\n a card payment gets processed"',
      'footer.tag': 'Fluxygram',
      'play.title': 'Playground — Fluxygram',
      'play.preset': 'Example',
      'play.p.how': 'How Fluxygram works',
      'play.p.order': 'Flow: an order',
      'play.p.arch': 'Architecture: an app',
      'play.p.web': 'Timeline: the web',
      'play.source': 'Diagram JSON',
      'play.valid': 'Valid',
      'play.incomplete': 'Incomplete JSON',
      'play.errors1': '1 error',
      'play.errorsN': '{n} errors',
      'play.reset': 'Reset',
      '404.title': 'Not found — Fluxygram',
      '404.heading': 'This page does not exist.',
      '404.lead': 'The diagram may have moved somewhere else.',
      '404.back': 'Back to home',
      'lang.switch': 'Español',
    },
    es: {
      'meta.title': 'Fluxygram — diagramas que se explican solos',
      'meta.description': 'Describe cualquier cosa en un JSON. Fluxygram la dibuja y la cuenta paso a paso, con movimiento que ayuda a entender.',
      'nav.examples': 'Ejemplos',
      'nav.playground': 'Playground',
      'nav.schema': 'Schema',
      'hero.title': 'Diagramas que se explican solos.',
      'hero.lead': 'Describe cualquier cosa en un JSON. Fluxygram la dibuja y la cuenta paso a paso, con movimiento que ayuda a entender en vez de distraer.',
      'hero.play': 'Abrir el playground',
      'hero.github': 'Ver en GitHub',
      'examples.title': 'Cada tipo de diagrama se mueve a su manera.',
      'examples.lead': 'Eliges el tipo y Fluxygram aplica su gramática de movimiento. Los pasos son opcionales: sin ellos, el diagrama igual cuenta su historia.',
      'examples.flow': 'Flujo',
      'examples.architecture': 'Arquitectura',
      'examples.timeline': 'Línea de tiempo',
      'examples.json': 'Ver el JSON de este diagrama',
      'motion.title': 'Movimiento con propósito.',
      'motion.lead': 'Cada animación responde a una pregunta: qué aparece, hacia dónde va, qué cambia.',
      'motion.flow': 'El camino se construye paso a paso y una partícula recorre cada tramo nuevo.',
      'motion.architecture': 'Las capas aparecen de abajo hacia arriba y las peticiones viajan entre servicios.',
      'motion.timeline': 'La cámara avanza hito por hito y cada momento aterriza en su lugar.',
      'agents.title': 'Hecho para agentes.',
      'agents.lead': 'Fluxygram incluye una skill que le enseña a cualquier agente el formato, cómo elegir el tipo de diagrama y cómo contar una buena historia en pasos. Le pides algo en lenguaje natural y recibes un diagrama animado.',
      'agents.c1': '// 1. Incrusta el componente (paquete npm en camino)',
      'agents.c2': '// 2. O pídeselo a tu agente',
      'agents.ask': '"Hazme un diagrama animado de cómo\n se procesa un pago con tarjeta"',
      'footer.tag': 'Fluxygram',
      'play.title': 'Playground — Fluxygram',
      'play.preset': 'Ejemplo',
      'play.p.how': 'Cómo funciona Fluxygram',
      'play.p.order': 'Flujo: un pedido',
      'play.p.arch': 'Arquitectura: una app',
      'play.p.web': 'Línea de tiempo: la web',
      'play.source': 'JSON del diagrama',
      'play.valid': 'Válido',
      'play.incomplete': 'JSON incompleto',
      'play.errors1': '1 error',
      'play.errorsN': '{n} errores',
      'play.reset': 'Restablecer',
      '404.title': 'No encontrado — Fluxygram',
      '404.heading': 'Esta página no existe.',
      '404.lead': 'Puede que el diagrama se haya movido de lugar.',
      '404.back': 'Volver al inicio',
      'lang.switch': 'English',
    },
  };

  var KEY = 'fluxygram:lang';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage unavailable */ }
  var browser = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  var lang = saved === 'es' || saved === 'en' ? saved : /^es\b/i.test(browser) ? 'es' : 'en';
  var dict = STRINGS[lang];

  function t(key, params) {
    var s = dict[key] || STRINGS.en[key] || key;
    if (params) for (var k in params) s = s.replace('{' + k + '}', params[k]);
    return s;
  }

  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
    el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
      var parts = pair.split(':');
      el.setAttribute(parts[0], t(parts[1]));
    });
  });
  var titleKey = document.documentElement.getAttribute('data-i18n-title');
  if (titleKey) document.title = t(titleKey);
  var desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('meta.description'));

  document.querySelectorAll('[data-lang-switch]').forEach(function (btn) {
    btn.textContent = t('lang.switch');
    btn.setAttribute('lang', lang === 'es' ? 'en' : 'es');
    btn.addEventListener('click', function () {
      try { localStorage.setItem(KEY, lang === 'es' ? 'en' : 'es'); } catch (e) { /* storage unavailable */ }
      location.reload();
    });
  });

  window.FLUXY_I18N = { lang: lang, t: t };
})();
