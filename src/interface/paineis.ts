// Painéis do VR (e do PC): menu de pausa (grade de ícones), opções (coluna única), como jogar,
// missão, modo de teste e senha. Desenhos aprovados na página "Interface da Nave" (rodada 3).
// O painel aparece 1,4 m à frente do jogador, um pouco abaixo dos olhos; o raio do controle direito
// (ou o mouse, no PC) aponta e o gatilho (ou o clique) escolhe.

import * as THREE from 'three';
import { C, R, T, botao, chave, comoJogarPC, comoJogarVR, comecarAlvos, deslizante, icone, painel, pegarAlvos, segmentos, selo, svg, svgParaCanvas, texturaDeCanvas, type Alvo } from './svg';
import { opcoes } from '../nucleo/config';
import { entrada } from '../xr/entrada';
import { camera, cena3d } from '../mundo/mundo';

export type TipoPainel = 'pausa' | 'opcoes' | 'como_jogar' | 'missao' | 'teste' | 'senha' | 'confirmar';

export interface ContextoPaineis {
  vr: boolean;
  modoTeste: boolean;
  missao: { nome: string; objetivo: string; luzes: Record<'ponte' | 'treinamento' | 'oficina' | 'portal', boolean> };
  senha: string;
  senhaErrou: number;           // instante do último erro (o campo treme)
  botoesVivos: Set<string>;
  medidorQps: boolean;
  atravessar: boolean;
  versao: string;
  confirmar: 'jogo' | 'missao';  // o que o painel de confirmação vai apagar
  nomeReiniciar: string;         // nome da missão que "Reiniciar missão" vai reiniciar
  contagemAltura: number;        // 3, 2, 1 enquanto ajusta a altura (0 = parado)
  botoesBrutos: string;          // números dos botões apertados (diagnóstico do ≡)
}

export interface Desenho { w: number; h: number; corpo: string; alvos: Alvo[]; }

// =====================================================================
// Desenhos
// =====================================================================
function desenharPausa(c: ContextoPaineis): Desenho {
  comecarAlvos();
  // grade 4 × 2 aprovada na rodada 4 (Continuar ocupa duas casas)
  const W = 1240, h = c.modoTeste ? 790 : 700;
  const itens: [string, string, string, number][] = [['jogar', 'Continuar', 'continuar', 2], ['ajustes', 'Opções', 'abrir:opcoes', 1], ['controle', 'Como jogar', 'abrir:como_jogar', 1],
    ['relogio', 'Ver missão', 'abrir:missao', 1], ['recomecar', 'Reiniciar missão', 'confirmar:missao', 1], ['do_inicio', 'Recomeçar jogo', 'confirmar:jogo', 1], ['sair', c.vr ? 'Sair do VR' : 'Sair', 'sair', 1]];
  let col = 0;
  let corpo = itens.map(([ic, t, acao, larg]) => {
    const x = 60 + (col % 4) * 284, y = 132 + Math.floor(col / 4) * 272, w = 260 + (larg - 1) * 284; col += larg;
    const ac = acao === 'continuar';
    pegarAlvos().push({ acao, x, y, w, h: 250 });
    return R(x, y, w, 250, { r: 26, f: ac ? C.lima : C.sup, st: ac ? C.lima : C.linha, sw: 2.5 }) + icone(ic, x + w / 2 - 46, y + 34, 92, ac ? C.fundo : ic === 'do_inicio' ? C.coral : C.aqua) +
      T(x + w / 2, y + 216, t, { s: 30, w: 700, a: 'middle', c: ac ? C.fundo : C.texto });
  }).join('');
  if (c.modoTeste) corpo += botao(60, 690, 1120, 70, 'Modo de teste', { tipo: 'suave', s: 26, ic: 'teste', icCor: C.coral, acao: 'abrir:teste' });
  return { w: W, h, corpo: painel(W, h, 'Pausado', 'Missão: ' + c.missao.nome, corpo, { ic: 'pausar' }), alvos: pegarAlvos() };
}

function desenharConfirmar(c: ContextoPaineis): Desenho {
  comecarAlvos();
  const jogo = c.confirmar === 'jogo';
  const titulo = jogo ? 'Recomeçar o jogo?' : 'Reiniciar a missão?';
  const linhas = jogo ? ['Você volta para a abertura. As luzes acesas e as missões', 'feitas são apagadas.']
    : [`A missão “${c.nomeReiniciar}” volta para o começo.`, 'O que você fez nela é desfeito.'];
  pegarAlvos().push({ acao: 'confirmar_sim', x: 40, y: 270, w: 440, h: 92 });
  const corpo = T(40, 170, linhas[0], { f: 'n', s: 28 }) + T(40, 210, linhas[1], { f: 'n', s: 28 }) +
    R(40, 270, 440, 92, { r: 46, f: C.coral, st: C.coral, sw: 2.5 }) + icone(jogo ? 'do_inicio' : 'recomecar', 92, 294, 44, C.fundo) + T(150, 330, jogo ? 'Sim, recomeçar' : 'Sim, reiniciar', { s: 34, c: C.fundo }) +
    botao(520, 270, 440, 92, 'Cancelar', { s: 34, ic: 'voltar', acao: 'voltar' });
  return { w: 1000, h: 410, corpo: painel(1000, 410, titulo, '', corpo, { ic: jogo ? 'do_inicio' : 'recomecar' }), alvos: pegarAlvos() };
}

function desenharOpcoes(c: ContextoPaineis): Desenho {
  comecarAlvos();
  const movimento = c.vr
    ? segmentos(50, 430, 'Giro', ['Passos', 'Contínuo'], opcoes.giro === 'passos' ? 0 : 1, 'giro', 'giro') +
      segmentos(50, 494, 'Tamanho do passo', ['30°', '45°'], opcoes.passoGiro === 30 ? 0 : 1, null, 'passo') +
      chave(50, 558, 'Escurecer as bordas ao andar', opcoes.bordas, 'conforto', 'bordas') +
      segmentos(50, 622, 'Altura', ['Em pé', 'Sentado'], opcoes.posicao === 'sentado' ? 1 : 0, 'altura', 'posicao') +
      botao(600, 656, 350, 52, c.contagemAltura ? `Olhe para frente… ${c.contagemAltura}` : 'Ajustar altura agora', { tipo: 'suave', s: 22, ic: 'altura', icCor: C.aqua, acao: 'ajustar_altura' })
    : deslizante(50, 430, 900, 'Mouse', Math.min(1, opcoes.sensibilidadeMouse / 2), 'pc', 'sensibilidade') +
      chave(50, 520, 'Escurecer as bordas ao andar', opcoes.bordas, 'conforto', 'bordas');
  const corpo = T(40, 150, 'SOM', { f: 'n', s: 20, w: 700, c: C.aqua, ls: 2 }) +
    deslizante(50, 196, 900, 'Música', opcoes.musica, 'musica', 'musica') + deslizante(50, 256, 900, 'Efeitos', opcoes.efeitos, 'efeitos', 'efeitos') + deslizante(50, 316, 900, 'Vozes', opcoes.vozes, 'vozes', 'vozes') +
    T(40, 384, 'MOVIMENTO', { f: 'n', s: 20, w: 700, c: C.aqua, ls: 2 }) + movimento +
    imagem(c.vr ? 744 : 626) + botao(780, 22, 180, 60, 'Voltar', { tipo: 'contorno', s: 24, ic: 'voltar', acao: 'voltar' });
  const h = c.vr ? 1080 : 960;
  return { w: 1000, h, corpo: painel(1000, h, 'Opções', '', corpo, { ic: 'ajustes' }), alvos: pegarAlvos() };
  function imagem(y: number): string {
    return T(40, y, 'IMAGEM', { f: 'n', s: 20, w: 700, c: C.aqua, ls: 2 }) +
      chave(50, y + 46, 'Reduzir efeitos de iluminação', opcoes.reduzirLuz, 'luz', 'reduzir_luz') + chave(50, y + 110, 'Legendas', opcoes.legendas, 'legenda', 'legendas') +
      segmentos(50, y + 174, 'Tamanho da legenda', ['P', 'M', 'G'], ['P', 'M', 'G'].indexOf(opcoes.tamanhoLegenda), null, 'tamanho_legenda') +
      `<line x1="40" y1="${y + 226}" x2="960" y2="${y + 226}" stroke="${C.linha}" stroke-width="2"/>` +
      icone('teste', 50, y + 258, 30, C.texto2) + T(96, y + 282, 'Modo de teste', { f: 'n', s: 24, w: 700, c: C.texto2 }) +
      botao(700, y + 250, 250, 52, c.modoTeste ? 'Desligar' : 'Ativar…', { tipo: 'suave', s: 22, acao: c.modoTeste ? 'teste_desligar' : 'abrir:senha' });
  }
}

function desenharComoJogar(c: ContextoPaineis): Desenho {
  comecarAlvos();
  const base = c.vr ? comoJogarVR() : comoJogarPC();
  const corpo = base + botao(1060, 22, 180, 60, 'Voltar', { tipo: 'contorno', s: 24, ic: 'voltar', acao: 'voltar' });
  return { w: 1280, h: 760, corpo, alvos: pegarAlvos() };
}

function desenharMissao(c: ContextoPaineis): Desenho {
  comecarAlvos();
  const luzes = (Object.entries(c.missao.luzes) as [string, boolean][]).map(([nome, on], i) => {
    const cor = [C.aqua, C.violeta, '#ffd166', C.lavanda][i];
    const x = 110 + i * 200;
    return `<polygon points="${x},230 ${x + 40},270 ${x},310 ${x - 40},270" fill="${on ? cor : 'none'}" stroke="${cor}" stroke-width="4"/>` +
      T(x, 350, nome[0].toUpperCase() + nome.slice(1), { f: 'n', s: 24, w: 700, a: 'middle', c: on ? C.texto : C.texto2 });
  }).join('');
  const corpo = T(40, 156, c.missao.nome.toUpperCase(), { f: 'n', s: 20, w: 700, c: C.lima, ls: 2 }) + T(40, 196, 'LUZES DA NAVE', { f: 'n', s: 20, w: 700, c: C.aqua, ls: 2 }) + luzes +
    T(40, 420, 'AGORA', { f: 'n', s: 20, w: 700, c: C.aqua, ls: 2 }) + quebrar(c.missao.objetivo || 'Explore a nave.', 46).map((l, i) => T(40, 470 + i * 40, l, { f: 'n', s: 30, w: 700 })).join('') +
    botao(780, 22, 180, 60, 'Voltar', { tipo: 'contorno', s: 24, ic: 'voltar', acao: 'voltar' });
  return { w: 1000, h: 640, corpo: painel(1000, 640, 'Missão', '', corpo, { ic: 'missao' }), alvos: pegarAlvos() };
}

function desenharTeste(c: ContextoPaineis): Desenho {
  comecarAlvos();
  const corpo = `<rect x="4" y="100" width="992" height="10" fill="${C.coral}"/>` +
    T(40, 160, 'IR PARA A CENA', { f: 'n', s: 20, w: 700, c: C.aqua, ls: 2 }) +
    [['Abertura', 'ir:sala_abertura'], ['Ponte', 'ir:ponte_navegacao'], ['Treinamento', 'ir:treino_captura'], ['Oficina', 'ir:oficina_energia'], ['Livre', 'ir:livre']].map(([t, a], i) => botao(40 + i * 186, 182, 176, 62, t, { tipo: 'suave', s: 21, acao: a })).join('') +
    botao(40, 270, 450, 66, 'Completar a missão', { ic: 'missao', s: 26, acao: 'completar' }) + botao(510, 270, 450, 66, 'Recomeçar a cena', { tipo: 'suave', s: 26, ic: 'recomecar', icCor: C.aqua, acao: 'recomecar' }) +
    chave(40, 386, 'Medidor de quadros por segundo', c.medidorQps, null, 'qps') + chave(40, 446, 'Atravessar paredes', c.atravessar, null, 'atravessar') +
    R(40, 490, 920, 170, { r: 18, f: C.sup }) + T(64, 530, 'Botões do controle (ao vivo)', { s: 26 }) +
    ['≡', 'Y', 'X', 'gatilho E', 'grip E', 'A', 'B', 'gatilho D', 'grip D'].map((k, i) => {
      const on = c.botoesVivos.has(k);
      return R(56 + i * 99, 556, 92, 64, { r: 14, f: on ? C.lima : C.sup2, st: on ? C.lima : C.linha }) + T(102 + i * 99, 596, k, { f: 'n', s: 18, w: 700, a: 'middle', c: on ? C.fundo : C.texto2 });
    }).join('') + T(64, 642, 'números: ' + (c.botoesBrutos || '—'), { f: 'n', s: 18, c: C.texto2 }) +
    botao(780, 22, 180, 60, 'Voltar', { tipo: 'contorno', s: 24, ic: 'voltar', acao: 'voltar' }) +
    T(40, 702, 'versão ' + c.versao, { f: 'n', s: 18, c: C.texto2 });
  return { w: 1000, h: 730, corpo: painel(1000, 730, 'Modo de teste', '', corpo, { ic: 'teste' }), alvos: pegarAlvos() };
}

function desenharSenha(c: ContextoPaineis): Desenho {
  comecarAlvos();
  const treme = performance.now() / 1000 - c.senhaErrou < 0.4 ? Math.sin(performance.now() / 25) * 8 : 0;
  let corpo = R(40 + treme, 130, 420, 70, { r: 16, f: C.sup, st: C.linha }) + T(250 + treme, 178, c.senha.replace(/./g, '• ').trim() || ' ', { s: 40, a: 'middle', c: C.lima });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].forEach((k, i) => {
    const x = 40 + (i % 3) * 145, y = 224 + Math.floor(i / 3) * 86, ok = k === 'OK';
    pegarAlvos().push({ acao: 'tecla:' + k, x, y, w: 130, h: 72 });
    corpo += R(x, y, 130, 72, { r: 18, f: ok ? C.lima : C.sup, st: ok ? C.lima : C.linha, sw: 2.5 }) + T(x + 65, y + 48, k, { s: 32, a: 'middle', c: ok ? C.fundo : C.texto });
  });
  corpo += botao(40, 580, 420, 60, 'Voltar', { tipo: 'contorno', s: 24, ic: 'voltar', acao: 'voltar' });
  return { w: 500, h: 670, corpo: painel(500, 670, 'Modo de teste', '', corpo, { ic: 'teste' }), alvos: pegarAlvos() };
}

const DESENHOS: Record<TipoPainel, (c: ContextoPaineis) => Desenho> = {
  pausa: desenharPausa, opcoes: desenharOpcoes, como_jogar: desenharComoJogar, missao: desenharMissao, teste: desenharTeste, senha: desenharSenha, confirmar: desenharConfirmar,
};

/** O desenho de um painel (a tela inicial do navegador usa os mesmos desenhos). */
export function desenhoDoPainel(tipo: TipoPainel, c: ContextoPaineis): Desenho { return DESENHOS[tipo](c); }

function quebrar(t: string, max: number): string[] {
  const out: string[] = []; let l = '';
  for (const p of t.split(' ')) { if ((l + ' ' + p).trim().length > max) { out.push(l.trim()); l = p; } else l += ' ' + p; }
  if (l.trim()) out.push(l.trim());
  return out.slice(0, 4);
}

// =====================================================================
// Painel no mundo 3D
// =====================================================================
const PX_POR_M = 1000;               // 1 px do desenho = 1 mm
const grupo = new THREE.Group(); grupo.name = 'painel_do_jogo';
export const grupoPainel = grupo;
const malha = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthTest: true }));
malha.renderOrder = 50;
const destaque = new THREE.Group();
const linhaRaio = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: C.aqua, transparent: true, opacity: 0.8, toneMapped: false }));
const pontaRaio = new THREE.Mesh(new THREE.OctahedronGeometry(0.01), new THREE.MeshBasicMaterial({ color: C.aqua, toneMapped: false }));
let canvas: HTMLCanvasElement | null = null;
let textura: THREE.CanvasTexture | null = null;
let aberto: TipoPainel | null = null;
let desenho: Desenho | null = null;
let contexto: () => ContextoPaineis;
let aoAgir: (acao: string, valor?: number) => void;
let alvoHover: Alvo | null = null;
let arrastando: Alvo | null = null;
let redesenhando = false, redesenharDeNovo = false;

export function iniciarPaineis(ctx: () => ContextoPaineis, agir: (acao: string, valor?: number) => void): void {
  contexto = ctx; aoAgir = agir;
  grupo.add(malha, destaque); grupo.visible = false;
  cena3d.add(grupo);
  const mat = new THREE.MeshBasicMaterial({ color: C.lima, toneMapped: false, depthTest: false });
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); b.renderOrder = 51; destaque.add(b); }
  destaque.visible = false;
  linhaRaio.visible = false; pontaRaio.visible = false; linhaRaio.renderOrder = 52; pontaRaio.renderOrder = 53;
  cena3d.add(linhaRaio, pontaRaio);
}

export function painelAberto(): TipoPainel | null { return aberto; }

/** Abre um painel na frente do jogador (ou troca o que está aberto, no mesmo lugar). */
export function abrirPainel(tipo: TipoPainel): void {
  const jaAberto = !!aberto;
  aberto = tipo; alvoHover = null; arrastando = null;
  if (!jaAberto) posicionar();
  grupo.visible = true;
  void redesenhar();
}
export function fecharPainel(): void { aberto = null; grupo.visible = false; destaque.visible = false; linhaRaio.visible = false; pontaRaio.visible = false; }

function posicionar(): void {
  const olho = camera.getWorldPosition(new THREE.Vector3());
  const dir = camera.getWorldDirection(new THREE.Vector3()); dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const dist = entrada.modo === 'vr' ? 1.4 : 0.78; // no PC a tela é menor: o painel vem mais perto
  grupo.position.copy(olho).addScaledVector(dir, dist); grupo.position.y = olho.y - (entrada.modo === 'vr' ? 0.12 : 0.02);
  grupo.lookAt(olho.x, grupo.position.y + 0.08, olho.z);
}

/** Redesenha o painel aberto (depois de mudar uma opção, por exemplo). */
export async function redesenhar(): Promise<void> {
  if (!aberto) return;
  if (redesenhando) { redesenharDeNovo = true; return; }
  redesenhando = true;
  const d = DESENHOS[aberto](contexto());
  const cv = await svgParaCanvas(svg(d.w, d.h, d.corpo), d.w, d.h, d.w > 1100 ? 2048 : 1600, canvas ?? undefined);
  canvas = cv;
  // canvas mudou de tamanho (outro painel): textura nova, senão a GPU tenta copiar além da borda
  const tamanho = cv.width + 'x' + cv.height;
  if (!textura || textura.image !== cv || malha.userData.tamanho !== tamanho) { malha.userData.tamanho = tamanho; textura?.dispose(); textura = texturaDeCanvas(cv); (malha.material as THREE.MeshBasicMaterial).map = textura; (malha.material as THREE.MeshBasicMaterial).needsUpdate = true; }
  else textura.needsUpdate = true;
  // tamanho real: 1 px = 1 mm (painéis largos ficam um pouco menores para caber na vista)
  const escala = d.w > 1100 ? 0.85 : 1;
  malha.scale.set((d.w / PX_POR_M) * escala, (d.h / PX_POR_M) * escala, 1);
  malha.userData.escala = escala;
  desenho = d;
  redesenhando = false;
  if (redesenharDeNovo) { redesenharDeNovo = false; void redesenhar(); }
}

const raio = new THREE.Raycaster();
/** A cada quadro: raio do controle/mouse, destaque Lima no alvo e cliques. */
export function atualizarPaineis(): void {
  if (!aberto || !desenho) { linhaRaio.visible = false; pontaRaio.visible = false; return; }
  const m = entrada.maos.dir;
  let origem: THREE.Vector3, dir: THREE.Vector3;
  if (entrada.modo === 'vr') {
    if (!m.conectada) return;
    origem = m.mira.getWorldPosition(new THREE.Vector3());
    dir = new THREE.Vector3(0, 0, -1).applyQuaternion(m.mira.getWorldQuaternion(new THREE.Quaternion()));
    raio.set(origem, dir);
  } else {
    raio.setFromCamera(entrada.pc.mouse, camera);
    origem = raio.ray.origin; dir = raio.ray.direction;
  }
  const hit = raio.intersectObject(malha, false)[0];
  let alvo: Alvo | null = null, u = 0;
  if (hit?.uv) {
    const px = hit.uv.x * desenho.w, py = (1 - hit.uv.y) * desenho.h;
    alvo = desenho.alvos.find((a) => px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h) ?? null;
    if (alvo?.tipo === 'deslizante') u = THREE.MathUtils.clamp((px - alvo.x0!) / (alvo.x1! - alvo.x0!), 0, 1);
    if (arrastando?.tipo === 'deslizante') u = THREE.MathUtils.clamp((px - arrastando.x0!) / (arrastando.x1! - arrastando.x0!), 0, 1);
  }
  // raio visível (só no VR: no PC o mouse já mostra)
  if (entrada.modo === 'vr') {
    const comprimento = hit ? hit.distance : 3;
    linhaRaio.position.copy(origem); linhaRaio.lookAt(origem.clone().add(dir)); linhaRaio.scale.set(1, 1, comprimento);
    linhaRaio.visible = true;
    pontaRaio.visible = !!hit; if (hit) pontaRaio.position.copy(hit.point);
  }
  if (alvo !== alvoHover) { alvoHover = alvo; mostrarDestaque(alvo); }
  const clicou = m.gatilhoBorda;
  if (arrastando) {
    if (m.gatilho) { if (hit) aoAgir(arrastando.acao, u); }
    else arrastando = null;
    return;
  }
  if (clicou && alvo) {
    if (alvo.tipo === 'deslizante') { arrastando = alvo; aoAgir(alvo.acao, u); }
    else aoAgir(alvo.acao);
  }
}

function mostrarDestaque(a: Alvo | null): void {
  if (!a || !desenho) { destaque.visible = false; return; }
  const k = (malha.userData.escala as number ?? 1) / PX_POR_M;
  const cx = (a.x + a.w / 2 - desenho.w / 2) * k, cy = -(a.y + a.h / 2 - desenho.h / 2) * k;
  const w = a.w * k, h = a.h * k, e = 0.004;
  const [cima, baixo, esq, dir] = destaque.children as THREE.Mesh[];
  cima.position.set(cx, cy + h / 2 + e / 2, 0.002); cima.scale.set(w + 2 * e, e, 1);
  baixo.position.set(cx, cy - h / 2 - e / 2, 0.002); baixo.scale.set(w + 2 * e, e, 1);
  esq.position.set(cx - w / 2 - e / 2, cy, 0.002); esq.scale.set(e, h, 1);
  dir.position.set(cx + w / 2 + e / 2, cy, 0.002); dir.scale.set(e, h, 1);
  destaque.visible = true;
}

/** Para os testes automáticos: aciona um alvo pelo nome da ação. */
export function acionar(acao: string, valor?: number): boolean {
  if (!desenho?.alvos.some((a) => a.acao === acao)) return false;
  aoAgir(acao, valor); return true;
}
export function alvosAbertos(): string[] { return desenho?.alvos.map((a) => a.acao) ?? []; }
export { selo };
