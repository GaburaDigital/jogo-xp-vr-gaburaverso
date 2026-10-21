# Entrega 2.1: portas com botão (abre, fecha pelo botão, abre sozinha por dentro, fecha sozinha ao voltar),
# uma fala de cada vez (capturas em sequência rápida: nenhuma voz por cima da outra e nada de "falta um" depois do fim),
# seta que some ao chegar no posto e clones com a cor normal.
from base import *

def porta(pg): return J(pg, "return j.portasAbertas.has('porta_treinamento')")

with sync_playwright() as p:
    b, pg, erros = abrir(p, 960, 600)
    entrar_pc(pg)
    J(pg, 'j.testeTempo.escala = 2')
    # 1) portas
    J(pg, "j.irPara('livre')"); time.sleep(1)
    J(pg, 'j.teleportar([-4.3, 0, 0.4], 90)'); time.sleep(0.5)
    def apertar():
        J(pg, "const b = j.instancias.get('porta_treinamento').obj.getObjectByName('botao'); const v = b.getWorldPosition(new j.three.Vector3()); __t.olhar(v.x, v.y, v.z)")
        time.sleep(0.4); pg.mouse.click(480, 300); time.sleep(2.5)
    apertar(); print('apertou: aberta', porta(pg))
    apertar(); print('apertou de novo: aberta', porta(pg))
    apertar(); J(pg, 'j.teleportar([-8.5, 0, 0], 90)'); time.sleep(1)
    print('passou para o corredor: aberta', porta(pg))
    J(pg, "j.agir('teste_fechar')") if False else None
    J(pg, 'j.teleportar([0, 0, 0.8], 0)'); time.sleep(5)
    print('voltou para a sala central (5 s): aberta', porta(pg))
    J(pg, 'j.teleportar([-7.6, 0, 0], -90)'); time.sleep(3)
    print('do lado de dentro, perto da porta fechada: abriu sozinha', porta(pg))
    # 2) seta: some ao pisar no posto da oficina
    J(pg, "j.irPara('oficina_energia')"); time.sleep(1)
    pular(pg, 90, lambda: (pedido(pg) or '').startswith('pisar'))
    print('pedido:', pedido(pg), '· seta aparecendo:', J(pg, 'return j.setaVisivel()'))
    J(pg, 'j.teleportar([16.4, 0, 0], -90)'); time.sleep(2)
    print('no posto · pedido:', pedido(pg), '· seta aparecendo:', J(pg, 'return j.setaVisivel()'))
    # 3) treinamento: clones com a cor normal (foto) e capturas em sequência rápida
    J(pg, "j.irPara('treino_captura')"); time.sleep(1)
    J(pg, 'j.testeTempo.escala = 4')
    for _ in range(90):
        if sum(1 for k in J(pg, 'return j.clones()') if k['estado'] == 'escondido') >= 5: break
        time.sleep(0.5)
    J(pg, '__t.olhar(-17.5, 0.7, 0.6)'); time.sleep(1.5); pg.screenshot(path=F + '60_clones_cor_normal.png')
    J(pg, 'j.teleportar([-12.9, 0, -1.7], 90)'); time.sleep(0.5)
    pular(pg, 60, lambda: (pedido(pg) or '').startswith('pegar a arma'))
    J(pg, "__t.olharId('arma_laser')"); time.sleep(0.6); pg.mouse.click(480, 300, button='right'); time.sleep(1)
    pular(pg, 60, lambda: (pedido(pg) or '').startswith('capturar'))
    J(pg, 'j.vozesJuntas.segundos = 0; j.tocadasAvulsas.length = 0')
    # 16 capturas, uma a cada 0,6 s (bem mais rápido que um jogador): os comentários não podem atropelar
    fim_captura = None
    for i in range(40):
        if J(pg, 'return j.treino.completo'): fim_captura = J(pg, 'return j.ctxAgora()'); break
        J(pg, 'j.capturarTeste()'); time.sleep(0.6)
    print('completo:', J(pg, 'return j.treino.completo'))
    pular(pg, 90, lambda: cenas(pg)['treino_captura']['estado'] == 'terminada')
    tocadas = J(pg, 'return j.tocadasAvulsas')
    print('comentários que tocaram:', [t['fala'][-3:] for t in tocadas])
    sobre = [(a['fala'], b2['fala']) for i, a in enumerate(tocadas) for b2 in tocadas[i + 1:] if b2['inicio'] < a['fim'] - 0.05]
    print('comentários um por cima do outro:', sobre or 'nenhum')
    print('"falta um" depois do fim:', [t for t in tocadas if t['fala'].endswith('013') and fim_captura and t['inicio'] > fim_captura] or 'não')
    print('tempo com fala da cena e comentário juntos:', round(J(pg, 'return j.vozesJuntas.segundos'), 2), 's')
    print('cena:', cenas(pg)['treino_captura'])
    print('\n'.join(erros[:20]) or 'sem erros')
    b.close()
