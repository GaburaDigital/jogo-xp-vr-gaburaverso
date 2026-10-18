# Menu de pausa e painéis (Opções, Como jogar, Missão, Modo de teste) no PC.
from base import *
with sync_playwright() as p:
    b, pg, erros = abrir(p)
    entrar_pc(pg)
    J(pg, 'j.agir("ir:livre")'); time.sleep(1)
    print('ativo', pg.evaluate('() => document.activeElement && document.activeElement.outerHTML.slice(0, 80)'))
    pg.keyboard.press('Escape'); time.sleep(0.05); print('borda', J(pg, 'return j.entrada.menuBorda'))
    time.sleep(1.5); print('painel', J(pg, 'return j.painelAberto()'))
    pg.screenshot(path=F + '45_pausa.png')
    for a, nome in [('abrir:opcoes', '46_opcoes'), ('abrir:como_jogar', '47_como_jogar_pc'), ('abrir:missao', '48_missao'), ('abrir:teste', '49_teste')]:
        J(pg, f'j.agir("{a}")'); time.sleep(1.5); pg.screenshot(path=F + nome + '.png'); J(pg, 'j.agir("voltar")'); time.sleep(0.5)
    print('\n'.join([e for e in erros if 'useProgram' not in e][:20]) or 'sem erros')
    b.close()
