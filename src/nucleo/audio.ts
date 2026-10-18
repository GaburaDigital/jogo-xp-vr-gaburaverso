// Som do jogo: três "barramentos" (como os Audio Buses da Godot): Músicas, Efeitos e Vozes.
// Volume final = volume do som na Mesa de som (mixagem do pacote) × volume do grupo nas Opções.
// A música abaixa sozinha enquanto alguém fala. Efeitos de objetos podem sair do lugar do objeto (3D).

import * as THREE from 'three';
import { biblioteca, bufferPronto, carregarAudio, contextoAudio } from './dados';
import { opcoes } from './config';
import type { GrupoSom } from './modelo';

let barramentos: Record<GrupoSom, GainNode> | null = null;
let abaixador: GainNode; // só da música (abaixa nas falas)

function bus(): Record<GrupoSom, GainNode> {
  if (barramentos) return barramentos;
  const ctx = contextoAudio();
  const mk = () => { const g = ctx.createGain(); g.connect(ctx.destination); return g; };
  barramentos = { musica: mk(), efeitos: mk(), vozes: mk() };
  abaixador = ctx.createGain(); abaixador.connect(barramentos.musica);
  aplicarVolumesGrupos();
  return barramentos;
}

/** Depois de mexer nas Opções: volumes dos grupos. */
export function aplicarVolumesGrupos(): void {
  if (!barramentos) return;
  const ctx = contextoAudio(), m = biblioteca.pacote?.mixagem;
  barramentos.musica.gain.setTargetAtTime(opcoes.musica * (m?.grupos.musica ?? 1), ctx.currentTime, 0.05);
  barramentos.efeitos.gain.setTargetAtTime(opcoes.efeitos * (m?.grupos.efeitos ?? 1), ctx.currentTime, 0.05);
  barramentos.vozes.gain.setTargetAtTime(opcoes.vozes * (m?.grupos.vozes ?? 1), ctx.currentTime, 0.05);
}

export function grupoDe(id: string): GrupoSom {
  return biblioteca.pacote?.mixagem?.sons[id]?.grupo ?? (/^mus/i.test(id) ? 'musica' : /^sfx/i.test(id) ? 'efeitos' : 'vozes');
}
/** Volume do som na Mesa de som (falas: 1). */
export function volumeDoSom(id: string): number {
  return grupoDe(id) === 'vozes' ? 1 : (biblioteca.pacote?.mixagem?.sons[id]?.volume ?? (grupoDe(id) === 'musica' ? 0.18 : 0.4));
}

export interface Tocando { fonte: AudioBufferSourceNode; ganho: GainNode; id: string; parar: (fade?: number) => void; }

export interface OpcoesSom {
  loop?: boolean;
  volume?: number;               // multiplica o volume da mesa
  quando?: number;               // instante do relógio do áudio (padrão: agora)
  offset?: number;               // começar do meio (s)
  ate?: number;                  // parar neste instante do relógio do áudio
  em?: THREE.Object3D | THREE.Vector3; // som posicional (sai daquele lugar)
  taxa?: number;                 // velocidade (varia o tom: clones iguais não soam idênticos)
}

const tocandoAgora = new Set<Tocando>();

/** Toca um som já carregado. Se ainda não carregou, carrega e toca (sem garantia de tempo exato). */
export function tocar(id: string, o: OpcoesSom = {}): Tocando | null {
  const buf = bufferPronto(id);
  if (!buf) { void carregarAudio(id).then((b) => { if (b && !o.loop && o.quando === undefined) tocar(id, o); }); return null; }
  const ctx = contextoAudio(), b = bus();
  const fonte = ctx.createBufferSource(); fonte.buffer = buf; fonte.loop = !!o.loop;
  if (o.taxa) fonte.playbackRate.value = o.taxa;
  const ganho = ctx.createGain(); ganho.gain.value = volumeDoSom(id) * (o.volume ?? 1);
  const g = grupoDe(id);
  let saida: AudioNode = g === 'musica' ? abaixador : b[g];
  if (o.em) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.rolloffFactor = 1;
    const pos = o.em instanceof THREE.Vector3 ? o.em : o.em.getWorldPosition(new THREE.Vector3());
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    p.connect(saida); saida = p;
  }
  fonte.connect(ganho).connect(saida);
  const quando = o.quando ?? ctx.currentTime;
  const off = o.offset ?? 0;
  fonte.start(Math.max(ctx.currentTime, quando), o.loop ? off % buf.duration : Math.max(0, off));
  if (o.ate !== undefined) fonte.stop(Math.max(ctx.currentTime + 0.01, o.ate));
  const t: Tocando = {
    fonte, ganho, id,
    parar: (fade = 0.05) => {
      try { ganho.gain.setTargetAtTime(0, ctx.currentTime, fade / 3); fonte.stop(ctx.currentTime + fade + 0.05); } catch { /* já parou */ }
      tocandoAgora.delete(t);
    },
  };
  tocandoAgora.add(t);
  fonte.onended = () => tocandoAgora.delete(t);
  return t;
}

// ---------- música: uma por vez, com troca suave ----------
let musica: { id: string; t: Tocando } | null = null;
export function tocarMusica(id: string | null): void {
  if ((musica?.id ?? null) === id) return;
  musica?.t.parar(1.5);
  musica = null;
  if (!id) return;
  const t = tocar(id, { loop: true });
  if (t) {
    const ctx = contextoAudio(), alvo = t.ganho.gain.value;
    t.ganho.gain.setValueAtTime(0.0001, ctx.currentTime); t.ganho.gain.linearRampToValueAtTime(alvo, ctx.currentTime + 1.5);
    musica = { id, t };
  } else void carregarAudio(id).then(() => { if (!musica) tocarMusica(id); });
}
export function musicaAtual(): string | null { return musica?.id ?? null; }

/** A música abaixa enquanto alguém fala (quanto: mixagem.abaixar_musica). */
let falando = false;
export function abaixarMusica(alguemFalando: boolean): void {
  if (alguemFalando === falando || !barramentos) return;
  falando = alguemFalando;
  const k = alguemFalando ? (biblioteca.pacote?.mixagem?.abaixar_musica ?? 0.5) : 1;
  abaixador.gain.setTargetAtTime(k, contextoAudio().currentTime, 0.15);
}

/** O "ouvido" do jogador acompanha a cabeça (para os sons 3D). */
const pTmp = new THREE.Vector3(), fTmp = new THREE.Vector3(), uTmp = new THREE.Vector3();
export function atualizarOuvinte(cabeca: THREE.Object3D): void {
  if (!barramentos) return;
  const l = contextoAudio().listener;
  cabeca.getWorldPosition(pTmp);
  fTmp.set(0, 0, -1).transformDirection(cabeca.matrixWorld); uTmp.set(0, 1, 0).transformDirection(cabeca.matrixWorld);
  if (l.positionX) {
    l.positionX.value = pTmp.x; l.positionY.value = pTmp.y; l.positionZ.value = pTmp.z;
    l.forwardX.value = fTmp.x; l.forwardY.value = fTmp.y; l.forwardZ.value = fTmp.z;
    l.upX.value = uTmp.x; l.upY.value = uTmp.y; l.upZ.value = uTmp.z;
  } else { l.setPosition(pTmp.x, pTmp.y, pTmp.z); l.setOrientation(fTmp.x, fTmp.y, fTmp.z, uTmp.x, uTmp.y, uTmp.z); }
}

/** Pausa (menu): congela todo o som; Continuar volta de onde parou. */
export async function pausarSom(sim: boolean): Promise<void> {
  const ctx = contextoAudio();
  if (sim) await ctx.suspend(); else await ctx.resume();
}
export function iniciarAudio(): void { bus(); void contextoAudio().resume(); }
