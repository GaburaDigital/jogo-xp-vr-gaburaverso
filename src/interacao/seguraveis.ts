// Objetos que dá para pegar, soltar, jogar e empurrar (caixas, caixas de pizza, cyberdeck...).
// Física simples e leve para o Quest: gravidade, apoio no que estiver embaixo (raio para baixo),
// paredes que seguram e o corpo do jogador empurrando o que está no chão.
// Ao aproximar a mão: contorno Lima + um "plim" bem suave (Lima = dá para tocar).

import * as THREE from 'three';
import { cena3d, empurrarParaFora, instancias, type Instancia } from '../mundo/mundo';
import { entrada, type Mao } from '../xr/entrada';
import { tocar } from '../nucleo/audio';
import { posicaoPes } from '../xr/jogador';

export interface Seguravel {
  id: string;
  inst: Instancia;
  estado: 'repouso' | 'segurado' | 'caindo';
  vel: THREE.Vector3;
  raio: number;                // meia largura no chão (para paredes e empurrão)
  altura: number;
  mao: Mao | null;
  offset: THREE.Matrix4;       // da mão até o objeto, guardado ao pegar
  contorno: THREE.Object3D[];
  somImpacto: string | null;
  ultimoPlim: number;
  ultimoImpacto: number;
  inicial: { pos: THREE.Vector3; quat: THREE.Quaternion; visivel: boolean };
  inclinacao: THREE.Quaternion; // "de pé" deste objeto (ex.: o cyberdeck fica deitado): o giro inicial sem a parte vertical
  ativo: boolean;              // pode pegar agora?
}

export const seguraveis = new Map<string, Seguravel>();
export const ganchos = {
  aoPegar: (_s: Seguravel) => {},
  aoSoltar: (_s: Seguravel) => {},
  aoPousar: (_s: Seguravel, _velocidade: number) => {},
  aoEmpurrar: (_s: Seguravel) => {},
};

const LIMA = new THREE.Color('#8fd651');
const matContorno = new THREE.MeshBasicMaterial({ color: LIMA, side: THREE.BackSide });
matContorno.onBeforeCompile = (s) => {
  s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * 0.007;');
};

/** Contorno Lima: cópia das malhas com o lado de dentro, um pouco "inchada". */
export function criarContorno(obj: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const malhas: THREE.Mesh[] = [];
  obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh) malhas.push(m); });
  for (const m of malhas) {
    const c = new THREE.Mesh(m.geometry, matContorno);
    c.visible = false; c.renderOrder = 1; c.userData.contorno = true;
    m.add(c); out.push(c);
  }
  return out;
}

export function registrarSeguravel(id: string, somImpacto: string | null = 'sfx_caixa_impacto'): Seguravel | null {
  const inst = instancias.get(id);
  if (!inst?.obj) return null;
  const caixa = new THREE.Box3().setFromObject(inst.raiz), t = caixa.getSize(new THREE.Vector3());
  const s: Seguravel = {
    id, inst, estado: 'repouso', vel: new THREE.Vector3(), raio: Math.max(0.06, Math.min(t.x, t.z) / 2), altura: t.y, mao: null,
    offset: new THREE.Matrix4(), contorno: criarContorno(inst.obj), somImpacto, ultimoPlim: -9, ultimoImpacto: -9,
    inicial: { pos: inst.raiz.position.clone(), quat: inst.raiz.quaternion.clone(), visivel: inst.raiz.visible }, ativo: true,
    inclinacao: new THREE.Quaternion(),
  };
  const e0 = new THREE.Euler().setFromQuaternion(inst.raiz.quaternion, 'YXZ');
  s.inclinacao.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -e0.y).multiply(inst.raiz.quaternion);
  seguraveis.set(id, s);
  return s;
}

/** Volta o objeto para onde estava no começo (recomeçar a missão). */
export function restaurar(id: string): void {
  const s = seguraveis.get(id); if (!s) return;
  if (s.mao) s.mao = null;
  s.estado = 'repouso'; s.vel.set(0, 0, 0);
  s.inst.raiz.position.copy(s.inicial.pos); s.inst.raiz.quaternion.copy(s.inicial.quat); s.inst.raiz.visible = s.inicial.visivel;
}

// ---------- apoio: o que está embaixo ----------
const raioBaixo = new THREE.Raycaster();
let estaticos: THREE.Object3D[] = [];
/** Malhas que servem de apoio (chão, mesas, console...). Calculado uma vez depois de montar o mundo. */
export function definirApoios(ignorar: (id: string) => boolean): void {
  estaticos = [];
  for (const inst of instancias.values()) {
    if (ignorar(inst.id) || !inst.obj) continue;
    inst.obj.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.casco && !/teto|casco|vidro|luzes|janela_portal|redemoinho/.test(o.name) && !o.userData.contorno) estaticos.push(o); });
  }
}
function alturaApoio(s: Seguravel, p: THREE.Vector3): number {
  raioBaixo.set(new THREE.Vector3(p.x, p.y + 0.4, p.z), new THREE.Vector3(0, -1, 0));
  raioBaixo.far = 6;
  const outros: THREE.Object3D[] = [];
  for (const o of seguraveis.values()) if (o !== s && o.estado !== 'segurado' && o.inst.raiz.visible && o.inst.obj) outros.push(o.inst.obj);
  const hits = raioBaixo.intersectObjects([...estaticos, ...outros], true).filter((h) => !h.object.userData.contorno && h.object.visible && (!h.face || h.face.normal.y > -0.2));
  for (const h of hits) if (h.point.y <= p.y + 0.12) return h.point.y;
  return 0;
}

// ---------- mão perto: contorno e "plim" ----------
const caixaTmp = new THREE.Box3(), pTmp = new THREE.Vector3();
const raioMira = new THREE.Raycaster();
/** O objeto mais perto da mão (VR: até 8 cm da caixa dele; PC: o que está na mira, até 2,2 m). */
export function objetoNaMao(m: Mao): Seguravel | null {
  let melhor: Seguravel | null = null, dMelhor = Infinity;
  if (entrada.modo === 'vr') {
    m.pose.getWorldPosition(pTmp);
    for (const s of seguraveis.values()) {
      if (!s.ativo || s.estado === 'segurado' || !s.inst.raiz.visible) continue;
      caixaTmp.setFromObject(s.inst.raiz);
      const d = caixaTmp.distanceToPoint(pTmp);
      if (d < 0.08 && d < dMelhor) { dMelhor = d; melhor = s; }
    }
    return melhor;
  }
  raioMira.set(m.mira.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).applyQuaternion(m.mira.getWorldQuaternion(new THREE.Quaternion())));
  raioMira.far = 2.2;
  const lista = [...seguraveis.values()].filter((s) => s.ativo && s.estado !== 'segurado' && s.inst.raiz.visible && s.inst.obj);
  const hits = raioMira.intersectObjects(lista.map((s) => s.inst.raiz), true).filter((h) => !h.object.userData.contorno);
  if (!hits.length) return null;
  let o: THREE.Object3D | null = hits[0].object;
  while (o && !seguraveis.has(o.userData.id)) o = o.parent;
  return o ? seguraveis.get(o.userData.id) ?? null : null;
}

const emFoco = new Map<Mao, Seguravel | null>();
export function segurando(m: Mao): Seguravel | null { for (const s of seguraveis.values()) if (s.mao === m) return s; return null; }

function pegar(s: Seguravel, m: Mao): void {
  s.estado = 'segurado'; s.mao = m; s.vel.set(0, 0, 0);
  if (entrada.modo === 'vr') {
    // guarda onde o objeto está em relação à mão (pega do jeito que estava, sem "pular")
    m.pose.updateMatrixWorld(true); s.inst.raiz.updateMatrixWorld(true);
    s.offset.copy(m.pose.matrixWorld).invert().multiply(s.inst.raiz.matrixWorld);
  }
  for (const c of s.contorno) c.visible = false;
  tocar('sfx_segurar', { em: s.inst.raiz });
  // quem estava em cima pode cair agora
  for (const o of seguraveis.values()) if (o !== s && o.estado === 'repouso' && o.inst.raiz.position.distanceTo(s.inst.raiz.position) < 0.6) o.estado = 'caindo';
  ganchos.aoPegar(s);
}

export function soltar(s: Seguravel, jogar = true): void {
  const m = s.mao;
  s.mao = null; s.estado = 'caindo';
  if (m && jogar && entrada.modo === 'vr') s.vel.copy(m.velocidade).clampLength(0, 6); else s.vel.set(0, 0, 0);
  tocar('sfx_soltar', { em: s.inst.raiz });
  ganchos.aoSoltar(s);
}

/** Tira o objeto do mundo físico (ex.: cyberdeck encaixado no console). */
export function desativar(s: Seguravel): void { if (s.mao) s.mao = null; s.estado = 'repouso'; s.ativo = false; for (const c of s.contorno) c.visible = false; }

const quatNivel = new THREE.Quaternion(), eul = new THREE.Euler(), qTmp = new THREE.Quaternion(), qInv = new THREE.Quaternion();
/** A cada quadro: mãos, física e empurrão. */
export function atualizarSeguraveis(dt: number, agora: number, bloqueado: boolean): void {
  // ---- mãos ----
  for (const m of Object.values(entrada.maos)) {
    if (!m.conectada) continue;
    const segurado = segurando(m);
    const perto = bloqueado || segurado ? null : objetoNaMao(m);
    const antes = emFoco.get(m) ?? null;
    if (perto !== antes) {
      if (antes) for (const c of antes.contorno) c.visible = false;
      if (perto) {
        for (const c of perto.contorno) c.visible = true;
        if (agora - perto.ultimoPlim > 0.6) { tocar('sfx_passar_mao', { em: perto.inst.raiz }); perto.ultimoPlim = agora; }
      }
      emFoco.set(m, perto);
    }
    if (bloqueado) continue;
    if (segurado) {
      const largar = entrada.modo === 'vr' ? m.segurarSoltou || !m.segurar : m.segurarBorda;
      if (largar) soltar(segurado);
    } else if (perto && m.segurarBorda) pegar(perto, m);
  }
  // ---- física ----
  const pes = posicaoPes();
  for (const s of seguraveis.values()) {
    const r = s.inst.raiz;
    if (!s.ativo) continue;
    if (s.estado === 'segurado' && s.mao) {
      if (entrada.modo === 'vr') {
        const mw = new THREE.Matrix4().copy(s.mao.pose.matrixWorld).multiply(s.offset);
        mw.decompose(r.position, r.quaternion, new THREE.Vector3());
      } else {
        // PC: o objeto fica 70 cm à frente da câmera, um pouco à direita e abaixo, de pé
        const cam = s.mao.mira;
        const frente = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
        // à direita e abaixo do centro, para não tapar a visão
        const direita = new THREE.Vector3(-frente.z, 0, frente.x).normalize();
        r.position.copy(cam.getWorldPosition(new THREE.Vector3())).addScaledVector(frente, 0.7).addScaledVector(direita, 0.3); r.position.y -= 0.32 + s.altura / 2;
        eul.set(0, Math.atan2(-frente.x, -frente.z), 0, 'YXZ'); r.quaternion.setFromEuler(eul).multiply(s.inclinacao);
      }
      continue;
    }
    if (s.estado === 'caindo') {
      s.vel.y -= 9.8 * dt;
      r.position.addScaledVector(s.vel, dt);
      // fica de pé enquanto cai (só o giro em volta do eixo vertical continua)
      eul.setFromQuaternion(qTmp.copy(r.quaternion).multiply(qInv.copy(s.inclinacao).invert()), 'YXZ');
      quatNivel.setFromEuler(new THREE.Euler(0, eul.y, 0, 'YXZ')).multiply(s.inclinacao);
      r.quaternion.slerp(quatNivel, Math.min(1, dt * 6));
      if (empurrarParaFora(r.position, s.raio)) { s.vel.x *= -0.3; s.vel.z *= -0.3; }
      const h = alturaApoio(s, r.position);
      if (r.position.y <= h) {
        r.position.y = h;
        const v = Math.abs(s.vel.y);
        if (v > 0.5 && s.somImpacto && agora - s.ultimoImpacto > 0.15) { tocar(s.somImpacto, { em: r, volume: Math.min(1, 0.35 + v / 4) }); s.ultimoImpacto = agora; }
        ganchos.aoPousar(s, v);
        s.vel.set(0, 0, 0); s.estado = 'repouso';
        r.quaternion.copy(quatNivel);
      }
      continue;
    }
    // em repouso no chão: o corpo do jogador empurra (esbarrar)
    if (r.position.y < 0.3) {
      const dx = r.position.x - pes.x, dz = r.position.z - pes.z, d = Math.hypot(dx, dz), min = s.raio + 0.22;
      if (d < min && d > 1e-4) {
        r.position.x = pes.x + (dx / d) * min; r.position.z = pes.z + (dz / d) * min;
        empurrarParaFora(r.position, s.raio);
        if (agora - s.ultimoImpacto > 0.5 && s.somImpacto) { tocar(s.somImpacto, { em: r, volume: 0.5 }); s.ultimoImpacto = agora; }
        ganchos.aoEmpurrar(s);
        s.estado = 'caindo'; s.vel.set(0, 0, 0); // confere o apoio (pode ter saído de cima de outra caixa)
      }
    }
  }
}

/** Para o teste automático: pega/solta sem mão física. */
export function moverPara(id: string, p: THREE.Vector3): void { const s = seguraveis.get(id); if (!s) return; s.inst.raiz.position.copy(p); s.estado = 'caindo'; s.vel.set(0, 0, 0); }
export { cena3d };
