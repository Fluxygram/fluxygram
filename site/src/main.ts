import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { exampleUrl } from './i18n';
import './agents';
import './lang';
import { applySpecular } from './vendor/specular-button';
import { SPECULAR } from './specular';
import { mountTechText } from './vendor/tech-text';

const hero = document.querySelector<FluxyGram>('#hero')!;
hero.setAttribute('src', exampleUrl(hero.dataset.example!));

const example = document.querySelector<FluxyGram>('#example')!;
const json = document.querySelector<HTMLElement>('#example-json')!;
const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tab[data-example]')];

async function show(name: string) {
  const res = await fetch(exampleUrl(name));
  const text = await res.text();
  json.textContent = text;
  example.diagram = text;
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const t of tabs) t.setAttribute('aria-selected', String(t === tab));
    void show(tab.dataset.example!);
  });
}

void show('order');

// La marca gigante al final: las letras se seleccionan como bloques del editor.
mountTechText(document.querySelector<HTMLElement>('#wordmark')!, {
  text: 'fluxygram',
  fontWeight: 600,
  fontSize: 260,
  letterSpacing: -0.055,
  accentColor: '#2bff88',
  intro: 'metrics',
  introDuration: 2.2,
  speed: 0.6,
});

// "Ver en GitHub": botón de cristal cuyo borde se enciende hacia el cursor. El verde sigue siendo la acción principal.
const github = document.querySelector<HTMLElement>('.hero .cta a.btn:not(.btn-primary)');
if (github) applySpecular(github, SPECULAR);
