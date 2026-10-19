# Tela inicial com jogo salvo, "Jogar do início", menu de pausa 4 × 2, "Reiniciar missão" (atual → última concluída → jogo),
# "Recomeçar jogo" e a colisão da mesa das pizzas no PC.
from base import *
SALVO = "localStorage.setItem('nave_progresso_v1', JSON.stringify({ cenasConcluidas: ['sala_abertura', 'ponte_navegacao'], eventos: ['acender_faixas_chao', 'missao_completa_ponte', 'acender_luz_ponte'] }))"
def pronto(pg): pg.wait_for_function('() => window.__jogo && window.__jogo.pronto()', timeout=180000); time.sleep(0.5)
with sync_playwright() as p:
    b, pg, erros = abrir(p)
    pg.goto(URL); pronto(pg); pg.screenshot(path=F + '90_inicio_sem_salvo.png')
    print('sem salvo, botão do início:', pg.locator('button[aria-label="Jogar do início"]').count())
    pg.evaluate('() => ' + SALVO); pg.reload(); pronto(pg)
    pg.screenshot(path=F + '91_inicio_salvo.png')
    pg.click('button[aria-label="Jogar do início"]'); time.sleep(0.4); pg.screenshot(path=F + '92_confirmar_inicio.png')
    pg.click('button[aria-label="Cancelar"]'); time.sleep(0.3)
    print('cancelar mantém:', pg.evaluate("() => localStorage.getItem('nave_progresso_v1')"))
    pg.click('button[aria-label="Jogar do início"]'); time.sleep(0.3); pg.click('button[aria-label="Sim, recomeçar"]'); time.sleep(0.5)
    print('depois de apagar:', pg.evaluate("() => localStorage.getItem('nave_progresso_v1')"), '| botão some:', pg.locator('button[aria-label="Jogar do início"]').count())
    pg.screenshot(path=F + '93_inicio_apagado.png')
    # jogo com a ponte concluída: "Reiniciar missão" reinicia a ponte (a última concluída)
    pg.evaluate('() => ' + SALVO); pg.reload(); pronto(pg)
    pg.click('button[aria-label="Jogar na versão adaptada para PC"]'); time.sleep(0.3); pg.click('button[aria-label="Continuar no PC"]'); time.sleep(1.5); prep(pg)
    print('continuar:', [(c['id'], c['estado']) for c in J(pg, 'return j.estadoCenas()')][:2])
    J(pg, 'j.entrada.menuBorda = true'); time.sleep(1.5); pg.screenshot(path=F + '94_pausa_4x2.png')
    print('alvos da pausa:', J(pg, 'return j.alvosAbertos()'))
    J(pg, 'j.agir("confirmar:missao")'); time.sleep(1.5); pg.screenshot(path=F + '95_confirmar_missao.png')
    J(pg, 'j.agir("confirmar_sim")'); time.sleep(2)
    print('reiniciou a ponte:', [(c['id'], c['estado']) for c in J(pg, 'return j.estadoCenas()')][:2], J(pg, 'return JSON.stringify(j.progresso)'), J(pg, 'return __t.pos()'))
    # com a ponte em andamento: reinicia a própria ponte
    J(pg, 'j.agir("confirmar:missao")'); time.sleep(0.5); J(pg, 'j.agir("confirmar_sim")'); time.sleep(1.5)
    print('ponte em andamento → ponte:', [(c['id'], c['estado'], c['t']) for c in J(pg, 'return j.estadoCenas()')][1])
    # recomeçar jogo
    J(pg, 'j.agir("confirmar:jogo")'); time.sleep(1.5); pg.screenshot(path=F + '96_confirmar_jogo.png'); J(pg, 'j.agir("confirmar_sim")'); time.sleep(2)
    print('recomeçou o jogo:', [(c['id'], c['estado']) for c in J(pg, 'return j.estadoCenas()')][:2], J(pg, 'return JSON.stringify(j.progresso)'), J(pg, 'return __t.pos()'))
    # nada concluído e abertura tocando: "Reiniciar missão" = recomeçar o jogo (abertura)
    J(pg, 'j.agir("confirmar:missao")'); time.sleep(1.2); print('na abertura, painel:', J(pg, 'return j.painelAberto()')); pg.screenshot(path=F + '97_confirmar_abertura.png')
    J(pg, 'j.agir("voltar")'); time.sleep(0.5); J(pg, 'j.agir("continuar")'); time.sleep(0.5)
    # colisão: andar para dentro da mesa das pizzas
    J(pg, 'j.agir("ir:ponte_navegacao")'); time.sleep(1)
    J(pg, 'j.teleportar([-3.6, 0, -14.2], 90)'); time.sleep(0.5)
    x0 = J(pg, 'return __t.pos()'); pg.keyboard.down('w'); time.sleep(5); pg.keyboard.up('w'); x1 = J(pg, 'return __t.pos()')
    print('andar contra a mesa:', x0, '->', x1)
    pg.screenshot(path=F + '98_mesa.png')
    print('\n'.join([e for e in erros if 'useProgram' not in e and 'móveis' not in e][:20]) or 'sem erros')
    b.close()
