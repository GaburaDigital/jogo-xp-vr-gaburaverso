// Luvas do jogador (aprovadas na rodada 5: "Luva Luar chanfrada", no formato do desenho do autor):
// palma = um bloco; dedos = dois blocos (indicador sozinho + os outros três juntos), cada um com uma articulação;
// polegar = bloco ao lado da palma, para fora, com uma articulação. Cantos chanfrados, sem bloco na ponta dos dedos.
// O gatilho dobra o indicador e o grip fecha a mão, acompanhando o quanto o botão está apertado.
//
// PADRÃO DOS JOGOS GABURA: para outro jogo, crie um estilo novo em ESTILOS_LUVA (só as cores mudam).
//
// Espaço da luva: pulso na origem, dedos para -Z, costas da mão para +Y (palma para -Y).
// lado = 1 (direita: polegar e indicador em -X) ou -1 (esquerda: polegar e indicador em +X).

import * as THREE from 'three';

export interface EstiloLuva {
  nome: string;
  cor: string;     // blocos da mão
  junta: string;   // faixas das articulações
  punho: string;
  faixa: string;   // risco escuro no punho
  brilho: boolean; // juntas e faixa brilham (emissivo)
  chanfro: number; // m (0 = blocos retos)
}

export const ESTILOS_LUVA: Record<string, EstiloLuva> = {
  luar: { nome: 'Luva Luar chanfrada', cor: '#f6f3ea', junta: '#8fd651', punho: '#8fd651', faixa: '#0c1a24', brilho: false, chanfro: 0.0035 },
};

/** Medidas (m): palma quase quadrada, dedos curtos e grossos, como no desenho. */
const M = { palmaL: 0.078, palmaC: 0.074, esp: 0.03, dedosL: 0.042, indL: 0.03, vao: 0.004, seg1: 0.027, seg2: 0.023,
  polC: 0.03, polSeg1: 0.022, polSeg2: 0.02, punhoC: 0.034 };

export interface Luva { raiz: THREE.Group; posar: (gatilho: number, grip: number) => void; }

/** Bloco reto ou com cantos chanfrados (extrusão com bisel de 1 segmento: continua low-poly). */
function geometria(l: number, a: number, c: number, ch: number): THREE.BufferGeometry {
  if (!ch || Math.min(l, a, c) < ch * 3) return new THREE.BoxGeometry(l, a, c);
  const f = new THREE.Shape(); const x = l / 2 - ch, y = a / 2 - ch;
  f.moveTo(-x, -y); f.lineTo(x, -y); f.lineTo(x, y); f.lineTo(-x, y); f.lineTo(-x, -y);
  const g = new THREE.ExtrudeGeometry(f, { depth: c - 2 * ch, bevelEnabled: true, bevelThickness: ch, bevelSize: ch, bevelSegments: 1 });
  g.translate(0, 0, -(c - 2 * ch) / 2);
  return g;
}

export function criarLuva(estilo: EstiloLuva, lado: 1 | -1): Luva {
  const e = estilo;
  const mat = (cor: string, brilho = false) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.72, metalness: 0.04, flatShading: true,
    emissive: brilho ? cor : '#000000', emissiveIntensity: brilho ? 0.55 : 0 });
  const mCor = mat(e.cor), mJunta = mat(e.junta, e.brilho), mPunho = mat(e.punho), mFaixa = mat(e.faixa, e.brilho);
  const bloco = (l: number, a: number, c: number, m: THREE.Material, ch = e.chanfro) => new THREE.Mesh(geometria(l, a, c, ch), m);
  const raiz = new THREE.Group(); raiz.name = 'luva_' + (lado > 0 ? 'direita' : 'esquerda');

  const palma = bloco(M.palmaL, M.esp, M.palmaC, mCor); palma.position.set(0, 0, -M.palmaC / 2); raiz.add(palma);
  const punho = bloco(M.palmaL * 0.9, M.esp * 1.12, M.punhoC, mPunho); punho.position.set(0, 0, M.punhoC / 2 - 0.002); raiz.add(punho);
  // faixas um pouco maiores que o bloco embaixo: nenhuma face no mesmo plano (sem "pisca" de malha)
  const faixa = bloco(M.palmaL * 0.9 + 0.002, M.esp * 1.12 + 0.002, 0.006, mFaixa, 0); faixa.position.set(0, 0, 0.004); raiz.add(faixa);

  const juntas: Record<string, [THREE.Group, THREE.Group]> = {};
  function dedo(nome: string, x: number, largura: number): void {
    const base = new THREE.Group(); base.position.set(x, 0, -M.palmaC - M.vao); raiz.add(base);
    const s1 = bloco(largura, M.esp * 0.86, M.seg1, mCor); s1.position.z = -M.seg1 / 2; base.add(s1);
    const j = new THREE.Group(); j.position.z = -M.seg1; base.add(j);
    const risco = bloco(largura + 0.0016, M.esp * 0.86 + 0.0016, 0.004, mJunta, 0); j.add(risco);
    const s2 = bloco(largura, M.esp * 0.82, M.seg2, mCor); s2.position.z = -M.seg2 / 2 - 0.002; j.add(s2);
    juntas[nome] = [base, j];
  }
  const borda = M.palmaL / 2;
  dedo('indicador', -lado * (borda - M.indL / 2), M.indL);
  dedo('dedos', lado * (borda - M.dedosL / 2), M.dedosL);

  const pol = new THREE.Group(); pol.position.set(-lado * (borda + M.vao), 0, -M.palmaC + M.polC / 2 + 0.006); raiz.add(pol);
  const p1 = bloco(M.polSeg1, M.esp * 0.84, M.polC, mCor); p1.position.x = -lado * M.polSeg1 / 2; pol.add(p1);
  const pj = new THREE.Group(); pj.position.x = -lado * M.polSeg1; pol.add(pj);
  const prisco = bloco(0.004, M.esp * 0.84 + 0.0016, M.polC + 0.0016, mJunta, 0); pj.add(prisco);
  const p2 = bloco(M.polSeg2, M.esp * 0.8, M.polC, mCor); p2.position.x = -lado * (M.polSeg2 / 2 + 0.002); pj.add(p2);

  function posar(gatilho: number, grip: number): void {
    const [ib, ij] = juntas.indicador, [db, dj] = juntas.dedos;
    ib.rotation.x = -(0.12 + 1.05 * gatilho); ij.rotation.x = -(0.15 + 1.25 * gatilho);
    db.rotation.x = -(0.2 + 1.2 * grip); dj.rotation.x = -(0.2 + 1.35 * grip);
    pol.rotation.z = lado * (0.15 + 0.55 * grip);
    pol.rotation.y = -lado * (0.9 * grip);
    pj.rotation.z = lado * (0.2 + 0.9 * grip);
  }
  posar(0, 0);
  return { raiz, posar };
}

/**
 * Prende a luva no "grip" do controle (WebXR): origem no meio do punho fechado, -Z para o lado do polegar
 * (ao longo do cabo), +X para fora das costas da mão direita (na esquerda, -X), Y = Z × X (para o pulso).
 * A palma da luva fica centrada na origem do grip.
 */
/** Graus que a luva sobe em relação ao cabo do controle (ajuste fino depois do teste no Quest). */
export const AJUSTE_GRAUS = 30;

export function orientarNoGrip(luva: Luva, lado: 1 | -1): void {
  const B = lado > 0
    ? new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0))
    : new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
  // o cabo do controle do Quest é inclinado: levanta os dedos um pouco para a luva ficar na linha do antebraço
  const ajuste = new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(AJUSTE_GRAUS));
  const T = ajuste.multiply(B);
  luva.raiz.quaternion.setFromRotationMatrix(T);
  luva.raiz.position.copy(new THREE.Vector3(0, 0, M.palmaC / 2).applyMatrix4(T));
}

/** Onde o relógio fica na luva esquerda: um pouco abaixo do punho (sem encostar), pulseira atravessada,
 *  tela para as costas da mão, 12 h para o lado do dedo mínimo (girado 180°, rodada 5). */
export function poseRelogioNaLuva(alvo: THREE.Object3D): void {
  alvo.position.set(0, 0.006, 0.058);
  alvo.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)));
}
