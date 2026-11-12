import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { exampleUrl } from './i18n';

const hero = document.querySelector<FluxyGram>('#hero')!;
hero.setAttribute('src', exampleUrl(hero.dataset.example!));

const example = document.querySelector<FluxyGram>('#example')!;
const json = document.querySelector<HTMLElement>('#example-json')!;
const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tab')];

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
