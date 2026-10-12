#!/usr/bin/env python3
"""Собирает страницу «Тренды продвижения 2027» для блока T123 на Тильде.

Шрифты, логотип и фото встраиваются в код (base64), поэтому страница ничего
не загружает с внешних серверов. Ссылки задаются в LINKS ниже; пока ссылки нет,
вместо неё стоит «#» и сборка пишет предупреждение.
    python3 tools/build-trends.py
Результат: tilda/trends-block.html (вставить в T123) и trends/preview.html (просмотр в браузере).
"""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

LINKS = {
    # Оплата билета, клуба и регистрация участника — виджеты GetCourse в trends.src.html.
    "LINK_CLUB": "https://reginapr.getcourse.ru/regina_club_06",   # запасная ссылка «Вступить в клуб» для старых браузеров
    "LINK_OFFER": "",                                              # оферта мероприятия
    "LINK_PRIVACY": "https://reginapr.getcourse.ru/confidetial",   # политика конфиденциальности
}
# Фото: ссылка на картинку, загруженную в Тильду; пока пусто — встраивается trends/assets/regina-trends.webp
PHOTO_URL = ""


def b64(path):
    return base64.b64encode((ROOT / path).read_bytes()).decode()


src = (ROOT / "trends" / "trends.src.html").read_text(encoding="utf-8")
values = {
    "F_M600C": b64("assets/fonts/montserrat-cyrillic-600-normal.woff2"),
    "F_M600L": b64("assets/fonts/montserrat-latin-600-normal.woff2"),
    "F_M900C": b64("assets/fonts/montserrat-cyrillic-900-normal.woff2"),
    "F_M900L": b64("assets/fonts/montserrat-latin-900-normal.woff2"),
    "F_PTC": b64("assets/fonts/pt-serif-cyrillic-400-italic.woff2"),
    "F_PTL": b64("assets/fonts/pt-serif-latin-400-italic.woff2"),
    "LOGO": b64("assets/logo/shtyagina-black.png"),
    "PHOTO": PHOTO_URL or "data:image/webp;base64," + b64("trends/assets/regina-trends.webp"),
}
missing = []
for key, url in LINKS.items():
    values[key] = url or "#"
    if not url:
        missing.append(key)

out = src
for key, val in values.items():
    out = out.replace("{{" + key + "}}", val)
assert "{{" not in out, "остались незаполненные места в шаблоне"

(ROOT / "tilda").mkdir(exist_ok=True)
(ROOT / "tilda" / "trends-block.html").write_text(out, encoding="utf-8")
(ROOT / "trends" / "preview.html").write_text(
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
    '<title>Тренды продвижения 2027 — просмотр</title><style>body{margin:0;background:#F8F7F4}</style></head><body>'
    + out + "</body></html>", encoding="utf-8")
print("tilda/trends-block.html:", len(out.encode("utf-8")) // 1024, "КБ")
if missing:
    print("Нет ссылок:", ", ".join(missing))
