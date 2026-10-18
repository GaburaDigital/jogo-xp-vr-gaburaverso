# Clique de verdade no painel 3D, progresso salvo da ponte ao recarregar e jogo sem internet.
from base import *
with sync_playwright() as p:
    b = p.chromium.launch(headless=False, args=['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); pg.set_default_timeout(120000)
    erros = []; pg.on('pageerror', lambda e: erros.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: erros.append(m.type + ' ' + m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('() => window.__jogo && window.__jogo.pronto()', timeout=180000)
    # salvar para jogar sem internet
    pg.click('button[aria-label="Salvar para jogar sem internet"]')
    pg.wait_for_function("() => localStorage.getItem('nave_offline_versao')", timeout=300000); time.sleep(0.5)
    pg.screenshot(path=F + '60_salvo_offline.png')
    print('caches:', pg.evaluate("async () => { const n = await caches.keys(); const c = await caches.open(n[0]); return [n, (await c.keys()).length] }"))
    # progresso: ponte feita (como se o jogador tivesse jogado antes)
    pg.evaluate("""() => localStorage.setItem('nave_progresso_v1', JSON.stringify({ cenasConcluidas: ['sala_abertura', 'ponte_navegacao'], eventos: ['acender_faixas_chao', 'missao_completa_ponte', 'acender_luz_ponte'] }))""")
    ctx.set_offline(True)
    pg.reload(); pg.wait_for_function('() => window.__jogo && window.__jogo.pronto()', timeout=180000)
    print('carregou sem internet')
    pg.click('button[aria-label="Jogar na versão adaptada para PC"]'); time.sleep(0.3); pg.click('button[aria-label="Continuar no PC"]'); time.sleep(1.5); prep(pg)
    print('cenas:', [(c['id'], c['estado']) for c in J(pg, 'return j.estadoCenas()')][:2], 'peças:', sum(1 for x in J(pg, 'return j.pecas()') if x['encaixada']))
    J(pg, 'j.teleportar([0, 0, -12.6], 0)'); J(pg, '__t.olhar(0, 1.1, -17.6)'); time.sleep(3); pg.screenshot(path=F + '61_ponte_recarregada.png')
    # menu com clique de verdade: abre, clica em "Ver missão" e depois "Voltar" e "Continuar" pelo mouse
    J(pg, 'j.entrada.menuBorda = true'); time.sleep(1.5)
    alvos = J(pg, 'return j.alvosAbertos()'); print('alvos pausa:', alvos)
    centro = pg.evaluate("""() => { const j = window.__jogo; const g = j.grupoPainel;
       const malha = g.children[0]; const out = {}; const w = malha.scale.x, h = malha.scale.y;
       // grade da pausa: 6 botões 270x250 a partir de (70,132), passo 290 x 270, painel 1000 x 700
       [['continuar',0],['abrir:opcoes',1],['abrir:como_jogar',2],['abrir:missao',3],['recomecar',4],['sair',5]].forEach(([a,i]) => {
         const px = 70 + (i % 3) * 290 + 135, py = 132 + Math.floor(i / 3) * 270 + 125;
         const v = new j.three.Vector3((px / 1000 - 0.5) * w, (0.5 - py / 700) * h, 0); malha.localToWorld(v); v.project(j.camera);
         out[a] = [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
       return out; }""")
    pg.mouse.move(*centro['abrir:missao']); time.sleep(0.6); pg.screenshot(path=F + '62_hover_missao.png')
    pg.mouse.click(*centro['abrir:missao']); time.sleep(1.5)
    print('depois do clique:', J(pg, 'return j.painelAberto()')); pg.screenshot(path=F + '63_missao.png')
    J(pg, 'j.agir("voltar")'); time.sleep(1.2)
    pg.mouse.click(*centro['continuar']); time.sleep(1)
    print('continuar pelo mouse:', J(pg, 'return j.painelAberto()'))
    print('\n'.join([e for e in erros if 'useProgram' not in e][:20]) or 'sem erros')
    b.close()
