#!/usr/bin/env python3
"""Собирает страницу «Разбор» (reginashtyagina.ru/razbor) для блока T123 на Тильде.
    python3 tools/build-razbor.py          (нужны пакеты fonttools и brotli)
Результат: tilda/razbor-block.html (вставить в T123) и razbor/preview.html (просмотр в браузере).

Картинки и курсивный шрифт встроены в код. Montserrat берётся из настроек шрифтов сайта на Тильде.
Внешние запросы — только форма GetCourse. Пока код формы (WIDGET) пустой, код для Тильды не собирается:
страница без формы не должна попасть на сайт.
"""
import base64, html, io, pathlib, re
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
VALUES = {
    # Код виджета формы GetCourse целиком: <script id="…" src="https://…/pl/lite/widget/script?id=…"></script>
    "WIDGET": "",
    # Запасная связь, если форма не загрузилась
    "FALLBACK_LINK": "https://t.me/yulya_solo_pr",
    "FALLBACK_TEXT": "@yulya_solo_pr",
}
IMAGES = {"LOGO_FORUM": "logo-forum.webp", "LOGO_SHTYAGINA": "logo-shtyagina.webp", "PORTRAIT": "portrait.webp",
          "ALBINA": "albina.webp", "LILIYA": "liliya.webp", "DILYARA": "dilyara.webp"}
LIMIT = 100_000  # символов в одном блоке T123
CYR = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"
LAT = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+20BD, U+2122, U+2212"


def b64(data):
    return base64.b64encode(data).decode()


def subset_font(path, text):
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["kern", "liga"]
    font = subset.load_font(str(path), opts)
    sub = subset.Subsetter(opts); sub.populate(text=text); sub.subset(font)
    buf = io.BytesIO(); subset.save_font(font, buf, opts)
    return buf.getvalue()


src = (ROOT / "razbor" / "razbor.src.html").read_text(encoding="utf-8")
for key, name in IMAGES.items():
    src = src.replace("{{%s}}" % key, "data:image/webp;base64," + b64((ROOT / "razbor/assets" / name).read_bytes()))
for key in ("FALLBACK_LINK", "FALLBACK_TEXT"):
    src = src.replace("{{%s}}" % key, VALUES[key])
# Курсивом набраны только эти строки — шрифт урезается до них
serif = "Разбор вашей ситуации на онлайн-эфире с Региной Штягиной Регина Штягина"
faces = "\n".join(
    '@font-face { font-family: "RZ Serif"; font-style: italic; font-weight: 400; font-display: swap; '
    'src: url(data:font/woff2;base64,%s) format("woff2"); unicode-range: %s; }'
    % (b64(subset_font(ROOT / "assets/fonts" / ("pt-serif-%s-400-italic.woff2" % part), serif)), rng)
    for part, rng in (("cyrillic", CYR), ("latin", LAT)))
src = src.replace("{{FONTS}}", faces)

stub = '<div class="rz__stub">Здесь будет форма GetCourse</div>'
preview_body = src.replace("{{WIDGET}}", VALUES["WIDGET"] or stub)
font_css = "".join("@font-face{font-family:Montserrat;font-weight:%s;src:url(../assets/fonts/montserrat-%s-%s-normal.woff2)%s}"
                   % (w, sub, w, ";unicode-range:U+0400-045F" if sub == "cyrillic" else "")
                   for w in ("600", "900") for sub in ("latin", "cyrillic"))
(ROOT / "razbor" / "preview.html").write_text(
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
    '<meta name="robots" content="noindex, nofollow"><title>Разбор — просмотр</title>'
    '<style>body{margin:0;background:#0d1730}' + font_css + '</style></head><body>' + preview_body + '</body></html>',
    encoding="utf-8")

if not VALUES["WIDGET"]:
    print("razbor/preview.html собран. Код формы GetCourse (WIDGET) пустой — код для Тильды не собирается.")
    raise SystemExit
out = src.replace("{{WIDGET}}", VALUES["WIDGET"])
assert "{{" not in out, "остались незаполненные места в шаблоне"
(ROOT / "tilda").mkdir(exist_ok=True)
(ROOT / "tilda" / "razbor-block.html").write_text(out, encoding="utf-8")
print("tilda/razbor-block.html:", len(out), "символов (предел Тильды ~%d)" % LIMIT)
if len(out) > LIMIT:
    raise SystemExit("Блок длиннее предела Тильды")
