import { CONFIG, asset } from './config.js';
import { initAnalytics, goal } from './analytics.js';
import { setupLogo } from './logo.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Форматирование ---------- */

const NBSP = ' ';
const money = (n) => new Intl.NumberFormat('ru-RU').format(n).replace(/\s/g, NBSP) + NBSP + '₽';

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const days = (n) => n + NBSP + plural(n, 'день', 'дня', 'дней');
const months = (n) => n + NBSP + plural(n, 'месяц', 'месяца', 'месяцев');

function cfgValue(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), CONFIG);
}

function fillConfig() {
  $$('[data-cfg]').forEach((el) => {
    const v = cfgValue(el.dataset.cfg);
    if (typeof v !== 'number') return;
    const unit = el.dataset.unit;
    el.textContent = unit === 'days' ? days(v) : unit === 'months' ? months(v) : money(v);
  });
  $$('[data-per-month]').forEach((el) => {
    const { price, months: m } = CONFIG.year;
    if (price && m) el.textContent = '=' + NBSP + money(Math.round(price / m)) + ' в' + NBSP + 'месяц';
  });
  $$('[data-text="subtitle"]').forEach((el) => { el.textContent = CONFIG.subtitle; });
  $$('[data-text="legal"]').forEach((el) => { if (CONFIG.legal) el.textContent = CONFIG.legal; else el.hidden = true; });
}

function template(text) {
  return text
    .replaceAll('{trialPrice}', money(CONFIG.trial.price))
    .replaceAll('{yearPrice}', money(CONFIG.year.price))
    .replaceAll('{creditedYearPrice}', money(CONFIG.creditedYearPrice))
    .replaceAll('{creditWindow}', days(CONFIG.creditWindowDays));
}

const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const isTodo = (t) => typeof t === 'string' && t.includes('[ЗАПОЛНИТЬ');

// Плейсхолдеры [ЗАПОЛНИТЬ …] видны только в режиме ?demo=1
function renderTodo(el, text) {
  const parts = text.split(/(\[ЗАПОЛНИТЬ[^\]]*\])/);
  el.textContent = '';
  parts.forEach((part) => {
    if (!part) return;
    if (part.startsWith('[ЗАПОЛНИТЬ')) {
      const mark = document.createElement('span');
      mark.className = 'tbd';
      mark.textContent = part;
      el.append(mark);
    } else el.append(part);
  });
}

/* ---------- Источник трафика и акцент пакета ---------- */

function detectAccent() {
  const from = params.get('from');
  let warm = !!from && CONFIG.warmFrom.includes(from);
  if (!warm && document.referrer && CONFIG.warmReferrers.length) {
    warm = CONFIG.warmReferrers.some((part) => part && document.referrer.includes(part));
  }
  document.documentElement.dataset.accent = warm ? 'year' : 'trial';
  return warm ? 'year' : 'trial';
}

function trackingParams() {
  const out = new URLSearchParams();
  params.forEach((value, key) => {
    if (key.startsWith('utm_') || key === 'from') out.append(key, value);
  });
  return out;
}

function setupCheckoutLinks() {
  const passOn = trackingParams();
  $$('[data-checkout]').forEach((a) => {
    const plan = a.dataset.checkout;
    const url = CONFIG[plan] && CONFIG[plan].url;
    if (isUrl(url)) {
      const target = new URL(url);
      passOn.forEach((value, key) => { if (!target.searchParams.has(key)) target.searchParams.append(key, value); });
      a.href = target.toString();
    } else {
      a.href = '#terms';
      a.dataset.missing = '';
    }
    a.addEventListener('click', (e) => {
      goal(plan === 'trial' ? 'click_trial' : 'click_year', { block: a.dataset.block || 'unknown' });
      if (a.hasAttribute('data-missing')) console.warn('Ссылка GetCourse для «' + plan + '» не указана в js/config.js');
      // Формы GetCourse загружены на странице: кнопка открывает нужную форму окном
      // (или прокручивает к ней, если браузер не умеет окна)
      const form = CONFIG.payMode !== 'link' && document.getElementById('pay-' + plan);
      if (form) {
        e.preventDefault();
        if (CONFIG.payMode === 'modal') {
          // Окно не открылось (очень старый браузер) — ведём на страницу оплаты
          if (!openPayModal(plan, form)) location.href = a.href;
          return;
        }
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        goal('pay_open', { plan });
      }
    });
  });
}

/* ---------- Формы оплаты GetCourse на странице ---------- */

// Если форма не появилась за 10 секунд, показываем ссылку на отдельную страницу оплаты
function setupPayForms() {
  const section = $('#pay');
  if (section && CONFIG.payMode === 'inline') section.classList.add('is-inline');
  else if (section) section.setAttribute('aria-hidden', 'true');
  $$('[data-pay-form]').forEach((form) => {
    const plan = form.dataset.payForm;
    const link = $('[data-pay-fallback] a', form);
    if (link && isUrl(CONFIG[plan] && CONFIG[plan].url)) link.href = CONFIG[plan].url;
    setTimeout(() => {
      if (!form.querySelector('iframe, form')) $('[data-pay-fallback]', form).hidden = false;
    }, 10000);
  });
}

// Окно оплаты: форму GetCourse переносим из карточки в окно, после закрытия возвращаем обратно
function openPayModal(plan, form) {
  const dlg = $('[data-pay]');
  if (!dlg || typeof dlg.showModal !== 'function') return false;
  if (dlg.open) dlg.close();
  const c = CONFIG[plan];
  $('[data-pay-title]', dlg).textContent = (plan === 'trial' ? 'Тест-драйв' : 'Год в' + NBSP + 'клубе') + NBSP + '— ' + money(c.price);
  const parts = $$('.pay-form__box, [data-pay-fallback]', form);
  const body = $('[data-pay-body]', dlg);
  parts.forEach((el) => body.append(el));
  dlg.addEventListener('close', () => parts.forEach((el) => form.append(el)), { once: true });
  dlg.showModal();
  goal('pay_open', { plan });
  return true;
}

function setupPayDialog() {
  const dlg = $('[data-pay]');
  if (!dlg) return;
  $('[data-pay-close]', dlg).addEventListener('click', () => dlg.close());
  // Клик по затемнению вокруг окна закрывает его
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

// Кнопки первого экрана ведут к условиям: там видны цены и зачёт
function setupTermsLinks() {
  $$('[data-to-terms]').forEach((a) => {
    a.addEventListener('click', () => goal('hero_to_terms', { plan: a.dataset.toTerms }));
  });
}

function setupLinks() {
  $$('[data-link]').forEach((a) => {
    const url = CONFIG.links[a.dataset.link];
    if (isUrl(url) || (url && !url.startsWith('ССЫЛКА'))) {
      a.href = url;
      if (isUrl(url)) { a.target = '_blank'; a.rel = 'noopener'; }
    } else {
      // Нет ссылки: пункт подвала скрывается, чтобы не вести в пустоту.
      const li = a.closest('li, p');
      if (li && !DEMO) li.hidden = true;
    }
  });
  const { email, phone } = CONFIG.links;
  const emailEl = $('[data-contact="email"]');
  const phoneEl = $('[data-contact="phone"]');
  if (email && emailEl) { emailEl.innerHTML = ''; const a = document.createElement('a'); a.href = 'mailto:' + email; a.textContent = email; emailEl.append(a); emailEl.hidden = false; }
  if (phone && phoneEl) { phoneEl.innerHTML = ''; const a = document.createElement('a'); a.href = 'tel:' + phone.replace(/[^\d+]/g, ''); a.textContent = phone; phoneEl.append(a); phoneEl.hidden = false; }
}

/* ---------- Видео ---------- */

function setupVideo() {
  const root = $('[data-video]');
  if (!root) return;
  const frame = $('.video__frame', root);
  const posterEl = $('[data-video-poster]', root);
  const caption = $('[data-video-caption]', root);
  const toggle = $('[data-video-toggle]', root);
  const ev = CONFIG.eventVideo || {};
  if (ev.poster) posterEl.src = asset(ev.poster);
  if (ev.caption) caption.textContent = ev.caption;

  // Видео с мероприятия: без звука, по кругу, только пока первый экран виден
  let loop = null;
  const c = navigator.connection || {};
  if (ev.src && !reducedMotion && c.saveData !== true) {
    const startLoop = () => {
      loop = document.createElement('video');
      loop.className = 'video__loop';
      loop.muted = true; loop.loop = true; loop.playsInline = true;
      loop.setAttribute('muted', ''); loop.setAttribute('playsinline', '');
      loop.preload = 'auto';
      loop.poster = asset(ev.poster) || '';
      [[ev.src, 'video/mp4'], [ev.srcWebm, 'video/webm']].forEach(([u, type]) => {
        if (!u) return;
        const source = document.createElement('source');
        source.src = asset(u); source.type = type;
        loop.append(source);
      });
      loop.setAttribute('aria-hidden', 'true');
      posterEl.after(loop);
      let paused = false;
      const setPaused = (p) => {
        paused = p;
        toggle.classList.toggle('is-paused', p);
        toggle.setAttribute('aria-label', p ? 'Запустить видео' : 'Остановить видео');
        if (p) loop.pause(); else loop.play().catch(() => {});
      };
      toggle.hidden = false;
      toggle.addEventListener('click', () => setPaused(!paused));
      loop.addEventListener('playing', () => frame.classList.add('is-playing'), { once: true });
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) loop.pause();
        else if (!paused) loop.play().catch(() => {});
      }).observe(frame);
    };
    if (document.readyState === 'complete') setTimeout(startLoop, 300);
    else addEventListener('load', () => setTimeout(startLoop, 300), { once: true });
  }

  // Приветствие Регины со звуком: загружается только по нажатию
  const { src, poster } = CONFIG.video;
  if (!src) return;
  const play = $('[data-video-play]', root);
  play.hidden = false;
  play.addEventListener('click', () => {
    if (loop) loop.remove();
    toggle.remove();
    const video = document.createElement('video');
    video.src = asset(src);
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    if (poster) video.poster = asset(poster);
    let started = false;
    video.addEventListener('play', () => { if (!started) { started = true; goal('video_start'); } });
    video.addEventListener('ended', () => goal('video_complete'));
    frame.append(video);
    play.remove();
    posterEl.remove();
    caption.remove();
    video.play().catch(() => {});
    video.focus();
  }, { once: true });
}

/* ---------- Данные из JSON ---------- */

async function loadJson(path) {
  if (!path) return null;
  const url = DEMO ? path.replace(/^(.*\/)?([^/]+)$/, (m, dir, file) => (dir || '') + 'demo/' + file) : path;
  try {
    const res = await fetch(asset(url), { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

async function renderSchedule() {
  const data = await loadJson(CONFIG.scheduleJson);
  if (!Array.isArray(data)) return;
  const now = Date.now();
  const upcoming = data
    .map((e) => ({ ...e, t: Date.parse(e.date) }))
    .filter((e) => e.t && e.t >= now - 2 * 3600e3 && e.topic)
    .sort((a, b) => a.t - b.t);
  const meetings = upcoming.filter((e) => e.type !== 'state').slice(0, 4);
  const state = upcoming.find((e) => e.type === 'state');
  const list = [...meetings, ...(state ? [state] : [])].sort((a, b) => a.t - b.t);
  if (!list.length) return;

  const ol = $('[data-schedule]');
  list.forEach((e) => {
    const li = document.createElement('li');
    if (e.type === 'state') li.className = 'schedule__state';
    const d = new Date(e.t);
    const time = document.createElement('time');
    time.dateTime = d.toISOString();
    time.textContent = dateFmt.format(d) + ', ' + timeFmt.format(d);
    const topic = document.createElement('p');
    topic.className = 'schedule__topic';
    topic.textContent = e.type === 'state' ? 'Эфир «Состояние»: ' + e.topic : e.topic;
    li.append(time, topic);
    if (e.expert) {
      const ex = document.createElement('p');
      ex.className = 'schedule__expert';
      ex.textContent = e.expert;
      li.append(ex);
    }
    ol.append(li);
  });
  $('#schedule').hidden = false;
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function speakerCard(s) {
  const li = document.createElement('li');
  li.className = 'speaker';
  const wrap = document.createElement(isUrl(s.url) ? 'a' : 'div');
  if (isUrl(s.url)) { wrap.href = s.url; wrap.target = '_blank'; wrap.rel = 'noopener'; }
  const photo = document.createElement('div');
  photo.className = 'speaker__photo';
  if (s.photo) {
    const img = document.createElement('img');
    img.src = asset(s.photo); img.alt = s.name; img.loading = 'lazy'; img.decoding = 'async';
    img.width = 300; img.height = 300;
    photo.append(img);
  } else {
    photo.textContent = initials(s.name);
    photo.setAttribute('aria-hidden', 'true');
  }
  const name = document.createElement('p');
  name.className = 'speaker__name';
  name.textContent = s.name;
  wrap.append(photo, name);
  if (s.topic) {
    const topic = document.createElement('p');
    topic.className = 'speaker__topic';
    topic.textContent = s.topic;
    wrap.append(topic);
  }
  li.append(wrap);
  return li;
}

// Сетка: 12 главных карточек видны сразу (group: featured), остальные — по кнопке
// (group: more), в одной общей сетке.
async function renderSpeakers() {
  const data = await loadJson(CONFIG.speakersJson);
  if (!Array.isArray(data)) return;
  const valid = data.filter((s) => s && s.name && !s.name.startsWith('['));
  const people = valid.filter((s) => s.kind !== 'rubric');
  const rubrics = valid.filter((s) => s.kind === 'rubric');
  const groups = { featured: [], more: [] };
  people.forEach((s) => (groups[s.group] || groups.more).push(s));
  if (groups.featured.length < 4) return;

  Object.entries(groups).forEach(([g, list]) => {
    const ul = $(`[data-speakers="${g}"]`);
    list.forEach((s) => ul.append(speakerCard(s)));
  });

  const hiddenCount = groups.more.length;
  const countEl = $('[data-experts-count]');
  countEl.textContent = CONFIG.expertsNote || '';
  countEl.hidden = !CONFIG.expertsNote;
  const toggle = $('[data-experts-toggle]');
  const all = $('#experts-all');
  if (!hiddenCount) toggle.hidden = true;
  toggle.addEventListener('click', () => {
    const open = all.hidden;
    all.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Свернуть' : 'Ещё эксперты и\u00A0партнёры';
    if (open) goal('experts_expand');
  });

  if (rubrics.length) {
    const box = $('[data-rubrics]');
    rubrics.forEach((r) => {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = r.name;
      li.append(b, r.topic || '');
      box.append(li);
    });
    box.parentElement.hidden = false;
  }
  $('#speakers').hidden = false;
}

async function renderReviews() {
  const data = await loadJson(CONFIG.reviewsJson);
  if (!Array.isArray(data)) return;
  // Отзыв — либо текстом (name + text), либо скриншотом (src + alt)
  const list = data.filter((r) => r && ((r.text && r.name) || (r.src && r.alt)));
  if (!list.length) return;
  const ul = $('[data-reviews]');
  list.forEach((r) => {
    const li = document.createElement('li');
    if (r.text) {
      li.className = 'review';
      const q = document.createElement('blockquote');
      q.className = 'review__text';
      q.textContent = r.text;
      const who = document.createElement('p');
      who.className = 'review__who';
      const b = document.createElement('b');
      b.textContent = r.name;
      who.append(b);
      if (r.role) who.append(r.role);
      const src = document.createElement('p');
      src.className = 'review__source';
      src.textContent = r.source || 'Из закрытого чата клуба';
      li.append(q, who, src);
    } else {
      // Скриншот сообщения: по нажатию открывается в полном размере
      li.className = 'review review--shot';
      const a = document.createElement('a');
      a.href = asset(r.src); a.target = '_blank'; a.rel = 'noopener';
      const img = document.createElement('img');
      img.src = asset(r.src); img.alt = r.alt; img.loading = 'lazy'; img.decoding = 'async';
      img.width = r.width || 600; img.height = r.height || 1000;
      a.append(img);
      const src = document.createElement('p');
      src.className = 'review__source';
      src.textContent = r.source || 'Из закрытого чата клуба';
      li.append(a, src);
    }
    ul.append(li);
  });
  // Первая строка — 3 отзыва (на телефоне 2), остальные раскрываются ниже по кнопке
  const items = [...ul.children];
  const more = $('[data-reviews-more]');
  items.slice(3).forEach((li) => more.append(li));
  const wrap = $('[data-reviews-wrap]');
  const toggle = $('[data-reviews-toggle]');
  if (items.length > 2) {
    const label = 'Все ' + items.length + NBSP + plural(items.length, 'отзыв', 'отзыва', 'отзывов');
    toggle.firstElementChild.textContent = label;
    toggle.hidden = false;
    if (items.length === 3) toggle.classList.add('reviews__btn--mobile');
    toggle.addEventListener('click', () => {
      const open = !wrap.classList.contains('is-open');
      wrap.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.firstElementChild.textContent = open ? 'Свернуть' : label;
      if (open) goal('reviews_expand');
      else $('#reviews').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }
  $('#reviews').hidden = false;
}

/* ---------- Вопросы и ответы ---------- */

function renderFaq() {
  const root = $('[data-faq]');
  CONFIG.faq.forEach((item) => {
    if (!item || !item.q || !item.a) return;
    const text = template(item.a);
    if (isTodo(text) && !DEMO) return;
    const d = document.createElement('details');
    const s = document.createElement('summary');
    s.textContent = item.q;
    const p = document.createElement('p');
    renderTodo(p, text);
    d.append(s, p);
    d.addEventListener('toggle', () => { if (d.open) goal('faq_open', { question: item.q }); });
    root.append(d);
  });
  if (!root.children.length) $('#faq').hidden = true;
}

/* ---------- Основатель ---------- */

function setupFounder() {
  const el = $('[data-founder-photo]');
  if (!CONFIG.founderPhoto || !el) return;
  const img = document.createElement('img');
  img.src = asset(CONFIG.founderPhoto);
  img.alt = 'Регина Штягина';
  img.loading = 'lazy'; img.decoding = 'async'; img.width = 920; img.height = 1150;
  el.textContent = '';
  el.append(img);
}

/* ---------- Шкала пакетов ---------- */

function setupScale(accent) {
  const scale = $('[data-scale]');
  if (!scale) return;
  const buttons = $$('[data-scale-mode]', scale);

  function show(mode, animate) {
    scale.dataset.mode = mode;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scaleMode === mode)));
    scale.classList.remove('is-drawn');
    scale.classList.toggle('is-static', !animate || reducedMotion);
    void scale.offsetWidth; // новый старт анимации при каждом нажатии
    scale.classList.add('is-drawn');
  }

  show(accent, false);
  buttons.forEach((b) => b.addEventListener('click', () => {
    show(b.dataset.scaleMode, true);
    goal('scale_interact', { plan: b.dataset.scaleMode, source: 'toggle' });
  }));
  $$('.plan').forEach((card) => card.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    show(card.dataset.plan, true);
    goal('scale_interact', { plan: card.dataset.plan, source: 'card' });
  }));
}

/* ---------- Наблюдение: условия, закреплённая кнопка, прокрутка ---------- */

function setupObservers() {
  const terms = $('#terms');
  let termsSeen = false;
  const visible = new Set();
  const sticky = $('[data-sticky]');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id);
      if (e.target === terms && e.isIntersecting && e.intersectionRatio > 0.25 && !termsSeen) {
        termsSeen = true;
        goal('terms_view');
      }
    });
    const show = !visible.has('top') && !visible.has('terms') && !visible.has('final');
    sticky.classList.toggle('is-visible', show);
    sticky.setAttribute('aria-hidden', String(!show));
    sticky.tabIndex = show ? 0 : -1;
  }, { threshold: [0, 0.25] });
  ['top', 'terms', 'final'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  sticky.addEventListener('click', () => goal('sticky_click'));

  const marks = [25, 50, 75, 100];
  const fired = new Set();
  let ticking = false;
  const check = () => {
    ticking = false;
    const h = document.documentElement.scrollHeight - innerHeight;
    const pct = h > 0 ? (scrollY / h) * 100 : 100;
    marks.forEach((m) => { if (pct >= m - 0.5 && !fired.has(m)) { fired.add(m); goal('scroll_' + m); } });
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
}

/* ---------- Живая сеть ---------- */

function weakDevice() {
  const c = navigator.connection || {};
  return (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
    || (navigator.deviceMemory && navigator.deviceMemory <= 2)
    || c.saveData === true
    || /(^|-)2g$/.test(c.effectiveType || '');
}

function startNetwork() {
  if (reducedMotion || weakDevice()) return; // остаётся статичная картинка
  const host = $('.hero__net');
  const run = () => import('./network.js').then((m) => m.startNetwork(host)).catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}

/* ---------- Старт ---------- */

const accent = detectAccent();
fillConfig();
setupLogo();
setupCheckoutLinks();
setupPayForms();
setupPayDialog();
setupTermsLinks();
setupLinks();
setupVideo();
setupFounder();
renderFaq();
setupScale(accent);
setupObservers();
initAnalytics();
Promise.all([renderSchedule(), renderSpeakers(), renderReviews()]);
if (document.readyState === 'complete') startNetwork();
else addEventListener('load', startNetwork, { once: true });
