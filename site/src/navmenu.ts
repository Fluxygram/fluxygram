import { t } from './i18n';

/**
 * Menú de la navegación en pantallas angostas: los enlaces, GitHub y el idioma se pliegan en un panel
 * que abre un botón. La cuenta queda siempre a la vista, junto al botón. En pantallas anchas no cambia nada.
 */
export function mountNavMenu(header: HTMLElement) {
  const links = header.querySelector<HTMLElement>('.nav-links');
  if (!links || header.querySelector('.nav-menu')) return;

  const end = document.createElement('div');
  end.className = 'nav-end';
  links.replaceWith(end);
  links.id ||= 'navLinks';
  const account = links.querySelector<HTMLElement>('#account');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-menu';
  button.setAttribute('aria-controls', links.id);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', t('nav.menu'));
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="nav-menu-top" d="M4 8h16"/><path class="nav-menu-bottom" d="M4 16h16"/></svg>';

  end.append(links);
  if (account) end.append(account);
  end.append(button);

  const setOpen = (open: boolean) => {
    header.classList.toggle('nav-open', open);
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => setOpen(!header.classList.contains('nav-open')));
  links.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (header.classList.contains('nav-open') && !header.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('nav-open')) {
      setOpen(false);
      button.focus();
    }
  });
  // Al pasar a pantalla ancha el panel deja de existir: se cierra para no quedar abierto al volver.
  matchMedia('(min-width: 721px)').addEventListener('change', (e) => e.matches && setOpen(false));
}
