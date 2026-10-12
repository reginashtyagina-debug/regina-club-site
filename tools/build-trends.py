#!/usr/bin/env python3
"""Собирает страницу «Тренды продвижения 2027» для блока T123 на Тильде.

Логотип и фото встраиваются в код (base64), поэтому страница ничего
не загружает с внешних серверов. Шрифты по умолчанию не встраиваются: Тильда
пропускает в блок T123 не больше ~100 000 символов, а шрифты занимают ~160 000.
Заголовки берут Montserrat из настроек сайта на Тильде (запасной — Arial),
курсив — PT Serif или Georgia. Встроить шрифты (для просмотра вне Тильды): --fonts. Ссылки задаются в LINKS ниже; пока ссылки нет,
вместо неё стоит «#» и сборка пишет предупреждение.
    python3 tools/build-trends.py
Результат: tilda/trends-block.html (вставить в T123) и trends/preview.html (просмотр в браузере).
"""
import base64, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

LINKS = {
    # Оплата билета, клуба и регистрация участника — виджеты GetCourse в trends.src.html.
    "LINK_CLUB": "https://reginapr.getcourse.ru/regina_club_06",   # запасная ссылка «Вступить в клуб» для старых браузеров
    "LINK_OFFER": "https://reginapr.getcourse.ru/oferta_club",     # оферта (клубная, подтверждено Региной)
    "LINK_PRIVACY": "https://reginapr.getcourse.ru/confidetial",   # политика конфиденциальности
}
# Ссылки на картинки, загруженные в Тильду; пока пусто — встраиваются уменьшенные копии
PHOTO_URL = ""   # trends/assets/regina-trends-small.webp
LOGO_URL = ""    # trends/assets/logo-small.webp
EMBED_FONTS = "--fonts" in sys.argv
LIMIT = 100_000  # символов в одном блоке T123


def b64(path):
    return base64.b64encode((ROOT / path).read_bytes()).decode()


src = (ROOT / "trends" / "trends.src.html").read_text(encoding="utf-8")
if not EMBED_FONTS:
    src = "\n".join(l for l in src.split("\n") if "{{F_" not in l)
values = {}
if EMBED_FONTS:
  values.update({
    "F_M600C": b64("assets/fonts/montserrat-cyrillic-600-normal.woff2"),
    "F_M600L": b64("assets/fonts/montserrat-latin-600-normal.woff2"),
    "F_M900C": b64("assets/fonts/montserrat-cyrillic-900-normal.woff2"),
    "F_M900L": b64("assets/fonts/montserrat-latin-900-normal.woff2"),
    "F_PTC": b64("assets/fonts/pt-serif-cyrillic-400-italic.woff2"),
    "F_PTL": b64("assets/fonts/pt-serif-latin-400-italic.woff2"),
  })
values.update({
    "LOGO": LOGO_URL or "data:image/webp;base64," + b64("trends/assets/logo-small.webp"),
    "PHOTO": PHOTO_URL or "data:image/webp;base64," + b64("trends/assets/regina-trends-small.webp"),
})
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
    '<title>Тренды продвижения 2027 — просмотр</title><style>body{margin:0;background:#F8F7F4}'
    # на Тильде Montserrat подключает сайт; в просмотре — локальные файлы
    '@font-face{font-family:Montserrat;font-weight:600;src:url(../assets/fonts/montserrat-latin-600-normal.woff2)}'
    '@font-face{font-family:Montserrat;font-weight:600;src:url(../assets/fonts/montserrat-cyrillic-600-normal.woff2);unicode-range:U+0400-045F}'
    '@font-face{font-family:Montserrat;font-weight:900;src:url(../assets/fonts/montserrat-latin-900-normal.woff2)}'
    '@font-face{font-family:Montserrat;font-weight:900;src:url(../assets/fonts/montserrat-cyrillic-900-normal.woff2);unicode-range:U+0400-045F}'
    '</style></head><body>'
    + out + "</body></html>", encoding="utf-8")
print("tilda/trends-block.html:", len(out), "символов (предел Тильды ~%d)" % LIMIT)
if len(out) > LIMIT and not EMBED_FONTS:
    sys.exit("Блок длиннее предела Тильды — уменьшите картинки или задайте PHOTO_URL/LOGO_URL")
if missing:
    print("Нет ссылок:", ", ".join(missing))
