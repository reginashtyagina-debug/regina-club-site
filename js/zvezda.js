// «От Анонима до Звезды»: ссылка записи, раскрытие модулей, цели Метрики.
import { CONFIG } from './config.js';
import { initAnalytics, goal } from './analytics.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const NBSP = ' ';
const money = (n) => new Intl.NumberFormat('ru-RU').format(n).replace(/\s/g, NBSP) + NBSP + '₽';

const cfg = CONFIG.zvezda || {};

// Цена берётся из config.js, чтобы она совпадала везде
$$('[data-zv-price]').forEach((el) => { if (cfg.price) el.textContent = money(cfg.price); });

// Кнопка записи: GetCourse, а пока ссылки нет — Telegram-канал. UTM-метки передаются дальше.
$$('[data-zv-cta]').forEach((a) => {
  const url = isUrl(cfg.url) ? cfg.url : CONFIG.links && CONFIG.links.telegram;
  if (!isUrl(url)) return;
  const target = new URL(url);
  new URLSearchParams(location.search).forEach((v, k) => {
    if (k.startsWith('utm_') && !target.searchParams.has(k)) target.searchParams.append(k, v);
  });
  a.href = target.toString();
  a.target = '_blank';
  a.rel = 'noopener';
  a.addEventListener('click', () => goal('zv_signup', { source: isUrl(cfg.url) ? 'getcourse' : 'telegram' }));
});

// «Раскрыть все модули» / «Свернуть»
const toggle = $('[data-modules-toggle]');
const modules = $$('.zv-module');
if (toggle && modules.length) {
  const sync = () => {
    const allOpen = modules.every((m) => m.open);
    toggle.textContent = allOpen ? 'Свернуть модули' : 'Раскрыть все модули';
  };
  toggle.addEventListener('click', () => {
    const open = !modules.every((m) => m.open);
    modules.forEach((m) => { m.open = open; });
    sync();
    if (open) goal('zv_modules_all');
  });
  modules.forEach((m) => m.addEventListener('toggle', sync));
  sync();
}

$$('[data-goal]').forEach((a) => a.addEventListener('click', () => goal(a.dataset.goal)));

initAnalytics();
