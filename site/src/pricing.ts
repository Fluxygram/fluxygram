import './lang';
import { goPro, initSiteAccount, loadMe, openPortal, renderSignInButtons, track } from './cloud';
import { t } from './i18n';

/**
 * Página de precios. Los precios se ven siempre (los pide el proveedor de pagos y sirven sin Cloud);
 * el botón de Pro depende de la cuenta: sin sesión pide iniciar sesión, con sesión abre el pago de Polar,
 * y si ya es Pro lleva al portal para gestionar la suscripción.
 */
const PRICES = { month: { price: 5, per: 'pricing.perMonth', billed: 'pricing.billedMonthly' }, year: { price: 4, per: 'pricing.perMonth', billed: 'pricing.billedYearly' } };

void initSiteAccount(document.getElementById('account')!);

const params = new URLSearchParams(location.search);
// De dónde llega la persona: ?from= (aviso de Pro, menú) o, si no, la página anterior.
const from = (() => {
  const asked = params.get('from');
  if (asked) return asked;
  if (params.has('buy')) return 'pricing';
  const ref = document.referrer;
  if (!ref) return 'direct';
  if (ref.includes('docs.fluxygram.app')) return 'docs';
  if (ref.startsWith(location.origin)) return new URL(ref).pathname === '/' ? 'landing' : 'nav';
  return 'other';
})();
if (from !== 'pricing') track('pricing_view', from);
if (params.has('from')) history.replaceState(null, '', location.pathname + (params.has('buy') ? `?buy=${params.get('buy')}` : ''));
let interval: 'month' | 'year' = params.get('buy') === 'month' ? 'month' : 'year';
const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-interval]')];
const price = document.getElementById('proPrice')!;
const per = document.getElementById('proPer')!;
const billed = document.getElementById('proBilled')!;
const cta = document.getElementById('proCta') as HTMLButtonElement;
const note = document.getElementById('proNote')!;
const signin = document.getElementById('proSignin')!;

function showInterval() {
  for (const b of toggles) b.setAttribute('aria-checked', String(b.dataset.interval === interval));
  const p = PRICES[interval];
  price.textContent = `$${p.price}`;
  per.textContent = t(p.per);
  billed.textContent = t(p.billed);
}
for (const b of toggles) {
  b.addEventListener('click', () => {
    interval = b.dataset.interval as 'month' | 'year';
    showInterval();
  });
}
showInterval();

const say = (key: string) => {
  note.textContent = t(key);
  note.hidden = false;
};

const me = await loadMe();
if (me === undefined) {
  // Sin Cloud (instalación propia o sin red): los precios se ven, pero no hay a dónde pagar.
  cta.disabled = true;
  say('pricing.unavailable');
} else if (me.signedIn && me.user.plan === 'pro') {
  cta.textContent = t('pricing.manage');
  cta.classList.remove('btn-primary');
  cta.onclick = () => void openPortal(() => say('cloud.error'));
  say('pricing.youArePro');
} else if (me.signedIn && !me.billing?.available) {
  cta.disabled = true;
  say('pricing.soon');
} else {
  let resumed = false; // al volver del inicio de sesión, el clic ya se contó antes
  cta.onclick = async () => {
    if (!resumed) track('pro_click', 'pricing', interval);
    if (!me.signedIn) {
      // Al volver del inicio de sesión, ?buy= retoma el pago con el periodo elegido.
      signin.hidden = false;
      renderSignInButtons(document.getElementById('proSigninButtons')!, me.providers, `/pricing?buy=${interval}`);
      cta.hidden = true;
      return;
    }
    cta.disabled = true;
    cta.textContent = t('pricing.opening');
    const ok = await goPro(interval);
    if (!ok) {
      cta.disabled = false;
      cta.textContent = t('pricing.pro.cta');
      say('cloud.error');
    }
  };
  if (me.signedIn && params.has('buy')) {
    history.replaceState(null, '', location.pathname);
    resumed = true;
    cta.click();
  }
}
