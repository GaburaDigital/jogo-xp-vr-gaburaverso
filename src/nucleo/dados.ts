// Dados do jogo: pacote de cenas (do Editor de Cenas), falas da dublagem (texto, duração, curva de volume)
// e os áudios decodificados. É o mesmo formato que o editor usa, então as regras do editor valem aqui.

import { normalizarPacote, type Pacote } from './modelo';

export interface InfoFala { id: string; personagem: string; texto: string; duracao: number; audio?: string; curva_volume?: string; }
export interface Curva { quadros_por_segundo: number; valores: number[]; }

const BASE = import.meta.env.BASE_URL;
export const url = (caminho: string) => BASE + caminho.replace(/^\/+/, '');

export const biblioteca = {
  pacote: null as Pacote | null,
  falas: new Map<string, InfoFala>(),
  curvas: new Map<string, Curva>(),
};

let ctx: AudioContext | null = null;
/** O contexto de áudio do jogo (um só). No navegador ele só começa a tocar depois de um toque/clique. */
export function contextoAudio(): AudioContext {
  ctx ??= new AudioContext({ latencyHint: 'interactive' });
  return ctx;
}

const buffers = new Map<string, AudioBuffer>();
const carregando = new Map<string, Promise<AudioBuffer | null>>();

/** Caminho do arquivo de cada som pelo id (falas, músicas e efeitos). */
function caminhoAudio(id: string): string {
  if (/^mus_/.test(id)) return `audio/musicas/${id}.ogg`;
  if (/^sfx_/.test(id)) return `audio/efeitos/${id}.ogg`;
  return `audio/falas/${id}.ogg`;
}

/** Baixa e decodifica um som (uma vez só). */
export function carregarAudio(id: string): Promise<AudioBuffer | null> {
  const pronto = buffers.get(id);
  if (pronto) return Promise.resolve(pronto);
  let p = carregando.get(id);
  if (!p) {
    p = fetch(url(caminhoAudio(id)))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((b) => contextoAudio().decodeAudioData(b))
      .then((buf) => { buffers.set(id, buf); return buf; })
      .catch((e) => { console.warn('áudio não carregou:', id, e); return null; });
    carregando.set(id, p);
  }
  return p;
}
export function bufferPronto(id: string): AudioBuffer | null { return buffers.get(id) ?? null; }

/** Duração de uma fala: do áudio, senão do falas.json. */
export function duracaoFala(id: string): number {
  return buffers.get(id)?.duration ?? biblioteca.falas.get(id)?.duracao ?? 3;
}

/** Curva de volume (para a boca e os respiros). */
export async function carregarCurva(id: string): Promise<void> {
  if (biblioteca.curvas.has(id)) return;
  try {
    const r = await fetch(url(`audio/falas/${id}.curva.json`));
    if (r.ok) biblioteca.curvas.set(id, await r.json() as Curva);
  } catch { /* sem curva: a boca fica parada */ }
}

/** Carrega o pacote de cenas e o roteiro de falas. */
export async function carregarDados(): Promise<void> {
  const [p, f] = await Promise.all([
    fetch(url('dados/cenas_nave.json')).then((r) => r.json()),
    fetch(url('dados/falas.json')).then((r) => r.json()),
  ]);
  biblioteca.pacote = normalizarPacote(p as Pacote);
  for (const x of (f as { falas: InfoFala[] }).falas) biblioteca.falas.set(x.id, x);
}

/** Falas e sons usados por uma cena (para carregar antes de tocar). */
export async function prepararSons(ids: string[]): Promise<void> {
  await Promise.all(ids.map(async (id) => { await carregarAudio(id); if (!/^(mus|sfx)_/.test(id)) await carregarCurva(id); }));
}
