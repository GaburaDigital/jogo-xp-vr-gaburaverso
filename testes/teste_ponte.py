# Missão da ponte no PC: pizzas, cyberdeck, encaixe no console e o tangram com a câmera de foco.
from base import *
import math
def esperar_pedido(pg, ini, s=60): return pular(pg, s, lambda: (pedido(pg) or '').startswith(ini))
def clique_dir(pg): pg.mouse.click(640, 360, button='right'); time.sleep(0.6)
with sync_playwright() as p:
    b, pg, erros = abrir(p)
    entrar_pc(pg)
    J(pg, 'j.agir("ir:ponte_navegacao")'); time.sleep(2)
    print('cenas', cenas(pg)['ponte_navegacao'])
    pg.screenshot(path=F+'20_ponte_inicio.png')
    print('pede cyberdeck:', esperar_pedido(pg, 'achar'), pedido(pg))
    J(pg, 'j.teleportar([-3.5, 0, -13.9], 90)'); J(pg, "__t.olharId('caixa_pizza_2')"); time.sleep(0.8)
    pg.screenshot(path=F+'21_pizzas.png')
    for caixa in ['caixa_pizza_2', 'caixa_pizza_1', 'caixa_pizza_fatia']:
        J(pg, f"__t.olharId('{caixa}')"); time.sleep(0.4); clique_dir(pg)
        est = J(pg, f"return j.seguraveis.get('{caixa}').estado"); print(caixa, est)
        if est == 'segurado':
            J(pg, '__t.olhar(-3.0, 0.3, -12.6)'); time.sleep(0.3); clique_dir(pg); time.sleep(1)
        J(pg, "__t.olharId('cyberdeck')"); time.sleep(0.4)
        print('  cyberdeck na mira?', pg.inner_text('.dica') if pg.is_visible('.dica') else '-')
    pg.screenshot(path=F+'22_cyberdeck_visivel.png')
    for _ in range(4):
        if J(pg, "return j.seguraveis.get('cyberdeck').estado") == 'segurado': break
        if J(pg, "return !!j.entrada && [...j.seguraveis.values()].some(s => s.estado === 'segurado')"): clique_dir(pg)
        J(pg, "__t.olharId('cyberdeck')"); time.sleep(0.4); clique_dir(pg)
    print('cyberdeck:', J(pg, "return j.seguraveis.get('cyberdeck').estado"), J(pg, 'return j.ponte.pegouCyberdeck'))
    pg.screenshot(path=F+'23_segurando_cyberdeck.png')
    print('pede encaixe:', esperar_pedido(pg, 'encaixar', 30), pedido(pg))
    J(pg, 'j.teleportar([0, 0, -16.6], 0)'); J(pg, '__t.olhar(-0.3, 1.0, -17.95)'); time.sleep(0.8); print('no console:', J(pg, 'return __t.pos()'))
    pg.screenshot(path=F+'24_no_console.png')
    clique_dir(pg)
    print('encaixou:', J(pg, 'return j.ponte.encaixou'))
    print('pede tangram:', esperar_pedido(pg, 'montar', 30), pedido(pg))
    time.sleep(1)
    pg.screenshot(path=F+'25_console_ligado.png')
    J(pg, '__t.olhar(0.1, 0.9, -17.6)'); time.sleep(0.5)
    print('dica:', pg.inner_text('.dica') if pg.is_visible('.dica') else '-')
    pg.mouse.click(640, 360); time.sleep(1.5)
    print('foco:', J(pg, 'return j.ponte.focoPC'))
    pg.screenshot(path=F+'26_foco.png')
    lugares = J(pg, 'return j.lugares()'); ocupados = set()
    def tela(x, z, y): return J(pg, f"return __t.noTela(...j.consoleParaMundo({x}, {y}, {z}))")
    def arrastar(nome, lug, giros, virar=0):
        pc = [x for x in J(pg, 'return j.pecas()') if x['nome'] == nome][0]
        a = tela(pc['centro'][0], pc['centro'][1], pc['pos'][1]); d = tela(lug['centro'][0] + 0.03, lug['centro'][1] + 0.02, lug['pos'][1])
        pg.mouse.move(*a); time.sleep(0.2); pg.mouse.down(); time.sleep(0.3)
        for _ in range(giros): pg.keyboard.press('e'); time.sleep(0.45)
        for _ in range(virar): pg.keyboard.press('f'); time.sleep(0.45)
        for i in range(1, 7): pg.mouse.move(a[0] + (d[0]-a[0])*i/6, a[1] + (d[1]-a[1])*i/6); time.sleep(0.08)
        time.sleep(0.4); pg.mouse.up(); time.sleep(0.5)
        return [x for x in J(pg, 'return j.pecas()') if x['nome'] == nome][0]
    # peças iguais trocam de lugar: pequeno_1 vai no encaixe do pequeno_2 e vice-versa; o mesmo com os grandes
    troca = {'peca_pequeno_1': 'peca_pequeno_2', 'peca_pequeno_2': 'peca_pequeno_1', 'peca_grande_1': 'peca_grande_2', 'peca_grande_2': 'peca_grande_1'}
    # paralelogramo virado do avesso não cabe: tem que voltar (F de novo)
    lp = [l for l in lugares if l['nome'] == 'peca_paralelogramo'][0]
    r = arrastar('peca_paralelogramo', lp, 0, virar=1)
    print('paralelogramo virado:', r['encaixada'], r['virada'])
    r = arrastar('peca_paralelogramo', lp, 4, virar=1)   # girado 180° (simetria) e desvirado
    print('paralelogramo girado 180°:', r['encaixada'], r['giro'])
    pg.screenshot(path=F+'27_tangram_meio.png')
    for nome in ['peca_grande_1', 'peca_grande_2', 'peca_medio', 'peca_pequeno_1', 'peca_pequeno_2', 'peca_quadrado']:
        pc = [x for x in J(pg, 'return j.pecas()') if x['nome'] == nome][0]
        if pc['encaixada']: continue
        alvo = troca.get(nome, nome)
        lug = [l for l in lugares if l['nome'] == alvo][0]
        # os encaixes são comparados pela forma: gira 45° por vez até a sombra aceitar (como o jogador faria)
        r = arrastar(nome, lug, 0); tent = 0
        while not r['encaixada'] and tent < 16: r = arrastar(nome, lug, 1); tent += 1
        print(nome, '->', r['encaixada'], 'giro', r['giro'], 'tentativas', tent)
    pg.screenshot(path=F+'28_tangram_pronto.png')
    print('pronto:', J(pg, 'return j.ponte.tangramPronto'), 'foco', J(pg, 'return j.ponte.focoPC'))
    print('estado final:', [(x['nome'], x['encaixada'], x['giro'], x['virada']) for x in J(pg, 'return j.pecas()')])
    print('fim:', pular(pg, 60, lambda: cenas(pg)['ponte_navegacao']['estado'] == 'terminada'), cenas(pg)['ponte_navegacao'])
    time.sleep(2.5)
    J(pg, '__t.olhar(0, 1.4, -17.6)'); time.sleep(1); pg.screenshot(path=F+'29_ponte_acesa.png')
    J(pg, 'j.teleportar([0, 0, 0.8], 0)'); J(pg, "__t.olharId('painel_luzes')"); time.sleep(2); pg.screenshot(path=F+'30_painel.png')
    print('progresso', J(pg, 'return JSON.stringify(j.progresso)'))
    print('\n'.join(erros[:30]) or 'sem erros')
    b.close()
