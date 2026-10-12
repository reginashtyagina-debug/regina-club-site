#!/usr/bin/env python3
"""Собирает страницу «Заявка принята» для блока T123 на Тильде.
    python3 tools/build-thanks.py
Результат: tilda/thanks-block.html (вставить в T123) и thanks/preview.html (просмотр в браузере).

Логотип и фото Юлии встраиваются в код (base64): страница ничего не грузит с чужих серверов.
Шрифты не встраиваются: Montserrat берётся из настроек сайта на Тильде, курсив — PT Serif или Georgia.
Пока ссылки MAX_LINK или TEST_LINK пустые, их кнопка не выводится (вместо нерабочей кнопки), сборка предупреждает.
"""
import base64, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent

LINKS = {
    "MAX_LINK": "https://max.ru/u/f9LHodD0cOKMJb_S2fQPg_xSzds-I7sOWH6ZJV-sJWBOIfm4oShBdvusUJY",  # чат MAX Юлии Соло
    "TEST_LINK": "",   # тест «На какой вы стадии» — уточнить у Регины
}
LIMIT = 100_000  # символов в одном блоке T123


def b64(path):
    return base64.b64encode((ROOT / path).read_bytes()).decode()


out = (ROOT / "thanks" / "thanks.src.html").read_text(encoding="utf-8")
missing = []
for key, url in LINKS.items():
    pattern = re.compile(r"<!--IF %s-->(.*?)<!--END-->" % key, re.S)
    if url:
        out = pattern.sub(lambda m: m.group(1).replace("{{%s}}" % key, url), out)
    else:
        out = pattern.sub("", out)
        missing.append(key)
out = out.replace("{{LOGO}}", "data:image/webp;base64," + b64("trends/assets/logo-small.webp"))
out = out.replace("{{YULIA}}", "data:image/webp;base64," + b64("thanks/assets/yulia-solo.webp"))
assert "{{" not in out and "<!--IF" not in out, "остались незаполненные места в шаблоне"

(ROOT / "tilda").mkdir(exist_ok=True)
(ROOT / "tilda" / "thanks-block.html").write_text(out, encoding="utf-8")
(ROOT / "thanks" / "preview.html").write_text(
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
    '<title>Заявка принята — просмотр</title><style>body{margin:0;background:#F8F7F4}'
    # на Тильде Montserrat подключает сайт; в просмотре — локальные файлы
    + "".join("@font-face{font-family:Montserrat;font-weight:%s;src:url(../assets/fonts/montserrat-%s-%s-normal.woff2)%s}"
              % (w, sub, w, ";unicode-range:U+0400-045F" if sub == "cyrillic" else "")
              for w in ("600", "900") for sub in ("latin", "cyrillic"))
    + "</style></head><body>" + out + "</body></html>", encoding="utf-8")
print("tilda/thanks-block.html:", len(out), "символов (предел Тильды ~%d)" % LIMIT)
if missing:
    print("Нет ссылок (кнопка скрыта):", ", ".join(missing))
