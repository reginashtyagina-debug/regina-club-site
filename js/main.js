import { CONFIG } from './config.js';
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
  $$('[data-text="subtitle"]').forEach((el) => { el.textContent = CONFIG.subtitle; });
  $$('[data-text="legal"]').forEach((el) => { if (CONFIG.legal) el.textContent = CONFIG.legal; else el.hidden = true; });
}

function template(text) {
  return text
    .replaceAll('{trialPrice}', money(CONFIG.trial.price))
    .replaceAll('{yearPrice}', money(CONFIG.year.price))
    .replaceAll('{creditedYearPrice}', money(CONFIG.creditedYearPrice))
    .replaceAll('{creditWindow}', days(CONFIG.creditWindowDaysAfterTrial));
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
    a.addEventListener('click', () => {
      goal(plan === 'trial' ? 'click_trial' : 'click_year', { block: a.dataset.block || 'unknown' });
      if (a.hasAttribute('data-missing')) console.warn('Ссылка GetCourse для «' + plan + '» не указана в js/config.js');
    });
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
  if (ev.poster) posterEl.src = ev.poster;
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
      loop.poster = ev.poster || '';
      [[ev.src, 'video/mp4'], [ev.srcWebm, 'video/webm']].forEach(([u, type]) => {
        if (!u) return;
        const source = document.createElement('source');
        source.src = u; source.type = type;
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
    video.src = src;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    if (poster) video.poster = poster;
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
    const res = await fetch(url, { cache: 'no-cache' });
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

async function renderSpeakers() {
  const data = await loadJson(CONFIG.speakersJson);
  if (!Array.isArray(data)) return;
  const valid = data.filter((s) => s && s.name && !s.name.startsWith('['));
  const list = valid.filter((s) => s.kind !== 'rubric');
  const rubrics = valid.filter((s) => s.kind === 'rubric');
  if (list.length < 4) return;
  const ul = $('[data-speakers]');
  list.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'speaker';
    const wrap = document.createElement(isUrl(s.url) ? 'a' : 'div');
    if (isUrl(s.url)) { wrap.href = s.url; wrap.target = '_blank'; wrap.rel = 'noopener'; }
    const photo = document.createElement('div');
    photo.className = 'speaker__photo';
    if (s.photo) {
      const img = document.createElement('img');
      img.src = s.photo; img.alt = s.name; img.loading = 'lazy'; img.decoding = 'async';
      img.width = 400; img.height = 500;
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
    ul.append(li);
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

async function renderStory() {
  const s = await loadJson(CONFIG.storyJson);
  if (!s || !s.name || !s.result) return;
  const root = $('[data-story]');
  const grid = document.createElement('div');
  grid.className = 'story__grid';
  const photo = document.createElement('div');
  photo.className = 'story__photo';
  if (s.photo) {
    const img = document.createElement('img');
    img.src = s.photo; img.alt = s.name; img.loading = 'lazy'; img.width = 400; img.height = 500;
    photo.append(img);
  }
  const text = document.createElement('div');
  const name = document.createElement('p'); name.className = 'story__name'; name.textContent = s.name;
  const result = document.createElement('p'); result.className = 'story__result'; result.textContent = s.result;
  text.append(name, result);
  if (s.topic) {
    const topic = document.createElement('p'); topic.className = 'story__topic';
    const b = document.createElement('b'); b.textContent = 'Её эфир в клубе';
    topic.append(b, s.topic);
    text.append(topic);
  }
  grid.append(photo, text);
  root.append(grid);
  $('#story').hidden = false;
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
      a.href = r.src; a.target = '_blank'; a.rel = 'noopener';
      const img = document.createElement('img');
      img.src = r.src; img.alt = r.alt; img.loading = 'lazy'; img.decoding = 'async';
      img.width = r.width || 600; img.height = r.height || 1000;
      a.append(img);
      const src = document.createElement('p');
      src.className = 'review__source';
      src.textContent = r.source || 'Из закрытого чата клуба';
      li.append(a, src);
    }
    ul.append(li);
  });
  const step = () => (ul.firstElementChild ? ul.firstElementChild.getBoundingClientRect().width + 16 : 300);
  $('[data-reviews-prev]').addEventListener('click', () => ul.scrollBy({ left: -step(), behavior: reducedMotion ? 'auto' : 'smooth' }));
  $('[data-reviews-next]').addEventListener('click', () => ul.scrollBy({ left: step(), behavior: reducedMotion ? 'auto' : 'smooth' }));
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
  img.src = CONFIG.founderPhoto;
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
setupLinks();
setupVideo();
setupFounder();
renderFaq();
setupScale(accent);
setupObservers();
initAnalytics();
Promise.all([renderSchedule(), renderSpeakers(), renderStory(), renderReviews()]);
if (document.readyState === 'complete') startNetwork();
else addEventListener('load', startNetwork, { once: true });
