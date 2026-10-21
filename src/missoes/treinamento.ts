// Missão do treinamento: a máquina de clonagem com defeito cospe 8 Gojos e 8 Freds pela esteira; eles correm
// para os esconderijos (caixas com cara de robô, pilha com bracinhos, latas e baldes) e espiam de vez em quando.
// O jogador pega a arma de captura laser no suporte e, do posto (só anda para os lados), atira bolinhas de energia.
// A bolinha só captura se tocar SOMENTE no clone: se encostar no esconderijo, explode e não conta.
// Cada clone capturado vira pixels e aparece flutuando numa vaga sorteada da câmara de captura.
// As falas e a ordem vêm da cena "treino_captura" do Editor de Cenas; aqui fica o que depende do jogador.
//
// Regras dos clones (aprovadas em 16/10, iguais à galeria): caminho numa grade de 25 cm (A*) em volta dos
// objetos; só param por um clone à frente; num impasse passa o de número menor; esperando demais, recalculam;
// travando de novo, pulam por cima; para entrar no esconderijo dão um salto rápido por cima da borda.
// Analogia Godot: cada clone é um CharacterBody3D com NavigationAgent3D, só que a "navegação" é a grade.

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { camera, cena3d, gltf, instancias } from '../mundo/mundo';
import { entrada, vibrarTipo, type Mao } from '../xr/entrada';
import { tocar } from '../nucleo/audio';
import { falaPorEvento, tempoGlobal, zerarFalasPorEvento } from '../cenas/diretor';
import { jogador, posicaoPes } from '../xr/jogador';
import { criarContorno } from '../interacao/seguraveis';
import type { Tocavel } from '../interacao/toque';

export const treino = {
  comecou: false,     // a cena começou: a máquina cospe os clones
  pegouArma: false,
  capturados: 0,
  completo: false,
  dicaTexto: '' as string,
  dicaLado: null as 'esq' | 'dir' | null,
};

type Tipo = 'gojo' | 'fred';
const ESCONDERIJOS = ['caixa_robo_1', 'caixa_robo_2', 'caixa_robo_3', 'caixas_bracinhos', 'lata_aqua', 'lata_violeta', 'balde_amarelo', 'balde_coral'];
/** Posto atrás do parapeito: durante a missão o jogador só anda para os lados (pedido do autor, 19/10). */
export const POSTO = { x0: -13.3, x1: -12.45, z0: -2.2, z1: 2.2 };
const SALA = { x0: -27.9, x1: -10.1, z0: -6.9, z1: 6.9, teto: 3.4 };
const VEL_BOLINHA = 8;          // m/s (20/10: um pouco mais rápida)
const INTERVALO_TIRO = 0.7;     // s entre um tiro e outro (20/10: espera maior)
const SAIDA_MAQUINA = 2.0;      // s entre um clone e outro na esteira (20/10: mais espaçado)
const RAIO_CLONE: Record<Tipo, number> = { gojo: 0.3, fred: 0.17 };
const ALTURA_CLONE: Record<Tipo, number> = { gojo: 0.58, fred: 0.3 };

interface Esconderijo { id: string; caixa: THREE.Box3; dentro: THREE.Vector3; borda: number; soFred: boolean; ocupado: Clone | null; }
interface Passo { tipo: 'andar' | 'esteira' | 'salto'; de: THREE.Vector3; para: THREE.Vector3; t: number; dur?: number; altura?: number; entrar?: boolean; vel?: number; parado?: boolean; espera?: number; }
interface Clone {
  n: number; tipo: Tipo; obj: THREE.Group; mixer: THREE.AnimationMixer; clipes: Map<string, THREE.AnimationClip>; clipe: string;
  estado: 'maquina' | 'andando' | 'escondido' | 'susto' | 'voando' | 'tubo';
  fila: Passo[]; local: Esconderijo | null; corre: boolean; paradas: number[]; semPulo: number; noAr: boolean;
  espiar: number; espiarAte: number; proximoEspiar: number; fundoY: number;
  t: number; vaga: THREE.Object3D | null; de: THREE.Vector3; para: THREE.Vector3; giro: number; sobe: number;
  primeira: boolean; fatorV: number; espera: number; paradoDesde: number;   // 1ª corrida (rápida); velocidade suave; espera atrás de alguém
}
interface Modelo { cena: THREE.Object3D; clipes: THREE.AnimationClip[]; raio: number; altura: number; centroFlutuar: number; }

const modelos: Partial<Record<Tipo, Modelo>> = {};
/** Sorteio com semente (o teste automático repete as mesmas rodadas). */
let semente = (Date.now() % 100000) + 1;
function aleatorio(): number { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; }
let clones: Clone[] = [];
let locais: Esconderijo[] = [];
let obstaculos: { caixa: THREE.Box3; esconderijo?: Esconderijo }[] = [];
let fila: Tipo[] = [];             // clones que ainda estão dentro da máquina
let ultimoLado = 0;                // lado (x) do esconderijo do último clone que saiu
let proximaSaida = 0;
let maquina: THREE.Object3D | null = null;
let vagas: THREE.Object3D[] = [];
let visor: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture } | null = null;
let vidro: THREE.MeshStandardMaterial | null = null;
let mixerAcum = 0, proximoSom = 0, ultimaCaptura = -9, ultimaFalaCaptura = -9, ultimaFalaErro = -9;

// ---------- grade de passagem (25 cm) ----------
const GR = { x0: -27.75, z0: -6.75, passo: 0.25, nx: 54, nz: 54 };   // vai até x = -14,25 (antes do parapeito)
let grade = new Uint8Array(GR.nx * GR.nz);
const celula = (p: THREE.Vector3): [number, number] => [THREE.MathUtils.clamp(Math.floor((p.x - GR.x0) / GR.passo), 0, GR.nx - 1), THREE.MathUtils.clamp(Math.floor((p.z - GR.z0) / GR.passo), 0, GR.nz - 1)];
const centroCel = (i: number, j: number) => new THREE.Vector3(GR.x0 + (i + 0.5) * GR.passo, 0, GR.z0 + (j + 0.5) * GR.passo);
const livre = (i: number, j: number) => i >= 0 && j >= 0 && i < GR.nx && j < GR.nz && !grade[i + j * GR.nx];

function montarGrade(): void {
  grade = new Uint8Array(GR.nx * GR.nz);
  const m = 0.32;
  for (let i = 0; i < GR.nx; i++) for (let j = 0; j < GR.nz; j++) {
    const c = centroCel(i, j);
    if (c.x < SALA.x0 + 0.35 || c.z < SALA.z0 + 0.35 || c.z > SALA.z1 - 0.35) { grade[i + j * GR.nx] = 1; continue; }
    for (const o of obstaculos) if (c.x > o.caixa.min.x - m && c.x < o.caixa.max.x + m && c.z > o.caixa.min.z - m && c.z < o.caixa.max.z + m) { grade[i + j * GR.nx] = 1; break; }
  }
}

/** A* em 8 direções + atalhos em linha reta (igual à galeria). */
function caminho(de: THREE.Vector3, para: THREE.Vector3): THREE.Vector3[] {
  const [si, sj] = celula(de), [ti, tj] = celula(para); const N = GR.nx * GR.nz, alvo = ti + tj * GR.nx, inicio = si + sj * GR.nx;
  const g = new Float32Array(N).fill(Infinity), veio = new Int32Array(N).fill(-1), fechado = new Uint8Array(N);
  const aberto: number[] = [inicio]; g[inicio] = 0;
  const h = (k: number) => Math.hypot((k % GR.nx) - ti, Math.floor(k / GR.nx) - tj);
  while (aberto.length) {
    let mi = 0; for (let k = 1; k < aberto.length; k++) if (g[aberto[k]] + h(aberto[k]) < g[aberto[mi]] + h(aberto[mi])) mi = k;
    const atual = aberto.splice(mi, 1)[0]; if (atual === alvo) break; fechado[atual] = 1;
    const ai = atual % GR.nx, aj = Math.floor(atual / GR.nx);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = ai + di, nj = aj + dj, k = ni + nj * GR.nx;
      if (!livre(ni, nj) && k !== alvo) continue; if (fechado[k]) continue;
      if (di && dj && (!livre(ai + di, aj) || !livre(ai, aj + dj))) continue;
      const ng = g[atual] + Math.hypot(di, dj); if (ng < g[k]) { g[k] = ng; veio[k] = atual; if (!aberto.includes(k)) aberto.push(k); }
    }
  }
  let k = alvo; const pts: THREE.Vector3[] = [];
  while (k !== -1 && k !== inicio) { pts.unshift(centroCel(k % GR.nx, Math.floor(k / GR.nx))); k = veio[k]; }
  if (!pts.length) return [para.clone()];
  pts[pts.length - 1] = para.clone();
  const visto = (a: THREE.Vector3, b: THREE.Vector3) => { const n = Math.ceil(a.distanceTo(b) / 0.1); for (let s = 1; s < n; s++) { const [i, j] = celula(a.clone().lerp(b, s / n)); if (!livre(i, j)) return false; } return true; };
  const out: THREE.Vector3[] = []; let base = de.clone();
  for (let i = 0; i < pts.length; i++) if (i === pts.length - 1 || !visto(base, pts[i + 1])) { out.push(pts[i]); base = pts[i]; }
  return out;
}

/** Ponto no chão, do lado livre do esconderijo, de onde o clone pula para dentro. */
function entradaDe(l: Esconderijo): THREE.Vector3 {
  const c = l.caixa.getCenter(new THREE.Vector3()); const t = l.caixa.getSize(new THREE.Vector3());
  const r = Math.max(t.x, t.z) / 2 + 0.45;
  // primeiro o lado do posto (o clone chega pela frente, onde o jogador vê)
  for (const a of [Math.PI / 2, 0, Math.PI, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 2]) {
    const p = new THREE.Vector3(c.x + Math.sin(a) * r, 0, c.z + Math.cos(a) * r); const [i, j] = celula(p); if (livre(i, j)) return p;
  }
  return new THREE.Vector3(c.x + r, 0, c.z);
}

// ---------- montar ----------
async function carregarModelo(tipo: Tipo): Promise<void> {
  const g = await gltf(tipo === 'gojo' ? 'gojo_escala.glb' : 'fred_escala.glb'); if (!g) return;
  // 20/10: cores normais do Gojo e do Fred (sem brilho de clone: ficava com cara de holograma)
  const cena = SkeletonUtils.clone(g.scene);
  let cf = 0; cena.traverse((o) => { if (o.userData.centro_flutuar_m) cf = o.userData.centro_flutuar_m * o.scale.y; });
  // medidas validadas na galeria (o modelo com esqueleto mede errado na pose de repouso)
  modelos[tipo] = { cena, clipes: g.animations, raio: RAIO_CLONE[tipo], altura: ALTURA_CLONE[tipo], centroFlutuar: cf };
}

function novoClone(tipo: Tipo, n: number): Clone | null {
  const md = modelos[tipo]; if (!md) return null;
  const obj = new THREE.Group(); obj.name = 'clone_' + tipo + '_' + n;
  obj.add(SkeletonUtils.clone(md.cena)); obj.visible = false; cena3d.add(obj);
  const mixer = new THREE.AnimationMixer(obj);
  return { n, tipo, obj, mixer, clipes: new Map(md.clipes.map((c) => [c.name, c])), clipe: '', estado: 'maquina', fila: [], local: null, corre: n % 3 === 0,
    paradas: [], semPulo: 0, noAr: false, espiar: 0, espiarAte: 0, proximoEspiar: 0, fundoY: 0, t: 0, vaga: null, de: new THREE.Vector3(), para: new THREE.Vector3(), giro: 0, sobe: 0,
    primeira: false, fatorV: 1, espera: 0, paradoDesde: -1 };
}

let arma: { raiz: THREE.Group; mixer: THREE.AnimationMixer | null; disparar: THREE.AnimationClip | null; emissor: THREE.Object3D | null; contorno: THREE.Object3D[]; suporte: { pos: THREE.Vector3; quat: THREE.Quaternion } } | null = null;
let armaMao: Mao | null = null;           // VR: a mão que segura; PC: a mão direita
let armaCaindo = 0, ultimoTiro = -9;
const bolinhas: { m: THREE.Mesh; vel: THREE.Vector3; vida: number }[] = [];
const efeitos: { m: THREE.Mesh; d: THREE.Vector3; vida: number; t: number }[] = [];
let mira: THREE.Line | null = null;
let botao: { obj: THREE.Object3D; mixer: THREE.AnimationMixer | null; apertar: THREE.AnimationClip | null } | null = null;

const geoBolinha = new THREE.IcosahedronGeometry(0.035, 0);
const matBolinha = new THREE.MeshBasicMaterial({ color: '#4fd6d0' });
const geoParticula = new THREE.OctahedronGeometry(0.03, 0);
const matsParticula = ['#4fd6d0', '#c9b6ff', '#e2a72e', '#f6f3ea'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
const geoPixel = new THREE.BoxGeometry(0.04, 0.04, 0.04);
const matsPixel = ['#4fd6d0', '#7b4fd6'].map((c) => new THREE.MeshBasicMaterial({ color: c }));

export async function montarTreino(): Promise<void> {
  await Promise.all([carregarModelo('gojo'), carregarModelo('fred')]);
  maquina = instancias.get('maquina_clonagem')?.obj ?? null;
  // esconderijos e obstáculos (caixas no espaço do mundo; as salas ficam em y = 0)
  locais = []; obstaculos = [];
  for (const id of ESCONDERIJOS) {
    const inst = instancias.get(id); if (!inst?.obj) continue;
    inst.raiz.updateMatrixWorld(true);
    let borda = 0.7, soFred = false; const dentro = new THREE.Vector3();
    inst.obj.traverse((o) => { if (o.userData.altura_borda_m) { borda = o.userData.altura_borda_m; soFred = !!o.userData.so_fred; } if (o.name === 'ponto_dentro') o.getWorldPosition(dentro); });
    const caixa = new THREE.Box3().setFromObject(inst.raiz);
    const l: Esconderijo = { id, caixa, dentro, borda, soFred, ocupado: null };
    locais.push(l);
    // para o tiro, o esconderijo vai só até a borda (as abas abertas e a tampa são finas): a cabeça que aparece pode ser acertada
    const corpo = caixa.clone(); corpo.max.y = Math.min(corpo.max.y, borda + 0.02);
    obstaculos.push({ caixa: corpo, esconderijo: l });
  }
  for (const id of ['maquina_clonagem', 'camara_captura', 'botao_cuidado']) {
    const inst = instancias.get(id); if (inst?.obj) obstaculos.push({ caixa: new THREE.Box3().setFromObject(inst.raiz) });
  }
  // o Gabura gato fica ao lado do botão durante a captura (chave final da cena)
  obstaculos.push({ caixa: new THREE.Box3(new THREE.Vector3(-16.0, 0, 4.2), new THREE.Vector3(-15.2, 1.4, 5.0)) });
  montarGrade();
  // câmara de captura: vagas, visor, vidro
  const camara = instancias.get('camara_captura');
  vagas = [];
  camara?.obj?.traverse((o) => { if (/^vaga_\d+$/.test(o.name)) vagas.push(o); });
  const noVisor = camara?.obj?.getObjectByName('visor_numero');
  if (noVisor) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.18), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    placa.position.z = 0.004; noVisor.add(placa); visor = { cv, tex };
  }
  const v = camara?.obj?.getObjectByName('vidro') as THREE.Mesh | undefined;
  if (v?.isMesh) { vidro = (v.material as THREE.MeshStandardMaterial).clone(); v.material = vidro; }
  // arma
  const ia = instancias.get('arma_laser');
  if (ia?.obj) {
    arma = { raiz: ia.raiz, mixer: ia.mixer, disparar: ia.clipes.get('disparar') ?? null, emissor: ia.obj.getObjectByName('ponto_emissor') ?? null,
      contorno: criarContorno(ia.obj), suporte: { pos: ia.raiz.position.clone(), quat: ia.raiz.quaternion.clone() } };
  }
  const ib = instancias.get('botao_cuidado');
  if (ib?.obj) botao = { obj: ib.raiz, mixer: ib.mixer, apertar: ib.clipes.get('apertar') ?? null };
  // mira pontilhada (só enquanto segura a arma, no VR)
  mira = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineDashedMaterial({ color: '#8fd651', dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.8 }));
  mira.visible = false; mira.frustumCulled = false; cena3d.add(mira);
  // os 16 clones (8 Gojos e 8 Freds), escondidos dentro da máquina até a cena começar
  clones = [];
  for (let i = 0; i < 16; i++) { const c = novoClone(i % 2 ? 'fred' : 'gojo', i); if (c) clones.push(c); }
  zerarTreino();
}

// ---------- clones: sair da máquina, andar, esconder ----------
function tocarClipe(c: Clone, nome: string): void {
  if (c.clipe === nome) return;
  const clipe = c.clipes.get(nome) ?? c.clipes.get('idle'); if (!clipe) return;
  c.mixer.stopAllAction(); const a = c.mixer.clipAction(clipe); a.reset().play(); c.clipe = nome;
  if (nome === 'flutuar') a.time = Math.random() * clipe.duration;
}
const md = (c: Clone) => modelos[c.tipo]!;

function localLivre(tipo: Tipo): Esconderijo | null {
  const livres = locais.filter((l) => !l.ocupado && (tipo === 'fred' || !l.soFred));
  return livres[Math.floor(aleatorio() * livres.length)] ?? null;
}

function rotaPara(c: Clone, de: THREE.Vector3): Passo[] {
  const l = c.local!; const ent = entradaDe(l);
  const fundo = l.dentro.clone(); fundo.y = l.borda - md(c).altura * 0.75; c.fundoY = fundo.y;
  const passos: Passo[] = []; let ant = de.clone();
  for (const p of caminho(de, ent)) { passos.push({ tipo: 'andar', de: ant, para: p, t: 0 }); ant = p; }
  passos.push({ tipo: 'salto', de: ant, para: fundo, t: 0, altura: l.borda + 0.12 - Math.max(ant.y, fundo.y), dur: 0.55, entrar: true });
  return passos;
}

/** A máquina cospe o próximo clone (se houver esconderijo livre para ele). */
function soltarDaMaquina(): boolean {
  if (!maquina || !fila.length) return false;
  const a = maquina.getObjectByName('ponto_saida')!.getWorldPosition(new THREE.Vector3());
  const b = maquina.getObjectByName('ponto_fim_esteira')!.getWorldPosition(new THREE.Vector3());
  // destinos alternados: cada clone vai para o lado oposto ao do anterior (não disputam o mesmo caminho)
  const escolher = (t: Tipo) => {
    const livres = locais.filter((l) => !l.ocupado && (t === 'fred' || !l.soFred)); if (!livres.length) return null;
    const outroLado = livres.filter((l) => Math.sign(l.dentro.x - b.x) !== ultimoLado);
    const lista = outroLado.length ? outroLado : livres; return lista[Math.floor(aleatorio() * lista.length)];
  };
  // o próximo da fila; se não houver lugar para ele (só baldes livres e ele é Gojo), sai um Fred
  let tipo = fila[0];
  let local = escolher(tipo);
  if (!local && tipo === 'gojo' && fila.includes('fred')) { tipo = 'fred'; local = escolher('fred'); }
  if (!local) return false;
  ultimoLado = Math.sign(local.dentro.x - b.x);
  fila.splice(fila.indexOf(tipo), 1);
  const c = clones.find((k) => k.estado === 'maquina' && k.tipo === tipo); if (!c) return false;
  const frente = b.clone().sub(a).setY(0).normalize(), lado = new THREE.Vector3(-frente.z, 0, frente.x);
  // cai da ponta da esteira para o lado do esconderijo dele
  const s0 = Math.sign(local.dentro.clone().sub(b).dot(lado)) || 1;
  let chao = b.clone().setY(0).addScaledVector(frente, 0.6);
  for (const s of [s0 * 0.8, s0 * 1.2, -s0 * 0.8, 0]) {
    const p = b.clone().setY(0).addScaledVector(frente, 0.6).addScaledVector(lado, s); const [i, j] = celula(p); if (livre(i, j)) { chao = p; break; }
  }
  c.local = local; local.ocupado = c; c.estado = 'andando'; c.obj.visible = true; c.obj.position.copy(a);
  c.primeira = true; c.fatorV = 1; c.espera = 0; c.paradoDesde = -1; c.paradas = [];
  c.fila = [{ tipo: 'esteira', de: a, para: b, t: 0, vel: 1.6 }, { tipo: 'salto', de: b, para: chao, t: 0, altura: 0.4, dur: 0.55 }, ...rotaPara(c, chao)];
  return true;
}

function trocarEsconderijo(c: Clone): void {
  const novo = localLivre(c.tipo); if (!novo || !c.local) return;
  const velho = c.local; velho.ocupado = null; novo.ocupado = c; c.local = novo; c.corre = true;
  const ent = entradaDe(velho); const daqui = c.obj.position.clone();
  c.estado = 'andando'; c.espiar = 0; c.fatorV = 1; c.espera = 0; c.paradoDesde = -1;
  c.fila = [{ tipo: 'salto', de: daqui, para: ent, t: 0, altura: velho.borda + 0.12 - daqui.y, dur: 0.55 }, ...rotaPara(c, ent)];
}

const olharPosto = (c: Clone) => { const p = posicaoPes(); c.obj.rotation.y = Math.atan2(p.x - c.obj.position.x, p.z - c.obj.position.z); };

function andarClone(c: Clone, dt: number, agora: number): void {
  const r = c.fila[0];
  if (!r) {
    // chegou: fica escondido, espiando de vez em quando
    if (c.estado === 'andando') { c.estado = 'escondido'; c.primeira = false; c.proximoEspiar = agora + 1 + aleatorio() * 3; olharPosto(c); }
    return;
  }
  const dist = r.de.distanceTo(r.para);
  let clipe = 'idle';
  c.noAr = false;
  if (r.tipo === 'andar') { andarNoChao(c, dt, agora); return; }
  if (r.tipo === 'esteira') {
    r.t = Math.min(1, r.t + ((r.vel ?? 1.6) * dt) / Math.max(dist, 0.001)); c.obj.position.lerpVectors(r.de, r.para, r.t);
    c.obj.rotation.y = Math.atan2(r.para.x - r.de.x, r.para.z - r.de.z);
  } else {
    // salto em arco (parábola): sobe acima da borda e cai dentro; no ar ninguém trava
    c.noAr = true;
    r.t = Math.min(1, r.t + dt / (r.dur ?? 0.55)); const e = r.t;
    c.obj.position.lerpVectors(r.de, r.para, e); c.obj.position.y += Math.max(0, r.altura ?? 0.4) * 4 * e * (1 - e);
    if (dist > 0.05 && !r.entrar) c.obj.rotation.y = Math.atan2(r.para.x - r.de.x, r.para.z - r.de.z);
    clipe = c.clipes.has('saltar') ? 'saltar' : 'idle';
  }
  tocarClipe(c, clipe);
  if (r.t >= 1) c.fila.shift();
}

/**
 * Andar no chão sem "travar" (plano de 20/10, medido no teste_clones.py):
 * - quem vem atrás SEGUE o da frente, desacelerando aos poucos pela distância (nunca anda-para-anda);
 * - o passo do quadro continua no próximo trecho do caminho (antes o clone perdia o resto do passo em cada curva);
 * - o corpo vira suave para a direção nova; a animação só vai para "parado" depois de 0,4 s parado;
 * - preso: primeiro desvia para o lado, depois recalcula o caminho; pular por cima é o último recurso.
 */
function andarNoChao(c: Clone, dt: number, agora: number): void {
  const r = c.fila[0];
  const R = (k: Clone) => md(k).raio;
  const correndo = !c.primeira && c.corre && Math.sin(agora * 1.4 + c.n) > -0.3; // depois do 1º esconderijo: corre, mas anda de vez em quando
  const vel = c.primeira ? (c.tipo === 'gojo' ? 2.2 : 1.7) : correndo ? (c.tipo === 'gojo' ? 1.8 : 1.3) : 1.0;
  const dir = r.para.clone().sub(c.obj.position).setY(0); const falta = dir.length();
  if (falta < 1e-5) { c.fila.shift(); return; }
  dir.divideScalar(falta);
  // quem está na frente, num corredor da largura dos dois (escondidos e quem está no ar não contam)
  let bloq: Clone | null = null, dFrente = Infinity;
  for (const o of clones) {
    if (o === c || o.estado !== 'andando' || o.noAr || o.obj.position.y >= 0.25) continue;
    const d = o.obj.position.clone().sub(c.obj.position).setY(0); const adiante = d.dot(dir); if (adiante <= 0) continue;
    const lateral = Math.sqrt(Math.max(0, d.lengthSq() - adiante * adiante)); if (lateral > (R(c) + R(o)) * 0.9) continue;
    if (adiante < dFrente) { dFrente = adiante; bloq = o; }
  }
  let fator = 1;
  if (bloq) fator = THREE.MathUtils.clamp((dFrente - (R(c) + R(bloq) + 0.06)) / 0.6, 0, 1);
  c.fatorV += (fator - c.fatorV) * Math.min(1, dt * 7);             // acelera e freia suave
  if (fator < 0.02 && c.fatorV < 0.05) c.fatorV = 0;
  // preso atrás de alguém
  if (bloq && c.fatorV === 0) {
    if (c.espera === 0) { c.paradas = c.paradas.filter((x) => agora - x < 4); c.paradas.push(agora); }
    c.espera += dt;
    // os dois se esperando (um vindo contra o outro): o de número menor desvia logo
    const ob = bloq.fila[0];
    const contra = !!ob && ob.tipo === 'andar' && ob.para.clone().sub(bloq.obj.position).setY(0).normalize().dot(dir) < -0.3;
    if (c.espera > (contra && c.n < bloq.n ? 0.15 : 0.35) && desviar(c, bloq, dir)) { c.espera = 0; return; }
    if (c.espera > 0.9) { recalcular(c); c.espera = 0; return; }
    if (c.paradas.length >= 3 && c.espera > 0.6 && !(c.semPulo > agora) && pularPorCima(c, bloq, dir, falta, agora)) { c.espera = 0; return; }
  } else c.espera = 0;
  // anda, levando o resto do passo para o próximo trecho do caminho
  let resto = vel * c.fatorV * dt;
  while (resto > 1e-6) {
    const s = c.fila[0]; if (!s || s.tipo !== 'andar') break;
    const v = s.para.clone().sub(c.obj.position).setY(0); const L = v.length();
    if (L <= resto) { c.obj.position.x = s.para.x; c.obj.position.z = s.para.z; resto -= L; c.fila.shift(); continue; }
    c.obj.position.addScaledVector(v.divideScalar(L), resto); resto = 0;
  }
  c.obj.position.y = 0;
  // vira suave para onde está indo (no máximo ~1,3 volta por segundo)
  const alvoGiro = Math.atan2(dir.x, dir.z); let dg = alvoGiro - c.obj.rotation.y; dg = Math.atan2(Math.sin(dg), Math.cos(dg));
  c.obj.rotation.y += THREE.MathUtils.clamp(dg, -8 * dt, 8 * dt);
  // animação: "parado" só depois de 0,4 s parado (nada de trocar andar/parado várias vezes por segundo)
  if (c.fatorV < 0.08) { if (c.paradoDesde < 0) c.paradoDesde = agora; } else c.paradoDesde = -1;
  const andando = c.paradoDesde < 0 || agora - c.paradoDesde < 0.4;
  const rapido = c.primeira || correndo;
  tocarClipe(c, !andando ? 'idle' : rapido && c.clipes.has('correr') ? 'correr' : 'andar');
}
/** Passo para o lado do clone da frente (num lugar livre), e depois segue o caminho. */
function desviar(c: Clone, bloq: Clone, dir: THREE.Vector3): boolean {
  const R = (k: Clone) => md(k).raio;
  const lat = new THREE.Vector3(-dir.z, 0, dir.x);
  const lado = Math.sign(lat.dot(c.obj.position.clone().sub(bloq.obj.position))) || (c.n % 2 ? 1 : -1);
  for (const s of [lado, -lado]) for (const k of [0.55, 0.8]) {
    const p = c.obj.position.clone().setY(0).addScaledVector(lat, s * k).addScaledVector(dir, 0.2);
    const [i, j] = celula(p); if (!livre(i, j)) continue;
    if (clones.some((o) => o !== c && o.estado === 'andando' && Math.hypot(o.obj.position.x - p.x, o.obj.position.z - p.z) < R(c) + R(o) + 0.08)) continue;
    c.fila.unshift({ tipo: 'andar', de: c.obj.position.clone(), para: p, t: 0 }); return true;
  }
  return false;
}
/** Recalcula o caminho até o esconderijo contornando os outros clones. */
function recalcular(c: Clone): void {
  const marcadas: number[] = [];
  for (const o of clones) if (o !== c && o.estado === 'andando' && o.obj.position.y < 0.25) {
    const [oi, oj] = celula(o.obj.position);
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) if (livre(oi + di, oj + dj)) { grade[oi + di + (oj + dj) * GR.nx] = 1; marcadas.push(oi + di + (oj + dj) * GR.nx); }
  }
  const fim = c.fila[c.fila.length - 1];
  const destino = c.fila[c.fila.length - 2]?.para ?? c.fila[0].para;
  const novos = caminho(c.obj.position.clone().setY(0), destino);
  for (const k of marcadas) grade[k] = 0;
  c.fila = []; let ant = c.obj.position.clone().setY(0);
  for (const pt of novos) { c.fila.push({ tipo: 'andar', de: ant, para: pt, t: 0 }); ant = pt; }
  if (fim.tipo === 'salto') { fim.de = ant; fim.t = 0; c.fila.push(fim); }
}
/** Último recurso: pula por cima e cai além do outro, num lugar livre (sem pular de novo por 2 s). */
function pularPorCima(c: Clone, bloq: Clone, dir: THREE.Vector3, falta: number, agora: number): boolean {
  const R = (k: Clone) => md(k).raio;
  const alem = bloq.obj.position.clone().setY(0).addScaledVector(dir, R(c) + R(bloq) + 0.3);
  const [ci, cj] = celula(alem);
  const ocupado = clones.some((o) => o !== c && o.obj.visible && o.estado === 'andando' && o.obj.position.distanceTo(alem) < R(c) + R(o) + 0.1);
  if (!livre(ci, cj) || ocupado || alem.distanceTo(c.obj.position) > falta + 0.4) return false;
  c.paradas = []; c.semPulo = agora + 2;
  c.fila.unshift({ tipo: 'salto', de: c.obj.position.clone(), para: alem, t: 0, altura: 0.7, dur: 0.5 });
  return true;
}

/** Escondido: de vez em quando sobe para espiar o posto (é a hora boa de mirar). */
function espiarClone(c: Clone, dt: number, agora: number): void {
  const alvo = agora < c.espiarAte ? 1 : 0;
  if (alvo === 0 && agora >= c.proximoEspiar) { c.espiarAte = agora + 1.2 + aleatorio() * 1.0; c.proximoEspiar = c.espiarAte + 2.5 + aleatorio() * 3.5; }
  c.espiar = THREE.MathUtils.clamp(c.espiar + Math.sign(alvo - c.espiar) * dt * 4, 0, 1);
  c.obj.position.y = c.fundoY + c.espiar * md(c).altura * 0.45;
  olharPosto(c);
  tocarClipe(c, 'idle');
}

// ---------- tiro ----------
/** Esfera de acerto do clone (o corpo; escondido, só a parte que aparece fica acima da borda). */
function esferaDe(c: Clone): THREE.Sphere {
  const m = md(c); return new THREE.Sphere(c.obj.position.clone().add(new THREE.Vector3(0, m.altura * 0.55, 0)), Math.max(0.15, m.raio * 0.95));
}
const alvoDoTiro = (c: Clone) => c.obj.visible && (c.estado === 'andando' || c.estado === 'escondido');

interface Acerto { t: number; clone?: Clone; esconderijo?: Esconderijo; ponto: THREE.Vector3; }
const raioTmp = new THREE.Ray(), pTmp = new THREE.Vector3();
/** O que o segmento de p0 até p1 toca primeiro: clone, esconderijo, outro objeto ou a sala. */
function primeiroAcerto(p0: THREE.Vector3, p1: THREE.Vector3): Acerto | null {
  const dir = p1.clone().sub(p0); const L = dir.length(); if (L < 1e-6) return null; dir.divideScalar(L);
  raioTmp.set(p0, dir);
  let melhor: Acerto | null = null;
  const anota = (t: number, extra: Partial<Acerto>) => { if (t <= L && (!melhor || t < melhor.t)) melhor = { t, ponto: p0.clone().addScaledVector(dir, t), ...extra }; };
  for (const c of clones) if (alvoDoTiro(c) && raioTmp.intersectSphere(esferaDe(c), pTmp)) anota(pTmp.distanceTo(p0), { clone: c });
  for (const o of obstaculos) if (raioTmp.intersectBox(o.caixa, pTmp)) anota(pTmp.distanceTo(p0), { esconderijo: o.esconderijo });
  // paredes, chão e teto da sala
  for (let k = 1; k <= 8; k++) {
    const q = p0.clone().addScaledVector(dir, (L * k) / 8);
    if (q.y < 0 || q.y > SALA.teto || q.x < SALA.x0 || q.x > SALA.x1 + 4 || q.z < SALA.z0 || q.z > SALA.z1) { anota((L * k) / 8, {}); break; }
  }
  return melhor;
}

function atirar(origem: THREE.Vector3, dir: THREE.Vector3): void {
  const agora = tempoGlobal(); if (agora - ultimoTiro < INTERVALO_TIRO || !arma) return;
  ultimoTiro = agora;
  if (arma.mixer && arma.disparar) { const a = arma.mixer.clipAction(arma.disparar); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.reset().play(); }
  tocar('sfx_arma_disparo', { em: origem });
  vibrarTipo(entrada.modo === 'vr' ? armaMao?.lado : null, 'tiro');
  const m = new THREE.Mesh(geoBolinha, matBolinha); m.position.copy(origem); cena3d.add(m);
  bolinhas.push({ m, vel: dir.clone().normalize().multiplyScalar(VEL_BOLINHA), vida: 3 });
}

function explodir(ponto: THREE.Vector3, n = 22): void {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geoParticula, matsParticula[i % 4]); m.position.copy(ponto); cena3d.add(m);
    efeitos.push({ m, d: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(0.8 + Math.random() * 1.4), vida: 0.6 + Math.random() * 0.4, t: 0 });
  }
}
function pixels(ponto: THREE.Vector3): void {
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(geoPixel, i % 3 ? matsPixel[0] : matsPixel[1]);
    m.position.copy(ponto).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.4, (Math.random() - 0.5) * 0.4)); cena3d.add(m);
    efeitos.push({ m, d: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3), vida: 0.6 + Math.random() * 0.4, t: 0 });
  }
}

function atualizarBolinhas(dt: number): void {
  for (let i = bolinhas.length - 1; i >= 0; i--) {
    const b = bolinhas[i]; b.vida -= dt;
    const p0 = b.m.position.clone(), p1 = p0.clone().addScaledVector(b.vel, dt);
    const h = b.vida > 0 ? primeiroAcerto(p0, p1) : { t: 0, ponto: p0 };
    if (!h) { b.m.position.copy(p1); continue; }
    cena3d.remove(b.m); bolinhas.splice(i, 1);
    if (h.clone) { capturar(h.clone); continue; }
    explodir(h.ponto);
    if (h.esconderijo) {
      tocar('sfx_bolinha_esconderijo', { em: h.ponto });
      // acertou o esconderijo: o clone de dentro se abaixa (se esconde de novo) e o gato comenta
      const c = h.esconderijo.ocupado; if (c && c.estado === 'escondido') { c.espiarAte = 0; c.proximoEspiar = tempoGlobal() + 2.5; }
      if (treino.comecou && !treino.completo && tempoGlobal() - ultimaFalaErro > 6) { falaPorEvento('treino_errou', { seOcupado: 'descartar' }); ultimaFalaErro = tempoGlobal(); }
    }
  }
  for (let i = efeitos.length - 1; i >= 0; i--) {
    const e = efeitos[i]; e.t += dt;
    e.m.position.addScaledVector(e.d, dt); e.d.y -= 1.5 * dt; e.m.scale.setScalar(Math.max(0.01, 1 - e.t / e.vida));
    if (e.t >= e.vida) { cena3d.remove(e.m); efeitos.splice(i, 1); }
  }
}

// ---------- captura: susto → pixels → câmara ----------
function capturar(c: Clone): void {
  if (c.local) { c.local.ocupado = null; c.local = null; }
  c.fila = []; c.estado = 'susto'; c.t = 0; ultimaCaptura = tempoGlobal();
  tocarClipe(c, c.clipes.has('atencao') ? 'atencao' : 'idle');
}
function vagaLivre(): THREE.Object3D | null {
  const livres = vagas.filter((v) => !clones.some((c) => c.vaga === v));
  return livres[Math.floor(Math.random() * livres.length)] ?? null;
}
function irParaOTubo(c: Clone, voar: boolean): void {
  const vaga = vagaLivre(); if (!vaga) return;
  c.vaga = vaga; c.estado = voar ? 'voando' : 'tubo'; c.t = 0; c.obj.visible = true; c.espiar = 0;
  const destino = vaga.getWorldPosition(new THREE.Vector3()); destino.y -= md(c).centroFlutuar;
  c.para.copy(destino);
  c.de.copy(instancias.get('camara_captura')?.obj?.getObjectByName('anel_chegada')?.getWorldPosition(new THREE.Vector3()) ?? destino).setY(2.6 - md(c).centroFlutuar);
  c.obj.position.copy(voar ? c.de : destino);
  c.obj.rotation.set(0, new THREE.Euler().setFromQuaternion(vaga.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y, 0);
  c.giro = (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.1);
  tocarClipe(c, 'flutuar');
  const n = clones.filter((k) => k.tipo === c.tipo && (k.estado === 'voando' || k.estado === 'tubo')).length - 1;
  const capa = instancias.get('camara_captura')?.obj?.getObjectByName(`contador_${c.tipo}_${n}_apagado`); if (capa) capa.visible = false;
}
function contar(): void {
  treino.capturados = clones.filter((k) => k.estado === 'voando' || k.estado === 'tubo').length;
  escreverVisor();
  const n = treino.capturados;
  if (n === 8) falaPorEvento('treino_metade', { validar: () => treino.capturados >= 8 && treino.capturados < 16 });
  else if (n === 15) falaPorEvento('treino_ultimo', { validar: () => treino.capturados === 15 });
  else if (n < 16 && tempoGlobal() - ultimaFalaCaptura > 4) { falaPorEvento('treino_captura', { seOcupado: 'descartar' }); ultimaFalaCaptura = tempoGlobal(); }
  if (n >= 16) completar();
}
function completar(): void {
  if (treino.completo) return;
  treino.completo = true; jogador.limites = null;
  if (vidro) { vidro.opacity = 0.42; vidro.color.set('#4fd6d0'); }
  const ic = instancias.get('camara_captura'); const cl = ic?.clipes.get('contar_todos');
  if (ic?.mixer && cl) { const a = ic.mixer.clipAction(cl); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.reset().play(); }
  soltarArma(true);
}
function escreverVisor(): void {
  if (!visor) return;
  const x = visor.cv.getContext('2d')!; x.fillStyle = '#0c1a24'; x.fillRect(0, 0, 256, 192);
  const g = clones.filter((k) => k.tipo === 'gojo' && (k.estado === 'voando' || k.estado === 'tubo')).length;
  const f = clones.filter((k) => k.tipo === 'fred' && (k.estado === 'voando' || k.estado === 'tubo')).length;
  x.textAlign = 'center'; x.fillStyle = '#e8f3f2'; x.font = "800 68px 'Baloo 2', sans-serif"; x.fillText(g + f + '/16', 128, 70);
  x.font = "700 40px Nunito, sans-serif"; x.fillStyle = '#4fd6d0'; x.fillText('Gojos ' + g + '/8', 128, 124);
  x.fillStyle = '#e2a72e'; x.fillText('Freds ' + f + '/8', 128, 174); visor.tex.needsUpdate = true;
}

function atualizarCapturas(dt: number): void {
  for (const c of clones) {
    if (c.estado === 'susto') {
      c.t += dt; c.obj.position.y += dt * 0.5;  // pulinho de susto
      if (c.t > 0.35) {
        pixels(c.obj.position.clone().add(new THREE.Vector3(0, md(c).altura * 0.5, 0)));
        tocar('sfx_captura', { em: c.obj.position.clone() });
        const ic = instancias.get('camara_captura'); const cl = ic?.clipes.get('chegada');
        if (ic?.mixer && cl) { const a = ic.mixer.clipAction(cl); a.setLoop(THREE.LoopOnce, 1); a.reset().play(); }
        irParaOTubo(c, true); contar();
      }
    } else if (c.estado === 'voando') {
      c.t = Math.min(1, c.t + dt / 1.3); const k = c.t * c.t * (3 - 2 * c.t);
      c.obj.position.lerpVectors(c.de, c.para, k); if (c.t >= 1) c.estado = 'tubo';
    }
    if (c.estado === 'tubo' || c.estado === 'voando') c.obj.rotation.y += c.giro * dt;
  }
}

// ---------- arma: pegar, segurar, soltar (volta para o suporte) ----------
function armaNoSuporte(): void {
  if (!arma) return;
  arma.raiz.position.copy(arma.suporte.pos); arma.raiz.quaternion.copy(arma.suporte.quat);
}
/** Soltou (ou saiu da sala): a arma cai um pouquinho e se teletransporta de volta para o suporte. */
function soltarArma(imediato = false): void {
  if (!arma) return;
  armaMao = null; if (mira) mira.visible = false;
  for (const c of arma.contorno) c.visible = false;
  if (imediato) { voltarParaSuporte(); return; }
  armaCaindo = 0.45;
}
function voltarParaSuporte(): void {
  if (!arma) return;
  const p = arma.raiz.position.clone();
  if (p.distanceTo(arma.suporte.pos) > 0.05) { pixels(p); pixels(arma.suporte.pos.clone()); tocar('sfx_captura', { em: arma.suporte.pos.clone(), volume: 0.6, taxa: 1.3 }); }
  armaCaindo = 0; armaNoSuporte();
}
const quatGiro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
function poseArmaVR(m: Mao): void {
  if (!arma) return;
  m.pose.getWorldPosition(arma.raiz.position);
  // o cano (+Z da arma) aponta para onde o controle aponta (-Z do raio)
  arma.raiz.quaternion.copy(m.mira.getWorldQuaternion(new THREE.Quaternion())).multiply(quatGiro);
}
function poseArmaPC(): THREE.Vector3 {
  const cam = camera.getWorldPosition(new THREE.Vector3()), q = camera.getWorldQuaternion(new THREE.Quaternion());
  const frente = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const alvo = cam.clone().addScaledVector(frente, 8);
  const h = primeiroAcerto(cam.clone().addScaledVector(frente, 0.3), cam.clone().addScaledVector(frente, 15)); if (h) alvo.copy(h.ponto);
  if (!arma) return alvo;
  arma.raiz.position.copy(new THREE.Vector3(0.17, -0.2, -0.42).applyQuaternion(q).add(cam));
  arma.raiz.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), alvo.clone().sub(arma.raiz.position).normalize());
  return alvo;
}
const caixaArma = new THREE.Box3();
function maoPertoDaArma(m: Mao): boolean {
  if (!arma) return false;
  caixaArma.setFromObject(arma.raiz);
  return caixaArma.distanceToPoint(m.pose.getWorldPosition(new THREE.Vector3())) < 0.18;
}
const raioPC = new THREE.Raycaster();
function miraNaArma(): boolean {
  if (!arma) return false;
  const m = entrada.maos.dir;
  raioPC.set(m.mira.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).applyQuaternion(m.mira.getWorldQuaternion(new THREE.Quaternion())));
  raioPC.far = 2.5;
  return raioPC.intersectObject(arma.raiz, true).some((h) => !h.object.userData.contorno);
}

let armaPerto: Mao | null = null;
function atualizarArma(dt: number): void {
  if (!arma) return;
  arma.mixer?.update(dt);
  treino.dicaTexto = ''; treino.dicaLado = null;
  if (armaCaindo > 0) {
    armaCaindo -= dt; arma.raiz.position.y = Math.max(0.05, arma.raiz.position.y - dt * 2.5);
    if (armaCaindo <= 0) voltarParaSuporte();
    return;
  }
  const naSala = posicaoPes().x < -10.3;
  if (entrada.modo === 'vr') {
    if (armaMao) {
      if (!armaMao.conectada || !armaMao.segurar || !naSala) { soltarArma(!naSala); return; }
      poseArmaVR(armaMao);
      const origem = arma.emissor!.getWorldPosition(new THREE.Vector3()), dir = new THREE.Vector3(0, 0, 1).applyQuaternion(arma.raiz.quaternion);
      // mira pontilhada até onde a bolinha vai bater
      if (mira) {
        const h = primeiroAcerto(origem, origem.clone().addScaledVector(dir, 15));
        const fim = h ? h.ponto : origem.clone().addScaledVector(dir, 15);
        (mira.geometry as THREE.BufferGeometry).setFromPoints([origem, fim]); mira.computeLineDistances(); mira.visible = true;
      }
      if (armaMao.gatilhoBorda) atirar(origem, dir);
      return;
    }
    // mão perto da arma: contorno Lima + vibradinha; grip pega
    let perto: Mao | null = null;
    for (const m of Object.values(entrada.maos)) if (m.conectada && maoPertoDaArma(m)) { perto = m; break; }
    if (perto !== armaPerto && perto) vibrarTipo(perto.lado, 'perto');
    armaPerto = perto;
    for (const c of arma.contorno) c.visible = !!perto;
    if (perto?.segurarBorda && naSala) pegarArma(perto);
    return;
  }
  // PC: clique direito pega/solta; clique esquerdo atira na mira
  const m = entrada.maos.dir;
  if (armaMao) {
    if (!naSala || m.segurarBorda) { soltarArma(); return; }
    const alvo = poseArmaPC();
    treino.dicaTexto = 'Clique: atirar · Clique direito: soltar';
    // a bolinha sai na linha da mira (logo à frente do cano): de baixo do cano ela raspava na borda dos esconderijos
    if (m.gatilhoBorda) {
      const cam = camera.getWorldPosition(new THREE.Vector3()), frente = alvo.clone().sub(cam).normalize();
      const origem = cam.addScaledVector(frente, 0.55); atirar(origem, alvo.sub(origem));
    }
    return;
  }
  const mirando = naSala && miraNaArma();
  for (const c of arma.contorno) c.visible = mirando;
  if (mirando) { treino.dicaTexto = 'Clique direito: pegar a arma'; if (m.segurarBorda) pegarArma(m); }
}
function pegarArma(m: Mao): void {
  armaMao = m; treino.pegouArma = true; armaCaindo = 0;
  for (const c of arma!.contorno) c.visible = false;
  tocar('sfx_segurar', { em: arma!.raiz }); vibrarTipo(m.lado, 'segurou');
}
/** A arma está na mão (para o resto do jogo não pegar outra coisa com o mesmo botão). */
export function segurandoArma(): boolean { return !!armaMao; }

// ---------- botão "não aperte" (depois da missão, a Gabu_IA reclama) ----------
function atualizarBotao(dt: number): void {
  if (!botao) return;
  botao.mixer?.update(dt);
  const apertar = () => {
    if (botao!.mixer && botao!.apertar) { const a = botao!.mixer.clipAction(botao!.apertar); a.setLoop(THREE.LoopOnce, 1); a.reset().play(); }
    tocar('sfx_botao_nao_aperte', { em: botao!.obj }); if (treino.completo) falaPorEvento('treino_botao_depois');
  };
  const p = botao.obj.getWorldPosition(new THREE.Vector3()); p.y = 1.0;
  if (entrada.modo === 'vr') {
    for (const m of Object.values(entrada.maos)) {
      if (!m.conectada || armaMao === m) continue;
      const d = m.pose.getWorldPosition(new THREE.Vector3()).distanceTo(p);
      if (d < 0.16 && (m.gatilhoBorda || m.segurarBorda)) { apertar(); vibrarTipo(m.lado, 'encaixe'); }
    }
  } else if (!armaMao && entrada.maos.dir.gatilhoBorda) {
    raioPC.set(entrada.maos.dir.mira.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).applyQuaternion(entrada.maos.dir.mira.getWorldQuaternion(new THREE.Quaternion())));
    raioPC.far = 2.5; if (raioPC.intersectObject(botao.obj, true).length) apertar();
  }
}

// ---------- movimento dos clones (também usado pelo teste de travadas, sem desenhar) ----------
function moverClones(dt: number, agora: number): void {
  // a máquina cospe um clone de cada vez, sempre que houver esconderijo livre
  if (treino.comecou && fila.length && agora >= proximaSaida) { if (soltarDaMaquina()) proximaSaida = agora + SAIDA_MAQUINA; else proximaSaida = agora + 0.5; }
  for (const c of clones) {
    if (c.estado === 'andando') { const antes = c.obj.position.clone(); andarClone(c, dt, agora); medir(c, antes, dt, agora); }
    else if (c.estado === 'escondido') espiarClone(c, dt, agora);
  }
  // de vez em quando um clone troca de esconderijo (se houver um livre)
  if (treino.comecou && !treino.completo && !fila.length && aleatorio() < dt / 9) {
    const parados = clones.filter((c) => c.estado === 'escondido' && c.espiar === 0);
    const c = parados[Math.floor(aleatorio() * parados.length)]; if (c && localLivre(c.tipo)) trocarEsconderijo(c);
  }
  // encostados: dois clones no chão, andando, mais perto que 70% da soma dos raios
  const noChao = clones.filter((c) => c.estado === 'andando' && !c.noAr && c.obj.position.y < 0.25);
  for (let i = 0; i < noChao.length; i++) for (let j = i + 1; j < noChao.length; j++) {
    const a = noChao[i], b = noChao[j];
    if (Math.hypot(a.obj.position.x - b.obj.position.x, a.obj.position.z - b.obj.position.z) < (md(a).raio + md(b).raio) * 0.7) estat.encostados += dt;
  }
}

/** Medidas de "travada": paradas curtas (anda-para-anda em menos de 0,3 s) e tempo parado. */
const estat = { tremidas: 0, paradas: 0, paradoMax: 0, encostados: 0, trocasClipe: 0 };
const medidas = new Map<Clone, { parado: boolean; desde: number; clipe: string }>();
function medir(c: Clone, antes: THREE.Vector3, dt: number, agora: number): void {
  const r = c.fila[0]; if (!r || r.tipo !== 'andar') { medidas.delete(c); return; }
  const vel = Math.hypot(c.obj.position.x - antes.x, c.obj.position.z - antes.z) / Math.max(dt, 1e-4);
  const parado = vel < 0.15;
  let m = medidas.get(c); if (!m) { m = { parado, desde: agora, clipe: c.clipe }; medidas.set(c, m); }
  if (m.clipe !== c.clipe) { estat.trocasClipe++; m.clipe = c.clipe; }
  if (parado !== m.parado) {
    if (m.parado) { const d = agora - m.desde; if (d < 0.3) estat.tremidas++; else estat.paradas++; estat.paradoMax = Math.max(estat.paradoMax, d); }
    m.parado = parado; m.desde = agora;
  }
}

/** Teste automático: roda a saída dos 16 clones sem desenhar (passo de 1/30 s), capturando um a cada 3 s depois de 20 s. */
export function _simular(segundos: number, sem: number): typeof estat & { escondidos: number; tubo: number } {
  semente = sem; zerarTreino(); treino.comecou = true; proximaSaida = 0;
  Object.assign(estat, { tremidas: 0, paradas: 0, paradoMax: 0, encostados: 0, trocasClipe: 0 }); medidas.clear();
  const dt = 1 / 30; let proximaCaptura = 20;
  for (let t = 0; t < segundos; t += dt) {
    moverClones(dt, t);
    if (t >= proximaCaptura) {
      proximaCaptura += 3;
      const alvo = clones.filter((c) => c.estado === 'escondido');
      const c = alvo[Math.floor(aleatorio() * alvo.length)];
      if (c) { if (c.local) c.local.ocupado = null; c.local = null; c.fila = []; c.estado = 'tubo'; c.obj.visible = false; }
    }
  }
  const r = { ...estat, escondidos: clones.filter((c) => c.estado === 'escondido').length, tubo: clones.filter((c) => c.estado === 'tubo').length };
  zerarTreino();
  return r;
}

// ---------- a cada quadro ----------
export function atualizarTreino(dt: number, pausado: boolean): void {
  if (pausado || !clones.length) return;
  const agora = tempoGlobal();
  moverClones(dt, agora);
  atualizarCapturas(dt);
  // animação dos clones a 30 quadros por segundo (leve para o Quest)
  mixerAcum += dt;
  if (mixerAcum >= 1 / 30) { for (const c of clones) if (c.obj.visible) c.mixer.update(mixerAcum); mixerAcum = 0; }
  instancias.get('camara_captura')?.mixer?.update(dt);
  // sons dos clones: um de cada vez, só de vez em quando, nunca na captura
  if (treino.comecou && agora >= proximoSom && agora - ultimaCaptura > 1.5) {
    const vivos = clones.filter((c) => c.obj.visible && (c.estado === 'andando' || c.estado === 'escondido'));
    const c = vivos[Math.floor(Math.random() * vivos.length)];
    if (c) tocar(c.tipo === 'gojo' ? 'treino_gojo_001' : 'treino_fred_001', { em: c.obj.position.clone().setY(0.4), taxa: 0.92 + Math.random() * 0.16, volume: 0.8 });
    proximoSom = agora + 5 + Math.random() * 5;
  }
  // posto: durante a captura o jogador só anda para os lados
  if (treino.comecou && !treino.completo) {
    const p = posicaoPes();
    if (!jogador.limites && p.x < POSTO.x1 + 0.15 && p.x > POSTO.x0 - 0.3 && Math.abs(p.z) < 2.4) jogador.limites = POSTO;
  }
  atualizarArma(dt);
  atualizarBolinhas(dt);
  atualizarBotao(dt);
}

/** O diretor pergunta: a ação manual da cena já aconteceu? */
export function manualTreino(texto: string): boolean {
  if (/pegar a arma/.test(texto)) return treino.pegouArma;
  if (/capturar os 16/.test(texto)) return treino.completo;
  return false;
}

/** A cena do treinamento começou: a máquina com defeito cospe os clones. */
export function comecarTreino(): void {
  zerarTreino();
  treino.comecou = true; proximaSaida = tempoGlobal() + 1.0; proximoSom = tempoGlobal() + 4;
}

/** Recomeçar a missão: clones de volta na máquina, câmara vazia, arma no suporte. */
export function zerarTreino(): void {
  treino.comecou = false; treino.pegouArma = false; treino.capturados = 0; treino.completo = false;
  if (jogador.limites === POSTO) jogador.limites = null;
  fila = []; for (let i = 0; i < 16; i++) fila.push(i % 2 ? 'fred' : 'gojo'); ultimoLado = 0;
  for (const l of locais) l.ocupado = null;
  for (const c of clones) { c.estado = 'maquina'; c.obj.visible = false; c.fila = []; c.local = null; c.vaga = null; c.espiar = 0; c.clipe = ''; c.mixer.stopAllAction(); }
  for (const b of bolinhas) cena3d.remove(b.m); bolinhas.length = 0;
  for (const e of efeitos) cena3d.remove(e.m); efeitos.length = 0;
  instancias.get('camara_captura')?.obj?.traverse((o) => { if (/^contador_.*_apagado$/.test(o.name)) o.visible = true; });
  const ic = instancias.get('camara_captura'); ic?.mixer?.stopAllAction();
  if (vidro) { vidro.opacity = 0.16; vidro.color.set('#9fe8e4'); }
  armaMao = null; armaCaindo = 0; armaNoSuporte(); if (mira) mira.visible = false;
  escreverVisor();
  zerarFalasPorEvento(['treino_metade', 'treino_ultimo', 'treino_botao_depois']);
}

/** Modo de teste "completar a missão" e missão já feita ao abrir o jogo: os 16 clones flutuando na câmara. */
export function completarTreino(): void {
  treino.comecou = true; treino.pegouArma = true; fila = [];
  for (const l of locais) l.ocupado = null;
  for (const c of clones) if (c.estado !== 'tubo' && c.estado !== 'voando') { c.fila = []; c.local = null; irParaOTubo(c, false); }
  treino.capturados = 16; escreverVisor(); completar();
}

/** Para a vibração ao tocar: os clones soltos pela sala (e os do tubo não). */
export function clonesTocaveis(): Tocavel[] {
  return clones.filter((c) => c.obj.visible && (c.estado === 'andando' || c.estado === 'escondido'))
    .map((c) => ({ pos: c.obj.position.clone(), raio: md(c).raio, altura: md(c).altura }));
}

/** Para o teste automático do PC. */
export function _clones(): { n: number; tipo: string; estado: string; pos: number[]; local: string | null; esfera: number[] }[] {
  return clones.map((c) => { const e = esferaDe(c); return { n: c.n, tipo: c.tipo, estado: c.estado, pos: c.obj.position.toArray().map((v) => +v.toFixed(2)), local: c.local?.id ?? null, esfera: [...e.center.toArray().map((v) => +v.toFixed(2)), +e.radius.toFixed(2)] }; });
}
export function _atirarEm(x: number, y: number, z: number): void {
  // teste: atira da arma (na mão) na direção de um ponto
  if (!arma?.emissor) return;
  const o = arma.emissor.getWorldPosition(new THREE.Vector3()); ultimoTiro = -9; atirar(o, new THREE.Vector3(x, y, z).sub(o));
}
/** Teste: o que um tiro de "de" até "para" acerta primeiro. */
export function _oQueAcerta(de: number[], para: number[]): string {
  const h = primeiroAcerto(new THREE.Vector3(...de), new THREE.Vector3(...para));
  if (!h) return 'nada';
  return h.clone ? 'clone ' + h.clone.n : h.esconderijo ? 'esconderijo ' + h.esconderijo.id : 'outro ' + h.ponto.toArray().map((v) => v.toFixed(2)).join(',');
}
/** Teste: captura um clone na hora (como se a bolinha tivesse acertado). */
export function _capturarTeste(): boolean {
  const c = clones.find((k) => k.estado === 'escondido' || k.estado === 'andando'); if (!c) return false;
  capturar(c); return true;
}
