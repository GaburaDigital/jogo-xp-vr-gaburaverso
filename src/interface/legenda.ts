// Legenda das falas: um painel preso à frente dos olhos, um pouco abaixo do centro da visão.
// "Nome: texto", com tamanho P, M ou G (Opções). Também mostra avisos curtos (ex.: "Gatilho: girar 45°").

import * as THREE from 'three';
import { camera } from '../mundo/mundo';
import { opcoes } from '../nucleo/config';
import { C } from './svg';
import { entrada } from '../xr/entrada';

const W = 1400, H = 300;
let malha: THREE.Mesh, cv: HTMLCanvasElement, tex: THREE.CanvasTexture;
let atual = '';

export function iniciarLegenda(): void {
  cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  malha = new THREE.Mesh(new THREE.PlaneGeometry(1, H / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  malha.renderOrder = 900; malha.visible = false;
  camera.add(malha);
}

/** Mostra (ou esconde, com null) a legenda. */
export function mostrarLegenda(quem: string | null, texto = ''): void {
  const chave = opcoes.legendas && quem ? `${quem}|${texto}|${opcoes.tamanhoLegenda}` : '';
  if (chave === atual) return;
  atual = chave;
  if (!chave || !quem) { malha.visible = false; return; }
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  const s = { P: 36, M: 44, G: 54 }[opcoes.tamanhoLegenda];
  g.font = `700 ${s}px Nunito, sans-serif`;
  const linhas = quebrarLinhas(g, `${quem}: ${texto}`, W - 80).slice(0, 3);
  const altura = linhas.length * s * 1.25 + 36;
  const y0 = H - altura;
  g.fillStyle = 'rgba(12, 26, 36, 0.86)'; g.strokeStyle = C.aqua; g.lineWidth = 3;
  const larg = Math.min(W - 8, Math.max(...linhas.map((l) => g.measureText(l).width)) + 60);
  arredondado(g, (W - larg) / 2, y0, larg, altura - 4, 22); g.fill(); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'top';
  linhas.forEach((l, i) => {
    const y = y0 + 18 + i * s * 1.25;
    if (i === 0 && l.startsWith(quem + ':')) {
      // nome em Aqua, texto em branco
      const resto = l.slice(quem.length + 1), wNome = g.measureText(quem + ':').width, wTudo = g.measureText(l).width;
      const x0 = W / 2 - wTudo / 2;
      g.textAlign = 'left'; g.fillStyle = C.aqua; g.fillText(quem + ':', x0, y); g.fillStyle = C.texto; g.fillText(resto, x0 + wNome, y); g.textAlign = 'center';
    } else { g.fillStyle = C.texto; g.fillText(l, W / 2, y); }
  });
  tex.needsUpdate = true;
  // a 1,3 m dos olhos, abaixo do centro (fica fora do caminho do olhar)
  // no PC a tela é menor que a visão do óculos: a legenda fica maior
  if (entrada.modo === 'pc') { malha.position.set(0, -0.62, -1.3); malha.scale.setScalar(1.45); } else { malha.position.set(0, -0.36, -1.3); malha.scale.setScalar(1.05); }
  malha.visible = true;
}

function quebrarLinhas(g: CanvasRenderingContext2D, t: string, max: number): string[] {
  const out: string[] = []; let l = '';
  for (const p of t.split(' ')) { const n = l ? l + ' ' + p : p; if (g.measureText(n).width > max && l) { out.push(l); l = p; } else l = n; }
  if (l) out.push(l);
  return out;
}
function arredondado(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
