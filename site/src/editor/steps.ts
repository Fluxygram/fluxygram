import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide';
import { t } from '../i18n';
import { h, icon } from './dom';
import type { Model, StepMode } from './model';


const MODES: StepMode[] = ['show', 'flow', 'highlight', 'focus', 'state'];

/**
 * Barra inferior: los pasos (elegir, agregar, reordenar) y, con uno seleccionado, qué se marca en el lienzo.
 * El texto, las notas del presentador y la duración del paso se editan en el panel derecho.
 */
export function renderSteps(root: HTMLElement, model: Model) {
  if (root.contains(document.activeElement) && ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement).tagName)) return;
  const steps = model.diagram.steps ?? [];
  const i = model.step;
  root.replaceChildren();

  root.append(h('span', { class: 'ed-steps-label' }, t('ed.steps')));

  if (!steps.length) {
    root.append(h('span', { class: 'ed-auto', title: t('ed.autoHint') }, t('ed.autoSteps')));
    root.append(
      h('button', { type: 'button', class: 'ed-btn', disabled: !model.diagram.nodes.length, onclick: () => model.materializeSteps() }, t('ed.makeSteps')),
      h('button', { type: 'button', class: 'ed-icon', title: t('ed.addStep'), 'aria-label': t('ed.addStep'), disabled: !model.diagram.nodes.length, onclick: () => model.addStep() }, icon(Plus)),
    );
    root.append(h('p', { class: 'ed-hint' }, t('ed.makeStepsHint')));
    return;
  }

  steps.forEach((s, k) =>
    root.append(
      h('button', {
        type: 'button', class: `ed-step${s.notes ? ' has-notes' : ''}`, 'aria-pressed': String(i === k),
        title: s.caption ? `${k + 1}. ${s.caption}` : t('ed.step', { n: String(k + 1) }),
        onclick: () => model.setStep(i === k ? null : k),
      }, String(k + 1)),
    ),
  );
  root.append(
    h('button', { type: 'button', class: 'ed-icon', title: t('ed.addStep'), 'aria-label': t('ed.addStep'), onclick: () => model.addStep() }, icon(Plus)),
  );

  if (i === null || !steps[i]) {
    root.append(h('p', { class: 'ed-hint' }, t('ed.pickStepHint')));
    return;
  }

  root.append(h('span', { class: 'ed-sep' }));
  root.append(
    h('div', { class: 'ed-seg', role: 'radiogroup' },
      ...MODES.map((m) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(model.stepMode === m), onclick: () => model.setStepMode(m) }, t(`ed.mode.${m}`)),
      ),
    ),
  );
  root.append(
    h('span', { class: 'ed-spacer' }),
    h('button', { type: 'button', class: 'ed-icon', title: t('ed.stepLeft'), 'aria-label': t('ed.stepLeft'), disabled: i === 0, onclick: () => model.moveStep(i, -1) }, icon(ArrowLeft)),
    h('button', { type: 'button', class: 'ed-icon', title: t('ed.stepRight'), 'aria-label': t('ed.stepRight'), disabled: i === steps.length - 1, onclick: () => model.moveStep(i, 1) }, icon(ArrowRight)),
    h('button', { type: 'button', class: 'ed-icon', title: t('ed.removeStep'), 'aria-label': t('ed.removeStep'), onclick: () => model.removeStep(i) }, icon(Trash2)),
    h('button', { type: 'button', class: 'ed-btn', onclick: () => model.setStep(null) }, t('ed.done')),
  );
  root.append(h('p', { class: 'ed-hint' }, t(`ed.hint.${model.stepMode}`)));
}
