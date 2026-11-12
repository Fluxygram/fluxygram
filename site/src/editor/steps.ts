import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide';
import { t } from '../i18n';
import { h, icon } from './dom';
import type { Model, StepMode } from './model';

const MODES: StepMode[] = ['show', 'flow', 'highlight', 'focus', 'state'];

/** Barra inferior: lista de pasos y, con uno seleccionado, qué hace ese paso. */
export function renderSteps(root: HTMLElement, model: Model) {
  if (root.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName === 'INPUT') return;
  const steps = model.diagram.steps ?? [];
  const i = model.step;
  root.replaceChildren();

  root.append(h('span', { class: 'ed-steps-label' }, t('ed.steps')));
  if (!steps.length) root.append(h('span', { class: 'ed-auto', title: t('ed.autoHint') }, t('ed.autoSteps')));
  steps.forEach((_, k) =>
    root.append(
      h('button', {
        type: 'button', class: 'ed-step', 'aria-pressed': String(i === k), title: t('ed.step', { n: String(k + 1) }),
        onclick: () => model.setStep(i === k ? null : k),
      }, String(k + 1)),
    ),
  );
  root.append(
    h('button', { type: 'button', class: 'ed-icon', title: t('ed.addStep'), 'aria-label': t('ed.addStep'), disabled: !model.diagram.nodes.length, onclick: () => model.addStep() }, icon(Plus)),
  );

  if (i === null || !steps[i]) return;
  const step = steps[i]!;

  root.append(h('span', { class: 'ed-sep' }));
  root.append(
    h('div', { class: 'ed-seg', role: 'radiogroup' },
      ...MODES.map((m) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(model.stepMode === m), onclick: () => model.setStepMode(m) }, t(`ed.mode.${m}`)),
      ),
    ),
  );

  let timer: number | undefined;
  const caption = h('input', { type: 'text', class: 'ed-caption', value: step.caption ?? '', placeholder: t('ed.caption'), maxlength: 120 });
  const commit = () => {
    clearTimeout(timer);
    if (caption.value.trim() !== (step.caption ?? '')) model.setCaption(caption.value.trim());
  };
  caption.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(commit, 600);
  });
  caption.addEventListener('blur', commit);
  caption.addEventListener('keydown', (e) => e.key === 'Enter' && caption.blur());
  root.append(caption);

  // Tiempo de este paso: vacío = el del diagrama (o automático).
  const fallback = model.diagram.motion?.hold;
  const seconds = h('input', {
    type: 'number', class: 'ed-seconds', min: 0.5, max: 60, step: 0.5,
    value: step.duration ?? '', placeholder: fallback ? String(fallback) : t('ed.auto.short'),
    title: t('ed.stepTime'), 'aria-label': t('ed.stepTime'),
  });
  seconds.addEventListener('change', () => {
    const v = Number(seconds.value);
    model.setStepDuration(v >= 0.5 && v <= 60 ? v : undefined);
  });
  root.append(h('label', { class: 'ed-seconds-wrap', title: t('ed.stepTime') }, seconds, h('span', {}, 's')));

  root.append(
    h('button', { type: 'button', class: 'ed-icon', title: t('ed.stepLeft'), 'aria-label': t('ed.stepLeft'), disabled: i === 0, onclick: () => model.moveStep(i, -1) }, icon(ArrowLeft)),
    h('button', { type: 'button', class: 'ed-icon', title: t('ed.stepRight'), 'aria-label': t('ed.stepRight'), disabled: i === steps.length - 1, onclick: () => model.moveStep(i, 1) }, icon(ArrowRight)),
    h('button', { type: 'button', class: 'ed-icon', title: t('ed.removeStep'), 'aria-label': t('ed.removeStep'), onclick: () => model.removeStep(i) }, icon(Trash2)),
    h('button', { type: 'button', class: 'ed-btn', onclick: () => model.setStep(null) }, t('ed.done')),
  );
  root.append(h('p', { class: 'ed-hint' }, t(`ed.hint.${model.stepMode}`)));
}
