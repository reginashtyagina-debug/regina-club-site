/* =========================================================================
   ВЫВОД КАРТОЧЕК ИЗ МАССИВОВ (js/data.js)
   Этот файл редактировать не нужно — только data.js.
   ========================================================================= */
(function () {
  'use strict';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // Картинка, если путь задан, иначе — плейсхолдер с подписью
  function media(src, alt, phClass, label) {
    if (src) {
      const img = el('img');
      img.src = src;
      img.alt = alt;
      img.loading = 'lazy';
      return img;
    }
    const ph = el('div', 'ph ' + phClass);
    ph.setAttribute('aria-hidden', 'true');
    if (label) ph.appendChild(el('span', 'ph__label', label));
    return ph;
  }

  // Цвет карточек экспертов чередуется «шахматкой»: голубой / зелёный
  const TONES = ['sky', 'sage', 'sage', 'sky'];

  function personPhoto(src, alt, comment) {
    const box = el('div', 'person-photo');
    box.appendChild(document.createComment(' ' + comment + ' '));
    box.appendChild(media(src, alt, 'ph--person'));
    return box;
  }

  function renderExperts(list, root) {
    const frag = document.createDocumentFragment();
    list.forEach(function (expert, i) {
      const item = el('li', 'expert expert--' + TONES[i % TONES.length]);
      item.appendChild(el('p', 'expert__name', expert.name));
      item.appendChild(personPhoto(expert.photo, expert.name, 'ФОТО ЭКСПЕРТА ' + (i + 1)));
      item.appendChild(el('p', 'expert__role', expert.role));
      frag.appendChild(item);
    });
    root.appendChild(frag);
  }

  function renderStats(stats) {
    document.querySelectorAll('[data-stat]').forEach(function (node) {
      const value = stats[node.getAttribute('data-stat')];
      if (value === null || value === undefined || value === '') return;
      const target = node.querySelector('[data-stat-value]');
      target.textContent = typeof value === 'number' ? value.toLocaleString('ru-RU') : value;
      node.hidden = false;
    });
  }

  // Скрин сообщения; пока его нет — плейсхолдер с текстом цитаты
  function reviewShot(review, i) {
    const fig = el('figure', 'review__shot');
    fig.appendChild(document.createComment(' СКРИН ОТЗЫВА ' + (i + 1) + ' (' + review.author + ') '));
    if (review.screenshot) {
      const img = el('img');
      img.src = review.screenshot;
      img.alt = 'Сообщение от участника клуба ' + review.author + ': «' + review.text + '»';
      img.loading = 'lazy';
      fig.appendChild(img);
    } else {
      const ph = el('div', 'review__shot-ph');
      ph.appendChild(el('span', 'ph__label', 'Скрин отзыва'));
      ph.appendChild(el('p', 'review__draft', '«' + review.text + '»'));
      fig.appendChild(ph);
    }
    return fig;
  }

  function renderReviews(list, root) {
    const frag = document.createDocumentFragment();
    list.forEach(function (review, i) {
      const card = el('li', 'review');
      if (review.photo || review.photoLabel) {
        const fig = el('figure', 'review__photo');
        fig.appendChild(document.createComment(' ' + (review.photoLabel || 'ФОТО') + ' '));
        fig.appendChild(media(review.photo, review.photoLabel || review.author, 'ph--photo', review.photoLabel));
        card.appendChild(fig);
      }
      card.appendChild(reviewShot(review, i));
      card.appendChild(el('p', 'review__author', review.author));
      frag.appendChild(card);
    });
    root.appendChild(frag);
  }

  const expertsRoot = document.getElementById('experts-grid');
  const reviewsRoot = document.getElementById('reviews-track');
  if (expertsRoot && typeof EXPERTS !== 'undefined') renderExperts(EXPERTS, expertsRoot);
  if (reviewsRoot && typeof REVIEWS !== 'undefined') renderReviews(REVIEWS, reviewsRoot);

  if (typeof CLUB_STATS !== 'undefined') renderStats(CLUB_STATS);
})();
