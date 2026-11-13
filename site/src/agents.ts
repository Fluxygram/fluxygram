import { lang, t } from './i18n';

/**
 * "Úsalo con tu agente": instrucciones y prompts listos para copiar, para cada agente.
 * Los agentes de chat reciben la skill completa dentro del prompt; los de código la instalan.
 */

const SITE = location.origin;
const EDITOR = `${SITE}/play`;

type Agent = { id: string; label: string; kind: 'claude-code' | 'coding' | 'chat'; open?: string };

const AGENTS: Agent[] = [
  { id: 'claude-code', label: 'Claude Code', kind: 'claude-code' },
  { id: 'coding', label: 'Cursor · Codex · Copilot', kind: 'coding' },
  { id: 'chatgpt', label: 'ChatGPT', kind: 'chat', open: 'https://chatgpt.com/' },
  { id: 'gemini', label: 'Gemini', kind: 'chat', open: 'https://gemini.google.com/app' },
  { id: 'claude', label: 'Claude', kind: 'chat', open: 'https://claude.ai/new' },
];

let skillText: string | undefined;
async function skill() {
  skillText ??= await (await fetch('/skill.md')).text();
  return skillText;
}

async function copy(text: string, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = t('agents.copied');
    button.classList.add('is-done');
    setTimeout(() => {
      button.textContent = t('agents.copy');
      button.classList.remove('is-done');
    }, 1800);
  } catch {
    button.textContent = t('agents.copyFail');
  }
}

/** Un bloque de código con su botón de copiar. */
function codeBlock(text: string, getText: () => string | Promise<string> = () => text) {
  const wrap = document.createElement('div');
  wrap.className = 'ag-copy';
  const pre = document.createElement('pre');
  pre.className = 'code';
  pre.textContent = text;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ag-copy-btn';
  btn.textContent = t('agents.copy');
  btn.onclick = async () => copy(await getText(), btn);
  wrap.append(pre, btn);
  return wrap;
}

function step(...children: (Node | string)[]) {
  const li = document.createElement('li');
  li.append(...children);
  return li;
}

/** Prompt para agentes de chat: el pedido del usuario + la skill completa. */
async function chatPrompt(topic: string) {
  const ask = topic.trim() || t('agents.topicFallback');
  return [
    t('agents.prompt.intro'),
    '',
    `${t('agents.prompt.topic')} ${ask}`,
    '',
    t('agents.prompt.reply', { editor: EDITOR }),
    t('agents.prompt.lang'),
    '',
    '---',
    '',
    await skill(),
  ].join('\n');
}

function panelFor(agent: Agent): HTMLElement {
  const box = document.createElement('div');
  box.className = 'ag-panel';
  const ol = document.createElement('ol');
  ol.className = 'ag-steps';

  if (agent.kind === 'claude-code') {
    ol.append(
      step(t('agents.cc.1'), codeBlock('/plugin marketplace add Fluxygram/fluxygram\n/plugin install fluxygram@fluxygram')),
      step(t('agents.cc.2'), codeBlock(t('agents.cc.example'))),
      step(t('agents.cc.3')),
    );
  } else if (agent.kind === 'coding') {
    ol.append(
      step(t('agents.code.1'), codeBlock(`curl -o FLUXYGRAM.md ${SITE}/skill.md`)),
      step(t('agents.code.2'), codeBlock(t('agents.code.example'))),
      step(t('agents.code.3')),
    );
  } else {
    const input = document.createElement('input');
    input.className = 'ag-input';
    input.placeholder = t('agents.topicPh');
    input.setAttribute('aria-label', t('agents.topicPh'));
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-primary';
    copyBtn.textContent = t('agents.copyPrompt');
    copyBtn.onclick = async () => {
      await copy(await chatPrompt(input.value), copyBtn);
      setTimeout(() => (copyBtn.textContent = t('agents.copyPrompt')), 1900);
    };
    const open = document.createElement('a');
    open.className = 'btn';
    open.href = agent.open!;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = t('agents.open', { agent: agent.label });
    const row = document.createElement('div');
    row.className = 'ag-row';
    row.append(input);
    const actions = document.createElement('div');
    actions.className = 'ag-row';
    actions.append(copyBtn, open);
    const editor = document.createElement('a');
    editor.href = '/play';
    editor.textContent = t('agents.editorLink');
    ol.append(
      step(t('agents.chat.1'), row),
      step(t('agents.chat.2', { agent: agent.label }), actions),
      step(t('agents.chat.3'), ' ', editor),
    );
  }
  box.append(ol);
  return box;
}

const tabs = document.getElementById('agentTabs');
const panel = document.getElementById('agentPanel');
if (tabs && panel) {
  const buttons = AGENTS.map((agent, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.textContent = agent.label;
    b.onclick = () => {
      buttons.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      panel.replaceChildren(panelFor(agent));
    };
    b.setAttribute('aria-selected', String(i === 0));
    return b;
  });
  tabs.append(...buttons);
  panel.replaceChildren(panelFor(AGENTS[0]!));
}

// Los bloques de instalación estáticos también llevan su botón de copiar.
for (const wrap of document.querySelectorAll<HTMLElement>('#install .ag-copy')) {
  const pre = wrap.querySelector('pre')!;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ag-copy-btn';
  btn.textContent = t('agents.copy');
  btn.onclick = () => copy(pre.textContent ?? '', btn);
  wrap.append(btn);
}

void lang;
