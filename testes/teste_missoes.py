# Missões em qualquer ordem: reiniciar o treinamento no meio da captura, trocar de sala com uma missão pela metade,
# completar treinamento e oficina (modo de teste) e conferir que tudo volta igual ao recarregar a página.
from base import *

def contagem(pg):
    c = {}
    for k in J(pg, 'return j.clones()'): c[k['estado']] = c.get(k['estado'], 0) + 1
    return c

with sync_playwright() as p:
    b, pg, erros = abrir(p, 960, 600)
    entrar_pc(pg)
    J(pg, 'j.testeTempo.escala = 4')
    # 1) treinamento: no posto, reiniciar a missão pelo menu
    J(pg, "j.irPara('treino_captura')"); time.sleep(8)
    J(pg, 'j.teleportar([-12.9, 0, 0], 90)'); time.sleep(1)
    print('antes de reiniciar:', contagem(pg), 'limites:', J(pg, 'return !!j.jogador.limites'))
    J(pg, "j.agir('confirmar:missao')"); J(pg, "j.agir('confirmar_sim')"); time.sleep(1)
    print('reiniciou:', cenas(pg)['treino_captura'], contagem(pg), 'limites:', J(pg, 'return !!j.jogador.limites'), J(pg, 'return __t.pos()'))
    # 2) objetivo no menu "Ver missão" quando está livre
    J(pg, "j.irPara('livre')"); time.sleep(1)
    print('objetivo livre:', J(pg, "return j.diretor.ativa ? 'ativa' : 'livre'"))
    # 3) ponte pela metade e o jogador entra na oficina: a ponte volta ao começo e a oficina começa
    J(pg, "j.irPara('ponte_navegacao')"); time.sleep(2)
    J(pg, 'j.teleportar([12, 0, 0], -90)'); time.sleep(2.5)
    c = cenas(pg); print('trocou de sala:', c['ponte_navegacao']['estado'], c['oficina_energia']['estado'])
    # 4) completar as duas pelo modo de teste e recarregar
    J(pg, "j.completarMissao()"); pular(pg, 120, lambda: cenas(pg)['oficina_energia']['estado'] == 'terminada')
    J(pg, "j.irPara('treino_captura')"); time.sleep(1); J(pg, "j.completarMissao()")
    pular(pg, 120, lambda: cenas(pg)['treino_captura']['estado'] == 'terminada')
    print('progresso:', J(pg, 'return JSON.stringify(j.progresso)'))
    pg.reload(); pg.wait_for_function('() => window.__jogo && window.__jogo.pronto()', timeout=180000); prep(pg)
    print('depois de recarregar:', contagem(pg), J(pg, 'return j.treino.capturados'),
          [(x['id'], x['encaixada']) for x in J(pg, 'return j.pecasOficina()')], 'LED do jogador visível:', J(pg, "return j.instancias.get('led').raiz.visible"))
    pg.click('button[aria-label="Jogar na versão adaptada para PC"]'); time.sleep(0.3)
    pg.click('button[aria-label="Continuar no PC"]'); time.sleep(1.5)
    J(pg, 'j.teleportar([-12.9, 0, 0], 90)'); J(pg, "__t.olharId('camara_captura', 0.2)"); time.sleep(2.5); pg.screenshot(path=F + '47_camara_recarregada.png')
    J(pg, 'j.teleportar([0, 0, 0.8], 0)'); J(pg, "__t.olharId('painel_luzes')"); time.sleep(2.5); pg.screenshot(path=F + '48_painel_tres_luzes.png')
    J(pg, "j.agir('abrir:missao')"); time.sleep(1.5); pg.screenshot(path=F + '49_missao_tres_luzes.png')
    print('\n'.join(erros[:30]) or 'sem erros')
    b.close()
