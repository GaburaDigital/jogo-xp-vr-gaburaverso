// Missão da ponte: achar o cyberdeck embaixo das caixas de pizza, encaixar no console e montar o
// foguete do tangram. As falas e a ordem vêm da cena "ponte_navegacao" do Editor de Cenas;
// aqui fica só o que depende do jogador (os "aguardar" manuais) e as dicas por tempo.
//
// Tangram: cada peça segue a mão em cima do tampo do console (inclinado ~6,3°). No VR, segure com o
// grip e gire 45° com o gatilho; no PC, a câmera para em cima do console e o mouse vira a mão
// (clique e arraste; roda ou clique direito giram). A peça encaixa sozinha quando chega bem perto do
// lugar certo com o giro certo. Peças iguais (os dois triângulos grandes, os dois pequenos) servem
// em qualquer um dos dois lugares.

import * as THREE from 'three';
import { instancias } from '../mundo/mundo';
import { entrada, type Mao } from '../xr/entrada';
import { tocar } from '../nucleo/audio';
import { desativar, ganchos, registrarSeguravel, restaurar, seguraveis, type Seguravel } from '../interacao/seguraveis';
import { diretor, falaPorEvento, tempoGlobal, zerarFalasPorEvento } from '../cenas/diretor';
import { camera } from '../mundo/mundo';
import { posicaoPes } from '../xr/jogador';

export const ponte = {
  pegouCyberdeck: false,
  encaixou: false,
  tangramPronto: false,
  tangramAtivo: false,       // depois do "ligar_console"
  focoPC: false,             // câmera de foco do tangram (PC)
  dicaTexto: '' as string,   // aviso curto perto da mão ("Gatilho: girar 45°")
  dicaLado: null as 'esq' | 'dir' | null, // VR: em qual mão mostrar o aviso
};

const PIZZAS = ['caixa_pizza_1', 'caixa_pizza_2', 'caixa_pizza_fatia', 'caneca'];
const INCLINACAO = THREE.MathUtils.degToRad(6.34);   // tampo do console (do GLB)
const qTampo = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), INCLINACAO);
const ATRACAO = 0.09;     // m: a peça é puxada para um encaixe que serve até essa distância (rodada 5: "atração maior")
const TOL_FORMA = 0.008;  // m: cantos da peça e do encaixe precisam coincidir com essa folga

/** Contorno de uma peça visto de cima (x, z), no espaço dela (sem giro). */
type Contorno = THREE.Vector2[];
interface Peca { no: THREE.Object3D; nome: string; tipo: string; giro: number; virada: boolean; inicio: { pos: THREE.Vector3; giro: number };
  encaixada: string | null; contorno: Contorno; fantasma: THREE.Object3D; }
interface Lugar { nome: string; tipo: string; pos: THREE.Vector3; giro: number; ocupado: boolean; pontos: Contorno; centro: THREE.Vector2; }
let pecas: Peca[] = [];
let lugares: Lugar[] = [];
let segurada: { peca: Peca; mao: Mao | null } | null = null;
let consoleRaiz: THREE.Object3D | null = null;
let pontoCyberdeck: THREE.Object3D | null = null;
let fantasma: THREE.Mesh | null = null;
let inicioBusca = -1, ultimaPecaMexida = -1, dicasTangram = 0;

const tipoDe = (nome: string) => nome.replace(/_\d$/, '');

export function montarPonte(): void {
  for (const id of ['cyberdeck', ...PIZZAS]) {
    const s = registrarSeguravel(id, id === 'cyberdeck' ? 'sfx_caixa_impacto' : id === 'caneca' ? null : 'sfx_caixa_impacto');
    if (s) diretor.fisicos.add(id);
  }
  const inst = instancias.get('console_tangram');
  consoleRaiz = inst?.obj?.getObjectByName('console_tangram') ?? null;
  pontoCyberdeck = consoleRaiz?.getObjectByName('ponto_cyberdeck') ?? null;
  const silhueta = consoleRaiz?.getObjectByName('silhueta_acesa');
  const alvos = (silhueta?.userData.alvos ?? {}) as Record<string, { posicao: number[]; giro_graus: number; giro_inicial_graus: number }>;
  pecas = []; lugares = [];
  for (const [nome, a] of Object.entries(alvos)) {
    const no = consoleRaiz?.getObjectByName(nome); if (!no) continue;
    const contorno = contornoDe(no);
    pecas.push({ no, nome, tipo: tipoDe(nome), giro: a.giro_inicial_graus, virada: false, inicio: { pos: no.position.clone(), giro: a.giro_inicial_graus }, encaixada: null, contorno, fantasma: criarFantasma(no) });
    const pos = new THREE.Vector3(a.posicao[0], a.posicao[1], a.posicao[2]);
    const pontos = pontosDaPeca(contorno, pos, a.giro_graus, false);
    lugares.push({ nome, tipo: tipoDe(nome), pos, giro: a.giro_graus, ocupado: false, pontos, centro: centroDe(pontos) });
  }
  for (const p of pecas) porPeca(p, p.inicio.pos);
  // fantasma Lima no encaixe do cyberdeck (aparece enquanto o jogador segura o cyberdeck)
  if (pontoCyberdeck) {
    fantasma = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22), new THREE.MeshBasicMaterial({ color: '#8fd651', transparent: true, opacity: 0.45, depthWrite: false }));
    fantasma.visible = false; pontoCyberdeck.add(fantasma);
  }
  const antesPegar = ganchos.aoPegar;
  ganchos.aoPegar = (s) => { antesPegar(s); if (s.id === 'cyberdeck') ponte.pegouCyberdeck = true; };
  const antesSoltar = ganchos.aoSoltar;
  ganchos.aoSoltar = (s) => { antesSoltar(s); if (s.id === 'cyberdeck') tentarEncaixar(s); };
}

/** O diretor pergunta: a ação manual da cena já aconteceu? */
export function manualPonte(texto: string): boolean {
  if (/cyberdeck \(embaixo/.test(texto)) { if (inicioBusca < 0) inicioBusca = tempoGlobal(); return ponte.pegouCyberdeck; }
  if (/encaixar o cyberdeck/.test(texto)) return ponte.encaixou;
  if (/tangram/.test(texto)) { ponte.tangramAtivo = true; return ponte.tangramPronto; }
  return false;
}

function tentarEncaixar(s: Seguravel): void {
  if (!pontoCyberdeck || ponte.encaixou) return;
  const alvo = pontoCyberdeck.getWorldPosition(new THREE.Vector3());
  const p = s.inst.raiz.getWorldPosition(new THREE.Vector3());
  // VR: soltar perto do encaixe (30 cm). PC: soltar na frente do console (a mão do PC fica longe da mesa)
  // PC: basta soltar na frente do console (até 1,6 m dele), porque a "mão" do PC fica longe da mesa
  const pes = posicaoPes();
  const perto = entrada.modo === 'vr' ? p.distanceTo(alvo) < 0.3 : Math.hypot(pes.x - alvo.x, pes.z - alvo.z) < 1.6;
  if (perto) encaixarCyberdeck();
}
function encaixarCyberdeck(): void {
  const s = seguraveis.get('cyberdeck');
  if (s) {
    desativar(s);
    // fica exatamente onde o "cyberdeck do console" vai aparecer (a cena troca um pelo outro em seguida)
    const destino = instancias.get('cyberdeck_console')?.raiz;
    if (destino) { s.inst.raiz.position.copy(destino.position); s.inst.raiz.quaternion.copy(destino.quaternion); }
  }
  ponte.pegouCyberdeck = true; ponte.encaixou = true;
  if (fantasma) fantasma.visible = false;
  tocar('sfx_encaixe_cyberdeck', { em: pontoCyberdeck ?? undefined });
}

// ---------- tangram ----------
// Regra (rodada 5): vale qualquer peça que caiba no encaixe com a mesma forma — peças iguais trocam de lugar,
// peça girada de um jeito que fica igual (quadrado 90°, paralelogramo 180°) e o paralelogramo virado do avesso, se couber.
// A peça não gira sozinha: o jogador gira (45°) e vira; perto de um encaixe que serve, aparece a sombra Lima e ela é puxada.
function alturaTampo(z: number): number { return 0.9239 - Math.tan(INCLINACAO) * z; }
function porPeca(p: Peca, pos: THREE.Vector3, levantada = 0): void {
  p.no.position.set(pos.x, alturaTampo(pos.z) + (pos.y - alturaTampo(pos.z)) + levantada, pos.z);
  p.no.quaternion.copy(qTampo).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(p.giro)));
  p.no.scale.x = p.virada ? -1 : 1;
}
function paraConsole(pMundo: THREE.Vector3): THREE.Vector3 { return consoleRaiz!.worldToLocal(pMundo.clone()); }

/** Cantos da peça vista de cima: envoltória convexa dos vértices da malha (as peças do tangram são convexas). */
function contornoDe(no: THREE.Object3D): Contorno {
  no.updateMatrixWorld(true);
  const inv = no.matrixWorld.clone().invert(), v = new THREE.Vector3(), pts: THREE.Vector2[] = [];
  no.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined; const pos = g?.getAttribute('position'); if (!pos) return;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); pts.push(new THREE.Vector2(v.x, v.z)); }
  });
  // junta os vértices repetidos (a malha repete cada canto em várias faces, com diferenças mínimas)
  const unicos = new Map<string, THREE.Vector2>();
  for (const q of pts) { const k = Math.round(q.x * 2000) + ',' + Math.round(q.y * 2000); if (!unicos.has(k)) unicos.set(k, new THREE.Vector2(Math.round(q.x * 2000) / 2000, Math.round(q.y * 2000) / 2000)); }
  pts.length = 0; pts.push(...unicos.values());
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  const giro = (o: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const metade = (lista: THREE.Vector2[]) => { const h: THREE.Vector2[] = []; for (const p of lista) { while (h.length >= 2 && giro(h[h.length - 2], h[h.length - 1], p) <= 1e-7) h.pop(); h.push(p); } h.pop(); return h; };
  const casco = [...metade(pts), ...metade([...pts].reverse())];
  // tira cantos quase alinhados (chanfros e arredondamentos da malha)
  return casco.filter((p, i) => { const a = casco[(i - 1 + casco.length) % casco.length], b = casco[(i + 1) % casco.length]; return Math.abs(giro(a, p, b)) > 2e-5; });
}
/** Contorno girado (graus), virado (espelho em x) e levado para pos (espaço do console). */
function pontosDaPeca(c: Contorno, pos: THREE.Vector3 | THREE.Vector2, giro: number, virada: boolean): Contorno {
  const r = THREE.MathUtils.degToRad(giro), co = Math.cos(r), si = Math.sin(r);
  const px = pos.x, pz = (pos as THREE.Vector3).isVector3 ? (pos as THREE.Vector3).z : (pos as THREE.Vector2).y;
  return c.map((q) => { const x = virada ? -q.x : q.x; return new THREE.Vector2(x * co + q.y * si + px, -x * si + q.y * co + pz); });
}
function centroDe(c: Contorno): THREE.Vector2 { const m = new THREE.Vector2(); c.forEach((p) => m.add(p)); return m.divideScalar(c.length || 1); }
function mesmaForma(a: Contorno, b: Contorno): boolean {
  return a.length === b.length && a.every((p) => b.some((q) => p.distanceTo(q) < TOL_FORMA));
}

/** Encaixe livre que serve para a peça como ela está (giro e lado), perto o bastante; devolve onde a peça fica. */
function encaixeQueServe(p: Peca, alcance = ATRACAO): { lugar: Lugar; pos: THREE.Vector3 } | null {
  const forma = pontosDaPeca(p.contorno, new THREE.Vector2(), p.giro, p.virada), meio = centroDe(forma);
  const agora = new THREE.Vector2(p.no.position.x + meio.x, p.no.position.z + meio.y);
  let melhor: { lugar: Lugar; pos: THREE.Vector3 } | null = null, d = alcance;
  for (const l of lugares) {
    if (l.ocupado && l.nome !== p.encaixada) continue;
    const dd = agora.distanceTo(l.centro); if (dd >= d) continue;
    const pos = new THREE.Vector3(l.centro.x - meio.x, l.pos.y, l.centro.y - meio.y);
    if (!mesmaForma(pontosDaPeca(p.contorno, pos, p.giro, p.virada), l.pontos)) continue;
    d = dd; melhor = { lugar: l, pos };
  }
  return melhor;
}

/** Sombra Lima da peça, mostrada no encaixe enquanto o jogador segura a peça perto dele. */
function criarFantasma(no: THREE.Object3D): THREE.Object3D {
  const f = no.clone(true); f.traverse((o) => { o.name += '_fantasma'; });
  const mat = new THREE.MeshBasicMaterial({ color: '#8fd651', transparent: true, opacity: 0.5, depthWrite: false });
  f.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = mat; o.renderOrder = 5; } });
  f.visible = false; no.parent?.add(f);
  return f;
}
function mostrarFantasma(p: Peca | null): void {
  for (const q of pecas) q.fantasma.visible = false;
  if (!p) return;
  const e = encaixeQueServe(p); if (!e) return;
  const f = p.fantasma;
  f.position.set(e.pos.x, e.lugar.pos.y + 0.001, e.pos.z);
  f.quaternion.copy(qTampo).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(p.giro)));
  f.scale.set(p.virada ? -1 : 1, 1, 1); f.visible = true;
}

function pecaPerto(pLocal: THREE.Vector3, raio: number): Peca | null {
  let melhor: Peca | null = null, d = raio;
  for (const p of pecas) {
    const meio = centroDe(pontosDaPeca(p.contorno, new THREE.Vector2(), p.giro, p.virada));
    const dd = Math.hypot(p.no.position.x + meio.x - pLocal.x, p.no.position.z + meio.y - pLocal.z);
    if (dd < d && Math.abs(p.no.position.y - pLocal.y) < 0.25) { d = dd; melhor = p; }
  }
  return melhor;
}
function pegarPeca(p: Peca, mao: Mao | null): void {
  // tirar uma peça já encaixada libera o encaixe
  if (p.encaixada) { const l = lugares.find((x) => x.nome === p.encaixada); if (l) l.ocupado = false; p.encaixada = null; }
  segurada = { peca: p, mao }; tocar('sfx_segurar', { em: p.no }); ultimaPecaMexida = tempoGlobal();
}

function soltarPeca(): void {
  if (!segurada) return;
  const p = segurada.peca;
  segurada = null; mostrarFantasma(null);
  ultimaPecaMexida = tempoGlobal();
  const e = encaixeQueServe(p);
  if (e) {
    e.lugar.ocupado = true; p.encaixada = e.lugar.nome;
    porPeca(p, e.pos);
    tocar('sfx_tangram_encaixa', { em: p.no });
    if (lugares.every((l) => l.ocupado)) { ponte.tangramPronto = true; ponte.focoPC = false; tocar('sfx_tangram_completo', { em: p.no }); }
    return;
  }
  // senão: fica onde soltou, se estiver em cima do tampo; fora dele volta para a bandeja
  const x = p.no.position.x, z = p.no.position.z;
  if (Math.abs(x) < 0.95 && z > -0.42 && z < 0.42) porPeca(p, new THREE.Vector3(x, alturaTampo(z), z));
  else { p.giro = p.inicio.giro; p.virada = false; porPeca(p, p.inicio.pos); }
  tocar('sfx_soltar', { em: p.no });
}

function girarPeca(p: Peca, sentido = 1): void { p.giro = (p.giro + 45 * sentido + 360) % 360; tocar('sfx_tangram_girar', { em: p.no }); }
/** Virar do avesso: só o paralelogramo muda de forma (os triângulos e o quadrado virados ficam iguais a um giro). */
function virarPeca(p: Peca): void { if (p.tipo !== 'peca_paralelogramo') return; p.virada = !p.virada; tocar('sfx_tangram_girar', { em: p.no, taxa: 0.85 }); }

const raio = new THREE.Raycaster();
const planoTampo = new THREE.Plane();
/** Ponto do tampo do console onde o raio (mouse) encosta, no espaço do console. */
function pontoNoTampo(r: THREE.Ray): THREE.Vector3 | null {
  if (!consoleRaiz) return null;
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(qTampo).applyQuaternion(consoleRaiz.getWorldQuaternion(new THREE.Quaternion()));
  const ponto = consoleRaiz.localToWorld(new THREE.Vector3(0, alturaTampo(0), 0));
  planoTampo.setFromNormalAndCoplanarPoint(normal, ponto);
  const hit = r.intersectPlane(planoTampo, new THREE.Vector3());
  return hit ? paraConsole(hit) : null;
}

/** Ponto de câmera do PC para montar o tangram (acima do console, olhando o tampo). */
export function cameraFocoPC(): { pos: THREE.Vector3; alvo: THREE.Vector3 } | null {
  if (!consoleRaiz) return null;
  return { pos: consoleRaiz.localToWorld(new THREE.Vector3(0.12, 1.75, 0.62)), alvo: consoleRaiz.localToWorld(new THREE.Vector3(0.12, 0.9, 0.02)) };
}

/** A cada quadro: fantasma do encaixe, dicas por tempo e o tangram. */
export function atualizarPonte(_dt: number, pausado: boolean): void {
  if (pausado || !consoleRaiz) return;
  const agora = tempoGlobal();
  ponte.dicaTexto = ''; ponte.dicaLado = null;
  // dicas da busca (30 s e 60 s sem achar o cyberdeck)
  if (inicioBusca >= 0 && !ponte.pegouCyberdeck) {
    if (agora - inicioBusca > 30) falaPorEvento('ponte_dica_30s');
    if (agora - inicioBusca > 60) falaPorEvento('ponte_dica_60s');
  }
  const cyber = seguraveis.get('cyberdeck');
  if (fantasma) fantasma.visible = !!cyber && cyber.estado === 'segurado' && !ponte.encaixou;
  if (cyber?.estado === 'segurado' && !ponte.encaixou && pontoCyberdeck) {
    // encaixa também sem soltar, se o jogador encostar o cyberdeck no lugar
    if (cyber.inst.raiz.getWorldPosition(new THREE.Vector3()).distanceTo(pontoCyberdeck.getWorldPosition(new THREE.Vector3())) < 0.12) encaixarCyberdeck();
  }
  if (!ponte.tangramAtivo || ponte.tangramPronto) return;
  if (ultimaPecaMexida < 0) ultimaPecaMexida = agora;
  // dicas do tangram: 40 s e 90 s sem mexer
  if (agora - ultimaPecaMexida > (dicasTangram === 0 ? 40 : 90) && dicasTangram < 2) { falaPorEvento('ponte_tangram_dicas'); dicasTangram++; ultimaPecaMexida = agora; }
  if (entrada.modo === 'vr') tangramVR(); else tangramPC();
}

function tangramVR(): void {
  for (const m of Object.values(entrada.maos)) {
    if (!m.conectada) continue;
    const local = paraConsole(m.pose.getWorldPosition(new THREE.Vector3()));
    if (segurada?.mao === m) {
      const p = segurada.peca;
      // segue a mão em cima do tampo (até 35 cm acima dele); longe demais, solta
      if (local.y - alturaTampo(local.z) > 0.35 || Math.abs(local.x) > 1.3) { soltarPeca(); continue; }
      porPeca(p, new THREE.Vector3(local.x, alturaTampo(local.z), local.z), 0.025);
      ponte.dicaTexto = p.tipo === 'peca_paralelogramo' ? 'Gatilho: girar 45° · A: virar' : 'Gatilho: girar 45°'; ponte.dicaLado = m.lado;
      if (m.gatilhoBorda) girarPeca(p);
      if (entrada.virarBorda) virarPeca(p);
      mostrarFantasma(p);
      if (!m.segurar) soltarPeca();
    } else if (!segurada && m.segurarBorda) {
      const p = pecaPerto(local, 0.1);
      if (p) pegarPeca(p, m);
    }
  }
}

function tangramPC(): void {
  // entra no foco: mirar o console de perto e clicar
  if (!ponte.focoPC) {
    const pes = posicaoPes(), c = consoleRaiz!.getWorldPosition(new THREE.Vector3());
    ponte.dicaTexto = Math.hypot(pes.x - c.x, pes.z - c.z) < 2.2 ? 'Clique no console para montar o tangram' : '';
    if (ponte.dicaTexto && entrada.maos.dir.gatilhoBorda) { ponte.focoPC = true; if (document.pointerLockElement) document.exitPointerLock(); }
    return;
  }
  ponte.dicaTexto = 'Arraste as peças · E, roda ou clique direito: girar 45° · F: virar · Esc: sair';
  raio.setFromCamera(entrada.pc.mouse, camera);
  const ponto = pontoNoTampo(raio.ray);
  const m = entrada.maos.dir;
  if (segurada && ponto) {
    porPeca(segurada.peca, new THREE.Vector3(ponto.x, alturaTampo(ponto.z), ponto.z), 0.02);
    if (entrada.pc.rodaPassos) girarPeca(segurada.peca, Math.sign(entrada.pc.rodaPassos));
    if (m.segurarBorda || entrada.girarBorda) girarPeca(segurada.peca);
    if (entrada.virarBorda) virarPeca(segurada.peca);
    mostrarFantasma(segurada.peca);
    if (!entrada.pc.cliqueEsq) soltarPeca();
  } else if (ponto && m.gatilhoBorda) {
    const p = pecaPerto(ponto, 0.09);
    if (p) pegarPeca(p, null);
  }
}

/** Modo de teste "completar a missão": deixa tudo pronto. */
export function completarPonte(): void {
  if (!ponte.encaixou) { encaixarCyberdeck(); }
  for (const p of pecas) {
    if (p.encaixada) continue;
    const l = lugares.find((x) => !x.ocupado && x.tipo === p.tipo); if (!l) continue;
    l.ocupado = true; p.encaixada = l.nome; p.giro = l.giro; p.virada = false; porPeca(p, l.pos);
  }
  ponte.tangramPronto = true; ponte.focoPC = false;
}

/** Recomeçar a missão: tudo volta para o lugar. */
export function zerarPonte(): void {
  ponte.pegouCyberdeck = false; ponte.encaixou = false; ponte.tangramPronto = false; ponte.tangramAtivo = false; ponte.focoPC = false;
  inicioBusca = -1; ultimaPecaMexida = -1; dicasTangram = 0; segurada = null;
  for (const id of ['cyberdeck', ...PIZZAS]) { restaurar(id); const s = seguraveis.get(id); if (s) s.ativo = true; }
  for (const l of lugares) l.ocupado = false;
  for (const p of pecas) { p.encaixada = null; p.giro = p.inicio.giro; p.virada = false; porPeca(p, p.inicio.pos); }
  mostrarFantasma(null);
  zerarFalasPorEvento(['ponte_dica_30s', 'ponte_dica_60s', 'ponte_tangram_dicas']);
}

/** Missão já feita (ao abrir o jogo de novo): tudo no estado final. */
export function ponteConcluida(): void { completarPonte(); }

/** Para o teste automático do PC. */
export function _pecasTangram(): { nome: string; encaixada: string | null; pos: number[]; giro: number; virada: boolean; lados: number; centro: number[] }[] {
  return pecas.map((p) => { const c = centroDe(pontosDaPeca(p.contorno, new THREE.Vector2(), p.giro, p.virada)); return { nome: p.nome, encaixada: p.encaixada, pos: p.no.position.toArray(), giro: p.giro, virada: p.virada, lados: p.contorno.length, centro: [p.no.position.x + c.x, p.no.position.z + c.y] }; });
}
export function _lugaresTangram(): { nome: string; tipo: string; pos: number[]; giro: number; centro: number[]; lados: number }[] { return lugares.map((l) => ({ nome: l.nome, tipo: l.tipo, pos: l.pos.toArray(), giro: l.giro, centro: [l.centro.x, l.centro.y], lados: l.pontos.length })); }
export function _consoleParaMundo(x: number, y: number, z: number): number[] { return consoleRaiz ? consoleRaiz.localToWorld(new THREE.Vector3(x, y, z)).toArray() : [0, 0, 0]; }
