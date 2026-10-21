# VR simulado: os controles viram objetos falsos (botões e posição) e a lógica do jogo roda igual ao Quest.
# Confere luvas (gatilho/grip), relógio no pulso, caixa no grip, puxar o cyberdeck de baixo das pizzas,
# botão da porta e tangram com o controle (girar e virar).
from base import *
VR = """
window.__vr = {
  ligar() { const j = window.__jogo; j.entrada.modo = 'vr';
    for (const [lado, h] of [['esq', 'left'], ['dir', 'right']]) { const m = j.entrada.maos[lado];
      m.fonte = { handedness: h, gamepad: { buttons: [...Array(7)].map(() => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0],
        hapticActuators: [{ pulse: (v, d) => { (window.__vib ||= []).push([lado, +v.toFixed(2), d]); return Promise.resolve(true); } }] } };
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
    # cabeça por cima da caixa (se abaixando, sem andar): a caixa não pode fugir
    antes_cx = J(pg, "return j.instancias.get('caixa_teste_4').raiz.position.toArray().map(v => +v.toFixed(3))")
    vr(pg, f"j.teleportar([{c[0][0]}, 0, {c[0][2]}], 0); j.camera.position.y = 1.0"); time.sleep(1)
    print('cabeça em cima da caixa: antes', antes_cx, 'depois', J(pg, "return j.instancias.get('caixa_teste_4').raiz.position.toArray().map(v => +v.toFixed(3))"))
    vr(pg, f"j.camera.position.y = 1.6; j.teleportar([{c[0][0]}, 0, {c[0][2] + 0.8}], 0)"); time.sleep(0.4)
    vr(pg, "window.__vib = []")
    vr(pg, f"__vr.mao('dir', {c[0][0]}, {c[1] + 0.12}, {c[0][2]})"); time.sleep(0.6)  # 12 cm acima: ainda não encosta
    vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.6)
    print('caixa (mão 12 cm acima):', J(pg, "return j.seguraveis.get('caixa_teste_4').estado"), 'vibrações:', J(pg, 'return JSON.stringify(window.__vib)'))
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
    # 7) peça solta FORA da mesa volta para o começo; solta EM CIMA da mesa fica deitada onde caiu
    def peca(nome): return [x for x in J(pg, 'return j.pecas()') if x['nome'] == nome][0]
    pm = peca('peca_medio'); ini = pm['pos']
    a = J(pg, f"return j.consoleParaMundo({pm['centro'][0]}, {pm['pos'][1] + 0.03}, {pm['centro'][1]})")
    vr(pg, f"__vr.mao('dir', {a[0]}, {a[1]}, {a[2]})"); time.sleep(0.4); vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.5)
    vr(pg, f"__vr.mao('dir', {a[0]}, {a[1] + 0.3}, {a[2]})"); time.sleep(0.5)
    print('peça no ar, na mão:', peca('peca_medio')['pos'], '(começo', ini, ')')
    fora = J(pg, "return j.consoleParaMundo(1.4, 1.0, 0.0)")
    vr(pg, f"__vr.mao('dir', {fora[0]}, {fora[1]}, {fora[2]})"); time.sleep(0.5); vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(0.5)
    print('solta fora da mesa → volta:', peca('peca_medio')['pos'] == ini, peca('peca_medio')['pos'])
    a = J(pg, f"return j.consoleParaMundo({peca('peca_medio')['centro'][0]}, {ini[1] + 0.03}, {peca('peca_medio')['centro'][1]})")
    vr(pg, f"__vr.mao('dir', {a[0]}, {a[1]}, {a[2]})"); time.sleep(0.4); vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.5)
    meio = J(pg, "return j.consoleParaMundo(-0.75, 1.1, 0.25)")
    vr(pg, f"__vr.mao('dir', {meio[0]}, {meio[1]}, {meio[2]})"); time.sleep(0.5); vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(0.5)
    print('solta em cima da mesa → fica deitada lá:', peca('peca_medio')['pos'])
    # 8) tocar no Gabura: vibradinha
    vr(pg, "window.__vib = []")
    g = J(pg, "return j.instancias.get('gabura').raiz.getWorldPosition(new j.three.Vector3()).toArray()")
    vr(pg, f"j.teleportar([{g[0]}, 0, {g[2] + 0.8}], 0)"); time.sleep(0.3)
    vr(pg, f"__vr.mao('esq', {g[0]}, 0.9, {g[2]})"); time.sleep(0.6)
    print('tocou no Gabura, vibrações:', J(pg, 'return JSON.stringify(window.__vib)'))
    vr(pg, "__vr.mao('esq', -0.3, 0.9, 0.0, false)")
    # 9) treinamento: pegar a arma com o grip, mira pontilhada, atirar (vibração forte), soltar → volta para o suporte
    J(pg, 'j.agir("ir:treino_captura")'); time.sleep(1)
    vr(pg, "j.teleportar([-12.9, 0, -1.9], 90)"); time.sleep(0.5)
    ar = J(pg, "const bb = new j.three.Box3().setFromObject(j.instancias.get('arma_laser').raiz); return bb.getCenter(new j.three.Vector3()).toArray()")
    vr(pg, "window.__vib = []")
    vr(pg, f"__vr.mao('dir', {ar[0] + 0.05}, {ar[1] + 0.08}, {ar[2]})"); time.sleep(0.5)
    vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.6)
    print('arma na mão:', J(pg, 'return j.treino.pegouArma'))
    q = "new j.three.Quaternion().setFromAxisAngle(new j.three.Vector3(0, 1, 0), Math.PI / 2)"
    vr(pg, f"__vr.mao('dir', -13.1, 1.25, -1.7, true, {q}); j.entrada.maos.dir.mira.quaternion.copy({q})"); time.sleep(0.8)
    pg.screenshot(path=F + '87_arma_vr.png')
    vr(pg, "__vr.botao('dir', 0, true)"); time.sleep(0.3); vr(pg, "__vr.botao('dir', 0, false)"); time.sleep(1)
    print('vibrações (perto, segurou, tiro):', J(pg, 'return JSON.stringify(window.__vib)'))
    vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(2.5)
    sp = J(pg, "return j.instancias.get('arma_laser').raiz.position.toArray().map(v => +v.toFixed(2))")
    print('soltou → arma no suporte:', sp)
    # 10) oficina: LED (começa virado) encaixado ao contrário; puxar de volta não pode grudar de novo; virar com A e encaixar
    J(pg, 'j.agir("ir:oficina_energia")'); time.sleep(1)
    vr(pg, "j.teleportar([16.5, 0, -1.4], -90)"); time.sleep(0.4)
    def pegar_led():
        led = J(pg, "const bb = new j.three.Box3().setFromObject(j.instancias.get('led').raiz); return bb.getCenter(new j.three.Vector3()).toArray()")
        vr(pg, f"__vr.mao('dir', {led[0]}, {led[1] + 0.1}, {led[2]})"); time.sleep(0.5)
        vr(pg, "__vr.botao('dir', 1, true)"); time.sleep(0.5)
        return J(pg, "const s = j.seguraveis.get('led'); const p = s.inst.raiz.position, m = j.entrada.maos.dir.pose.getWorldPosition(new j.three.Vector3()); return [m.x - p.x, m.y - p.y, m.z - p.z]")
    al = J(pg, "return j.alvosOficina().led")
    def mao_no(dx, dy, dz, off): vr(pg, f"__vr.mao('dir', {al[0] + off[0] + dx}, {al[1] + off[1] + dy}, {al[2] + off[2] + dz})")
    off = pegar_led(); mao_no(0.05, 0.05, 0, off); time.sleep(0.6); vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(0.6)
    print('LED ao contrário:', [x for x in J(pg, 'return j.pecasOficina()') if x['id'] == 'led'][0]['encaixada'])
    off = pegar_led(); time.sleep(1.0)
    print('puxou o LED encaixado: está na mão (não grudou)?', J(pg, "return j.seguraveis.get('led').estado"))
    vr(pg, "__vr.botao('dir', 4, true)"); time.sleep(0.3); vr(pg, "__vr.botao('dir', 4, false)"); time.sleep(0.3)
    mao_no(0, 0.2, 0, off); time.sleep(0.5)          # afasta 20 cm
    mao_no(0.03, 0.03, 0, off); time.sleep(0.6)
    pg.screenshot(path=F + '88_led_vr.png')
    vr(pg, "__vr.botao('dir', 1, false)"); time.sleep(0.6)
    print('virado com A, afastou e voltou → encaixado certo:', [x for x in J(pg, 'return j.pecasOficina()') if x['id'] == 'led'][0]['encaixada'])
    # 11) clones de perto (cor normal)
    J(pg, 'j.agir("ir:treino_captura")'); J(pg, 'j.testeTempo.escala = 4'); time.sleep(14)
    vr(pg, "j.teleportar([-12.9, 0, 0.6], 90)"); time.sleep(0.3)
    c = [k for k in J(pg, 'return j.clones()') if k['estado'] in ('escondido', 'andando')]
    if c:
        x, y, z, r = c[0]['esfera']; J(pg, f"j.camera.lookAt({x}, {y}, {z})"); time.sleep(1); pg.screenshot(path=F + '89_clone_perto.png')
    print('\n'.join([e for e in erros if 'useProgram' not in e and 'móveis' not in e][:20]) or 'sem erros')
    b.close()
