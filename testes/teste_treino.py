# Treinamento no PC: a máquina cospe os clones, eles se escondem, o jogador vai ao posto (só anda para os lados),
# pega a arma, erra um esconderijo de propósito, captura os 16 e a cena termina com a luz acesa.
from base import *
import math

def clones(pg): return J(pg, 'return j.clones()')
def contagem(pg):
    c = {}
    for k in clones(pg): c[k['estado']] = c.get(k['estado'], 0) + 1
    return c

with sync_playwright() as p:
    b, pg, erros = abrir(p, 960, 600)
    entrar_pc(pg)
    J(pg, 'j.testeTempo.escala = 4')
    J(pg, "j.irPara('treino_captura')"); time.sleep(2)
    print('cena:', cenas(pg)['treino_captura'], 'comecou:', J(pg, 'return j.treino.comecou'))
    J(pg, '__t.olhar(-19, 0.6, 1)'); time.sleep(3)
    pg.screenshot(path=F + '40_treino_esteira.png')
    # espera os 8 primeiros se esconderem
    for _ in range(80):
        c = contagem(pg)
        if c.get('escondido', 0) >= 8: break
        time.sleep(0.5)
    print('clones:', contagem(pg))
    J(pg, '__t.olhar(-19, 0.5, 0)'); time.sleep(1.5)
    pg.screenshot(path=F + '41_treino_escondidos.png')
    print('pedido:', pedido(pg))
    # vai ao posto e tenta andar para frente (não pode passar do posto) e para os lados
    J(pg, 'j.teleportar([-12.9, 0, -1.6], 90)'); time.sleep(1)
    print('limites:', J(pg, 'return JSON.stringify(j.jogador.limites)'))
    pg.keyboard.down('w'); time.sleep(2); pg.keyboard.up('w')
    print('andou para frente:', J(pg, 'return __t.pos()'))
    pg.keyboard.down('d'); time.sleep(3); pg.keyboard.up('d')
    print('andou para o lado:', J(pg, 'return __t.pos()'))
    J(pg, 'j.teleportar([-12.9, 0, -1.7], 90)'); time.sleep(0.5)
    pular(pg, 40, lambda: (pedido(pg) or '').startswith('pegar a arma'))
    print('pedido:', pedido(pg))
    J(pg, "__t.olharId('arma_laser')"); time.sleep(1)
    print('dica:', pg.inner_text('.dica') if pg.is_visible('.dica') else '-')
    pg.mouse.click(480, 300, button='right'); time.sleep(1)
    print('pegou arma:', J(pg, 'return j.treino.pegouArma'))
    J(pg, '__t.olhar(-19, 0.6, 0)'); time.sleep(1)
    pg.screenshot(path=F + '42_treino_arma.png')
    pular(pg, 40, lambda: (pedido(pg) or '').startswith('capturar'))
    print('pedido:', pedido(pg))
    # erra de propósito: mira no corpo de um esconderijo
    J(pg, "__t.olharId('caixa_robo_2', -0.25)"); time.sleep(0.5)
    pg.mouse.click(480, 300); time.sleep(4)
    pg.screenshot(path=F + '43_treino_erro.png')
    print('depois do erro, capturados:', J(pg, 'return j.treino.capturados'))
    # captura: como um jogador, anda para o lado até ver a cabeça do clone sem nada na frente e atira
    inicio = time.time(); tiros = 0
    while J(pg, 'return j.treino.capturados') < 16 and time.time() - inicio < 600:
        alvos = [k for k in clones(pg) if k['estado'] in ('escondido', 'andando')]
        feito = False
        for k in sorted(alvos, key=lambda k: -k['esfera'][1]):
            x, y, z, r = k['esfera']
            for zp in (0, -1, 1, -2, 2, -1.5, 1.5, -0.5, 0.5):
                olho = [-12.9, 1.6, zp]
                for f in (0.6, 0.85):
                    if J(pg, f"return j.oQueAcerta({olho}, [{x},{y + r * f},{z}])") == 'clone ' + str(k['n']):
                        J(pg, f'j.teleportar([-12.9, 0, {zp}], 90)'); J(pg, f'__t.olhar({x}, {y + r * f}, {z})'); time.sleep(0.25)
                        pg.mouse.click(480, 300); tiros += 1; time.sleep(1.4); feito = True; break
                if feito: break
            if feito: break
        if not feito: time.sleep(1)
        if tiros and tiros % 4 == 0 and feito: print('  tiros', tiros, 'capturados', J(pg, 'return j.treino.capturados'), contagem(pg))
        if tiros == 3 and feito: pg.screenshot(path=F + '44_treino_captura.png')
    print('capturados:', J(pg, 'return j.treino.capturados'), 'tiros:', tiros, 'completo:', J(pg, 'return j.treino.completo'))
    print('limites depois:', J(pg, 'return JSON.stringify(j.jogador.limites)'))
    J(pg, "__t.olharId('camara_captura', 0.3)"); time.sleep(2)
    pg.screenshot(path=F + '45_treino_camara.png')
    print('fim:', pular(pg, 90, lambda: cenas(pg)['treino_captura']['estado'] == 'terminada'), cenas(pg)['treino_captura'])
    print('progresso', J(pg, 'return JSON.stringify(j.progresso)'))
    print('falas por evento:', J(pg, 'return j.historicoAvulsas.join(", ")'))
    # botão "não aperte" depois da missão
    J(pg, 'j.teleportar([-15.6, 0, 3.6], 0)'); time.sleep(0.5)
    J(pg, "__t.olharId('botao_cuidado', 0.1)"); time.sleep(0.5); pg.mouse.click(480, 300); time.sleep(2)
    J(pg, 'j.teleportar([0, 0, 0.8], 0)'); J(pg, "__t.olharId('painel_luzes')"); time.sleep(2.5)
    pg.screenshot(path=F + '46_painel_treino.png')
    print('\n'.join(erros[:30]) or 'sem erros')
    b.close()
