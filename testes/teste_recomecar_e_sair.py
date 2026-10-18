# Recomeçar a missão, sair para a tela inicial e voltar.
from base import *
with sync_playwright() as p:
    b, pg, erros = abrir(p, 800, 450)
    entrar_pc(pg)
    J(pg, 'j.agir("ir:ponte_navegacao")'); time.sleep(1)
    print('pede:', pular(pg, 60, lambda: (pedido(pg) or '').startswith('achar')))
    J(pg, "j.teleportar([-3.5, 0, -13.9], 90)"); J(pg, "__t.olharId('caixa_pizza_2')"); time.sleep(0.5)
    pg.mouse.click(400, 225, button='right'); time.sleep(0.5)
    print('pizza:', J(pg, "return j.seguraveis.get('caixa_pizza_2').estado"))
    J(pg, 'j.agir("recomecar")'); time.sleep(3)
    print('depois de recomeçar:', J(pg, "return [j.seguraveis.get('caixa_pizza_2').estado, j.instancias.get('caixa_pizza_2').raiz.position.toArray().map(v => +v.toFixed(2))]"), cenas(pg)['ponte_navegacao'], __import__('json').dumps(J(pg, 'return __t.pos()')))
    J(pg, 'j.agir("sair")'); time.sleep(1)
    print('tela inicial:', pg.is_visible('#inicio'), J(pg, 'return j.jogando()'))
    pg.click('button[aria-label="Jogar na versão adaptada para PC"]'); time.sleep(0.3); pg.click('button[aria-label="Continuar no PC"]'); time.sleep(2)
    print('de volta:', J(pg, 'return j.jogando()'), cenas(pg)['ponte_navegacao'])
    print('\n'.join([e for e in erros if 'useProgram' not in e][:20]) or 'sem erros')
    b.close()
