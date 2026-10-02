// Яндекс Метрика: счётчик подключается, только если в config.js указан metrikaId.
// Цели отправляются через reachGoal; до загрузки счётчика они встают в очередь.

import { CONFIG } from './config.js';

const id = Number(CONFIG.metrikaId) || 0;
const demo = new URLSearchParams(location.search).has('demo');

export function initAnalytics() {
  if (!id || demo) return;
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  const load = () => {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://mc.yandex.ru/metrika/tag.js';
    document.head.appendChild(s);
  };
  if (document.readyState === 'complete') setTimeout(load, 0);
  else window.addEventListener('load', () => setTimeout(load, 0), { once: true });
}

export function goal(name, params) {
  if (demo) { console.info('[цель]', name, params || ''); return; }
  if (id && window.ym) window.ym(id, 'reachGoal', name, params);
}
