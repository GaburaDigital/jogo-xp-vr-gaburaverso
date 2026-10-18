"""Funções comuns dos testes automáticos no computador (Playwright + Chrome sem janela)."""
import time, json
from playwright.sync_api import sync_playwright
import os
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fotos') + '/'
os.makedirs(F, exist_ok=True)
URL = os.environ.get('URL_JOGO', 'http://localhost:4180/jogo-xp-vr-gaburaverso/')
def abrir(p, w=1280, h=720):
    b = p.chromium.launch(headless=False, args=['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': w, 'height': h}); pg.set_default_timeout(60000)
    erros = []
    pg.on('pageerror', lambda e: erros.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: erros.append(m.type + ' ' + m.text) if m.type in ('error', 'warning') else None)
    return b, pg, erros
def J(pg, js): return pg.evaluate('() => { const j = window.__jogo; ' + js + ' }')

AJUDA = """
window.__t = {
  olhar(x, y, z) { const j = window.__jogo; const o = j.camera.getWorldPosition(new j.three.Vector3()); const dx = x - o.x, dy = y - o.y, dz = z - o.z;
    j.entrada.pc.yaw = Math.atan2(-dx, -dz); j.entrada.pc.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
  olharId(id, dy = 0) { const j = window.__jogo; const i = j.instancias.get(id); const b = new j.three.Box3().setFromObject(i.raiz); const c = b.getCenter(new j.three.Vector3()); this.olhar(c.x, c.y + dy, c.z); return c.toArray(); },
  pos() { const j = window.__jogo; return j.camera.getWorldPosition(new j.three.Vector3()).toArray().map(v => +v.toFixed(2)); },
  noTela(x, y, z) { const j = window.__jogo; const v = new j.three.Vector3(x, y, z).project(j.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
};
"""
def prep(pg): pg.evaluate('() => {' + AJUDA + '}')
def pular(pg, segundos, parar=None):
    """Espaço a cada 0,25 s (pula falas) até o tempo acabar ou parar() ser verdade."""
    fim = time.time() + segundos
    while time.time() < fim:
        J(pg, 'j.entrada.pularFalaBorda = true;')
        time.sleep(0.25)
        if parar and parar(): return True
    return False
def pedido(pg): return J(pg, 'return j.pedido()')
def cenas(pg): return {c['id']: c for c in J(pg, 'return j.estadoCenas()')}
def entrar_pc(pg):
    pg.goto(URL)
    pg.wait_for_function('() => window.__jogo && window.__jogo.pronto()', timeout=180000)
    pg.click('button[aria-label="Jogar na versão adaptada para PC"]'); time.sleep(0.3)
    pg.click('button[aria-label="Continuar no PC"]'); time.sleep(1); prep(pg)
