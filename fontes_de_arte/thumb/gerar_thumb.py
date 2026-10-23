"""Gera docs/thumb.jpg (1280×720) e docs/capa_630x500.jpg a partir de thumb.html. Uso: python3 fontes_de_arte/thumb/gerar_thumb.py"""
import os, io
from playwright.sync_api import sync_playwright
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
with sync_playwright() as p:
    b = p.chromium.launch()
    for f, w, h, saida in (('grande', 1280, 720, 'docs/thumb.jpg'), ('capa', 630, 500, 'docs/capa_630x500.jpg')):
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.goto('file://' + os.path.join(AQUI, 'thumb.html') + '?f=' + f); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        Image.open(io.BytesIO(pg.screenshot())).convert('RGB').save(os.path.join(RAIZ, saida), quality=88, optimize=True, progressive=True)
        print('ok', saida)
    b.close()
