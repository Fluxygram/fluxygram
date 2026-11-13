import { json, jsonParseLinter } from '@codemirror/lang-json';
import { HighlightStyle, foldGutter, syntaxHighlighting, syntaxTree, bracketMatching, indentOnInput, foldKeymap } from '@codemirror/language';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { EditorState, type Text } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import type { SyntaxNode } from '@lezer/common';
import { validate, type Locale, type ValidationIssue } from '@fluxygram/core';

/* ---------- Tema: los colores de Fluxygram ---------- */

const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'transparent', color: '#f3f3f6' },
    '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, monospace", lineHeight: '1.65' },
    '.cm-content': { padding: '10px 0', caretColor: '#2bff88' },
    '.cm-gutters': { backgroundColor: 'transparent', color: '#4d4d59', border: 'none' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#9b9ba8' },
    '.cm-activeLine': { backgroundColor: 'rgb(255 255 255 / 0.03)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgb(43 255 136 / 0.18) !important' },
    '.cm-cursor': { borderLeftColor: '#2bff88' },
    '&.cm-focused .cm-matchingBracket': { backgroundColor: 'rgb(43 255 136 / 0.16)', outline: 'none' },
    '.cm-foldGutter span': { color: '#4d4d59' },
    '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy #ff5c5c', textUnderlineOffset: '3px' },
    '.cm-tooltip': { backgroundColor: '#16161c', border: '1px solid #2a2a33', borderRadius: '8px', color: '#f3f3f6' },
    '.cm-diagnostic-error': { borderLeft: '3px solid #ff5c5c' },
    '.cm-gutter-lint .cm-lint-marker-error': { content: 'none' },
  },
  { dark: true },
);

const colors = HighlightStyle.define([
  { tag: tags.propertyName, color: '#c9c9d4' },
  { tag: tags.string, color: '#2bff88' },
  { tag: tags.number, color: '#ffb020' },
  { tag: [tags.bool, tags.null], color: '#ff8fa3' },
  { tag: [tags.brace, tags.squareBracket, tags.separator, tags.punctuation], color: '#6e6e7a' },
]);

/* ---------- Ubicar un error del validador en el texto ---------- */

/** "nodes[2].label" → ["nodes", 2, "label"] */
function parsePath(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const m of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) out.push(m[2] !== undefined ? Number(m[2]) : m[1]!);
  return out;
}

/** Busca en el árbol del JSON el rango que corresponde a una ruta. Devuelve el más profundo que encuentre. */
function rangeOf(state: EditorState, doc: Text, path: string): { from: number; to: number } {
  const top = syntaxTree(state).topNode.firstChild;
  let node: SyntaxNode | null = top;
  let keyNode: SyntaxNode | null = null;
  for (const seg of parsePath(path)) {
    if (!node) break;
    if (typeof seg === 'number' && node.name === 'Array') {
      const values: SyntaxNode[] = [];
      for (let c = node.firstChild; c; c = c.nextSibling) if (!['[', ']', ','].includes(c.name)) values.push(c);
      const next: SyntaxNode | undefined = values[seg];
      if (!next) break;
      node = next;
      keyNode = null;
    } else if (typeof seg === 'string' && node.name === 'Object') {
      let found: SyntaxNode | null = null;
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.name !== 'Property') continue;
        const name = c.getChild('PropertyName');
        if (name && doc.sliceString(name.from, name.to) === JSON.stringify(seg)) found = c;
      }
      if (!found) break;
      keyNode = found.getChild('PropertyName');
      node = found.lastChild;
    } else break;
  }
  const target = node ?? top;
  if (!target) return { from: 0, to: Math.min(1, doc.length) };
  // Valores largos (objetos, listas): se marca solo su clave para no subrayar medio archivo.
  if ((target.name === 'Object' || target.name === 'Array') && keyNode) return { from: keyNode.from, to: keyNode.to };
  if (target.name === 'Object' || target.name === 'Array') return { from: target.from, to: target.from + 1 };
  return { from: target.from, to: target.to };
}

export interface JsonEditor {
  view: EditorView;
  setValue(text: string): void;
  getValue(): string;
  format(): void;
  hasFocus(): boolean;
  goTo(path: string): void;
}

/**
 * Editor de JSON con colores, números de línea, plegado y errores marcados en su línea:
 * los de sintaxis (JSON mal formado) y los del validador de Fluxygram (ids que no existen, valores inválidos…).
 */
export function createJsonEditor(
  parent: HTMLElement,
  opts: { locale: Locale; onChange: (text: string) => void; onIssues: (issues: ValidationIssue[] | 'syntax' | null) => void },
): JsonEditor {
  const parseLint = jsonParseLinter();
  const fluxLint = linter(
    (view) => {
      const syntax = parseLint(view);
      if (syntax.length) {
        opts.onIssues('syntax');
        return syntax;
      }
      let data: unknown;
      try {
        data = JSON.parse(view.state.doc.toString());
      } catch {
        return [];
      }
      const result = validate(data, { locale: opts.locale });
      if (result.ok) {
        opts.onIssues(null);
        return [];
      }
      opts.onIssues(result.issues);
      return result.issues.map<Diagnostic>((issue) => ({
        ...rangeOf(view.state, view.state.doc, issue.path),
        severity: 'error',
        message: issue.message,
      }));
    },
    { delay: 350 },
  );

  let silent = false;
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        lineNumbers(),
        foldGutter(),
        lintGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        json(),
        fluxLint,
        theme,
        syntaxHighlighting(colors),
        EditorState.tabSize.of(2),
        // El panel es angosto: las líneas largas saltan en vez de obligar a desplazarse de lado.
        EditorView.lineWrapping,
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !silent) opts.onChange(u.state.doc.toString());
        }),
        EditorView.contentAttributes.of({ 'aria-label': 'JSON' }),
      ],
    }),
  });

  const api: JsonEditor = {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(text) {
      if (text === view.state.doc.toString()) return;
      silent = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
      silent = false;
    },
    format() {
      try {
        const pretty = JSON.stringify(JSON.parse(view.state.doc.toString()), null, 2);
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: pretty } });
      } catch {
        /* con errores de sintaxis no se puede formatear: el subrayado ya los muestra */
      }
    },
    hasFocus: () => view.hasFocus,
    goTo(path) {
      const r = rangeOf(view.state, view.state.doc, path);
      view.dispatch({ selection: { anchor: r.from, head: r.to }, scrollIntoView: true });
      view.focus();
    },
  };
  return api;
}
