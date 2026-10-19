// Desenho dos painéis em SVG (os mesmos desenhos aprovados na página "Interface da Nave").
// Cada botão desenhado também registra sua área ("alvo"), para o raio do controle saber onde acertou.
// O SVG vira textura assim: as formas como imagem e os textos escritos depois no canvas,
// porque uma imagem SVG não usa as fontes da página.

import * as THREE from 'three';

export const C = { fundo: '#0c1a24', painel: '#0f2230', sup: '#163044', sup2: '#1d3b52', linha: '#2d5566', texto: '#e8f3f2', texto2: '#9fb8bf',
  lima: '#8fd651', aqua: '#4fd6d0', violeta: '#7b4fd6', lavanda: '#c9b6ff', coral: '#ff7a6b', luar: '#f6f3ea', escuro: '#0a1620' };

export const ICONES: Record<string, string> = {
  jogar: 'M8 5l11 7-11 7z', pausar: 'M8 5v14M16 5v14', vr: 'M3 8h18v8.5h-5.5L12 13.5l-3.5 3H3zM7.5 12h1M15.5 12h1',
  pc: 'M3 4h18v12H3zM8 20h8M12 16v4', inicio: 'M4 11l8-7 8 7M6 10v10h12V10',
  musica: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  efeitos: 'M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11', vozes: 'M4 5h16v10H10l-6 4.5z',
  ajustes: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
  controle: 'M7 8h10a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-6.3 2.1L13.5 14h-3l-1.2 1.6A3.5 3.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4zM7 11v3M5.5 12.5h3M16 11.5h0M18 13h0',
  relogio: 'M8.5 3h7l1 4h-9zM8.5 21h7l1-4h-9zM6 7h12v10H6zM12 10v2.5l1.5 1', voltar: 'M15 5l-7 7 7 7', fechar: 'M6 6l12 12M18 6L6 18',
  offline: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7zM12 10v6M9.5 13.5L12 16l2.5-2.5',
  atualizar: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5', recomecar: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5', sair: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  luz: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
  giro: 'M5 12a7 7 0 0 1 12.2-4.7M17.5 3.5v4h-4M19 12a7 7 0 0 1-12.2 4.7M6.5 20.5v-4h4', legenda: 'M3 6h18v12H3zM6 14h5M13 14h5M6 10.5h12',
  conforto: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  teste: 'M14.5 4.5a4 4 0 0 0 5 5L11 18a2.1 2.1 0 0 1-3-3l8.5-8.5a4 4 0 0 0-2-2z',
  missao: 'M12 3c3.5 2 4.6 6 3.6 10.5L12 16.5l-3.6-3C7.4 9 8.5 5 12 3zM9 16l-2 4.5M15 16l2 4.5M12 8.5v2',
  creditos: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z',
  do_inicio: 'M6 5v14M19 5l-10 7 10 7z',
  altura: 'M9 3.5a1.8 1.8 0 1 0 .01 0M9 8v6M6 10h6M9 14l-2 6M9 14l2 6M18 4v16M15.5 6.5L18 4l2.5 2.5M15.5 17.5L18 20l2.5-2.5',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- áreas clicáveis ----------
export interface Alvo { acao: string; x: number; y: number; w: number; h: number; tipo?: 'deslizante'; x0?: number; x1?: number; }
let alvos: Alvo[] = [];
export function comecarAlvos(): void { alvos = []; }
export function pegarAlvos(): Alvo[] { return alvos; }
const registrar = (a: Alvo) => { alvos.push(a); };

export const icone = (nome: string, x: number, y: number, tam: number, cor: string) =>
  `<g transform="translate(${x} ${y}) scale(${tam / 24})"><path d="${ICONES[nome]}" fill="none" stroke="${cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;

interface OT { f?: 'n'; w?: number; s?: number; c?: string; a?: 'start' | 'middle' | 'end'; ls?: number; }
export const T = (x: number, y: number, s: string, o: OT = {}) =>
  `<text x="${x}" y="${y}" font-family="${o.f === 'n' ? 'Nunito' : 'Baloo 2'}" font-weight="${o.w ?? (o.f === 'n' ? 400 : 800)}" font-size="${o.s ?? 24}" fill="${o.c ?? C.texto}" text-anchor="${o.a ?? 'start'}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`;
interface OR { r?: number; f?: string; st?: string; sw?: number; op?: number; }
export const R = (x: number, y: number, w: number, h: number, o: OR = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 12}" fill="${o.f ?? 'none'}" stroke="${o.st ?? 'none'}" stroke-width="${o.sw ?? 2}"${o.op != null ? ` opacity="${o.op}"` : ''}/>`;

interface OB { tipo?: 'acao' | 'contorno' | 'suave'; s?: number; ic?: string; icCor?: string; r?: number; centro?: boolean; acao?: string; }
/** Botão em pílula: 'acao' (Lima cheio), 'contorno', 'suave'. Com "acao", vira área clicável. */
export function botao(x: number, y: number, w: number, h: number, rotulo: string, o: OB = {}): string {
  const tipo = o.tipo ?? 'acao';
  const fill = tipo === 'acao' ? C.lima : tipo === 'suave' ? C.sup : 'none';
  const st = tipo === 'acao' || tipo === 'contorno' ? C.lima : C.linha;
  const cor = tipo === 'acao' ? C.fundo : C.texto;
  const s = o.s ?? Math.round(h * 0.42);
  const corIc = tipo === 'acao' ? C.fundo : (o.icCor ?? C.lima);
  if (o.acao) registrar({ acao: o.acao, x, y, w, h });
  if (o.centro === false) {
    return R(x, y, w, h, { r: o.r ?? h / 2, f: fill, st, sw: 2.5 }) + (o.ic ? icone(o.ic, x + 22, y + h / 2 - s * 0.6, s * 1.2, corIc) : '') +
      T(x + (o.ic ? 30 + s * 1.3 : 24), y + h / 2 + s * 0.36, rotulo, { s, c: cor, w: 700 });
  }
  const larguraTxt = rotulo.length * s * 0.5 + (o.ic ? s * 1.5 : 0);
  const x0 = x + w / 2 - larguraTxt / 2;
  return R(x, y, w, h, { r: o.r ?? h / 2, f: fill, st, sw: 2.5 }) +
    (o.ic ? icone(o.ic, x0, y + h / 2 - s * 0.6, s * 1.2, corIc) : '') +
    T(x0 + (o.ic ? s * 1.5 : larguraTxt / 2), y + h / 2 + s * 0.36, rotulo, { s, c: cor, w: 700, a: o.ic ? 'start' : 'middle' });
}

export function painel(w: number, h: number, titulo: string, sub: string, corpo: string, o: { ic?: string } = {}): string {
  return R(4, 4, w - 8, h - 8, { r: 28, f: C.painel, st: C.aqua, sw: 3 }) +
    R(4, 4, w - 8, 96, { r: 28, f: C.sup }) + `<rect x="4" y="74" width="${w - 8}" height="26" fill="${C.sup}"/>` +
    `<line x1="4" y1="100" x2="${w - 4}" y2="100" stroke="${C.linha}" stroke-width="2"/>` +
    (o.ic ? icone(o.ic, 36, 30, 40, C.aqua) : '') + T(o.ic ? 92 : 40, 66, titulo, { s: 42 }) +
    (sub ? T(w - 40, 64, sub, { f: 'n', s: 24, c: C.texto2, a: 'end' }) : '') + corpo;
}

export const svg = (w: number, h: number, corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${corpo}</svg>`;
export const selo = (x: number, y: number, txt: string, cor = C.aqua) => R(x, y, txt.length * 9.5 + 22, 30, { r: 8, f: cor }) + T(x + 11, y + 21, txt.toUpperCase(), { f: 'n', w: 700, s: 15, c: C.fundo, ls: 1.2 });

export function deslizante(x: number, y: number, w: number, rot: string, v: number, ic: string, acao: string): string {
  const L = w - 330, cx = x + 210 + L * v;
  registrar({ acao, x: x + 190, y: y - 30, w: L + 40, h: 60, tipo: 'deslizante', x0: x + 210, x1: x + 210 + L });
  return icone(ic, x, y - 16, 34, C.aqua) + T(x + 50, y + 10, rot, { f: 'n', s: 26, w: 700 }) +
    R(x + 210, y - 6, L, 12, { r: 6, f: C.sup2 }) + R(x + 210, y - 6, L * v, 12, { r: 6, f: C.lima }) +
    `<polygon points="${cx},${y - 20} ${cx + 17},${y} ${cx},${y + 20} ${cx - 17},${y}" fill="${C.lima}" stroke="${C.fundo}" stroke-width="3"/>` +
    T(x + w - 20, y + 10, Math.round(v * 100) + '%', { f: 'n', s: 24, w: 700, a: 'end', c: C.texto2 });
}
export function chave(x: number, y: number, rot: string, ligada: boolean, ic: string | null, acao: string): string {
  registrar({ acao, x: x + 590, y: y - 30, w: 110, h: 60 });
  return (ic ? icone(ic, x, y - 16, 34, C.aqua) : '') + T(x + (ic ? 50 : 0), y + 10, rot, { f: 'n', s: 26, w: 700 }) +
    R(x + 600, y - 22, 88, 44, { r: 22, f: ligada ? C.lima : C.sup2, st: ligada ? C.lima : C.linha }) +
    `<rect x="${ligada ? x + 650 : x + 606}" y="${y - 16}" width="32" height="32" rx="16" fill="${ligada ? C.fundo : C.texto2}"/>` +
    T(x + 580, y + 10, ligada ? 'ligado' : 'desligado', { f: 'n', s: 22, c: C.texto2, a: 'end' });
}
export function segmentos(x: number, y: number, rot: string, itens: string[], ativo: number, ic: string | null, acao: string): string {
  let out = (ic ? icone(ic, x, y - 16, 34, C.aqua) : '') + T(x + (ic ? 50 : 0), y + 10, rot, { f: 'n', s: 26, w: 700 });
  let cx = x + 330; const w = 120;
  itens.forEach((t, i) => {
    const on = i === ativo;
    registrar({ acao: `${acao}:${i}`, x: cx, y: y - 24, w, h: 48 });
    out += R(cx, y - 24, w, 48, { r: 24, f: on ? C.lima : 'none', st: on ? C.lima : C.linha, sw: 2.5 }) + T(cx + w / 2, y + 9, t, { s: 23, w: 700, a: 'middle', c: on ? C.fundo : C.texto });
    cx += w + 10;
  });
  return out;
}

// ---------- "Como jogar" (aprovado na rodada 2) ----------
function controleQuest(x: number, y: number, esq: boolean): string {
  const corpo = esq ? `M${x + 40} ${y + 20} L${x + 150} ${y} L${x + 220} ${y + 50} L${x + 230} ${y + 150} L${x + 190} ${y + 250} L${x + 150} ${y + 420} L${x + 90} ${y + 420} L${x + 60} ${y + 250} L${x + 10} ${y + 150} Z`
    : `M${x + 190} ${y + 20} L${x + 80} ${y} L${x + 10} ${y + 50} L${x} ${y + 150} L${x + 40} ${y + 250} L${x + 80} ${y + 420} L${x + 140} ${y + 420} L${x + 170} ${y + 250} L${x + 220} ${y + 150} Z`;
  return `<path d="${corpo}" fill="${C.sup2}" stroke="${C.linha}" stroke-width="3" stroke-linejoin="round"/>`;
}
function rotuloPts(pts: number[][], tecla: string, texto: string, lado: 'dir' | 'esq' = 'dir', ativo = true): string {
  const cor = ativo ? C.lima : C.texto2, [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1];
  return `<polyline points="${pts.map((q) => q.join(',')).join(' ')}" fill="none" stroke="${cor}" stroke-width="2.5"/><polygon points="${x1 - 6},${y1} ${x1},${y1 - 6} ${x1 + 6},${y1} ${x1},${y1 + 6}" fill="${cor}"/>` +
    T(x2 + (lado === 'dir' ? 12 : -12), y2 - 4, tecla, { s: 26, w: 800, a: lado === 'dir' ? 'start' : 'end', c: cor }) +
    T(x2 + (lado === 'dir' ? 12 : -12), y2 + 24, texto, { f: 'n', s: 21, a: lado === 'dir' ? 'start' : 'end', c: ativo ? C.texto : C.texto2 });
}
export function comoJogarVR(): string {
  const E = [330, 140], D = [720, 140];
  const bt = (x: number, y: number, r: number, t: string, on: boolean) => `<polygon points="${[...Array(8)].map((_, i) => { const a = i * Math.PI / 4 + Math.PI / 8; return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; }).join(' ')}" fill="${on ? C.lima : C.sup}" stroke="${on ? C.lima : C.linha}" stroke-width="2.5"/>` + (t ? T(x, y + r * 0.42, t, { f: 'n', s: r * 1.2, w: 700, a: 'middle', c: on ? C.fundo : C.texto2 }) : '');
  return painel(1280, 760, 'Como jogar · Meta Quest', '', controleQuest(E[0], E[1], true) + controleQuest(D[0], D[1], false) +
    bt(E[0] + 115, E[1] + 105, 34, '', true) + bt(E[0] + 66, E[1] + 196, 25, 'X', true) + bt(E[0] + 134, E[1] + 222, 25, 'Y', true) + bt(E[0] + 165, E[1] + 160, 13, '≡', true) +
    bt(D[0] + 115, D[1] + 105, 34, '', true) + bt(D[0] + 164, D[1] + 196, 25, 'A', true) + bt(D[0] + 96, D[1] + 222, 25, 'B', false) + bt(D[0] + 60, D[1] + 160, 13, '', false) +
    `<rect x="${E[0] + 148}" y="${E[1] + 12}" width="62" height="14" rx="7" fill="${C.lima}"/><rect x="${E[0] + 172}" y="${E[1] + 268}" width="16" height="70" rx="8" fill="${C.lima}"/>` +
    `<rect x="${D[0] + 20}" y="${D[1] + 12}" width="62" height="14" rx="7" fill="${C.lima}"/><rect x="${D[0] + 42}" y="${D[1] + 268}" width="16" height="70" rx="8" fill="${C.lima}"/>` +
    T(E[0] + 115, E[1] + 470, 'ESQUERDO', { f: 'n', s: 20, w: 700, a: 'middle', c: C.aqua, ls: 2 }) + T(D[0] + 115, D[1] + 470, 'DIREITO', { f: 'n', s: 20, w: 700, a: 'middle', c: C.aqua, ls: 2 }) +
    rotuloPts([[E[0] + 180, E[1] + 19], [260, 150]], 'Gatilho', 'usar (mão esquerda)', 'esq') +
    rotuloPts([[E[0] + 115, E[1] + 105], [260, 245]], 'Analógico', 'andar', 'esq') +
    rotuloPts([[E[0] + 41, E[1] + 196], [260, 340]], 'X', 'relógio', 'esq') +
    rotuloPts([[E[0] + 134, E[1] + 247], [E[0] + 134, E[1] + 290], [260, 430]], 'Y ou ≡', 'menu (pausa)', 'esq') +
    rotuloPts([[E[0] + 180, E[1] + 300], [E[0] + 180, 545], [260, 545]], 'Lateral (grip)', 'segurar / soltar', 'esq') +
    rotuloPts([[D[0] + 50, D[1] + 19], [1010, 150]], 'Gatilho', 'usar, apertar, girar peça', 'dir') +
    rotuloPts([[D[0] + 115, D[1] + 105], [1010, 245]], 'Analógico', 'girar o corpo', 'dir') +
    rotuloPts([[D[0] + 189, D[1] + 196], [1010, 340]], 'A', 'virar a peça (tangram)', 'dir', true) +
    rotuloPts([[D[0] + 50, D[1] + 300], [D[0] + 50, 545], [1010, 545]], 'Lateral (grip)', 'segurar / soltar', 'dir') +
    R(40, 652, 1200, 84, { r: 18, f: C.sup }) + icone('relogio', 64, 674, 40, C.aqua) + T(120, 706, 'Levante o pulso esquerdo como quem olha as horas: o relógio acende.', { f: 'n', s: 24, w: 700 }) +
    T(1210, 706, 'Botão Meta: pausa', { f: 'n', s: 21, c: C.texto2, a: 'end' }), { ic: 'controle' });
}
export function comoJogarPC(): string {
  const tecla = (x: number, y: number, w: number, t: string, on: boolean) => R(x, y, w, 64, { r: 12, f: on ? C.lima : C.sup, st: on ? C.lima : C.linha, sw: 2.5 }) + T(x + w / 2, y + 41, t, { f: 'n', s: 24, w: 800, a: 'middle', c: on ? C.fundo : C.texto2 });
  const y0 = 170, mx = 840, my = 160;
  return painel(1280, 760, 'Como jogar · computador', 'versão adaptada', selo(40, 114, 'adaptação · o jogo foi feito para VR', C.aqua) +
    tecla(60, y0, 84, 'Esc', true) +
    tecla(80, y0 + 100, 84, 'Q', true) + tecla(174, y0 + 100, 84, 'W', true) + tecla(268, y0 + 100, 84, 'E', true) + tecla(362, y0 + 100, 84, 'R', true) +
    tecla(104, y0 + 174, 84, 'A', true) + tecla(198, y0 + 174, 84, 'S', true) + tecla(292, y0 + 174, 84, 'D', true) +
    tecla(150, y0 + 248, 260, 'Espaço', true) +
    rotuloPts([[144, y0 + 32], [490, y0 + 32]], 'Esc', 'menu (pausa)') +
    rotuloPts([[446, y0 + 132], [490, y0 + 132]], 'R', 'relógio') +
    rotuloPts([[376, y0 + 206], [490, y0 + 216]], 'W A S D', 'andar') +
    rotuloPts([[410, y0 + 280], [490, y0 + 300]], 'Espaço', 'pular fala / continuar') +
    rotuloPts([[80, y0 + 132], [44, y0 + 132], [44, y0 + 372], [60, y0 + 372]], 'Q', 'trocar de mão (quando o jogo pedir)') +
    `<path d="M${mx} ${my + 60} Q${mx} ${my} ${mx + 70} ${my} Q${mx + 140} ${my} ${mx + 140} ${my + 60} L${mx + 140} ${my + 240} Q${mx + 140} ${my + 330} ${mx + 70} ${my + 330} Q${mx} ${my + 330} ${mx} ${my + 240} Z" fill="${C.sup2}" stroke="${C.linha}" stroke-width="3"/>` +
    `<path d="M${mx} ${my + 60} Q${mx} ${my} ${mx + 66} ${my} L${mx + 66} ${my + 120} L${mx} ${my + 120} Z" fill="${C.lima}"/><path d="M${mx + 74} ${my} Q${mx + 140} ${my} ${mx + 140} ${my + 60} L${mx + 140} ${my + 120} L${mx + 74} ${my + 120} Z" fill="${C.lima}" opacity=".6"/>` +
    `<rect x="${mx + 60}" y="${my + 30}" width="20" height="50" rx="10" fill="${C.fundo}" stroke="${C.lima}" stroke-width="3"/>` +
    rotuloPts([[mx + 30, my + 70], [1010, 220]], 'Clique esquerdo', 'usar, apertar, atirar') +
    rotuloPts([[mx + 115, my + 90], [1010, 305]], 'Clique direito', 'segurar / soltar') +
    rotuloPts([[mx + 70, my + 55], [mx + 70, my - 22], [1010, my - 22]], 'Roda ou E', 'girar a peça · F vira') +
    rotuloPts([[mx + 70, my + 250], [1010, 420]], 'Mover o mouse', 'olhar em volta') +
    R(40, 652, 1200, 84, { r: 18, f: C.sup }) + icone('pc', 64, 674, 40, C.aqua) + T(120, 706, 'Nos quebra-cabeças a câmera para no ponto certo e o cursor vira a sua mão.', { f: 'n', s: 24, w: 700 }), { ic: 'controle' });
}

/** SVG → textura (formas como imagem; textos escritos depois, com as fontes já carregadas na página). */
export function svgParaCanvas(svgTexto: string, w: number, h: number, larguraPx: number, canvas?: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  return new Promise((ok) => {
    const doc = new DOMParser().parseFromString(svgTexto, 'image/svg+xml');
    const textos = [...doc.querySelectorAll('text')].map((n) => {
      const d = { x: +n.getAttribute('x')!, y: +n.getAttribute('y')!, s: +n.getAttribute('font-size')!, w: n.getAttribute('font-weight'), f: n.getAttribute('font-family'),
        c: n.getAttribute('fill')!, a: n.getAttribute('text-anchor'), ls: n.getAttribute('letter-spacing'), t: n.textContent ?? '' };
      n.remove(); return d;
    });
    const img = new Image();
    const u = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' }));
    const cv = canvas ?? document.createElement('canvas');
    const k = larguraPx / w; cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const terminar = () => {
      const g = cv.getContext('2d')!;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      if (img.complete && img.naturalWidth) g.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(u);
      g.scale(k, k);
      for (const d of textos) {
        g.font = `${d.w} ${d.s}px '${d.f}', sans-serif`; g.fillStyle = d.c;
        g.textAlign = d.a === 'middle' ? 'center' : d.a === 'end' ? 'right' : 'left';
        if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = d.ls ? d.ls + 'px' : '0px';
        g.fillText(d.t, d.x, d.y);
      }
      ok(cv);
    };
    img.onload = terminar; img.onerror = terminar;
    img.src = u;
  });
}

export function texturaDeCanvas(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
