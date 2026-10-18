# VR simulado: os controles viram objetos falsos (botões e posição), a lógica do jogo roda igual ao Quest.
from base import *
VR = """
window.__vr = {
  ligar() { const j = window.__jogo; j.entrada.modo = 'vr';
    for (const [lado, h] of [['esq', 'left'], ['dir', 'right']]) { const m = j.entrada.maos[lado];
      m.fonte = { handedness: h, gamepad: { buttons: [...Array(7)].map(() => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] } };
      m.conectada = true; j.jogador.rig.add(m.pose); j.jogador.rig.add(m.mira); }
    j.camera.position.set(0, 1.6, 0); j.camera.rotation.set(0, 0, 0); j.prenderRelogio(); },
  mao(lado, x, y, z, mundo = true) { const j = window.__jogo; const m = j.entrada.maos[lado]; const v = new j.three.Vector3(x, y, z);
    if (mundo) j.jogador.rig.worldToLocal(v); m.pose.position.copy(v); m.pose.quaternion.identity(); m.mira.position.copy(v); m.pose.updateMatrixWorld(true); },
  botao(lado, i, v) { const b = window.__jogo.entrada.maos[lado].fonte.gamepad.buttons[i]; b.pressed = v; b.value = v ? 1 : 0; },
};
"""
def vr(pg, js): return pg.evaluate('() => { const j = window.__jogo; ' + js + ' }')
with sync_playwright() as p:
    b, pg, erros = abrir(p, 640, 400)
    entrar_pc(pg); pg.evaluate('() => {' + VR + '}')
    J(pg, 'j.agir("ir:livre")'); time.sleep(1)
    vr(pg, '__vr.ligar(); j.teleportar([0, 0, 0.8], 0);'); time.sleep(0.5)
    # 1) olhar o relógio
    vr(pg, "__vr.mao('esq', -0.05, 1.3, -0.3, false)"); time.sleep(0.6)
    print('olhando relógio:', J(pg, 'return j.jogador.olhandoRelogio'))
    vr(pg, "__vr.mao('esq', -0.3, 0.9, 0.0, false)"); time.sleep(0.6)
    print('braço abaixado:', J(pg, 'return j.jogador.olhandoRelogio'))
    # 2) grip numa caixa
    c = J(pg, "const r = j.instancias.get('caixa_teste_4').raiz; const bb = new j.three.Box3().setFromObject(r); return [bb.getCenter(new j.three.Vector3()).toArray(), bb.max.y]")
    vr(pg, f"j.teleportar([{c[0][0]}, 0, {c[0][2] + 0.8}], 0)"); time.sleep(0.4)
    vr(pg, f"__vr.mao('dir', {c[0][0]}, {c[1] + 0.03}, {c[0][2]})"); time.sleep(0.6)
    vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.6)
    print('caixa:', J(pg, "return j.seguraveis.get('caixa_teste_4').estado"))
    vr(pg, f"__vr.mao('dir', {c[0][0]}, {c[1] + 0.6}, {c[0][2] + 0.2})"); time.sleep(0.6)
    print('subiu junto:', J(pg, "return j.instancias.get('caixa_teste_4').raiz.position.y.toFixed(2)"))
    vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(3)
    print('caiu:', J(pg, "const s = j.seguraveis.get('caixa_teste_4'); return [s.estado, s.inst.raiz.position.y.toFixed(2)]"))
    # 3) botão da porta do treinamento com a ponta da mão
    bt = J(pg, "return j.instancias.get('porta_treinamento').obj.getObjectByName('botao').getWorldPosition(new j.three.Vector3()).toArray()")
    vr(pg, f"j.teleportar([{bt[0] + 0.6}, 0, {bt[2] + 0.4}], 0)"); time.sleep(0.4)
    vr(pg, f"__vr.mao('dir', {bt[0]}, {bt[1]}, {bt[2]})"); time.sleep(2)
    print('portas abertas:', J(pg, "return [...j.portasAbertas]"))
    # 4) tangram com o controle
    J(pg, 'j.agir("ir:ponte_navegacao")'); time.sleep(1)
    vr(pg, "j.ponte.pegouCyberdeck = true; j.ponte.encaixou = true;")
    print('tangram:', pular(pg, 40, lambda: (pedido(pg) or '').startswith('montar')), pedido(pg))
    vr(pg, "j.teleportar([0, 0, -16.7], 0)"); time.sleep(0.4)
    pc = [x for x in J(pg, 'return j.pecas()') if x['nome'] == 'peca_quadrado'][0]
    lug = [x for x in J(pg, 'return j.lugares()') if x['nome'] == 'peca_quadrado'][0]
    a = J(pg, f"return j.consoleParaMundo({pc['pos'][0]}, {pc['pos'][1] + 0.03}, {pc['pos'][2]})")
    d = J(pg, f"return j.consoleParaMundo({lug['pos'][0]}, {lug['pos'][1] + 0.03}, {lug['pos'][2]})")
    vr(pg, f"__vr.mao('dir', {a[0]}, {a[1]}, {a[2]})"); time.sleep(0.5)
    vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.6)
    print('dica na mão:', J(pg, 'return [j.ponte.dicaTexto, j.ponte.dicaLado]'))
    vr(pg, "__vr.botao('dir', 0, true)"); time.sleep(0.4); vr(pg, "__vr.botao('dir', 0, false)"); time.sleep(0.4)
    vr(pg, f"__vr.mao('dir', {d[0] + 0.01}, {d[1]}, {d[2] - 0.01})"); time.sleep(0.6)
    vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(0.6)
    print('quadrado:', [x for x in J(pg, 'return j.pecas()') if x['nome'] == 'peca_quadrado'][0])
    print('\n'.join([e for e in erros if 'useProgram' not in e][:20]) or 'sem erros')
    b.close()
