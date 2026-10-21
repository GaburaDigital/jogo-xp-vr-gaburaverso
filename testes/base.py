"""Funções comuns dos testes automáticos no computador (Playwright + Chrome sem janela)."""
import time, json, os, signal, subprocess, atexit, urllib.request
from contextlib import contextmanager
from playwright.sync_api import sync_playwright
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fotos') + '/'
os.makedirs(F, exist_ok=True)
URL = os.environ.get('URL_JOGO', 'http://localhost:4180/jogo-xp-vr-gaburaverso/')
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------- servidor local: o próprio teste liga e SEMPRE desliga (regra de 21/10: nada fica rodando) ----------
def _respondendo(url=URL):
    try: urllib.request.urlopen(url, timeout=1); return True
    except Exception: return False

@contextmanager
def servidor(porta=4180):
    """Liga o `vite preview` (o jogo já montado em dist/), espera responder e desliga no fim, mesmo se o teste falhar.
    Se já houver um servidor nessa porta (ex.: o rodar_todos.py), usa o que existe e não desliga."""
    if _respondendo():
        yield; return
    proc = subprocess.Popen(['npx', 'vite', 'preview', '--port', str(porta), '--strictPort'], cwd=RAIZ,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    def desligar():
        try: os.killpg(proc.pid, signal.SIGTERM); proc.wait(timeout=5)
        except Exception: pass
    atexit.register(desligar)            # também se o teste for interrompido no meio
    try:
        for _ in range(80):
            if _respondendo(): break
            time.sleep(0.25)
        yield
    finally:
        desligar()

_ligado = None
def _garantir_servidor():
    """Usado por abrir(): liga o servidor na primeira vez e deixa o desligar para o fim do processo."""
    global _ligado
    if _ligado is None and not _respondendo():
        _ligado = servidor(); _ligado.__enter__()
        atexit.register(lambda: _ligado.__exit__(None, None, None))

def abrir(p, w=1280, h=720):
    _garantir_servidor()
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
