# Final do jogo no PC: alavanca travada sem as 3 luzes; com as 3 luzes a faixa do portal acende, a alavanca destrava,
# puxar abre o portal, atravessar leva ao túnel (a plataforma anda sozinha, os hologramas se despedem) e os créditos
# aparecem em ordem, com Sair e Recomeçar.
from base import *

with sync_playwright() as p:
    b, pg, erros = abrir(p, 960, 600)
    entrar_pc(pg)
    J(pg, 'j.testeTempo.escala = 2')
    # 1) sem as 3 luzes: entra na câmara, a alavanca balança e a Gabu_IA explica
    J(pg, "j.irPara('livre')"); time.sleep(0.5)
    J(pg, 'j.teleportar([0, 0, 12.6], 180)'); time.sleep(1.5)
    J(pg, "__t.olharId('alavanca_portal', 0.2)"); time.sleep(0.6)
    print('dica:', pg.inner_text('.dica') if pg.is_visible('.dica') else '-')
    pg.mouse.click(480, 300); time.sleep(1)
    print('sem luzes · falas:', J(pg, 'return j.historicoAvulsas.join(", ")'), '· cena do portal:', cenas(pg)['portal_saida']['estado'])
    pg.screenshot(path=F + '70_portal_travado.png')
    # 2) com as 3 luzes (modo de teste completa as missões)
    J(pg, "j.irPara('portal_saida')"); time.sleep(1.5)
    print('faixa do portal acesa:', J(pg, "return j.progresso.eventos.includes('acender_caminho_portal')"))
    J(pg, 'j.teleportar([0, 0, 3.5], 180)'); J(pg, "__t.olhar(0, 0.2, 9)"); time.sleep(2); pg.screenshot(path=F + '71_faixa_portal.png')
    J(pg, 'j.teleportar([0, 0, 10.6], 180)'); time.sleep(1)
    pular(pg, 40, lambda: (pedido(pg) or '').startswith('ir até a alavanca'))
    print('pedido:', pedido(pg))
    J(pg, 'j.teleportar([0, 0, 13.4], 180)'); time.sleep(1)
    pular(pg, 20, lambda: (pedido(pg) or '').startswith('puxar'))
    print('pedido:', pedido(pg))
    J(pg, "__t.olharId('alavanca_portal', 0.2)"); time.sleep(0.6); pg.mouse.click(480, 300); time.sleep(1)
    print('puxou:', J(pg, 'return j.portal.alavancaPuxada'))
    time.sleep(6); J(pg, "__t.olhar(0, 2, 18.4)"); time.sleep(1); pg.screenshot(path=F + '72_portal_aberto.png')
    pular(pg, 40, lambda: (pedido(pg) or '').startswith('atravessar'))
    print('pedido:', pedido(pg))
    # 3) atravessar: escurece e vai para o túnel
    J(pg, 'j.teleportar([0, 0, 17.6], 180)'); time.sleep(0.5)
    print('esperando o túnel...', pular(pg, 60, lambda: cenas(pg)['tunel_despedida']['estado'] in ('tocando', 'aguardando')))
    time.sleep(1.5)
    z0 = J(pg, 'return __t.pos()'); time.sleep(4); z1 = J(pg, 'return __t.pos()')
    print('no túnel: a plataforma leva o jogador', z0, '->', z1, '· vinheta:', J(pg, 'return j.jogador.viajando'))
    pg.screenshot(path=F + '73_tunel.png')
    time.sleep(6); J(pg, '__t.olhar(-1.2, 1.0, -9.84 - 700)'); time.sleep(1.5); pg.screenshot(path=F + '74_tunel_holograma.png')
    # 4) créditos
    print('créditos:', pular(pg, 120, lambda: J(pg, 'return j.portal.creditos') >= 0), '· escuro:', round(J(pg, 'return j.escuro()'), 2))
    time.sleep(2); pg.screenshot(path=F + '75_creditos_inicio.png')
    for _ in range(40):
        if J(pg, 'return j.portal.creditos') >= 4: break
        time.sleep(0.5)
    J(pg, '__t.olhar(0, 1.58, -800)'); time.sleep(1); pg.screenshot(path=F + '76_creditos_fim.png')
    print('etapa final:', J(pg, 'return j.portal.creditos'), '· botões:', J(pg, 'return j.alvosAbertos()'), '· música:', J(pg, "return document.title && 'ok'"))
    print('progresso:', J(pg, 'return JSON.stringify(j.progresso.cenasConcluidas)'))
    # Recomeçar pede confirmação; Cancelar volta para os créditos
    J(pg, "j.acionar('confirmar:jogo')"); time.sleep(0.8); print('recomeçar → painel:', J(pg, 'return j.painelAberto()'))
    J(pg, "j.acionar('voltar')"); time.sleep(0.8); print('cancelar → painel:', J(pg, 'return j.painelAberto()'))
    J(pg, "j.acionar('creditos_sair')"); time.sleep(1.5)
    print('Sair → tela inicial:', pg.is_visible('button[aria-label="Jogar na versão adaptada para PC"]'))
    print('\n'.join(erros[:20]) or 'sem erros')
    b.close()
