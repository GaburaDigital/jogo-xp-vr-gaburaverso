// O corpo do jogador: a "plataforma" (rig) com a câmera, andar com o analógico ou W A S D, girar
// (em passos ou contínuo, como escolhido nas Opções), paredes e portas que seguram, escurecer as bordas
// ao andar e o relógio do pulso esquerdo (o comunicador da Gabu_IA).
// Analogia Godot: é o XROrigin3D com a XRCamera3D e os XRController3D dentro.

import * as THREE from 'three';
import { camera, cena3d, empurrarParaFora, gltf } from '../mundo/mundo';
import { entrada } from './entrada';
import { opcoes } from '../nucleo/config';
import { ESTILOS_LUVA, criarLuva, orientarNoGrip, poseRelogioNaLuva, type Luva } from './luvas';

export const ALTURA_OLHOS = 1.6;
const VELOCIDADE = 1.4;           // m/s, a mesma do Simular VR do editor
const RAIO = 0.18;            // paredes (19/10: o corpo diminuiu)
const RAIO_MOVEIS = 0.12;

export const jogador = {
  rig: new THREE.Group(),
  atravessar: false,              // modo de teste: atravessar paredes
  parado: false,                  // menu aberto ou câmera de foco do PC: não anda
  andando: false,
  olhandoRelogio: false,
  relogioPC: false,               // PC: R levanta o pulso
  alturaExtra: 0,                 // VR: m somados à plataforma (jogar sentado)
  /** Posto de missão: o jogador só anda dentro deste retângulo (treinamento: só para os lados). */
  limites: null as { x0: number; x1: number; z0: number; z1: number } | null,
};

/** Altura dos olhos medida pelo óculos (m, dentro da plataforma). */
export function alturaReal(): number { return camera.position.y; }
/** Mede agora: a altura atual dos olhos passa a valer 1,60 m. */
export function calibrarAltura(): number { return Math.max(0, Math.min(1.2, ALTURA_OLHOS - camera.position.y)); }

let vinheta: THREE.Mesh;
/** As luvas (só no VR; no PC a "mão" é a mira). */
export const luvas: { esq: Luva | null; dir: Luva | null } = { esq: null, dir: null };
let relogio: THREE.Group;
let comunicador: { obj: THREE.Object3D; mixer: THREE.AnimationMixer; falar: THREE.AnimationAction | null; chamar: THREE.AnimationAction | null; barras: THREE.Object3D[]; leds: Record<string, THREE.Object3D | undefined> } | null = null;

export function iniciarJogador(): void {
  const { rig } = jogador;
  rig.name = 'jogador';
  cena3d.add(rig);
  rig.add(camera);
  camera.position.set(0, ALTURA_OLHOS, 0);
  // vinheta de conforto: um anel escuro bem perto dos olhos (só aparece ao andar, se ligada nas Opções)
  vinheta = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.6, 32),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  vinheta.position.z = -0.12; vinheta.renderOrder = 999; vinheta.visible = false;
  camera.add(vinheta);
  relogio = new THREE.Group(); relogio.name = 'relogio';
  for (const [lado, sinal] of [['esq', -1], ['dir', 1]] as const) {
    const l = criarLuva(ESTILOS_LUVA.luar, sinal); orientarNoGrip(l, sinal); l.raiz.visible = false;
    entrada.maos[lado].pose.add(l.raiz); luvas[lado] = l;
  }
  void montarRelogio();
}

async function montarRelogio(): Promise<void> {
  const g = await gltf('comunicador.glb');
  if (!g) return;
  const obj = g.scene.clone(true);
  const mixer = new THREE.AnimationMixer(obj);
  const clipe = (n: string) => { const c = g.animations.find((a) => a.name === n); return c ? mixer.clipAction(c) : null; };
  const barras: THREE.Object3D[] = [];
  for (let i = 0; i < 7; i++) { const b = obj.getObjectByName('barra_' + i); if (b) barras.push(b); }
  relogio.add(obj);
  comunicador = { obj, mixer, falar: clipe('falar'), chamar: clipe('chamar'), barras,
    leds: { ponte: obj.getObjectByName('led_ponte_apagado'), treinamento: obj.getObjectByName('led_treinamento_apagado'), oficina: obj.getObjectByName('led_oficina_apagado') } };
  relogioFalando(0, 0);
  for (const m of ledsAcesos) ledRelogio(m as 'ponte', true); // o relógio carregou depois do progresso
}

/** Coloca o relógio no pulso esquerdo (VR) ou na frente da câmera quando o jogador aperta R (PC). */
export function prenderRelogio(): void {
  relogio.removeFromParent();
  if (entrada.modo === 'vr') {
    // no pulso da luva esquerda, como no desenho aprovado (rodada 5)
    luvas.esq!.raiz.add(relogio);
    poseRelogioNaLuva(relogio);
  } else {
    camera.add(relogio);
    relogio.position.set(-0.12, -0.11, -0.3);
    relogio.rotation.set(0.35, 0.35, 0);
  }
}

/** Onde a tela do relógio está e para onde ela olha (para o holograma da Gabu_IA e para detectar o olhar). */
export function poseRelogio(): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const pos = relogio.getWorldPosition(new THREE.Vector3());
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(relogio.matrixWorld);
  return { pos, normal };
}

/** Ondas na tela do relógio no ritmo da voz da Gabu_IA. */
export function relogioFalando(nivel: number, tempo: number): void {
  if (!comunicador) return;
  const c = comunicador;
  if (nivel > 0.02 && c.falar) {
    c.falar.enabled = true; c.falar.play(); c.falar.setEffectiveWeight(1);
    const d = c.falar.getClip().duration || 1; c.falar.time = tempo % d; c.mixer.update(0);
  } else {
    if (c.falar) c.falar.enabled = false;
    c.mixer.update(0);
    for (const b of c.barras) b.scale.set(1, 0.2, 1);
  }
}
/** A tela pisca (anel de chamada) quando alguém fala no relógio e o jogador não olha. */
export function relogioChamando(sim: boolean, tempo: number): void {
  const anel = comunicador?.obj.getObjectByName('anel_chamada');
  if (anel) anel.visible = !sim || Math.floor(tempo * 3) % 2 === 0;
}
/** Luz de missão no relógio (o LED apagado some quando a missão termina). */
const ledsAcesos = new Set<string>();
export function ledRelogio(missao: 'ponte' | 'treinamento' | 'oficina', aceso: boolean): void {
  if (aceso) ledsAcesos.add(missao); else ledsAcesos.delete(missao);
  const l = comunicador?.leds[missao]; if (l) l.visible = !aceso;
}

const tmp = new THREE.Vector3(), cabeca = new THREE.Vector3();
let giroArmado = true;

/** A cada quadro: andar, girar, colisão, vinheta e "olhando o relógio". */
export function atualizarJogador(dt: number): void {
  const { rig } = jogador;
  if (entrada.modo === 'vr') rig.position.y = jogador.alturaExtra;
  // PC: o mouse gira o corpo (yaw) e a cabeça (pitch)
  if (entrada.modo === 'pc') {
    rig.rotation.y = entrada.pc.yaw;
    camera.rotation.x = entrada.pc.pitch;
    camera.rotation.y = 0;
  }
  camera.getWorldPosition(cabeca);
  // ---- girar (só VR: no PC é o mouse) ----
  let girando = false;
  if (entrada.modo === 'vr' && !jogador.parado) {
    const g = entrada.girar;
    if (opcoes.giro === 'passos') {
      if (Math.abs(g) < 0.3) giroArmado = true;
      if (giroArmado && Math.abs(g) > 0.7) { girarEmVolta(-Math.sign(g) * THREE.MathUtils.degToRad(opcoes.passoGiro), cabeca); giroArmado = false; }
    } else if (Math.abs(g) > 0.01) { girarEmVolta(-g * THREE.MathUtils.degToRad(90) * dt, cabeca); girando = true; }
  }
  // ---- andar na direção em que a cabeça olha (só no chão) ----
  const a = entrada.andar;
  jogador.andando = !jogador.parado && a.lengthSq() > 0.01;
  if (jogador.andando) {
    const frente = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    frente.y = 0; frente.normalize();
    const lado = new THREE.Vector3(-frente.z, 0, frente.x);
    const v = frente.multiplyScalar(a.y).add(lado.multiplyScalar(a.x));
    if (v.lengthSq() > 1) v.normalize();
    rig.position.addScaledVector(v, VELOCIDADE * dt);
  }
  // ---- paredes e portas fechadas seguram (também quem anda de verdade na sala) ----
  if (!jogador.atravessar) {
    // paredes e portas: sempre (pela cabeça, na altura do chão)
    camera.getWorldPosition(cabeca); cabeca.y = 0.05;
    tmp.copy(cabeca);
    if (empurrarParaFora(tmp, RAIO, 'paredes')) { rig.position.x += tmp.x - cabeca.x; rig.position.z += tmp.z - cabeca.z; }
    // móveis: só quando anda com o analógico (no VR dá para se debruçar na mesa para pegar algo)
    if (jogador.andando || entrada.modo === 'pc') {
      camera.getWorldPosition(cabeca); cabeca.y = 0.05; tmp.copy(cabeca);
      if (empurrarParaFora(tmp, RAIO_MOVEIS, 'moveis')) { rig.position.x += tmp.x - cabeca.x; rig.position.z += tmp.z - cabeca.z; }
    }
  }
  // ---- posto de missão: só anda dentro do retângulo (também quem anda de verdade na sala) ----
  const L = jogador.limites;
  if (L) {
    camera.getWorldPosition(cabeca);
    const x = THREE.MathUtils.clamp(cabeca.x, L.x0, L.x1), z = THREE.MathUtils.clamp(cabeca.z, L.z0, L.z1);
    rig.position.x += x - cabeca.x; rig.position.z += z - cabeca.z;
  }
  // ---- conforto: escurece as bordas enquanto anda ou gira ----
  const alvo = opcoes.bordas && (jogador.andando || girando) ? 0.85 : 0;
  const mat = vinheta.material as THREE.MeshBasicMaterial;
  mat.opacity += (alvo - mat.opacity) * Math.min(1, dt * 8);
  vinheta.visible = mat.opacity > 0.01;
  // ---- relógio: está olhando? (tela virada para os olhos e perto do rosto) ----
  if (entrada.modo === 'vr') {
    relogio.visible = true;
    const { pos, normal } = poseRelogio();
    camera.getWorldPosition(cabeca);
    const paraOlhos = cabeca.clone().sub(pos);
    const dist = paraOlhos.length();
    jogador.olhandoRelogio = entrada.maos.esq.conectada && dist < 0.55 && normal.dot(paraOlhos.normalize()) > 0.6;
  } else {
    if (entrada.relogioBorda) jogador.relogioPC = !jogador.relogioPC;
    relogio.visible = jogador.relogioPC;
    jogador.olhandoRelogio = jogador.relogioPC;
  }
  comunicador?.mixer.update(0);
  // luvas: só no VR, acompanhando o quanto gatilho e grip estão apertados
  for (const lado of ['esq', 'dir'] as const) {
    const l = luvas[lado], m = entrada.maos[lado]; if (!l) continue;
    l.raiz.visible = entrada.modo === 'vr' && m.conectada;
    if (l.raiz.visible) l.posar(m.gatilhoValor, m.gripValor);
  }
}

function girarEmVolta(angulo: number, centro: THREE.Vector3): void {
  const { rig } = jogador;
  const d = rig.position.clone().sub(centro);
  d.applyAxisAngle(new THREE.Vector3(0, 1, 0), angulo);
  rig.position.copy(centro).add(d); rig.position.y = jogador.alturaExtra;
  rig.rotation.y += angulo;
}

/** Leva o jogador para um lugar (ex.: modo de teste "ir para a cena"). Olha para rotY (graus). */
export function teleportar(pos: [number, number, number], rotY: number): void {
  const { rig } = jogador;
  const r = THREE.MathUtils.degToRad(rotY);
  if (entrada.modo === 'pc') { entrada.pc.yaw = r; entrada.pc.pitch = 0; rig.rotation.y = r; rig.position.set(pos[0], 0, pos[2]); return; }
  rig.position.y = jogador.alturaExtra;
  // no VR a cabeça pode estar fora do centro da plataforma: compensa para a cabeça cair no ponto
  rig.rotation.y = r; rig.updateMatrixWorld(true);
  camera.getWorldPosition(cabeca);
  rig.position.x += pos[0] - cabeca.x; rig.position.z += pos[2] - cabeca.z; rig.position.y = jogador.alturaExtra;
}

/** Olho e direção do olhar (para "olhar" do aguardar, seta e luzes). */
export function olhar(): { origem: THREE.Vector3; direcao: THREE.Vector3 } {
  return { origem: camera.getWorldPosition(new THREE.Vector3()), direcao: camera.getWorldDirection(new THREE.Vector3()) };
}
export function posicaoPes(): THREE.Vector3 { const p = camera.getWorldPosition(new THREE.Vector3()); p.y = 0; return p; }
