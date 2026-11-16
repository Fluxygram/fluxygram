import { Plugin } from 'obsidian';
import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';

/**
 * Fluxygram for Obsidian: a ```fluxygram code block with the diagram JSON becomes an animated diagram
 * in reading view and live preview. It follows Obsidian's light or dark theme.
 */
export default class FluxygramPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('fluxygram', (source, el) => {
      const diagram = el.createEl('fluxy-gram' as keyof HTMLElementTagNameMap) as unknown as FluxyGram;
      this.applyTheme(diagram);
      // The component shows its own friendly error if the JSON is wrong.
      diagram.diagram = source;
    });
    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        for (const d of document.querySelectorAll<FluxyGram>('fluxy-gram')) this.applyTheme(d);
      }),
    );
  }

  private applyTheme(el: HTMLElement) {
    el.setAttribute('theme', document.body.classList.contains('theme-dark') ? 'dark' : 'light');
  }
}
