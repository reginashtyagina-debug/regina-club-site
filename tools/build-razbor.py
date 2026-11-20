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
    "WIDGET": '<script id="fdfc19dc6278297a0be16f2f67f5eacfd7734c10" src="https://reginapr.ru/pl/lite/widget/script?id=1687556"></script>',
    # Запасная связь, если форма не загрузилась
    "FALLBACK_LINK": "https://t.me/yulya_solo_pr",
    "FALLBACK_TEXT": "@yulya_solo_pr",
    # Страница «Вы записаны» (razbor-spasibo): закрытый чат участников и PDF подарка
    "CHAT_LINK": "https://t.me/+rPaQKl6ykcI1NTE6",
    "GIFT_LINK": "",
}
IMAGES = {"LOGO_FORUM": "logo-forum.webp", "LOGO_SHTYAGINA": "logo-shtyagina.webp", "PORTRAIT": "portrait.webp",
          "ALBINA": "albina.webp", "LILIYA": "liliya.webp", "DILYARA": "dilyara.webp"}
LIMIT = 100_000  # символов в одном блоке T123
CYR = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"
LAT = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+20BD, U+2122, U+2212"


def b64(data):
    return base64.b64encode(data).decode()


def subset_font(path, text, features=("kern", "liga")):
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = list(features)
    opts.name_IDs = []; opts.hinting = False
    font = subset.load_font(str(path), opts)
    sub = subset.Subsetter(opts); sub.populate(text=text); sub.subset(font)
    buf = io.BytesIO(); subset.save_font(font, buf, opts)
    return buf.getvalue()


src = (ROOT / "razbor" / "razbor.src.html").read_text(encoding="utf-8")
for key in ("FALLBACK_LINK", "FALLBACK_TEXT"):
    src = src.replace("{{%s}}" % key, VALUES[key])
# Курсивом набраны только эти строки — шрифт урезается до них
serif = "Разбор вашей ситуации на онлайн-эфире с Региной Штягиной Регина Штягина Онлайн-эфир в Zoom"
faces = "\n".join(
    '@font-face { font-family: "RZ Serif"; font-style: italic; font-weight: 400; font-display: swap; '
    'src: url(data:font/woff2;base64,%s) format("woff2"); unicode-range: %s; }'
    % (b64(subset_font(ROOT / "assets/fonts" / ("pt-serif-%s-400-italic.woff2" % part), serif)), rng)
    for part, rng in (("cyrillic", CYR), ("latin", LAT)))

# Montserrat встроен двумя начертаниями: 500 — обычный текст (до 650), 900 — жирный и заголовки (651–950).
# Тильда подгружает не все начертания своего Montserrat, поэтому без встраивания жирный текст выходит тонким.
def page_chars(text):
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return text + text.upper() + "0123456789«»—–-.,:;?!()@_/×€ "


def montserrat(text):
    chars = page_chars(text)
    return "\n".join(
        '@font-face { font-family: "RZ Montserrat"; font-style: normal; font-weight: %s; font-display: swap; '
        'src: url(data:font/woff2;base64,%s) format("woff2"); unicode-range: %s; }'
        % (rng_w, b64(subset_font(ROOT / "assets/fonts" / ("montserrat-%s-%d-normal.woff2" % (part, w)), chars, ("kern",))), rng)
        for w, rng_w in ((500, "100 650"), (900, "651 1000")) for part, rng in (("cyrillic", CYR), ("latin", LAT)))


font_css = "".join("@font-face{font-family:Montserrat;font-weight:%s;src:url(../assets/fonts/montserrat-%s-%s-normal.woff2)%s}"
                   % (w, sub, w, ";unicode-range:U+0400-045F" if sub == "cyrillic" else "")
                   for w in ("600", "900") for sub in ("latin", "cyrillic"))


def preview(name, title, body):
    (ROOT / "razbor" / name).write_text(
        '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="robots" content="noindex, nofollow"><title>' + title + ' — просмотр</title>'
        '<style>body{margin:0;background:#0d1730}' + font_css + '</style></head><body>' + body + '</body></html>',
        encoding="utf-8")


def block(name, out):
    assert "{{" not in out, "остались незаполненные места в шаблоне"
    (ROOT / "tilda").mkdir(exist_ok=True)
    (ROOT / "tilda" / name).write_text(out, encoding="utf-8")
    print("tilda/%s:" % name, len(out), "символов (предел Тильды ~%d)" % LIMIT)
    if len(out) > LIMIT:
        raise SystemExit("Блок длиннее предела Тильды")


def common(text):
    for key, name in IMAGES.items():
        text = text.replace("{{%s}}" % key, "data:image/webp;base64," + b64((ROOT / "razbor/assets" / name).read_bytes()))
    return text.replace("{{FONTS}}", faces + "\n" + montserrat(text))


# Страница разбора
src = common(src)
stub = '<div class="rz__stub">Здесь будет форма GetCourse</div>'
preview("preview.html", "Разбор", src.replace("{{WIDGET}}", VALUES["WIDGET"] or stub))
if VALUES["WIDGET"]:
    block("razbor-block.html", src.replace("{{WIDGET}}", VALUES["WIDGET"]))
else:
    print("Код формы GetCourse (WIDGET) пустой — код разбора для Тильды не собран.")

# Страница «Вы записаны»
thanks = common((ROOT / "razbor" / "spasibo.src.html").read_text(encoding="utf-8"))
# Без ссылки на PDF строка «Скачать подарок здесь» не выводится: подарок — в чате и в письме
thanks = re.sub(r"<!--IF GIFT_LINK-->(.*?)<!--END-->",
                lambda m: m.group(1).replace("{{GIFT_LINK}}", VALUES["GIFT_LINK"]) if VALUES["GIFT_LINK"] else "", thanks, flags=re.S)
thanks = thanks.replace("{{CHAT_LINK}}", VALUES["CHAT_LINK"] or "#")
preview("spasibo-preview.html", "Вы записаны", thanks)
if not VALUES["GIFT_LINK"]:
    print("Нет ссылки на PDF (GIFT_LINK): строка «Скачать подарок здесь» скрыта.")
if not VALUES["CHAT_LINK"]:
    print("Нет ссылки на чат (CHAT_LINK) — код «Вы записаны» для Тильды не собран.")
else:
    block("razbor-spasibo-block.html", thanks)
