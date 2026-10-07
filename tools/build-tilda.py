#!/usr/bin/env python3
"""Собирает код для блока «HTML-код» (T123) на Тильде из index.html.

Тильда не хранит наши файлы, поэтому стили, скрипты, фото и данные
подгружаются с jsDelivr прямо из GitHub-репозитория. Адрес закреплён
за коммитом, поэтому после вставки нового кода на Тильде сразу работают
свежие файлы, без сброса кэша. Сначала закоммитьте и отправьте правки, потом:
    python3 tools/build-tilda.py
Результат: tilda/tilda-block.html — вставить целиком в блок T123.

Чтобы файлы отдавались не с jsDelivr, а со своего хостинга в России
(например, static.reginashtyagina.ru в Яндекс Object Storage), передайте адрес:
    python3 tools/build-tilda.py --base https://static.reginashtyagina.ru/
На хостинг нужно выложить папки assets, css, js, data (tools/pack-static.py)
и включить CORS (Access-Control-Allow-Origin для https://reginashtyagina.ru):
без него браузер не запустит скрипты-модули и не загрузит шрифты и данные.
"""
import argparse, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHA = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
parser = argparse.ArgumentParser()
parser.add_argument("--base", help="адрес, где лежат папки assets, css, js, data (со слешем в конце)")
args = parser.parse_args()
BASE = args.base or f"https://cdn.jsdelivr.net/gh/reginashtyagina-debug/regina-club-site@{SHA}/"
if not BASE.endswith("/"):
    BASE += "/"
COOKIES_URL = "https://reginapr.getcourse.ru/confidetial"

html = (ROOT / "index.html").read_text(encoding="utf-8")
body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1).strip()
# Относительные пути к файлам сайта → полный адрес хранилища файлов
body = re.sub(r'((?:src|href|poster)=")((?:assets|css|js|data)/)', r"\1" + BASE + r"\2", body)
body = body.replace('href="privacy.html"', f'href="{COOKIES_URL}"')

accent = re.search(r"<script>\s*// Акцент.*?</script>", html, re.S).group(0)

fonts = "\n".join(
    f'<link rel="preload" href="{BASE}assets/fonts/{f}" as="font" type="font/woff2" crossorigin>'
    for f in ("montserrat-cyrillic-600-normal.woff2", "golos-text-cyrillic-400-normal.woff2", "pt-serif-cyrillic-400-italic.woff2")
)

out = f"""<!-- Деловой клуб Регины Штягиной: код для блока T123 на Тильде.
     Собран tools/build-tilda.py. Файлы сайта берутся с jsDelivr из GitHub. -->
<script>
  window.CLUB_ASSET_BASE = "{BASE}";
  window.CLUB_COOKIES_URL = "{COOKIES_URL}";
  if (!document.documentElement.dataset.accent) document.documentElement.dataset.accent = 'trial';
</script>
{accent}
{fonts}
<link rel="stylesheet" href="{BASE}css/styles.css">
<link rel="stylesheet" href="{BASE}css/tilda.css">
<div class="club-root">
{body}
</div>
<script type="module" src="{BASE}js/main.js"></script>
"""
(ROOT / "tilda").mkdir(exist_ok=True)
(ROOT / "tilda" / "tilda-block.html").write_text(out, encoding="utf-8")
print("tilda/tilda-block.html:", len(out.encode("utf-8")), "байт")
