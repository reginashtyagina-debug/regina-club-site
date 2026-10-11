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

// Диагностика: стадия с наибольшим числом отметок (при равенстве — более поздняя)
const diag = $('[data-diag]');
const out = $('[data-diag-result]');
if (diag && out) {
  const names = ['Аноним', 'Узнают', 'Интересуются', 'Признают', 'Я-Звезда', 'Я-Легенда'];
  let tracked = false;
  diag.addEventListener('change', () => {
    const count = {};
    $$('input:checked', diag).forEach((c) => { count[c.dataset.stage] = (count[c.dataset.stage] || 0) + 1; });
    const max = Math.max(0, ...Object.values(count));
    const top = max ? Math.max(...Object.keys(count).filter((k) => count[k] === max).map(Number)) : 0;
    $$('.zv-diag__row', diag).forEach((r) => r.classList.toggle('is-top', Number(r.dataset.stage) === top));
    out.hidden = !top;
    if (top) {
      const next = top === 1
        ? 'Начните с <a href="https://reginashtyagina.ru/club">Делового клуба</a>: там проходится шаг от Анонима до Узнают.'
        : top <= 3
          ? 'Ваш следующий шаг — эта программа: она ведёт к стадии «Признают».'
          : 'Следующий шаг — годовое сопровождение: путь к стадии «Я-Звезда».';
      out.innerHTML = 'Ваша стадия: <em>' + top + '. ' + names[top - 1] + '</em><span>' + next + '</span>';
    }
    if (top && !tracked) { goal('zv_diagnostics'); tracked = true; }
  });
}

initAnalytics();
