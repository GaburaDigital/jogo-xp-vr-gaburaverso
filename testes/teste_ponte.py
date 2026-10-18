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
    J(pg, 'j.teleportar([0, 0, -16.6], 0)'); J(pg, '__t.olhar(-0.3, 1.0, -17.95)'); time.sleep(0.8)
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
    for k in range(7):
        pecas = [x for x in J(pg, 'return j.pecas()') if not x['encaixada']]
        if not pecas: break
        pc = pecas[0]; tipo = pc['nome'].rsplit('_', 1)[0] if pc['nome'][-1].isdigit() else pc['nome']
        lug = [l for l in lugares if l['tipo'] == tipo and l['nome'] not in ocupados][0]
        a = J(pg, f"return __t.noTela(...j.consoleParaMundo({pc['pos'][0]}, {pc['pos'][1]}, {pc['pos'][2]}))")
        d = J(pg, f"return __t.noTela(...j.consoleParaMundo({lug['pos'][0]}, {lug['pos'][1]}, {lug['pos'][2]}))")
        pg.mouse.move(*a); time.sleep(0.2); pg.mouse.down(); time.sleep(0.3)
        sim = 90 if tipo == 'peca_quadrado' else 180 if tipo == 'peca_paralelogramo' else 360
        n = int(((lug['giro'] - pc['giro']) % sim) / 45)
        for _ in range(n): pg.mouse.wheel(0, 100); time.sleep(0.25)
        for i in range(1, 7): pg.mouse.move(a[0] + (d[0]-a[0])*i/6, a[1] + (d[1]-a[1])*i/6); time.sleep(0.08)
        time.sleep(0.3); pg.mouse.up(); time.sleep(0.4)
        r = [x for x in J(pg, 'return j.pecas()') if x['nome'] == pc['nome']][0]
        print(pc['nome'], 'giros', n, '->', r['encaixada'], [round(v,3) for v in r['pos']], r['giro'])
        if r['encaixada']: ocupados.add(r['encaixada'])
        if k == 2: pg.screenshot(path=F+'27_tangram_meio.png')
    pg.screenshot(path=F+'28_tangram_pronto.png')
    print('pronto:', J(pg, 'return j.ponte.tangramPronto'), 'foco', J(pg, 'return j.ponte.focoPC'))
    print('fim:', pular(pg, 60, lambda: cenas(pg)['ponte_navegacao']['estado'] == 'terminada'), cenas(pg)['ponte_navegacao'])
    time.sleep(2.5)
    J(pg, '__t.olhar(0, 1.4, -17.6)'); time.sleep(1); pg.screenshot(path=F+'29_ponte_acesa.png')
    J(pg, 'j.teleportar([0, 0, 0.8], 0)'); J(pg, "__t.olharId('painel_luzes')"); time.sleep(2); pg.screenshot(path=F+'30_painel.png')
    print('progresso', J(pg, 'return JSON.stringify(j.progresso)'))
    print('\n'.join(erros[:30]) or 'sem erros')
    b.close()
