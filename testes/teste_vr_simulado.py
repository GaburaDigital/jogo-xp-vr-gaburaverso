# VR simulado: os controles viram objetos falsos (botões e posição) e a lógica do jogo roda igual ao Quest.
# Confere luvas (gatilho/grip), relógio no pulso, caixa no grip, puxar o cyberdeck de baixo das pizzas,
# botão da porta e tangram com o controle (girar e virar).
from base import *
VR = """
window.__vr = {
  ligar() { const j = window.__jogo; j.entrada.modo = 'vr';
    for (const [lado, h] of [['esq', 'left'], ['dir', 'right']]) { const m = j.entrada.maos[lado];
      m.fonte = { handedness: h, gamepad: { buttons: [...Array(7)].map(() => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] } };
      m.conectada = true; j.jogador.rig.add(m.pose); j.jogador.rig.add(m.mira); }
    j.camera.position.set(0, 1.6, 0); j.camera.rotation.set(0, 0, 0); j.prenderRelogio(); },
  // segurando o controle do jeito normal: cabo inclinado para frente (polegar para cima e para frente)
  mao(lado, x, y, z, mundo = true, quat = null) { const j = window.__jogo, T = j.three; const m = j.entrada.maos[lado]; const v = new T.Vector3(x, y, z);
    if (mundo) j.jogador.rig.worldToLocal(v); m.pose.position.copy(v); m.mira.position.copy(v);
    const q = quat ?? new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(1, 0, 0), new T.Vector3(0, 0.64, 0.77), new T.Vector3(0, -0.77, 0.64)));
    m.pose.quaternion.copy(q); m.pose.updateMatrixWorld(true); },
  botao(lado, i, v) { const b = window.__jogo.entrada.maos[lado].fonte.gamepad.buttons[i]; b.pressed = v; b.value = v ? 1 : 0; },
};
"""
def vr(pg, js): return pg.evaluate('() => { const j = window.__jogo; ' + js + ' }')
with sync_playwright() as p:
    b, pg, erros = abrir(p, 960, 600)
    entrar_pc(pg); pg.evaluate('() => {' + VR + '}')
    J(pg, 'j.agir("ir:livre")'); time.sleep(1)
    vr(pg, '__vr.ligar(); j.teleportar([0, 0, 0.8], 0);'); time.sleep(0.5)
    # 1) luvas paradas, gatilho, grip, punho (foto na frente da câmera)
    for nome, g, gr in [('80_luvas_paradas', 0, 0), ('81_luvas_gatilho', 1, 0), ('82_luvas_grip', 0, 1), ('83_luvas_punho', 1, 1)]:
        vr(pg, "__vr.mao('dir', 0.17, 1.24, -0.38, false); __vr.mao('esq', -0.17, 1.24, -0.38, false); j.camera.rotation.set(-0.5, 0, 0);")
        vr(pg, f"for (const l of ['esq','dir']) {{ __vr.botao(l, 0, {str(bool(g)).lower()}); __vr.botao(l, 1, {str(bool(gr)).lower()}); }}"); time.sleep(0.8)
        pg.screenshot(path=F + nome + '.png')
    vr(pg, "for (const l of ['esq','dir']) { __vr.botao(l, 0, false); __vr.botao(l, 1, false); } j.camera.rotation.set(0, 0, 0);")
    # 2) olhar o relógio: costas da mão esquerda viradas para os olhos
    vr(pg, """const T = j.three; const pos = new T.Vector3(-0.05, 1.3, -0.3);
      const para = new T.Vector3(0, 1.6, 0).sub(pos).normalize();
      // grip esquerdo: -X sai das costas da mão; gira para as costas olharem os olhos e o polegar apontar para frente
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(-1, 0, 0), para);
      __vr.mao('esq', pos.x, pos.y, pos.z, false, q);"""); time.sleep(0.8)
    J(pg, 'j.camera.lookAt(j.entrada.maos.esq.pose.getWorldPosition(new j.three.Vector3()))'); time.sleep(0.5)
    print('olhando relógio:', J(pg, 'return j.jogador.olhandoRelogio'))
    pg.screenshot(path=F + '84_relogio_vr.png')
    vr(pg, "__vr.mao('esq', -0.3, 0.9, 0.0, false)"); time.sleep(0.6)
    print('braço abaixado:', J(pg, 'return j.jogador.olhandoRelogio'))
    # 3) grip numa caixa
    c = J(pg, "const r = j.instancias.get('caixa_teste_4').raiz; const bb = new j.three.Box3().setFromObject(r); return [bb.getCenter(new j.three.Vector3()).toArray(), bb.max.y]")
    vr(pg, f"j.teleportar([{c[0][0]}, 0, {c[0][2] + 0.8}], 0)"); time.sleep(0.4)
    vr(pg, f"__vr.mao('dir', {c[0][0]}, {c[1] + 0.03}, {c[0][2]})"); time.sleep(0.6)
    vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.6)
    print('caixa:', J(pg, "return j.seguraveis.get('caixa_teste_4').estado"))
    vr(pg, f"__vr.mao('dir', {c[0][0]}, {c[1] + 0.6}, {c[0][2] + 0.2})"); time.sleep(0.6)
    vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(3)
    print('caiu:', J(pg, "const s = j.seguraveis.get('caixa_teste_4'); return [s.estado, s.inst.raiz.position.y.toFixed(3)]"))
    # 4) botão da porta do treinamento com a ponta da mão
    bt = J(pg, "return j.instancias.get('porta_treinamento').obj.getObjectByName('botao').getWorldPosition(new j.three.Vector3()).toArray()")
    vr(pg, f"j.teleportar([{bt[0] + 0.6}, 0, {bt[2] + 0.4}], 0)"); time.sleep(0.4)
    vr(pg, f"__vr.mao('dir', {bt[0]}, {bt[1]}, {bt[2]})"); time.sleep(6)
    print('portas abertas:', J(pg, "return [...j.portasAbertas]"))
    # 5) ponte: puxar o cyberdeck de baixo das pizzas (as pizzas têm que cair na mesa, não flutuar)
    J(pg, 'j.agir("ir:ponte_navegacao")'); time.sleep(1)
    cy = J(pg, "const bb = new j.three.Box3().setFromObject(j.instancias.get('cyberdeck').raiz); return [bb.getCenter(new j.three.Vector3()).toArray(), bb.min.y]")
    vr(pg, f"j.teleportar([{cy[0][0] + 0.7}, 0, {cy[0][2]}], 90)"); time.sleep(0.4)
    vr(pg, f"__vr.mao('dir', {cy[0][0] + 0.12}, {cy[0][1]}, {cy[0][2]})"); time.sleep(0.6)
    vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.6)
    print('cyberdeck:', J(pg, "return j.seguraveis.get('cyberdeck').estado"))
    antes = J(pg, "return ['caixa_pizza_1','caixa_pizza_2'].map(id => j.instancias.get(id).raiz.position.y.toFixed(3))")
    vr(pg, f"__vr.mao('dir', {cy[0][0] + 0.6}, 1.0, {cy[0][2]})"); time.sleep(4)
    depois = J(pg, "return ['caixa_pizza_1','caixa_pizza_2'].map(id => [j.seguraveis.get(id).estado, j.instancias.get(id).raiz.position.y.toFixed(3)])")
    print('pizzas antes', antes, 'depois', depois)
    # soltar o cyberdeck no chão: não pode afundar
    vr(pg, f"__vr.mao('dir', {cy[0][0] + 0.6}, 0.4, {cy[0][2] + 0.3})"); time.sleep(0.4); vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(4)
    print('cyberdeck no chão: menor y =', J(pg, "return new j.three.Box3().setFromObject(j.instancias.get('cyberdeck').raiz).min.y.toFixed(3)"), J(pg, "return j.seguraveis.get('cyberdeck').estado"))
    pg.screenshot(path=F + '85_pizzas_cyberdeck.png')
    # 6) tangram com o controle: girar (gatilho), virar (A) e encaixar
    vr(pg, "j.ponte.pegouCyberdeck = true; j.ponte.encaixou = true;")
    print('tangram:', pular(pg, 40, lambda: (pedido(pg) or '').startswith('montar')), pedido(pg))
    vr(pg, "j.teleportar([0, 0, -16.7], 0)"); time.sleep(0.4)
    pc = [x for x in J(pg, 'return j.pecas()') if x['nome'] == 'peca_quadrado'][0]
    lug = [x for x in J(pg, 'return j.lugares()') if x['nome'] == 'peca_quadrado'][0]
    a = J(pg, f"return j.consoleParaMundo({pc['centro'][0]}, {pc['pos'][1] + 0.03}, {pc['centro'][1]})")
    d = J(pg, f"return j.consoleParaMundo({lug['centro'][0] + 0.05}, {lug['pos'][1] + 0.03}, {lug['centro'][1] - 0.03})")
    vr(pg, f"__vr.mao('dir', {a[0]}, {a[1]}, {a[2]})"); time.sleep(0.5)
    vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.6)
    print('dica na mão:', J(pg, 'return [j.ponte.dicaTexto, j.ponte.dicaLado]'))
    vr(pg, "__vr.botao('dir', 0, true)"); time.sleep(0.4); vr(pg, "__vr.botao('dir', 0, false)"); time.sleep(0.4)
    vr(pg, f"__vr.mao('dir', {d[0]}, {d[1]}, {d[2]})"); time.sleep(0.8)
    pg.screenshot(path=F + '86_tangram_sombra.png')
    vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(0.6)
    print('quadrado (5 cm fora, girado 45°):', [x for x in J(pg, 'return j.pecas()') if x['nome'] == 'peca_quadrado'][0]['encaixada'])
    print('\n'.join([e for e in erros if 'useProgram' not in e and 'móveis' not in e][:20]) or 'sem erros')
    b.close()
