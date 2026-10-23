# Fotos de divulgação (README, página do jogo): 1280×720, sem mira e sem avisos da tela do PC.
# Liga e desliga o servidor sozinho, como os testes. Salva em testes/fotos/divulgacao/ (rascunho, fora do zip).
from base import *

D = F + 'divulgacao/'
os.makedirs(D, exist_ok=True)
LIMPAR = """() => { const c = document.querySelector('canvas');
  for (const e of document.body.querySelectorAll('*')) {
    if (e === c || e.contains(c) || e.closest('.legenda') || e.tagName === 'STYLE' || e.tagName === 'SCRIPT') continue;
    if (e.parentElement && (e.parentElement.contains(c) || e.parentElement === document.body)) { e.dataset.semHud = e.style.visibility || '-'; e.style.visibility = 'hidden'; }
  } }"""
VOLTAR = """() => { for (const e of document.querySelectorAll('[data-sem-hud]')) { e.style.visibility = e.dataset.semHud === '-' ? '' : e.dataset.semHud; delete e.dataset.semHud; } }"""
def foto(pg, nome, espera=1.5):
    # esconde a interface do PC só na hora da foto (escondida, o clique direito cairia fora do jogo e abriria o menu do Chrome)
    time.sleep(espera); pg.evaluate(LIMPAR); pg.screenshot(path=D + nome + '.png')
    pg.evaluate(VOLTAR); print('foto', nome)

def nova(p):
    b, pg, erros = abrir(p, 1280, 720)
    entrar_pc(pg)
    J(pg, 'j.testeTempo.escala = 2')
    return b, pg, erros

# cada foto numa página nova: mais estável no Chrome sem placa de vídeo dos testes
def sala_e_ponte(pg):
    # 1) sala central: janelas e a porta do portal ao fundo
    J(pg, "j.irPara('livre')"); time.sleep(1)
    J(pg, 'j.teleportar([0, 0, 1.6], 0)'); J(pg, '__t.olhar(0, 1.3, -6)'); foto(pg, '01_sala_central', 2.5)
    # 2) ponte: o tangram no console
    J(pg, "j.irPara('ponte_navegacao')"); time.sleep(1)
    J(pg, 'j.teleportar([0, 0, -12.6], 0)'); J(pg, '__t.olhar(0, 1.1, -17.6)'); foto(pg, '02_ponte', 2.5)

def treinamento(pg):
    # 3) clones escondidos e a arma na mão
    J(pg, "j.irPara('treino_captura')"); time.sleep(1)
    J(pg, 'j.testeTempo.escala = 4')
    for _ in range(90):
        if sum(1 for k in J(pg, 'return j.clones()') if k['estado'] == 'escondido') >= 5: break
        time.sleep(0.5)
    J(pg, 'j.teleportar([-12.9, 0, -1.7], 90)'); time.sleep(0.5)
    pular(pg, 60, lambda: (pedido(pg) or '').startswith('pegar a arma'))
    J(pg, "__t.olharId('arma_laser')"); time.sleep(0.6); pg.mouse.click(640, 360, button='right'); time.sleep(1)
    J(pg, 'j.testeTempo.escala = 1')
    J(pg, '__t.olhar(-17.5, 0.9, 0.2)'); foto(pg, '03_treinamento', 2)

def oficina_portal_tunel(pg):
    # 4) oficina e 5) portal: o modo de teste completa as três missões (LED aceso, três luzes)
    J(pg, "j.irPara('portal_saida')"); time.sleep(2)
    J(pg, 'j.teleportar([15.6, 0, 0.9], -90)'); J(pg, "__t.olharId('protoboard', -0.1)"); foto(pg, '04_oficina', 2.5)
    J(pg, 'j.teleportar([0, 0, 10.6], 180)'); time.sleep(1)
    pular(pg, 40, lambda: (pedido(pg) or '').startswith('ir até a alavanca'))
    J(pg, 'j.teleportar([0, 0, 13.4], 180)'); time.sleep(1)
    pular(pg, 20, lambda: (pedido(pg) or '').startswith('puxar'))
    J(pg, "__t.olharId('alavanca_portal', 0.2)"); time.sleep(0.6); pg.mouse.click(640, 360); time.sleep(7)
    J(pg, 'j.teleportar([0, 0, 13.0], 180)'); J(pg, '__t.olhar(0, 1.9, 18.4)'); foto(pg, '05_portal', 2)
    # 6) túnel: os hologramas se despedem
    pular(pg, 40, lambda: (pedido(pg) or '').startswith('atravessar'))
    J(pg, 'j.teleportar([0, 0, 17.6], 180)'); time.sleep(0.5)
    pular(pg, 60, lambda: cenas(pg)['tunel_despedida']['estado'] in ('tocando', 'aguardando'))
    time.sleep(9); J(pg, '__t.olhar(-0.7, 1.15, -9.84 - 700)'); foto(pg, '06_tunel', 1.5)

with servidor(), sync_playwright() as p:
    for parte in (sala_e_ponte, treinamento, oficina_portal_tunel):
        b, pg, erros = nova(p)
        parte(pg)
        print('\n'.join(erros[:20]) or 'sem erros')
        b.close()
