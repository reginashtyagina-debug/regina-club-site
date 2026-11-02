#!/usr/bin/env python3
"""Собирает страницу «Вход в годовое сопровождение» для блока T123 на Тильде.
    python3 tools/build-annual.py          (нужны пакеты fonttools и brotli)
Результат: tilda/annual-block.html (вставить в T123) и annual/preview.html (просмотр в браузере).

Всё встроено в код: шрифты (урезаны до символов страницы), логотип, фото. Внешние запросы — только анкета GetCourse.
"""
import base64, html, io, pathlib, re
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent

VALUES = {
    # Анкета: тот же виджет GetCourse, что на странице «От Анонима до Звезды» (единая анкета)
    "WIDGET": '<script id="eab5349a14506c8704f25f0f74f27c91e5c71742" src="https://reginapr.ru/pl/lite/widget/script?id=1667776"></script>',
    # Кнопка без поддержки окна (старые браузеры) ведёт к куратору
    "FORM_LINK": "https://t.me/yulya_solo_pr",
    "NAME": "Годовое сопровождение",
    "PROMISE": "Через год вы&nbsp;— не&nbsp;участник рынка, а&nbsp;имя, которое рынок узнаёт первым.",
    "POINTS": "\n".join('        <li><b>%02d</b>%s</li>' % (i + 1, x) for i, x in enumerate([
        "Десять предпринимателей в&nbsp;группе",
        "Стратегия лично с&nbsp;Региной&nbsp;Штягиной",
        "Встречи каждую неделю, весь&nbsp;год",
        "Личный куратор и&nbsp;ежедневная связь с&nbsp;командой",
    ])),
    "LETTER": "\n".join('        <p>%s</p>' % x for x in [
        "Этот год мы&nbsp;пройдём вместе. Сначала разработаем вашу стратегию, а&nbsp;затем я&nbsp;и&nbsp;моя команда будем рядом на&nbsp;каждом этапе её&nbsp;внедрения.",
        "Большую задачу мы&nbsp;разложим на&nbsp;график по&nbsp;неделям и&nbsp;пойдём к&nbsp;результату точечными шагами. Встречаемся онлайн, а&nbsp;живые встречи&nbsp;— по&nbsp;запросу, в&nbsp;разных точках мира.",
        "Я&nbsp;выбираю участников лично. Рада, что в&nbsp;этом году вы&nbsp;среди них.",
    ]),
    "SIGN": "",
    "FORM_NOTE": "Расскажите о&nbsp;себе и&nbsp;своих целях на&nbsp;год. К&nbsp;первой встрече я&nbsp;изучу ваши ответы.",
    "NEXT": "После анкеты мы&nbsp;свяжемся с&nbsp;вами и&nbsp;согласуем дату первой встречи.",
    # Только в окне, если форма не загрузилась
    "CONTACT": '<a href="https://t.me/yulya_solo_pr" target="_blank" rel="noopener">@yulya_solo_pr</a>',
}
LIMIT = 100_000  # символов в одном блоке T123

CYR = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"
LAT = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+20BD, U+2122, U+2212"
FONTS = [  # семейство, начертание, вес, файл, диапазон
    ("GS Montserrat", "normal", 600, "montserrat-cyrillic-600-normal", CYR),
    ("GS Montserrat", "normal", 600, "montserrat-latin-600-normal", LAT),
    ("GS Montserrat", "normal", 900, "montserrat-cyrillic-900-normal", CYR),
    ("GS Montserrat", "normal", 900, "montserrat-latin-900-normal", LAT),
    ("GS Serif", "italic", 400, "pt-serif-cyrillic-400-italic", CYR),
    ("GS Serif", "italic", 400, "pt-serif-latin-400-italic", LAT),
]


def b64(data):
    return base64.b64encode(data).decode()


def page_text(src):
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", src, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return text + text.upper() + text.lower() + "0123456789«»—–-.,:;?!()@_/ "


def subset_font(path, text):
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["kern", "liga"]
    font = subset.load_font(str(path), opts)
    sub = subset.Subsetter(opts); sub.populate(text=text); sub.subset(font)
    buf = io.BytesIO(); subset.save_font(font, buf, opts)
    return buf.getvalue()


src = (ROOT / "annual" / "annual.src.html").read_text(encoding="utf-8")
out = re.sub(r"<!--IF WIDGET-->(.*?)<!--END-->", lambda m: m.group(1) if VALUES["WIDGET"] else "", src, flags=re.S)
for key, val in VALUES.items():
    out = out.replace("{{%s}}" % key, val)
out = out.replace("{{LOGO}}", "data:image/webp;base64," + b64((ROOT / "annual/assets/logo-milk.webp").read_bytes()))
out = out.replace("{{SIGNATURE}}", "data:image/webp;base64," + b64((ROOT / "annual/assets/signature-milk.webp").read_bytes()))
out = out.replace("{{PHOTO}}", "data:image/webp;base64," + b64((ROOT / "annual/assets/regina-annual.webp").read_bytes()))
chars = page_text(out)
# Курсивом набраны только эти слова и номера — шрифт урезается до них
SERIF_TEXT = "Добро пожаловать основатель Академии 0123456789 «»—.,"
SERIF_TEXT += html.unescape(re.sub("<[^>]+>", " ", VALUES["LETTER"] + VALUES["SIGN"])) + " Письмо"
faces = []
for family, style, weight, name, rng in FONTS:
    data = subset_font(ROOT / "assets/fonts" / (name + ".woff2"), SERIF_TEXT if family == "GS Serif" else chars)
    faces.append('@font-face { font-family: "%s"; font-style: %s; font-weight: %d; font-display: swap; '
                 'src: url(data:font/woff2;base64,%s) format("woff2"); unicode-range: %s; }' % (family, style, weight, b64(data), rng))
out = out.replace("{{FONTS}}", "\n".join(faces))
assert "{{" not in out, "остались незаполненные места в шаблоне"

(ROOT / "tilda").mkdir(exist_ok=True)
(ROOT / "tilda" / "annual-block.html").write_text(out, encoding="utf-8")
(ROOT / "annual" / "preview.html").write_text(
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
    '<meta name="robots" content="noindex, nofollow">'
    '<meta property="og:image" content="assets/og-soprovozhdenie.jpg">'
    '<title>Годовое сопровождение — просмотр</title><style>body{margin:0;background:#0B0B0B}</style></head><body>'
    + out + "</body></html>", encoding="utf-8")
print("tilda/annual-block.html:", len(out), "символов (предел Тильды ~%d)" % LIMIT)
if len(out) > LIMIT:
    raise SystemExit("Блок длиннее предела Тильды")
