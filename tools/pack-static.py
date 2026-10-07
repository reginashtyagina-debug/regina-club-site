#!/usr/bin/env python3
"""Собирает архив static-files.zip с файлами сайта для своего хостинга.

В архиве папки assets, css, js, data — их нужно выложить в корень хранилища
(чтобы открывался, например, https://static.reginashtyagina.ru/css/styles.css).
Запуск:
    python3 tools/pack-static.py
"""
import pathlib, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "static-files.zip"
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for folder in ("assets", "css", "js", "data"):
        for f in sorted((ROOT / folder).rglob("*")):
            if f.is_file() and not f.name.startswith("."):
                z.write(f, f.relative_to(ROOT).as_posix())
print(f"{OUT.name}: {sum(1 for _ in zipfile.ZipFile(OUT).namelist())} файлов, {OUT.stat().st_size // 1024} КБ")
