// Missão da oficina: montar o circuito na protoboard gigante para ligar o motor.
// Pilhas (já na placa) → jumper vermelho → resistor 220 Ω → LED (perna longa no +) → jumper preto.
// Cada peça certa encaixa com um "clique" magnético perto do lugar dela (a sombra Lima mostra onde).
// Pegadinhas: o resistor queimado e o jumper curto não encaixam (o MetalgabuTRON comenta ao pegar).
// O LED ao contrário encaixa, mas não acende: é preciso virar (VR: A ou girar a mão; PC: F).
// As falas e a ordem vêm da cena "oficina_energia" do Editor de Cenas; aqui fica o que depende do jogador.
//
// VR: as peças são objetos de pegar (grip). PC: a câmera para na frente da protoboard e o mouse arrasta as peças.

import * as THREE from 'three';
import { camera, cena3d, instancias } from '../mundo/mundo';
import { entrada, vibrarTipo } from '../xr/entrada';
import { tocar } from '../nucleo/audio';
import { desativar, ganchos, registrarSeguravel, restaurar, seguraveis, type Seguravel } from '../interacao/seguraveis';
import { diretor, falaPorEvento, tempoGlobal, zerarFalasPorEvento } from '../cenas/diretor';
import { posicaoPes } from '../xr/jogador';

export const oficina = {
  montagemAtiva: false,   // a cena pediu para montar o circuito
  circuitoPronto: false,
  focoPC: false,          // câmera de foco da protoboard (PC)
  dicaTexto: '' as string,
  dicaLado: null as 'esq' | 'dir' | null,
};

const PECAS = ['led', 'resistor', 'resistor_queimado', 'jumper_vermelho', 'jumper_preto', 'jumper_curto'];
/** Peça certa → lugar dela na protoboard (e o desenho do quadro que acende). */
const LUGAR: Record<string, { alvo: string; desenho: string }> = {
  jumper_vermelho: { alvo: 'alvo_jumper_vermelho', desenho: 'jumper' },
  resistor: { alvo: 'alvo_resistor', desenho: 'resistor' },
  led: { alvo: 'alvo_led', desenho: 'led' },
  jumper_preto: { alvo: 'alvo_jumper_preto', desenho: 'jumper' },
};
/** As pegadinhas parecem com estas (para a sombra e para o PC alinhar a peça). */
const PARECE: Record<string, string> = { resistor_queimado: 'resistor', jumper_curto: 'jumper_vermelho' };
// m: soltar até esta distância do lugar encaixa ("clique" magnético). 21/10: no PC a placa fica longe na tela, então a atração é maior
const encaixe = () => (entrada.modo === 'pc' ? 0.2 : 0.14);
const SOMBRA = 0.3;         // m: perto assim, aparece a sombra Lima no lugar
const giro180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

interface Alvo { no: THREE.Object3D; pos: THREE.Vector3; quat: THREE.Quaternion; }
const alvos = new Map<string, Alvo>();          // por peça certa
const encaixadas = new Map<string, boolean>();  // peça → encaixada certa (true) ou LED ao contrário (false)
const sombras = new Map<string, THREE.Object3D>();
let quadro: THREE.Object3D | null = null;
let protoboard: THREE.Object3D | null = null;
let ultimaFalaCerta = -9;

const alvoDe = (id: string) => alvos.get(LUGAR[id] ? id : PARECE[id] ?? '');
/** Perto do lugar: pela distância no plano (a placa é inclinada) e um pouco de folga na altura. */
const pertoDe = (p: THREE.Vector3, a: THREE.Vector3, r: number) => Math.hypot(p.x - a.x, p.z - a.z) < r && Math.abs(p.y - a.y) < 0.18;

export function montarOficina(): void {
  // o LED começa virado na bandeja: quem não olhar o quadro vai encaixar ao contrário (é a lição da missão)
  const led = instancias.get('led'); if (led) led.raiz.quaternion.multiply(giro180);
  for (const id of PECAS) { const s = registrarSeguravel(id, null); if (s) diretor.fisicos.add(id); }
  protoboard = instancias.get('protoboard')?.obj ?? null;
  quadro = instancias.get('quadro_esquema')?.obj ?? null;
  for (const [id, l] of Object.entries(LUGAR)) {
    const no = protoboard?.getObjectByName(l.alvo); if (!no) continue;
    no.updateMatrixWorld(true);
    alvos.set(id, { no, pos: no.getWorldPosition(new THREE.Vector3()), quat: no.getWorldQuaternion(new THREE.Quaternion()) });
  }
  // sombra Lima de cada peça certa (guia do encaixe)
  const mat = new THREE.MeshBasicMaterial({ color: '#8fd651', transparent: true, opacity: 0.45, depthWrite: false });
  for (const id of Object.keys(LUGAR)) {
    const inst = instancias.get(id); if (!inst?.obj) continue;
    const f = inst.obj.clone(true); f.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = mat; o.renderOrder = 5; } });
    const g = new THREE.Group(); g.add(f); g.visible = false; cena3d.add(g); sombras.set(id, g);
  }
  const antesPegar = ganchos.aoPegar, antesSoltar = ganchos.aoSoltar;
  ganchos.aoPegar = (s) => { antesPegar(s); if (PECAS.includes(s.id)) aoPegarPeca(s.id); };
  ganchos.aoSoltar = (s) => { antesSoltar(s); if (PECAS.includes(s.id)) tentarEncaixar(s.id, s.mao?.lado ?? maoUltima); };
  zerarOficina();
}

let maoUltima: 'esq' | 'dir' | null = null;
/** Peça tirada do lugar só encaixa de novo depois de se afastar 10 cm (senão ela "grudava" de volta na hora: teste no Quest, 20/10). */
const afastou = new Map<string, boolean>();
const AFASTAR = 0.1;
function aoPegarPeca(id: string): void {
  maoUltima = seguraveis.get(id)?.mao?.lado ?? null;
  const s = seguraveis.get(id), a = alvos.get(id);
  afastou.set(id, !(s && a && pertoDe(s.inst.raiz.position, a.pos, AFASTAR)));
  // tirar uma peça encaixada (o LED ao contrário) libera o lugar
  if (encaixadas.has(id)) encaixadas.delete(id);
  if (id === 'resistor_queimado') falaPorEvento('oficina_resistor_queimado');
  if (id === 'jumper_curto') falaPorEvento('oficina_jumper_curto');
}

/** Pose que a peça teria encaixada (o LED ao contrário fica girado 180°). */
function poseEncaixe(id: string, quatPeca: THREE.Quaternion): { pos: THREE.Vector3; quat: THREE.Quaternion; certo: boolean } | null {
  const a = alvos.get(id); if (!a) return null;
  if (id !== 'led') return { pos: a.pos.clone(), quat: a.quat.clone(), certo: true };
  // perna longa (+) fica no -X do LED; o + da placa é o -X do lugar
  const maisPeca = new THREE.Vector3(-1, 0, 0).applyQuaternion(quatPeca), maisPlaca = new THREE.Vector3(-1, 0, 0).applyQuaternion(a.quat);
  const certo = maisPeca.dot(maisPlaca) > 0;
  return { pos: a.pos.clone(), quat: certo ? a.quat.clone() : a.quat.clone().multiply(giro180), certo };
}

function tentarEncaixar(id: string, lado: 'esq' | 'dir' | null): boolean {
  const s = seguraveis.get(id); if (!s) return false;
  const p = s.inst.raiz.position;
  const parecido = alvoDe(id);
  if (!LUGAR[id]) {
    // pegadinha perto do lugar da peça parecida: não encaixa
    if (parecido && pertoDe(p, parecido.pos, encaixe() * 1.5)) { tocar('sfx_peca_errada', { em: parecido.pos }); vibrarTipo(lado, 'perto'); }
    return false;
  }
  const a = alvos.get(id)!; if (!pertoDe(p, a.pos, encaixe()) || afastou.get(id) === false) return false;
  const e = poseEncaixe(id, s.inst.raiz.quaternion)!;
  s.estado = 'repouso'; s.vel.set(0, 0, 0); s.mao = null;
  s.inst.raiz.position.copy(e.pos); s.inst.raiz.quaternion.copy(e.quat);
  tocar('sfx_protoboard_encaixe', { em: e.pos }); vibrarTipo(lado, 'encaixe');
  encaixadas.set(id, e.certo);
  sombras.get(id)!.visible = false;
  if (e.certo) {
    desativar(s);                 // peça certa fica no lugar
    mostrarDesenho(LUGAR[id].desenho);
  } else {
    s.fixo = true;                // LED ao contrário: fica, mas dá para pegar de novo
    falaPorEvento('oficina_led_invertido');
  }
  conferirCircuito(e.certo);
  return true;
}

function conferirCircuito(acabouDeAcertar: boolean): void {
  const pronto = Object.keys(LUGAR).every((id) => encaixadas.get(id) === true);
  if (pronto) { oficina.circuitoPronto = true; oficina.focoPC = false; return; }
  if (acabouDeAcertar && tempoGlobal() - ultimaFalaCerta > 5) { falaPorEvento('oficina_peca_certa', { seOcupado: 'descartar' }); ultimaFalaCerta = tempoGlobal(); }
}

function mostrarDesenho(nome: string): void { const d = quadro?.getObjectByName('destaque_' + nome); if (d) d.visible = true; }

// ---------- PC: câmera na frente da protoboard e o mouse arrasta as peças ----------
export function cameraFocoOficinaPC(): { pos: THREE.Vector3; alvo: THREE.Vector3 } {
  return { pos: new THREE.Vector3(16.05, 1.8, -0.62), alvo: new THREE.Vector3(17.3, 0.8, -0.5) };
}
const raio = new THREE.Raycaster();
const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0);
let arrastando: { id: string; virado: boolean } | null = null;

function pecaNaMira(): string | null {
  const lista = PECAS.map((id) => seguraveis.get(id)).filter((s): s is Seguravel => !!s && (s.ativo || s.fixo) && s.inst.raiz.visible);
  // a peça certa já encaixada fica fora (desativada)
  const hits = raio.intersectObjects(lista.filter((s) => s.ativo).map((s) => s.inst.raiz), true).filter((h) => !h.object.userData.contorno);
  let o: THREE.Object3D | null = hits[0]?.object ?? null;
  while (o && !PECAS.includes(o.userData.id)) o = o.parent;
  if (o) return o.userData.id;
  // peças finas (jumpers): vale clicar perto delas na tela
  let melhor: string | null = null, d = 0.07;
  for (const s of lista) {
    if (!s.ativo) continue;
    const c = new THREE.Box3().setFromObject(s.inst.raiz).getCenter(new THREE.Vector3()).project(camera);
    const dd = Math.hypot(c.x - entrada.pc.mouse.x, (c.y - entrada.pc.mouse.y) * 0.6);
    if (dd < d) { d = dd; melhor = s.id; }
  }
  return melhor;
}

function oficinaPC(): void {
  const m = entrada.maos.dir;
  if (!oficina.focoPC) {
    const pes = posicaoPes();
    const perto = oficina.montagemAtiva && !oficina.circuitoPronto && Math.hypot(pes.x - 16.4, pes.z) < 1.6;
    oficina.dicaTexto = perto ? 'Clique na protoboard para montar o circuito' : '';
    if (perto && m.gatilhoBorda) { oficina.focoPC = true; if (document.pointerLockElement) document.exitPointerLock(); }
    return;
  }
  oficina.dicaTexto = 'Arraste as peças até a protoboard · F: virar o LED · Esc: sair';
  raio.setFromCamera(entrada.pc.mouse, camera);
  if (arrastando) {
    const s = seguraveis.get(arrastando.id)!;
    const hit = raio.ray.intersectPlane(plano, new THREE.Vector3());
    if (hit) s.inst.raiz.position.set(hit.x, 0.95, hit.z);
    { const a = alvos.get(arrastando.id); if (a && !afastou.get(arrastando.id) && !pertoDe(s.inst.raiz.position, a.pos, AFASTAR)) afastou.set(arrastando.id, true); }
    const ref = alvoDe(arrastando.id);
    if (entrada.virarBorda && arrastando.id === 'led') { arrastando.virado = !arrastando.virado; tocar('sfx_tangram_girar', { em: s.inst.raiz }); }
    if (ref) s.inst.raiz.quaternion.copy(ref.quat).multiply(arrastando.id === 'led' && arrastando.virado ? giro180 : new THREE.Quaternion());
    mostrarSombras(arrastando.id, s.inst.raiz.position);
    if (!entrada.pc.cliqueEsq) soltarPC();
    return;
  }
  if (m.gatilhoBorda) {
    const id = pecaNaMira(); if (!id) return;
    const s = seguraveis.get(id)!;
    if (encaixadas.has(id)) encaixadas.delete(id);
    // o LED lembra para que lado está (girado 180° em relação ao lugar = virado)
    const ref = alvoDe(id); let virado = false;
    if (id === 'led' && ref) virado = new THREE.Vector3(-1, 0, 0).applyQuaternion(s.inst.raiz.quaternion).dot(new THREE.Vector3(-1, 0, 0).applyQuaternion(ref.quat)) < 0;
    desativar(s); s.fixo = false; arrastando = { id, virado };
    tocar('sfx_segurar', { em: s.inst.raiz });
    aoPegarPeca(id);
  }
}
function soltarPC(): void {
  if (!arrastando) return;
  const id = arrastando.id; arrastando = null; mostrarSombras(null, null);
  const s = seguraveis.get(id)!; s.ativo = true;
  if (tentarEncaixar(id, null)) return;
  // não encaixou: volta para a bandeja
  restaurar(id); tocar('sfx_soltar', { em: s.inst.raiz });
}

function mostrarSombras(id: string | null, pos: THREE.Vector3 | null): void {
  for (const [k, g] of sombras) {
    const a = alvos.get(k)!;
    g.visible = !!id && k === id && !!pos && pertoDe(pos, a.pos, SOMBRA) && encaixadas.get(k) !== true;
    if (g.visible) { g.position.copy(a.pos); g.quaternion.copy(a.quat); }
  }
}

// ---------- a cada quadro ----------
export function atualizarOficina(_dt: number, pausado: boolean): void {
  if (pausado || !protoboard) return;
  oficina.dicaTexto = ''; oficina.dicaLado = null;
  if (entrada.modo === 'pc') { oficinaPC(); }
  else {
    // VR: sombra da peça que está na mão; A vira o LED na mão; encostar no lugar já encaixa
    let mostrou = false;
    for (const id of PECAS) {
      const s = seguraveis.get(id); if (!s || s.estado !== 'segurado' || !s.mao) continue;
      if (LUGAR[id]) { mostrarSombras(id, s.inst.raiz.position); mostrou = true; }
      if (id === 'led') {
        oficina.dicaTexto = 'A: virar o LED'; oficina.dicaLado = s.mao.lado;
        if (entrada.virarBorda) { s.offset.multiply(new THREE.Matrix4().makeRotationY(Math.PI)); tocar('sfx_tangram_girar', { em: s.inst.raiz }); }
      }
      const a = alvos.get(id);
      if (a && !afastou.get(id) && !pertoDe(s.inst.raiz.position, a.pos, AFASTAR)) afastou.set(id, true);
      if (a && afastou.get(id) && s.inst.raiz.position.distanceTo(a.pos) < 0.04) { const lado = s.mao.lado; s.mao = null; s.estado = 'caindo'; tentarEncaixar(id, lado); }
    }
    if (!mostrou) mostrarSombras(null, null);
  }
  // peça que caiu no chão volta para a bandeja (como no tangram: só se cair fora da mesa)
  for (const id of PECAS) {
    const s = seguraveis.get(id); if (!s || !s.ativo || s.estado !== 'repouso' || s.fixo) continue;
    if (s.inst.raiz.position.y - s.base < 0.05 && s.inst.raiz.position.distanceTo(s.inicial.pos) > 0.1) restaurar(id);
  }
}

/** O diretor pergunta: a ação manual da cena já aconteceu? */
export function manualOficina(texto: string): boolean {
  if (/montar o circuito/.test(texto)) {
    if (!oficina.montagemAtiva) { oficina.montagemAtiva = true; mostrarDesenho('pilhas'); }
    return oficina.circuitoPronto;
  }
  return false;
}

/** Evento "acender_led" da cena: o LED aceso da cena toma o lugar do LED do jogador. */
export function trocarLedPeloAceso(): void { const i = instancias.get('led'); if (i) i.raiz.visible = false; }

/** Recomeçar a missão: peças na bandeja, quadro apagado. */
export function zerarOficina(): void {
  oficina.montagemAtiva = false; oficina.circuitoPronto = false; oficina.focoPC = false; arrastando = null;
  encaixadas.clear();
  for (const id of PECAS) { restaurar(id); const s = seguraveis.get(id); if (s) { s.ativo = true; s.inst.raiz.visible = true; } }
  quadro?.traverse((o) => { if (/^destaque_[a-z]+$/.test(o.name)) o.visible = false; });
  mostrarSombras(null, null);
  zerarFalasPorEvento(['oficina_resistor_queimado', 'oficina_jumper_curto', 'oficina_led_invertido']);
}

/** Modo de teste "completar a missão" e missão já feita: circuito montado. */
export function completarOficina(): void {
  for (const id of Object.keys(LUGAR)) {
    const s = seguraveis.get(id); const a = alvos.get(id); if (!s || !a) continue;
    desativar(s); s.inst.raiz.position.copy(a.pos); s.inst.raiz.quaternion.copy(a.quat); encaixadas.set(id, true);
    mostrarDesenho(LUGAR[id].desenho);
  }
  mostrarDesenho('pilhas'); oficina.montagemAtiva = true; oficina.circuitoPronto = true; oficina.focoPC = false;
}
export function oficinaConcluida(): void { completarOficina(); trocarLedPeloAceso(); }

/** Para o teste automático do PC. */
export function _pecasOficina(): { id: string; pos: number[]; ativo: boolean; fixo: boolean; encaixada: boolean | null; tela: number[] | null }[] {
  return PECAS.map((id) => { const s = seguraveis.get(id)!; return { id, pos: s.inst.raiz.position.toArray().map((v) => +v.toFixed(3)), ativo: s.ativo, fixo: s.fixo,
    encaixada: encaixadas.has(id) ? encaixadas.get(id)! : null, tela: null }; });
}
export function _alvosOficina(): Record<string, number[]> { return Object.fromEntries([...alvos].map(([k, a]) => [k, a.pos.toArray().map((v) => +v.toFixed(3))])); }
