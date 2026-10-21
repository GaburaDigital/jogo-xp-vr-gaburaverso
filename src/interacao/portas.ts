// Portas da sala central. As de botão (treinamento e oficina) abrem e fecham pelo botão
// (encostando a mão, com o raio + gatilho, ou com o clique no PC). Do lado de dentro do corredor elas abrem
// sozinhas (ninguém fica preso), e fecham sozinhas quando o jogador volta para a sala central (20/10).
// As da ponte e do portal abrem sozinhas quando o jogador chega perto.
// Porta fechada segura como parede (o colisor "porta" da sala só desliga com a porta aberta).

import * as THREE from 'three';
import { animar, instancias, portasAbertas } from '../mundo/mundo';
import { entrada, vibrarTipo } from '../xr/entrada';
import { tocar } from '../nucleo/audio';
import { posicaoPes } from '../xr/jogador';

interface Porta { id: string; tipo: 'botao' | 'automatica'; aberta: number; querAberta: boolean; longeDesde: number; apertando: number; ultimoAperto: number; maoNoBotao: boolean; }
const portas: Porta[] = [];

export function registrarPortas(): void {
  for (const inst of instancias.values()) {
    if (!/^porta_/.test(inst.id) || !inst.clipes.has('abrir')) continue;
    portas.push({ id: inst.id, tipo: inst.modelo === 'porta_botao.glb' ? 'botao' : 'automatica', aberta: 0, querAberta: false, longeDesde: 0, apertando: -1, ultimoAperto: -9, maoNoBotao: false });
    animar(inst.id, [{ clipe: 'abrir', tempo: 0, peso: 1, loop: false }]);
  }
}

/** Botões das portas para o raio do controle/mouse acertar. */
export function botoesDasPortas(): { porta: string; obj: THREE.Object3D }[] {
  const out: { porta: string; obj: THREE.Object3D }[] = [];
  for (const p of portas) if (p.tipo === 'botao') { const b = instancias.get(p.id)?.obj?.getObjectByName('botao'); if (b) out.push({ porta: p.id, obj: b }); }
  return out;
}

let relogioPortas = 0;
/** Botão: abre a porta fechada; na aberta, fecha (menos com o jogador no vão da porta). */
export function apertarBotao(id: string): void {
  const p = portas.find((x) => x.id === id); if (!p) return;
  if (relogioPortas - p.ultimoAperto < 0.8) return;   // um aperto de cada vez
  p.ultimoAperto = relogioPortas;
  const inst = instancias.get(id);
  p.apertando = 0;
  tocar('sfx_botao_porta', { em: inst?.obj?.getObjectByName('botao') ?? inst?.raiz });
  if (!p.querAberta) abrir(p, true);
  else if (!noVao(p)) abrir(p, false);
}
/** O jogador está no vão da porta (não fecha em cima dele)? */
function noVao(p: Porta): boolean {
  const c = instancias.get(p.id)?.raiz.position; if (!c) return false;
  const pes = posicaoPes(); return Math.hypot(pes.x - c.x, pes.z - c.z) < 1.3;
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
  relogioPortas = agora;
  for (const p of portas) {
    const inst = instancias.get(p.id); if (!inst) continue;
    const centro = inst.raiz.position;
    const d = Math.hypot(pes.x - centro.x, pes.z - centro.z);
    if (p.tipo === 'automatica') {
      if (d < 2.4) { abrir(p, true); p.longeDesde = agora; } else if (p.querAberta && agora - p.longeDesde > 2) abrir(p, false);
    } else {
      // do lado de dentro (corredor), a porta abre sozinha: dá sempre para voltar
      const fora = centro.clone().setY(0).normalize();
      const doLadoDeDentro = (pes.x - centro.x) * fora.x + (pes.z - centro.z) * fora.z > 0.3;
      if (doLadoDeDentro && d < 2.4) abrir(p, true);
      // de volta na sala central, longe da porta por 2 s: fecha sozinha
      const naSalaCentral = Math.hypot(pes.x, pes.z) < 5.4;
      if (p.querAberta && naSalaCentral && d > 2.5) { if (agora - p.longeDesde > 2) abrir(p, false); } else p.longeDesde = agora;
      if (entrada.modo === 'vr') {
        // encostar a ponta da mão no botão (só conta quando a mão chega; deixar a mão lá não fica abrindo e fechando)
        const b = inst.obj?.getObjectByName('botao');
        if (b) {
          b.getWorldPosition(pTmp);
          const mao = Object.values(entrada.maos).find((m) => m.conectada && m.pose.getWorldPosition(new THREE.Vector3()).distanceTo(pTmp) < 0.09);
          if (mao && !p.maoNoBotao) { apertarBotao(p.id); vibrarTipo(mao.lado, 'encaixe'); }
          p.maoNoBotao = !!mao;
        }
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
