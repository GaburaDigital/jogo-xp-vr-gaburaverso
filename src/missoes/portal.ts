// Final do jogo: câmara do portal, túnel de hiperespaço e créditos.
// - Com as 3 luzes acesas, a faixa do portal acende na sala central e a câmara fica pronta: a alavanca destrava,
//   o jogador puxa, o portal se expande e, ao atravessar, a Gabu_IA se despede.
// - Com menos de 3 luzes: dá para entrar na câmara, mas a alavanca só balança (a Gabu_IA explica).
// - O túnel fica longe da nave (a cena inteira é deslocada): o jogador é levado devagar pela "plataforma"
//   (faixa Mover do jogador, como no Editor de Cenas), pode olhar em volta, e os hologramas saem do relógio.
// - No fim, a imagem escurece e os créditos aparecem, nesta ordem; depois, os botões Sair e Recomeçar.
// As falas e a ordem vêm das cenas "portal_saida" e "tunel_despedida"; aqui fica o que depende do jogador.

import * as THREE from 'three';
import { camera, instancias } from '../mundo/mundo';
import { entrada, vibrarTipo, type Mao } from '../xr/entrada';
import { tocar } from '../nucleo/audio';
import { diretor, falaPorEvento, iniciarCena, pedidoAtual, tempoGlobal, zerarCena, zerarFalasPorEvento } from '../cenas/diretor';
import * as tocador from '../cenas/tocador';
import { jogador, posicaoPes, teleportar } from '../xr/jogador';
import { progresso } from '../nucleo/config';
import type { Cena, Vec3 } from '../nucleo/modelo';

/** O túnel fica longe da nave: nada da nave aparece lá dentro (a câmera vê até 300 m). */
export const DESLOCAMENTO_TUNEL: Vec3 = [0, 0, -700];
const MISSOES = ['ponte_navegacao', 'treino_captura', 'oficina_energia'];

export const portal = {
  alavancaPuxada: false,
  creditos: -1,              // etapa dos créditos (-1 = não começou; 0..4 vão aparecendo)
  dicaTexto: '' as string,
  dicaLado: null as 'esq' | 'dir' | null,
};

export const tresLuzes = () => MISSOES.every((m) => progresso.cenasConcluidas.includes(m));
const feitas = () => MISSOES.map((m) => progresso.cenasConcluidas.includes(m));

/** Desloca uma cena inteira (objetos, atores, caminhos do jogador e dos atores, pontos de "chegar"). */
export function deslocarCena(c: Cena, d: Vec3): void {
  const mais = (p: Vec3): Vec3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
  c.jogador.pos = mais(c.jogador.pos);
  for (const o of c.cenario) o.pos = mais(o.pos);
  for (const a of c.atores) a.pos = mais(a.pos);
  for (const f of c.faixas) {
    if (f.tipo === 'mover') for (const k of f.chaves) k.pos = mais(k.pos);
    if (f.tipo === 'aguardar') for (const b of f.blocos) if (b.condicao.tipo === 'chegar') b.condicao.pos = mais(b.condicao.pos);
  }
}

// ---------- escurecer (troca de cena e créditos) ----------
const esfera = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: '#05090d', side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
esfera.renderOrder = 45; esfera.visible = false;
let escuroAlvo = 0, escuroVel = 1.5;
function escurecer(alvo: number, segundos = 0.7): void { escuroAlvo = alvo; escuroVel = 1 / Math.max(0.05, segundos); }

let braco: THREE.Object3D | null = null;
let balanco = -1;                // instante em que a alavanca travada começou a balançar
let esperaDesde = -1;            // aguardando atravessar desde (fala dos 15 s)
let ultimoT = 0;                 // tempo da cena do túnel no quadro anterior (a plataforma anda a diferença)
let creditosT = 0;
let trocandoParaTunel = -1;

export function montarPortal(): void {
  camera.add(esfera);
  braco = instancias.get('alavanca_portal')?.obj?.getObjectByName('braco') ?? null;
}

// ---------- alavanca ----------
const raioPC = new THREE.Raycaster();
function maoNaAlavanca(m: Mao): boolean {
  if (!braco) return false;
  const b = new THREE.Box3().setFromObject(braco);
  return b.distanceToPoint(m.pose.getWorldPosition(new THREE.Vector3())) < 0.14;
}
function miraNaAlavanca(): boolean {
  const inst = instancias.get('alavanca_portal'); if (!inst) return false;
  const m = entrada.maos.dir;
  raioPC.set(m.mira.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).applyQuaternion(m.mira.getWorldQuaternion(new THREE.Quaternion())));
  raioPC.far = 3;
  return raioPC.intersectObject(inst.raiz, true).length > 0;
}
let pertoAntes: Mao | null = null;
function usarAlavanca(): void {
  const pes = posicaoPes(), a = instancias.get('alavanca_portal')?.raiz.position;
  if (!a || Math.hypot(pes.x - a.x, pes.z - a.z) > 2.6) { pertoAntes = null; return; }
  let quem: Mao | null = null;
  if (entrada.modo === 'vr') {
    const perto = Object.values(entrada.maos).find((m) => m.conectada && maoNaAlavanca(m)) ?? null;
    if (perto && perto !== pertoAntes) vibrarTipo(perto.lado, 'perto');
    pertoAntes = perto;
    if (perto && (perto.segurarBorda || perto.gatilhoBorda)) quem = perto;
    if (perto) { portal.dicaTexto = 'Grip ou gatilho: puxar'; portal.dicaLado = perto.lado; }
  } else if (miraNaAlavanca()) {
    portal.dicaTexto = 'Clique: puxar a alavanca';
    if (entrada.maos.dir.gatilhoBorda) quem = entrada.maos.dir;
  }
  if (!quem) return;
  const r = diretor.rodando.get('portal_saida');
  const podePuxar = tresLuzes() && r?.estado === 'aguardando' && /puxar a alavanca/.test(pedidoAtual() ?? '');
  if (podePuxar) { portal.alavancaPuxada = true; vibrarTipo(quem.lado, 'encaixe'); tocar('sfx_alavanca_puxar', { em: braco ?? undefined }); }
  else if (!tresLuzes() || r?.estado !== 'terminada') {
    // travada: o braço só balança e a Gabu_IA explica
    if (!tresLuzes()) falaPorEvento('portal_travada');
    if (tempoGlobal() - balanco > 0.8) { balanco = tempoGlobal(); tocar('sfx_alavanca_travada', { em: braco ?? undefined }); vibrarTipo(quem.lado, 'perto'); }
  }
}

// ---------- a cada quadro ----------
export function atualizarPortal(_dt: number, pausado: boolean): void {
  if (pausado) return;
  portal.dicaTexto = ''; portal.dicaLado = null;
  const pes = posicaoPes();
  const naCamara = pes.z > 9.6 && pes.z < 30;
  // entrou na câmara do portal
  if (naCamara) {
    if (!tresLuzes()) falaPorEvento('portal_sem_luzes');
    else {
      const r = diretor.rodando.get('portal_saida');
      if (r?.estado === 'nao_iniciada' && (!diretor.ativa || diretor.ativa === r)) void iniciarCena('portal_saida');
      // portal já aberto (jogo terminado antes): atravessar de novo leva ao túnel de novo
      if (r?.estado === 'terminada' && pes.z > 17.4 && trocandoParaTunel < 0 && portal.creditos < 0) irParaOTunel();
    }
    usarAlavanca();
  }
  // 15 s sem atravessar o portal aberto
  if (/atravessar o portal/.test(pedidoAtual() ?? '')) { if (esperaDesde < 0) esperaDesde = tempoGlobal(); if (tempoGlobal() - esperaDesde > 15) falaPorEvento('portal_15s'); }
  else esperaDesde = -1;
  // troca para o túnel: escurece, leva o jogador e clareia
  if (trocandoParaTunel >= 0 && tempoGlobal() - trocandoParaTunel > 0.8) {
    trocandoParaTunel = -1;
    const c = diretor.rodando.get('tunel_despedida')!.cena;
    zerarCena('tunel_despedida');
    teleportar(c.jogador.pos, c.jogador.rotY); ultimoT = 0;
    void iniciarCena('tunel_despedida');
    escurecer(0, 1.2);
  }
  // túnel: a plataforma leva o jogador (ele só olha em volta)
  const rt = diretor.rodando.get('tunel_despedida');
  const noTunel = diretor.ativa === rt && !!rt && rt.estado !== 'nao_iniciada';
  jogador.viajando = noTunel;
  if (noTunel) {
    const f = rt.cena.faixas.find((x) => x.tipo === 'mover' && x.alvo === 'jogador');
    if (f && f.tipo === 'mover') {
      const padrao = { pos: rt.cena.jogador.pos, rotY: rt.cena.jogador.rotY, escala: 1 };
      const a = tocador.poseEm(f.chaves, ultimoT, padrao).pos, b = tocador.poseEm(f.chaves, rt.t, padrao).pos;
      jogador.rig.position.x += b[0] - a[0]; jogador.rig.position.z += b[2] - a[2];
      ultimoT = rt.t;
    }
  }
  void feitas;
}

/** A cada quadro, mesmo com painel aberto (os créditos são um painel): créditos aparecendo e o escurecer. */
export function atualizarTelaFinal(dt: number): void {
  // créditos aparecendo um de cada vez
  if (portal.creditos >= 0 && portal.creditos < 4) {
    creditosT += dt; const t = creditosT;   // relógio próprio: com o painel aberto o tempo do jogo para
    const etapa = t > 13 ? 4 : t > 10 ? 3 : t > 7 ? 2 : t > 3 ? 1 : 0;
    if (etapa !== portal.creditos) { portal.creditos = etapa; aoMudarCreditos(); }
  }
  // escurecer
  const mat = esfera.material as THREE.MeshBasicMaterial;
  mat.opacity = THREE.MathUtils.clamp(mat.opacity + Math.sign(escuroAlvo - mat.opacity) * dt * escuroVel, 0, 1);
  if (Math.abs(mat.opacity - escuroAlvo) < dt * escuroVel) mat.opacity = escuroAlvo;
  esfera.visible = mat.opacity > 0.001;
}

/** Depois do diretor (que anima a alavanca): balanço da alavanca travada e luzes das missões na porta e na alavanca. */
export function atualizarPortalDepois(): void {
  if (braco && balanco >= 0) {
    const t = tempoGlobal() - balanco;
    if (t < 0.7) braco.rotateX(Math.sin(t * 30) * 0.12 * (1 - t / 0.7)); else balanco = -1;
  }
  const f = feitas();
  // luzinhas do aro do portal: uma acesa por missão feita
  const aro = instancias.get('portal')?.obj;
  if (aro) f.forEach((feita, k) => { const l = aro.getObjectByName(`luz_${k}`); if (l) l.visible = feita; });
  for (const id of ['porta_portal', 'alavanca_portal']) {
    const obj = instancias.get(id)?.obj; if (!obj) continue;
    f.forEach((feita, k) => { const capa = obj.getObjectByName(`luz_${k}_apagada`); if (capa && feita) capa.visible = false; else if (capa) capa.visible = true; });
  }
}

/** Evento "iniciar_tunel" da cena do portal. */
export function irParaOTunel(): void { escurecer(1, 0.8); trocandoParaTunel = tempoGlobal(); }

let aoMudarCreditos: () => void = () => {};
/** Evento "mostrar_creditos" do túnel: a imagem escurece e os créditos começam. */
export function mostrarCreditos(redesenhar: () => void): void {
  aoMudarCreditos = redesenhar;
  escurecer(1, 1.5);
  portal.creditos = 0; creditosT = 0;
  redesenhar();
}
export function fecharCreditos(): void { portal.creditos = -1; escurecer(0, 0.6); }

/** O diretor pergunta: a ação manual da cena já aconteceu? */
export function manualPortal(texto: string): boolean {
  if (/puxar a alavanca/.test(texto)) return portal.alavancaPuxada;
  return false;
}

/** Recomeçar: alavanca de volta, nada escuro. */
export function zerarPortal(): void {
  portal.alavancaPuxada = false; portal.creditos = -1; esperaDesde = -1; trocandoParaTunel = -1; balanco = -1;
  jogador.viajando = false; escurecer(0, 0.3);
  zerarFalasPorEvento(['portal_sem_luzes', 'portal_travada', 'portal_15s']);
}

/** Modo de teste "completar a missão": puxa a alavanca. */
export function completarPortal(): void { portal.alavancaPuxada = true; }

/** Para os testes: quanto está escuro (0 a 1). */
export function _escuro(): number { return (esfera.material as THREE.MeshBasicMaterial).opacity; }
