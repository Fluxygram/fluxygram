import { mountTechText } from './vendor/tech-text';

mountTechText(document.querySelector<HTMLElement>('#wordmark404')!, {
  text: '404',
  fontWeight: 600,
  fontSize: 220,
  letterSpacing: -0.04,
  accentColor: '#2bff88',
  intro: 'assemble',
  introDuration: 1.6,
  speed: 0.6,
});
