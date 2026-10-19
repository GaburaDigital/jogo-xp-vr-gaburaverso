// Toque nos personagens (VR): a mão que encosta num personagem dá uma vibradinha sutil, para o jogador
// "sentir" o impacto (pedido do autor depois do teste no Quest, 19/10: o filho dele tentou tocar nos personagens).
// Cada personagem vira um cilindro simples (centro no chão, raio e altura): barato para o Quest.

import * as THREE from 'three';
import { instancias } from '../mundo/mundo';
import { entrada, vibrarTipo, type Lado } from '../xr/entrada';

export interface Tocavel { pos: THREE.Vector3; raio: number; altura: number; }

const fixos: { id: string; raio: number; altura: number }[] = [];
const fontes: (() => Tocavel[])[] = [];
const ultimo: Record<Lado, number> = { esq: -9, dir: -9 };
const dentroAntes: Record<Lado, boolean> = { esq: false, dir: false };

/** Personagens do cenário (medidos uma vez, de pé). */
export function registrarPersonagens(ids: string[]): void {
  for (const id of ids) {
    const inst = instancias.get(id); if (!inst?.obj) continue;
    const b = new THREE.Box3().setFromObject(inst.raiz), t = b.getSize(new THREE.Vector3());
    fixos.push({ id, raio: Math.max(0.12, Math.min(t.x, t.z) * 0.45), altura: t.y });
  }
}
/** Personagens que andam e mudam (os clones do treinamento). */
export function registrarFonteDeToque(f: () => Tocavel[]): void { fontes.push(f); }

const p = new THREE.Vector3(), c = new THREE.Vector3();
function tocando(mao: THREE.Vector3, t: Tocavel): boolean {
  const dy = mao.y - t.pos.y;
  return dy > 0 && dy < t.altura && Math.hypot(mao.x - t.pos.x, mao.z - t.pos.z) < t.raio;
}

/** A cada quadro (só no VR): vibra ao entrar num personagem, no máximo a cada meio segundo. */
export function atualizarToque(agora: number): void {
  if (entrada.modo !== 'vr') return;
  const lista: Tocavel[] = [];
  for (const f of fixos) {
    const inst = instancias.get(f.id); if (!inst?.raiz.visible) continue;
    inst.raiz.getWorldPosition(c);
    lista.push({ pos: c.clone(), raio: f.raio, altura: f.altura });
  }
  for (const f of fontes) lista.push(...f());
  for (const lado of ['esq', 'dir'] as const) {
    const m = entrada.maos[lado]; if (!m.conectada) continue;
    m.pose.getWorldPosition(p);
    const dentro = lista.some((t) => tocando(p, t));
    if (dentro && !dentroAntes[lado] && agora - ultimo[lado] > 0.5) { vibrarTipo(lado, 'personagem'); ultimo[lado] = agora; }
    dentroAntes[lado] = dentro;
  }
}
