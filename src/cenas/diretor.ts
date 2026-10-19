// O "diretor": monta a nave a partir do pacote de cenas e toca as cenas no tempo do áudio,
// como o Editor de Cenas. Para nos "aguardar" até o jogador fazer o que a cena pede
// (chegar, olhar, olhar o relógio, ou uma ação da missão), dispara os eventos e cuida das falas por evento.
// Analogia Godot: é um AnimationPlayer por cena, com as faixas de "chamar método" ligadas à missão.

import * as THREE from 'three';
import { biblioteca, contextoAudio, duracaoFala, prepararSons } from '../nucleo/dados';
import type { Ator, BlocoAguardar, Cena } from '../nucleo/modelo';
import { abaixarMusica, tocar, tocarMusica, volumeDoSom, type Tocando } from '../nucleo/audio';
import { progresso, salvarProgresso } from '../nucleo/config';
import { animar, apontar, brilhar, criarInstancia, instancias, posicionar, posicaoDe } from '../mundo/mundo';
import * as tocador from './tocador';
import { jogador, olhar, posicaoPes, poseRelogio, relogioChamando, relogioFalando } from '../xr/jogador';
import { mostrarLegenda } from '../interface/legenda';
import { entrada } from '../xr/entrada';

type EstadoCena = 'nao_iniciada' | 'tocando' | 'aguardando' | 'terminada';
interface Rodando { cena: Cena; estado: EstadoCena; t: number; ctxBase: number; tBase: number; liberados: Set<number>; aguardando: number; sons: Tocando[]; geracao: number; }

const ACIMA_DO_RELOGIO = 0.075;
export const CENAS_DO_JOGO = ['sala_abertura', 'ponte_navegacao', 'treino_captura', 'oficina_energia', 'portal_saida'];

export const diretor = {
  rodando: new Map<string, Rodando>(),
  ativa: null as Rodando | null,
  forcarAguardar: false,                         // modo de teste: "completar a missão"
  manual: (_texto: string) => false,             // a missão diz se a ação manual já aconteceu
  aoEvento: (_nome: string, _cena: string) => {},
  aoTerminar: (_cena: string) => {},
  /** Objetos que a física controla (o diretor só cuida de mostrar/esconder). */
  fisicos: new Set<string>(),
  /** Objetos que a missão controla por completo (ex.: peças do tangram dentro do console). */
  ignorarAnimacao: new Set<string>(),
};

const cenaPorId = (id: string) => biblioteca.pacote?.cenas.find((c) => c.id === id);

/** Cria todos os objetos e personagens das cenas do jogo (o túnel fica para a próxima entrega). */
export async function montarNave(aoProgresso: (k: number) => void): Promise<void> {
  const p = biblioteca.pacote!;
  const pedidos: Promise<unknown>[] = [];
  const feitos = new Set<string>();
  let total = 0, prontos = 0;
  const conta = <T>(pr: Promise<T>) => { total++; return pr.then((x) => { prontos++; aoProgresso(prontos / total); return x; }); };
  for (const id of CENAS_DO_JOGO) {
    const c = cenaPorId(id); if (!c) continue;
    diretor.rodando.set(id, { cena: c, estado: progresso.cenasConcluidas.includes(id) ? 'terminada' : 'nao_iniciada', t: 0, ctxBase: 0, tBase: 0, liberados: new Set(), aguardando: -1, sons: [], geracao: 0 });
    for (const o of c.cenario) {
      if (feitos.has(o.id)) continue; feitos.add(o.id);
      pedidos.push(conta(criarInstancia(o.id, o.modelo, { pos: o.pos, rotY: o.rotY, rotX: o.rotX, escala: o.escala, alemDoPortal: o.alemDoPortal })));
    }
    for (const a of c.atores) {
      if (feitos.has(a.id)) continue; feitos.add(a.id);
      pedidos.push(conta(criarInstancia(a.id, a.modelo, { holograma: a.holograma, pos: a.pos, rotY: a.rotY, rotX: a.rotX, escala: a.escala })));
    }
  }
  await Promise.all(pedidos);
  void p;
}

/** Ids de todas as falas e sons de uma cena (para carregar antes de tocar). */
function sonsDaCena(c: Cena): string[] {
  const ids = new Set<string>();
  for (const f of c.faixas) {
    if (f.tipo === 'fala') f.blocos.forEach((b) => ids.add(b.fala));
    if (f.tipo === 'som') f.blocos.forEach((b) => ids.add(b.arquivo));
  }
  const eventos = new Set(c.faixas.flatMap((f) => (f.tipo === 'evento' ? f.blocos.map((b) => b.nome) : [])));
  for (const s of biblioteca.pacote?.mixagem?.por_evento ?? []) if (eventos.has(s.evento)) ids.add(s.som);
  return [...ids];
}

/** Começa (ou recomeça) uma cena do início. */
export async function iniciarCena(id: string): Promise<void> {
  const r = diretor.rodando.get(id); if (!r) return;
  const g = ++r.geracao;
  await prepararSons(sonsDaCena(r.cena));
  if (g !== r.geracao) return; // enquanto carregava, a cena foi zerada ou pulada (modo de teste)
  pararSons(r);
  if (diretor.ativa && diretor.ativa !== r) { pararSons(diretor.ativa); if (diretor.ativa.estado !== 'terminada') diretor.ativa.estado = 'nao_iniciada'; }
  r.estado = 'tocando'; r.t = 0; r.liberados.clear(); r.aguardando = -1;
  diretor.ativa = r;
  retomar(r, 0);
}

/** Volta uma cena para o começo, sem tocar (recomeçar a missão / modo de teste). */
export function zerarCena(id: string): void {
  const r = diretor.rodando.get(id); if (!r) return;
  pararSons(r); r.geracao++;
  r.estado = 'nao_iniciada'; r.t = 0; r.liberados.clear(); r.aguardando = -1;
  if (diretor.ativa === r) diretor.ativa = null;
  progresso.cenasConcluidas = progresso.cenasConcluidas.filter((x) => x !== id); salvarProgresso();
}

function aguardosDa(c: Cena): BlocoAguardar[] { return c.faixas.flatMap((f) => (f.tipo === 'aguardar' ? f.blocos : [])).sort((a, b) => a.t - b.t); }
function eventosDa(c: Cena) { return c.faixas.flatMap((f) => (f.tipo === 'evento' ? f.blocos : [])); }

/** Agenda falas, efeitos da cena e sons por evento a partir de t0 (a música é cuidada à parte). */
function retomar(r: Rodando, t0: number): void {
  const ctx = contextoAudio();
  const agora = ctx.currentTime + 0.05;
  r.tBase = t0; r.ctxBase = agora; r.t = t0;
  pararSons(r);
  const c = r.cena;
  const fimEspera = proximoAguardar(r, t0);
  const agendar = (id: string, inicio: number, o: { loop?: boolean; fim?: number; volume?: number; relogio?: boolean } = {}) => {
    if (inicio >= fimEspera) return;          // depois do próximo "aguardar": agenda quando a cena seguir
    const buf = id; void buf;
    const dur = /^(mus|sfx)_/.test(id) ? Infinity : duracaoFala(id);
    if (!o.loop && t0 - inicio >= dur) return;
    if (o.fim !== undefined && t0 >= o.fim) return;
    const fim = Math.min(o.fim ?? Infinity, o.loop ? fimEspera : Infinity);
    const s = tocar(id, { loop: o.loop, volume: o.volume, quando: agora + Math.max(0, inicio - t0), offset: Math.max(0, t0 - inicio), ate: Number.isFinite(fim) ? agora + (fim - t0) : undefined });
    if (s) { (s as Tocando & { relogio?: boolean }).relogio = o.relogio; r.sons.push(s); }
  };
  for (const b of tocador.falasDa(c)) agendar(b.fala, b.t, { relogio: !!tocador.atorDaFala(c, b)?.relogio });
  for (const f of c.faixas) if (f.tipo === 'som') for (const b of f.blocos) if (!/^mus_/.test(b.arquivo)) agendar(b.arquivo, b.t, { loop: b.loop, fim: b.t + b.dur, volume: b.volume });
  const nomes = eventosDa(c);
  for (const b of nomes) for (const se of biblioteca.pacote?.mixagem?.por_evento ?? []) {
    if (se.evento === b.nome) agendar(se.som, b.t + (se.atraso ?? 0), { loop: !!se.loop, fim: se.loop ? c.duracao : undefined });
  }
}
function pararSons(r: Rodando): void { for (const s of r.sons) s.parar(0.05); r.sons = []; }
function proximoAguardar(r: Rodando, t: number): number {
  const lista = aguardosDa(r.cena);
  for (let i = 0; i < lista.length; i++) if (lista[i].t >= t - 1e-6 && !r.liberados.has(i)) return lista[i].t;
  return Infinity;
}

/** A condição de um aguardar já aconteceu? */
function cumprido(cd: BlocoAguardar['condicao']): boolean {
  if (diretor.forcarAguardar) return true;
  if (cd.tipo === 'chegar') { const p = posicaoPes(); return Math.hypot(p.x - cd.pos[0], p.z - cd.pos[2]) <= cd.raio; }
  if (cd.tipo === 'olhar') {
    const alvo = posicaoDe(cd.alvo); if (!alvo) return true;
    const { origem, direcao } = olhar();
    return THREE.MathUtils.radToDeg(direcao.angleTo(alvo.sub(origem).normalize())) <= cd.angulo;
  }
  if (cd.tipo === 'relogio') return jogador.olhandoRelogio;
  return diretor.manual(cd.texto);
}

/** O que a cena está pedindo agora (texto do aguardar), ou null. */
export function pedidoAtual(): string | null {
  const r = diretor.ativa; if (!r || r.estado !== 'aguardando') return null;
  return aguardosDa(r.cena)[r.aguardando]?.condicao.texto ?? null;
}

/** Pula a fala que está tocando (Espaço no PC / teste). */
export function pularFala(): void {
  const r = diretor.ativa; if (!r || r.estado !== 'tocando') return;
  const ativas = tocador.falasAtivas(r.cena, r.t);
  const ult = ativas[ativas.length - 1]; if (!ult) return;
  retomar(r, Math.min(ult.t + duracaoFala(ult.fala) + 0.05, proximoAguardar(r, r.t)));
}

// ---------- falas por evento (sem hora marcada) ----------
interface Avulsa { fala: string; ator: string | null; inicio: number; som: Tocando | null; }
let avulsa: Avulsa | null = null;
const filaAvulsas: { fala: string; ator: string | null }[] = [];
const jaTocadas = new Set<string>();
const ultimaDoGrupo = new Map<string, string>();
const posicaoNaSequencia = new Map<string, number>();
/** Falas por evento pedidas até agora (para os testes automáticos). */
export const historicoAvulsas: string[] = [];

/** Toca uma fala por evento (sorteio sem repetir a anterior, sequência ou uma vez só). */
export function falaPorEvento(idEvento: string): void {
  const e = biblioteca.pacote?.falas_por_evento?.find((x) => x.id === idEvento); if (!e) return;
  let fala: string | undefined;
  if (e.modo === 'uma_vez') { if (jaTocadas.has(e.id)) return; jaTocadas.add(e.id); fala = e.falas[0]; }
  else if (e.modo === 'sequencia') { const i = posicaoNaSequencia.get(e.id) ?? 0; if (i >= e.falas.length) return; fala = e.falas[i]; posicaoNaSequencia.set(e.id, i + 1); }
  else { const outras = e.falas.filter((f) => f !== ultimaDoGrupo.get(e.id)); fala = outras[Math.floor(Math.random() * outras.length)] ?? e.falas[0]; ultimaDoGrupo.set(e.id, fala); }
  if (!fala) return;
  const ator = e.ator ?? (biblioteca.falas.get(fala)?.personagem === 'gaburia' ? 'gaburia' : null);
  filaAvulsas.push({ fala, ator: ator === 'gaburia' ? 'gaburia' : ator }); historicoAvulsas.push(fala);
  void prepararSons([fala]);
}
export function zerarFalasPorEvento(ids: string[]): void { for (const id of ids) { jaTocadas.delete(id); posicaoNaSequencia.delete(id); } }

// ---------- a cada quadro ----------
const relogioGlobal = { t: 0 };
export function atualizarDiretor(dt: number, pausado: boolean): void {
  if (!pausado) relogioGlobal.t += dt;
  const ctx = contextoAudio();
  const r = diretor.ativa;
  if (r && !pausado) {
    if (r.estado === 'tocando') {
      let t = r.tBase + (ctx.currentTime - r.ctxBase);
      if (t < r.tBase) t = r.tBase;
      // eventos que ficaram para trás
      for (const b of eventosDa(r.cena)) if (b.t > r.t && b.t <= t) dispararEvento(b.nome, r.cena.id);
      // chegou num aguardar?
      const lista = aguardosDa(r.cena);
      const i = lista.findIndex((b, k) => b.t >= r.t - 1e-6 && b.t <= t && !r.liberados.has(k));
      if (i >= 0) { t = lista[i].t; r.estado = 'aguardando'; r.aguardando = i; }
      if (t >= r.cena.duracao && r.estado === 'tocando') {
        t = r.cena.duracao; r.estado = 'terminada'; pararSons(r);
        if (!progresso.cenasConcluidas.includes(r.cena.id)) { progresso.cenasConcluidas.push(r.cena.id); salvarProgresso(); }
        diretor.ativa = null;
        diretor.aoTerminar(r.cena.id);
      }
      r.t = t;
    } else if (r.estado === 'aguardando') {
      const b = aguardosDa(r.cena)[r.aguardando];
      if (!b || cumprido(b.condicao)) { r.liberados.add(r.aguardando); r.estado = 'tocando'; retomar(r, r.t); }
    }
  }
  // fila de falas por evento (uma de cada vez, nunca por cima de uma fala da cena)
  const falandoCena = r ? tocador.falasAtivas(r.cena, r.t).length > 0 && r.estado === 'tocando' : false;
  if (avulsa && ctx.currentTime - avulsa.inicio > duracaoFala(avulsa.fala) + 0.3) avulsa = null;
  if (!avulsa && !falandoCena && filaAvulsas.length && !pausado) {
    const prox = filaAvulsas.shift()!;
    avulsa = { ...prox, inicio: ctx.currentTime, som: tocar(prox.fala) };
    if (!avulsa.som) avulsa = null; else (avulsa.som as Tocando & { relogio?: boolean }).relogio = prox.ator === 'gaburia';
  }
  aplicarCenas();
  // voz de quem está no relógio: normal olhando, 40% sem olhar
  for (const s of [...(r?.sons ?? []), ...(avulsa?.som ? [avulsa.som] : [])]) {
    if (!(s as Tocando & { relogio?: boolean }).relogio) continue;
    s.ganho.gain.setTargetAtTime(volumeDoSom(s.id) * (jogador.olhandoRelogio ? 1 : 0.4), ctx.currentTime, 0.08);
  }
}

function dispararEvento(nome: string, cena: string): void { diretor.aoEvento(nome, cena); }

/** Põe cada personagem e objeto no lugar do instante de cada cena (ativa, antes ou depois). */
function aplicarCenas(): void {
  const ctx = contextoAudio();
  let legenda: { quem: string; texto: string } | null = null;
  let falandoAlguem = false, nivelRelogio = 0, tRelogio = 0;
  const personagens = biblioteca.pacote?.personagens ?? {};
  for (const r of diretor.rodando.values()) {
    const c = r.cena;
    const ativa = r === diretor.ativa;
    const t = ativa ? r.t : r.estado === 'terminada' ? c.duracao : 0;
    const extra = ativa ? 0 : relogioGlobal.t; // fora da cena, os loops (idle, flutuar) continuam andando
    for (const o of c.cenario) {
      if (diretor.fisicos.has(o.id)) continue;
      if (o.animacao) animar(o.id, [{ clipe: o.animacao, tempo: relogioGlobal.t, peso: 1, loop: true }]);
    }
    for (const a of c.atores) {
      if (a.relogio) { if (ativa) atualizarAtorRelogio(c, a, t); continue; }
      const inst = instancias.get(a.id); if (!inst) continue;
      const vis = tocador.visivelEm(c, a, t);
      if (diretor.fisicos.has(a.id)) { inst.raiz.visible = vis; continue; }
      const p = tocador.poseAtor(c, a, t);
      posicionar(a.id, p.pos, p.rotY, p.escala, vis, a.rotX ?? 0);
      if (!vis || diretor.ignorarAnimacao.has(a.id)) continue;
      const camadas = tocador.camadasEm(c, a, t, [...inst.clipes.keys()]).map((k) => (k.loop ? { ...k, tempo: k.tempo + extra } : k));
      animar(a.id, camadas, inst.boca.length && ativa ? tocador.bocaEm(c, a, t) : null);
    }
    if (ativa && r.estado !== 'nao_iniciada') {
      const leg = tocador.legendaEm(c, personagens, t);
      if (leg && r.estado === 'tocando') legenda = leg;
      const falas = tocador.falasAtivas(c, t);
      if (falas.length && r.estado === 'tocando') falandoAlguem = true;
      for (const b of falas) {
        const ator = tocador.atorDaFala(c, b);
        if (ator?.relogio) { nivelRelogio = tocador.nivelVoz(b.fala, t - b.t); tRelogio = t - b.t; }
        if (ator?.holograma && !ator.relogio) brilhar(ator.id, tocador.nivelVoz(b.fala, t - b.t));
      }
      const seta = r.estado === 'tocando' || r.estado === 'aguardando' ? tocador.setaEm(c, t) : null;
      const { origem, direcao } = olhar();
      apontar(seta, origem, direcao, relogioGlobal.t);
    }
  }
  if (!diretor.ativa) { const { origem, direcao } = olhar(); apontar(null, origem, direcao, 0); }
  // fala por evento
  if (avulsa) {
    const tl = ctx.currentTime - avulsa.inicio;
    const info = biblioteca.falas.get(avulsa.fala);
    legenda = { quem: personagens[info?.personagem ?? ''] ?? info?.personagem ?? '', texto: info?.texto ?? '' };
    falandoAlguem = true;
    const nivel = tocador.nivelVoz(avulsa.fala, tl);
    if (avulsa.ator === 'gaburia') { nivelRelogio = nivel; tRelogio = tl; mostrarGaburia(nivel > 0 || tl < duracaoFala(avulsa.fala), tl, avulsa.fala); }
    else if (avulsa.ator) {
      const inst = instancias.get(avulsa.ator);
      if (inst) {
        const corpo = inst.clipes.has('falar_corpo') ? 'falar_corpo' : 'falar';
        const abertura = Math.min(1, Math.max(0, (nivel - tocador.LIMIAR_SILENCIO) / 0.9));
        animar(avulsa.ator, [{ clipe: corpo, tempo: tl, peso: 1, loop: true }], { abertura, tempo: tl });
      }
    }
  } else if (!diretor.ativa?.cena.atores.some((a) => a.relogio && tocador.falasAtivas(diretor.ativa!.cena, diretor.ativa!.t).some((b) => tocador.atorDaFala(diretor.ativa!.cena, b)?.id === a.id))) {
    mostrarGaburia(false, 0, null);
  }
  mostrarLegenda(legenda?.quem ?? null, legenda?.texto ?? '');
  abaixarMusica(falandoAlguem);
  relogioFalando(nivelRelogio, tRelogio);
  relogioChamando(nivelRelogio > 0.02 && !jogador.olhandoRelogio, relogioGlobal.t);
}

/** A Gabu_IA do relógio: holograma da cabeça 7,5 cm acima do relógio, só com o pulso levantado. */
function atualizarAtorRelogio(c: Cena, a: Ator, t: number): void {
  const falando = tocador.falasAtivas(c, t).find((b) => tocador.atorDaFala(c, b)?.id === a.id);
  const inst = instancias.get(a.id); if (!inst) return;
  if (!falando) { if (!avulsa) inst.raiz.visible = false; return; }
  mostrarGaburia(true, t - falando.t, falando.fala, c, a, t);
}
function mostrarGaburia(sim: boolean, tl: number, fala: string | null, c?: Cena, a?: Ator, t?: number): void {
  const inst = instancias.get('gaburia'); if (!inst) return;
  const vis = sim && jogador.olhandoRelogio;
  inst.raiz.visible = vis;
  if (!vis) return;
  const { pos } = poseRelogio();
  const olhos = olhar().origem;
  inst.raiz.position.copy(pos); inst.raiz.position.y += ACIMA_DO_RELOGIO;
  inst.raiz.rotation.set(0, Math.atan2(olhos.x - pos.x, olhos.z - pos.z), 0);
  inst.raiz.scale.setScalar(0.085);
  if (c && a && t !== undefined) animar('gaburia', tocador.camadasEm(c, a, t, [...inst.clipes.keys()]), tocador.bocaEm(c, a, t));
  else if (fala) {
    const nivel = tocador.nivelVoz(fala, tl);
    animar('gaburia', [{ clipe: inst.clipes.has('falar_corpo') ? 'falar_corpo' : 'falar', tempo: tl, peso: 1, loop: true }], { abertura: Math.min(1, Math.max(0, (nivel - tocador.LIMIAR_SILENCIO) / 0.9)), tempo: tl });
  }
  brilhar('gaburia', fala ? tocador.nivelVoz(fala, tl) : 0);
}

/** Música: a do trecho da cena ativa, senão a da sala onde o jogador está. */
export function atualizarMusica(): void {
  const r = diretor.ativa;
  if (r) {
    const bloco = r.cena.faixas.flatMap((f) => (f.tipo === 'som' ? f.blocos : [])).find((b) => /^mus_/.test(b.arquivo) && r.t >= b.t && r.t < b.t + b.dur);
    if (bloco) { tocarMusica(bloco.arquivo); return; }
  }
  tocarMusica(musicaDaSala());
}
function musicaDaSala(): string {
  const p = posicaoPes();
  if (p.z < -9.8) return 'mus_ponte';
  if (p.x < -9.8) return 'mus_treino';
  if (p.x > 9.8) return 'mus_oficina';
  if (p.z > 9.8) return 'mus_portal';
  return 'mus_sala_central';
}

export function tempoGlobal(): number { return relogioGlobal.t; }
export { entrada };
