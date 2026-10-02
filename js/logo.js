// Логотип из файлов assets/logo/ (пути в config.js, поле logo).
// Пока файла нет, остаётся временное набранное слово «shtyagina».

import { CONFIG } from './config.js';

export function setupLogo() {
  document.querySelectorAll('[data-logo]').forEach((link) => {
    const src = CONFIG.logo && CONFIG.logo[link.dataset.logo];
    if (!src) return;
    const img = new Image();
    img.alt = 'shtyagina';
    img.decoding = 'async';
    img.onload = () => {
      link.textContent = '';
      link.removeAttribute('aria-label');
      link.append(img);
    };
    img.src = src;
  });
}

if (!document.querySelector('script[src$="main.js"]')) setupLogo();
