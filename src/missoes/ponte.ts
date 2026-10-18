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
const TOLERANCIA = 0.045;  // m (o GLB pede 0,03; um pouco mais folgado no VR, como o autor pediu: "bem próximo")

interface Peca { no: THREE.Object3D; nome: string; tipo: string; giro: number; inicio: { pos: THREE.Vector3; giro: number }; encaixada: string | null; }
interface Lugar { nome: string; tipo: string; pos: THREE.Vector3; giro: number; ocupado: boolean; }
let pecas: Peca[] = [];
let lugares: Lugar[] = [];
let segurada: { peca: Peca; mao: Mao | null } | null = null;
let consoleRaiz: THREE.Object3D | null = null;
let pontoCyberdeck: THREE.Object3D | null = null;
let fantasma: THREE.Mesh | null = null;
let inicioBusca = -1, ultimaPecaMexida = -1, dicasTangram = 0;

const tipoDe = (nome: string) => nome.replace(/_\d$/, '');
/** Quanto girar a peça e ainda ficar igual (quadrado: 90°, paralelogramo: 180°, triângulos: 360°). */
const simetria = (tipo: string) => (tipo === 'peca_quadrado' ? 90 : tipo === 'peca_paralelogramo' ? 180 : 360);
const mesmoGiro = (a: number, b: number, tipo: string) => { const s = simetria(tipo); return (((a - b) % s) + s) % s < 1; };

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
    pecas.push({ no, nome, tipo: tipoDe(nome), giro: a.giro_inicial_graus, inicio: { pos: no.position.clone(), giro: a.giro_inicial_graus }, encaixada: null });
    lugares.push({ nome, tipo: tipoDe(nome), pos: new THREE.Vector3(a.posicao[0], a.posicao[1], a.posicao[2]), giro: a.giro_graus, ocupado: false });
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
  const perto = entrada.modo === 'vr' ? p.distanceTo(alvo) < 0.3 : Math.hypot(p.x - alvo.x, p.z - alvo.z) < 0.9;
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
function alturaTampo(z: number): number { return 0.9239 - Math.tan(INCLINACAO) * z; }
function porPeca(p: Peca, pos: THREE.Vector3, levantada = 0): void {
  p.no.position.set(pos.x, alturaTampo(pos.z) + (pos.y - alturaTampo(pos.z)) + levantada, pos.z);
  p.no.quaternion.copy(qTampo).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(p.giro)));
}
function paraConsole(pMundo: THREE.Vector3): THREE.Vector3 { return consoleRaiz!.worldToLocal(pMundo.clone()); }

function pecaPerto(pLocal: THREE.Vector3, raio: number): Peca | null {
  let melhor: Peca | null = null, d = raio;
  for (const p of pecas) {
    if (p.encaixada) continue;
    const dd = Math.hypot(p.no.position.x - pLocal.x, p.no.position.z - pLocal.z);
    if (dd < d && Math.abs(p.no.position.y - pLocal.y) < 0.25) { d = dd; melhor = p; }
  }
  return melhor;
}

function soltarPeca(): void {
  if (!segurada) return;
  const p = segurada.peca;
  segurada = null;
  ultimaPecaMexida = tempoGlobal();
  // encaixa se estiver bem perto de um lugar livre do mesmo tipo, com o giro certo
  const lugar = lugares.find((l) => !l.ocupado && l.tipo === p.tipo && Math.hypot(l.pos.x - p.no.position.x, l.pos.z - p.no.position.z) < TOLERANCIA && mesmoGiro(p.giro, l.giro, p.tipo));
  if (lugar) {
    lugar.ocupado = true; p.encaixada = lugar.nome;
    p.giro = lugar.giro; porPeca(p, lugar.pos);
    tocar('sfx_tangram_encaixa', { em: p.no });
    if (lugares.every((l) => l.ocupado)) { ponte.tangramPronto = true; ponte.focoPC = false; tocar('sfx_tangram_completo', { em: p.no }); }
    return;
  }
  // senão: fica onde soltou, se estiver em cima do tampo; fora dele volta para a bandeja
  const x = p.no.position.x, z = p.no.position.z;
  if (Math.abs(x) < 0.95 && z > -0.42 && z < 0.42) porPeca(p, new THREE.Vector3(x, alturaTampo(z), z));
  else { p.giro = p.inicio.giro; porPeca(p, p.inicio.pos); }
  tocar('sfx_soltar', { em: p.no });
}

function girarPeca(p: Peca, sentido = 1): void { p.giro = (p.giro + 45 * sentido + 360) % 360; tocar('sfx_tangram_girar', { em: p.no }); }

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
      ponte.dicaTexto = 'Gatilho: girar 45°'; ponte.dicaLado = m.lado;
      if (m.gatilhoBorda) girarPeca(p);
      if (!m.segurar) soltarPeca();
    } else if (!segurada && m.segurarBorda) {
      const p = pecaPerto(local, 0.1);
      if (p) { segurada = { peca: p, mao: m }; tocar('sfx_segurar', { em: p.no }); ultimaPecaMexida = tempoGlobal(); }
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
  ponte.dicaTexto = 'Arraste as peças · roda ou clique direito: girar 45° · Esc: sair';
  raio.setFromCamera(entrada.pc.mouse, camera);
  const ponto = pontoNoTampo(raio.ray);
  const m = entrada.maos.dir;
  if (segurada && ponto) {
    porPeca(segurada.peca, new THREE.Vector3(ponto.x, alturaTampo(ponto.z), ponto.z), 0.02);
    if (entrada.pc.rodaPassos) girarPeca(segurada.peca, Math.sign(entrada.pc.rodaPassos));
    if (m.segurarBorda) girarPeca(segurada.peca);
    if (!entrada.pc.cliqueEsq) soltarPeca();
  } else if (ponto && m.gatilhoBorda) {
    const p = pecaPerto(ponto, 0.09);
    if (p) { segurada = { peca: p, mao: null }; tocar('sfx_segurar', { em: p.no }); ultimaPecaMexida = tempoGlobal(); }
  }
}

/** Modo de teste "completar a missão": deixa tudo pronto. */
export function completarPonte(): void {
  if (!ponte.encaixou) { encaixarCyberdeck(); }
  for (const p of pecas) {
    if (p.encaixada) continue;
    const l = lugares.find((x) => !x.ocupado && x.tipo === p.tipo); if (!l) continue;
    l.ocupado = true; p.encaixada = l.nome; p.giro = l.giro; porPeca(p, l.pos);
  }
  ponte.tangramPronto = true; ponte.focoPC = false;
}

/** Recomeçar a missão: tudo volta para o lugar. */
export function zerarPonte(): void {
  ponte.pegouCyberdeck = false; ponte.encaixou = false; ponte.tangramPronto = false; ponte.tangramAtivo = false; ponte.focoPC = false;
  inicioBusca = -1; ultimaPecaMexida = -1; dicasTangram = 0; segurada = null;
  for (const id of ['cyberdeck', ...PIZZAS]) { restaurar(id); const s = seguraveis.get(id); if (s) s.ativo = true; }
  for (const l of lugares) l.ocupado = false;
  for (const p of pecas) { p.encaixada = null; p.giro = p.inicio.giro; porPeca(p, p.inicio.pos); }
  zerarFalasPorEvento(['ponte_dica_30s', 'ponte_dica_60s', 'ponte_tangram_dicas']);
}

/** Missão já feita (ao abrir o jogo de novo): tudo no estado final. */
export function ponteConcluida(): void { completarPonte(); }

/** Para o teste automático do PC. */
export function _pecasTangram(): { nome: string; encaixada: string | null; pos: number[]; giro: number }[] {
  return pecas.map((p) => ({ nome: p.nome, encaixada: p.encaixada, pos: p.no.position.toArray(), giro: p.giro }));
}
export function _lugaresTangram(): { nome: string; tipo: string; pos: number[]; giro: number }[] { return lugares.map((l) => ({ nome: l.nome, tipo: l.tipo, pos: l.pos.toArray(), giro: l.giro })); }
export function _consoleParaMundo(x: number, y: number, z: number): number[] { return consoleRaiz ? consoleRaiz.localToWorld(new THREE.Vector3(x, y, z)).toArray() : [0, 0, 0]; }
