// Portas da sala central. As de botão (treinamento e oficina) abrem quando o jogador aperta o botão
// (encostando a mão, com o raio + gatilho, ou com o clique no PC) e ficam abertas para explorar.
// As da ponte e do portal abrem sozinhas quando o jogador chega perto.
// Porta fechada segura como parede (o colisor "porta" da sala só desliga com a porta aberta).

import * as THREE from 'three';
import { animar, instancias, portasAbertas } from '../mundo/mundo';
import { entrada } from '../xr/entrada';
import { tocar } from '../nucleo/audio';
import { posicaoPes } from '../xr/jogador';

interface Porta { id: string; tipo: 'botao' | 'automatica'; aberta: number; querAberta: boolean; longeDesde: number; apertando: number; }
const portas: Porta[] = [];

export function registrarPortas(): void {
  for (const inst of instancias.values()) {
    if (!/^porta_/.test(inst.id) || !inst.clipes.has('abrir')) continue;
    portas.push({ id: inst.id, tipo: inst.modelo === 'porta_botao.glb' ? 'botao' : 'automatica', aberta: 0, querAberta: false, longeDesde: 0, apertando: -1 });
    animar(inst.id, [{ clipe: 'abrir', tempo: 0, peso: 1, loop: false }]);
  }
}

/** Botões das portas para o raio do controle/mouse acertar. */
export function botoesDasPortas(): { porta: string; obj: THREE.Object3D }[] {
  const out: { porta: string; obj: THREE.Object3D }[] = [];
  for (const p of portas) if (p.tipo === 'botao') { const b = instancias.get(p.id)?.obj?.getObjectByName('botao'); if (b) out.push({ porta: p.id, obj: b }); }
  return out;
}

export function apertarBotao(id: string): void {
  const p = portas.find((x) => x.id === id); if (!p) return;
  const inst = instancias.get(id);
  p.apertando = 0;
  tocar('sfx_botao_porta', { em: inst?.obj?.getObjectByName('botao') ?? inst?.raiz });
  if (!p.querAberta) abrir(p, true);
}

function abrir(p: Porta, sim: boolean): void {
  if (p.querAberta === sim) return;
  p.querAberta = sim;
  tocar(sim ? 'sfx_porta_abrir' : 'sfx_porta_fechar', { em: instancias.get(p.id)?.raiz });
}

const pTmp = new THREE.Vector3();
/** A cada quadro: botão por toque, portas automáticas por distância, animação e colisor. */
export function atualizarPortas(dt: number, agora: number): void {
  const pes = posicaoPes();
  for (const p of portas) {
    const inst = instancias.get(p.id); if (!inst) continue;
    const centro = inst.raiz.position;
    const d = Math.hypot(pes.x - centro.x, pes.z - centro.z);
    if (p.tipo === 'automatica') {
      if (d < 2.4) { abrir(p, true); p.longeDesde = agora; } else if (p.querAberta && agora - p.longeDesde > 2) abrir(p, false);
    } else if (entrada.modo === 'vr' && !p.querAberta) {
      // encostar a ponta da mão no botão
      const b = inst.obj?.getObjectByName('botao');
      if (b) {
        b.getWorldPosition(pTmp);
        for (const m of Object.values(entrada.maos)) if (m.conectada && m.pose.getWorldPosition(new THREE.Vector3()).distanceTo(pTmp) < 0.09) apertarBotao(p.id);
      }
    }
    const alvo = p.querAberta ? 1 : 0;
    const dur = inst.clipes.get('abrir')?.duration ?? 1.2;
    p.aberta = THREE.MathUtils.clamp(p.aberta + Math.sign(alvo - p.aberta) * (dt / dur), 0, 1);
    const camadas = [{ clipe: 'abrir', tempo: p.aberta * dur, peso: 1, loop: false }];
    if (p.apertando >= 0 && inst.clipes.has('apertar')) { p.apertando += dt; camadas.push({ clipe: 'apertar', tempo: p.apertando, peso: 1, loop: false }); if (p.apertando > 0.4) p.apertando = -1; }
    animar(p.id, camadas);
    if (p.aberta > 0.6) portasAbertas.add(p.id); else portasAbertas.delete(p.id);
  }
}
