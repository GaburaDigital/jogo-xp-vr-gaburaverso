// Tela inicial no navegador (antes do VR) e as telas que saem dela: aviso da versão PC, senha do
// modo de teste, como jogar, opções e créditos. Desenhos aprovados na página "Interface da Nave"
// (tela inicial A ajustada, aviso PC A). São SVG dentro da página, com botões de verdade por cima
// de cada área clicável (funciona com mouse, toque e teclado).
// Também cuida de "Salvar para jogar sem internet" e "Verificar atualização".

import { C, R, T, botao, comecarAlvos, comoJogarPC, comoJogarVR, icone, pegarAlvos, svg, type Alvo } from './svg';
import { desenhoDoPainel, type ContextoPaineis } from './paineis';
import { SENHA_TESTE, jaJogouVR, ligarModoTeste, modoTesteLigado } from '../nucleo/config';
import { url } from '../nucleo/dados';

type Tela = 'inicio' | 'aviso_pc' | 'senha' | 'como_jogar_vr' | 'como_jogar_pc' | 'opcoes' | 'creditos' | 'confirmar_inicio';

export interface AcoesInicio {
  jogarVR: () => void;
  jogarPC: () => void;
  agirOpcao: (acao: string, valor?: number) => void;
  contexto: () => ContextoPaineis;
  temJogoSalvo: () => boolean;
  apagarJogo: () => void;       // "Jogar do início" confirmado: apaga o progresso e volta a nave ao começo
}

const CHAVE_OFFLINE = 'nave_offline_versao';
let caixa: HTMLDivElement, palco: HTMLDivElement, botoes: HTMLDivElement;
let acoes: AcoesInicio;
let tela: Tela = 'inicio';
let carregado = 0;            // 0 a 1 (modelos e dados da nave)
let mensagem = '';            // linha de baixo (salvando, atualizado...)
let salvando = -1;            // 0 a 1 enquanto salva para jogar sem internet
let senha = '', senhaErrou = 0;
let vrDisponivel = false;
let telaCurta = false;         // Quest que já jogou no VR: só o botão grande (o resto em "Mais opções")

// ---------- desenho das telas ----------
function ceu(w: number, h: number, n = 70, sem = 3): string {
  let r = sem, out = '';
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, s = 2 + rnd() * 5, cheia = rnd() > 0.45;
    const pts = [...Array(8)].map((_, k) => { const a = (k * Math.PI) / 4 - Math.PI / 2, q = k % 2 ? s * 0.42 : s; return `${(x + Math.cos(a) * q).toFixed(1)},${(y + Math.sin(a) * q).toFixed(1)}`; }).join(' ');
    out += `<polygon points="${pts}" fill="${cheia ? C.lavanda : 'none'}" stroke="${C.lavanda}" stroke-width="1" opacity="${(0.35 + rnd() * 0.4).toFixed(2)}"/>`;
  }
  return out;
}
const octaedro = (x: number, y: number, s: number, cor: string) => `<g opacity="0.9"><polygon points="${x},${y - s} ${x + s * 0.7},${y} ${x},${y + s} ${x - s * 0.7},${y}" fill="${cor}"/><polygon points="${x},${y - s} ${x + s * 0.7},${y} ${x},${y + s * 0.1}" fill="#ffffff" opacity=".18"/><polygon points="${x},${y + s * 0.1} ${x + s * 0.7},${y} ${x},${y + s}" fill="#000" opacity=".2"/></g>`;
/** Símbolo original da marca (pacote Gabura-logo, gabura-escuro): nunca redesenhado por código. */
const simbolo = (cx: number, cy: number) => `<image href="${url('imagens/gabura-escuro-512.png')}" x="${cx - 80}" y="${cy - 110}" width="160" height="160"/>`;

function linhaDeBaixo(): string {
  const versao = 'versão ' + __VERSAO_APP__;
  let estado = '';
  if (salvando >= 0) estado = `salvando para jogar sem internet: ${Math.round(salvando * 100)}%`;
  else if (mensagem) estado = mensagem;
  else if (lerOffline() === __VERSAO_CACHE__) estado = 'pronto para jogar sem internet';
  return T(1240, 691, estado ? `${versao} · ${estado}` : versao, { f: 'n', s: 15, c: C.texto2, a: 'end' });
}

function desenharInicio(): { corpo: string; alvos: Alvo[] } {
  comecarAlvos();
  const pronto = carregado >= 1;
  const salvo = pronto && acoes.temJogoSalvo();
  const rotuloVR = pronto ? 'Jogar no VR' : `Carregando a nave… ${Math.round(carregado * 100)}%`;
  const yVR = salvo ? 304 : 318;
  let corpo = `<rect width="1280" height="720" fill="${C.fundo}"/>` + ceu(1280, 720) + octaedro(1110, 150, 46, C.violeta) + octaedro(170, 560, 30, C.aqua) +
    simbolo(640, 150) + T(640, 268, 'Experiência VR no GaburaVERSO', { s: 54, a: 'middle' }) +
    botao(420, yVR, 440, 96, rotuloVR, pronto ? { ic: 'vr', s: 38, acao: 'jogar_vr' } : { tipo: 'suave', s: 30 });
  // jogo salvo (rodada 4, A): "Continuar de onde parou" já marcado; "Jogar do início" pede confirmação
  if (salvo) {
    corpo += R(420, 416, 440, 50, { r: 25, f: C.sup, st: C.linha }) + R(424, 420, 236, 42, { r: 21, f: C.aqua }) +
      T(542, 448, 'Continuar de onde parou', { f: 'n', s: 17, w: 800, a: 'middle', c: C.fundo }) + T(760, 448, 'Jogar do início', { f: 'n', s: 17, w: 700, a: 'middle' });
    pegarAlvos().push({ acao: 'tela:confirmar_inicio', x: 662, y: 418, w: 196, h: 46 });
  }
  const yPC = salvo ? 486 : 452, hPC = salvo ? 64 : 68;
  if (telaCurta) {
    corpo += botao(520, yPC, 240, 56, 'Mais opções', { tipo: 'contorno', s: 22, acao: 'mais_opcoes' });
  } else {
    corpo += botao(370, yPC, 540, hPC, 'Jogar na versão adaptada para PC', pronto ? { tipo: 'contorno', s: 24, ic: 'pc', acao: 'jogar_pc' } : { tipo: 'suave', s: 24, ic: 'pc' }) +
      `<line x1="120" y1="580" x2="1160" y2="580" stroke="${C.linha}" stroke-width="1.5"/>`;
    const itens: [string, string, number, string][] = [['controle', 'Como jogar', 180, 'tela:como_jogar_vr'], ['ajustes', 'Opções', 160, 'tela:opcoes'],
      ['offline', 'Salvar para jogar sem internet', 320, 'salvar_offline'], ['atualizar', 'Verificar atualização', 260, 'atualizar'], ['creditos', 'Créditos', 150, 'tela:creditos']];
    let x = 69;
    for (const [ic, t, larg, acao] of itens) { corpo += botao(x, 604, larg, 46, t, { tipo: 'suave', s: 18, ic, icCor: C.aqua, acao }); x += larg + 18; }
    pegarAlvos().push({ acao: modoTesteLigado() ? 'teste_desligar' : 'tela:senha', x: 30, y: 664, w: 200, h: 40 });
    corpo += icone('teste', 40, 676, 18, C.texto2) + T(64, 691, modoTesteLigado() ? 'Modo de teste ligado (desligar)' : 'Modo de teste', { f: 'n', s: 15, c: modoTesteLigado() ? C.coral : C.texto2 });
  }
  if (!vrDisponivel && pronto && !telaCurta) corpo += T(640, 568, 'Sem VR neste navegador: no Meta Quest, use o navegador do óculos.', { f: 'n', s: 16, c: C.texto2, a: 'middle' });
  corpo += linhaDeBaixo();
  return { corpo, alvos: pegarAlvos() };
}

/** Confirmação de "Jogar do início" (rodada 4, A: botão de apagar em Coral). */
function desenharConfirmarInicio(): { corpo: string; alvos: Alvo[] } {
  comecarAlvos();
  pegarAlvos().push({ acao: 'apagar_jogo', x: 180, y: 425, w: 440, h: 92 });
  const corpo = `<rect width="1280" height="720" fill="${C.fundo}"/>` + ceu(1280, 720) + `<rect width="1280" height="720" fill="${C.escuro}" opacity=".85"/>` +
    R(140, 155, 1000, 410, { r: 28, f: C.painel, st: C.aqua, sw: 3 }) + R(140, 155, 1000, 96, { r: 28, f: C.sup }) + `<rect x="140" y="225" width="1000" height="26" fill="${C.sup}"/>` +
    icone('do_inicio', 172, 181, 40, C.aqua) + T(228, 217, 'Jogar do início?', { s: 42 }) +
    T(180, 320, 'Você volta para a abertura. As luzes acesas e as missões', { f: 'n', s: 28 }) + T(180, 360, 'feitas são apagadas.', { f: 'n', s: 28 }) +
    R(180, 425, 440, 92, { r: 46, f: C.coral, st: C.coral, sw: 2.5 }) + icone('do_inicio', 232, 449, 44, C.fundo) + T(290, 485, 'Sim, recomeçar', { s: 34, c: C.fundo }) +
    botao(660, 425, 440, 92, 'Cancelar', { s: 34, ic: 'voltar', acao: 'cancelar' });
  return { corpo, alvos: pegarAlvos() };
}

function desenharAvisoPC(): { corpo: string; alvos: Alvo[] } {
  comecarAlvos();
  const teclas: [string, string][] = [['W A S D', 'andar'], ['Mouse', 'olhar'], ['Clique esquerdo', 'usar'], ['Clique direito', 'segurar'], ['R', 'relógio'], ['Esc', 'menu']];
  const corpo = `<rect width="1280" height="720" fill="${C.fundo}"/>` + ceu(1280, 720) + `<rect width="1280" height="720" fill="${C.escuro}" opacity=".85"/>` +
    R(240, 90, 800, 540, { r: 28, f: C.painel, st: C.aqua, sw: 3 }) +
    icone('vr', 280, 128, 56, C.aqua) + T(356, 172, 'Feito para Realidade Virtual', { s: 44 }) +
    T(280, 232, 'Esta experiência foi criada para o Meta Quest. A versão para', { f: 'n', s: 24 }) +
    T(280, 266, 'computador é uma adaptação: algumas partes ficam diferentes,', { f: 'n', s: 24 }) +
    T(280, 300, 'como montar o tangram e pegar objetos com o mouse.', { f: 'n', s: 24 }) +
    R(280, 330, 720, 150, { r: 16, f: C.sup }) +
    teclas.map(([k, t], i) => {
      const w = 74 + Math.min(k.length, 15) * 7, x = 300 + (i % 3) * 232, y = 348 + Math.floor(i / 3) * 64;
      return R(x, y, w, 42, { r: 10, f: C.sup2, st: C.linha }) + T(x + w / 2, y + 28, k, { f: 'n', s: 17, w: 700, a: 'middle' }) + T(x + w + 10, y + 28, t, { f: 'n', s: 18, c: C.texto2 });
    }).join('') +
    botao(280, 510, 400, 76, 'Continuar no PC', { ic: 'pc', s: 30, acao: 'continuar_pc' }) + botao(700, 510, 300, 76, 'Voltar', { tipo: 'contorno', s: 28, ic: 'voltar', acao: 'tela:inicio' });
  return { corpo, alvos: pegarAlvos() };
}

function desenharSenha(): { corpo: string; alvos: Alvo[] } {
  comecarAlvos();
  const treme = performance.now() / 1000 - senhaErrou < 0.4 ? 8 : 0;
  let corpo = `<rect width="1280" height="720" fill="${C.fundo}"/>` + ceu(1280, 720) + `<rect width="1280" height="720" fill="${C.escuro}" opacity=".85"/>` +
    R(390, 40, 500, 676, { r: 28, f: C.painel, st: C.aqua, sw: 3 }) + icone('teste', 426, 104, 40, C.aqua) + T(480, 138, 'Modo de teste', { s: 40 }) +
    R(430 + treme, 176, 420, 70, { r: 16, f: C.sup, st: C.linha }) + T(640 + treme, 224, senha.replace(/./g, '• ').trim() || ' ', { s: 40, a: 'middle', c: C.lima });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].forEach((k, i) => {
    const x = 430 + (i % 3) * 145, y = 270 + Math.floor(i / 3) * 86, ok = k === 'OK';
    pegarAlvos().push({ acao: 'tecla:' + k, x, y, w: 130, h: 72 });
    corpo += R(x, y, 130, 72, { r: 18, f: ok ? C.lima : C.sup, st: ok ? C.lima : C.linha, sw: 2.5 }) + T(x + 65, y + 48, k, { s: 32, a: 'middle', c: ok ? C.fundo : C.texto });
  });
  corpo += botao(430, 626, 420, 60, 'Voltar', { tipo: 'contorno', s: 24, ic: 'voltar', acao: 'tela:inicio' });
  return { corpo, alvos: pegarAlvos() };
}

function desenharComoJogar(vr: boolean): { corpo: string; alvos: Alvo[]; w: number; h: number } {
  comecarAlvos();
  const base = vr ? comoJogarVR() : comoJogarPC();
  const corpo = `<rect width="1280" height="760" fill="${C.fundo}"/>` + base +
    botao(1060, 22, 180, 60, 'Voltar', { tipo: 'contorno', s: 24, ic: 'voltar', acao: 'tela:inicio' }) +
    botao(vr ? 700 : 760, 26, vr ? 330 : 270, 52, vr ? 'Ver teclado e mouse' : 'Ver Meta Quest', { tipo: 'suave', s: 20, ic: vr ? 'pc' : 'vr', icCor: C.aqua, acao: vr ? 'tela:como_jogar_pc' : 'tela:como_jogar_vr' });
  return { corpo, alvos: pegarAlvos(), w: 1280, h: 760 };
}

function desenharCreditos(): { corpo: string; alvos: Alvo[] } {
  comecarAlvos();
  const linhas: [string, string][] = [
    ['Criação, roteiro, vozes e arte', 'Gabura Digital'],
    ['Código', 'licença MIT (pode estudar, copiar e mudar)'],
    ['Personagens, arte e marca Gaburaverso', 'todos os direitos reservados'],
    ['Feito com', 'Three.js (MIT) e WebXR'],
    ['Fontes', 'Baloo 2 e Nunito (SIL Open Font License)'],
  ];
  const corpo = `<rect width="1280" height="720" fill="${C.fundo}"/>` + ceu(1280, 720) + `<rect width="1280" height="720" fill="${C.escuro}" opacity=".85"/>` +
    R(200, 80, 880, 560, { r: 28, f: C.painel, st: C.aqua, sw: 3 }) + icone('creditos', 240, 116, 44, C.aqua) + T(300, 154, 'Créditos', { s: 44 }) +
    linhas.map(([a, b], i) => T(250, 232 + i * 70, a.toUpperCase(), { f: 'n', s: 17, w: 700, c: C.aqua, ls: 1.5 }) + T(250, 262 + i * 70, b, { f: 'n', s: 26, w: 700 })).join('') +
    botao(850, 102, 190, 58, 'Voltar', { tipo: 'contorno', s: 24, ic: 'voltar', acao: 'tela:inicio' });
  return { corpo, alvos: pegarAlvos() };
}

// ---------- montar na página ----------
export function iniciarTelaInicial(raiz: HTMLElement, a: AcoesInicio): void {
  acoes = a;
  caixa = document.createElement('div'); caixa.id = 'inicio';
  palco = document.createElement('div'); palco.className = 'palco';
  botoes = document.createElement('div'); botoes.className = 'alvos';
  palco.append(botoes); caixa.append(palco); raiz.append(caixa);
  telaCurta = jaJogouVR();
  void (navigator as Navigator & { xr?: XRSystem }).xr?.isSessionSupported('immersive-vr').then((s) => { vrDisponivel = s; if (!s) telaCurta = false; desenhar(); }).catch(() => {});
  window.addEventListener('keydown', (e) => {
    if (caixa.hidden || tela !== 'senha') return;
    if (/^[0-9]$/.test(e.key)) agir('tecla:' + e.key); else if (e.key === 'Backspace') agir('tecla:⌫'); else if (e.key === 'Enter') agir('tecla:OK');
  });
  desenhar();
}

export function mostrarTelaInicial(): void { caixa.hidden = false; tela = 'inicio'; desenhar(); }
export function esconderTelaInicial(): void { caixa.hidden = true; }
export function telaInicialAberta(): boolean { return !caixa.hidden; }
export function progressoCarregamento(k: number): void { const antes = Math.round(carregado * 100); carregado = k; if (Math.round(k * 100) !== antes) desenhar(); }
export function avisarNaTela(texto: string): void { mensagem = texto; desenhar(); }

function desenhar(): void {
  if (!palco) return;
  let d: { corpo: string; alvos: Alvo[]; w?: number; h?: number };
  if (tela === 'aviso_pc') d = desenharAvisoPC();
  else if (tela === 'senha') d = desenharSenha();
  else if (tela === 'como_jogar_vr' || tela === 'como_jogar_pc') d = desenharComoJogar(tela === 'como_jogar_vr');
  else if (tela === 'creditos') d = desenharCreditos();
  else if (tela === 'confirmar_inicio') d = desenharConfirmarInicio();
  else if (tela === 'opcoes') {
    // as Opções da tela inicial são as do VR (giro); a do mouse fica no menu do jogo no PC
    const pv = desenhoDoPainel('opcoes', { ...acoes.contexto(), vr: true, modoTeste: modoTesteLigado() });
    d = { corpo: `<rect width="1000" height="960" fill="${C.fundo}"/>` + pv.corpo, alvos: pv.alvos, w: 1000, h: 960 };
  } else d = desenharInicio();
  const w = d.w ?? 1280, h = d.h ?? 720;
  const velho = palco.querySelector('svg'); velho?.remove();
  palco.insertAdjacentHTML('afterbegin', svg(w, h, d.corpo));
  const el = palco.querySelector('svg')!;
  el.setAttribute('width', '100%'); el.setAttribute('height', '100%'); el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.setAttribute('role', 'img'); el.setAttribute('aria-hidden', 'true');
  // o palco tem a mesma proporção do desenho: assim os botões invisíveis ficam em cima dos desenhados
  palco.style.aspectRatio = `${w} / ${h}`; palco.style.width = `min(100vw, calc(100vh * ${(w / h).toFixed(4)}))`;
  // botões de verdade por cima das áreas clicáveis
  botoes.replaceChildren(...d.alvos.map((a) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'alvo'; b.setAttribute('aria-label', rotuloDe(a.acao));
    Object.assign(b.style, { left: (a.x / w) * 100 + '%', top: (a.y / h) * 100 + '%', width: (a.w / w) * 100 + '%', height: (a.h / h) * 100 + '%' });
    b.addEventListener('click', (e) => {
      let u: number | undefined;
      if (a.tipo === 'deslizante') { const r = b.getBoundingClientRect(); const px = a.x + ((e.clientX - r.left) / r.width) * a.w; u = Math.min(1, Math.max(0, (px - a.x0!) / (a.x1! - a.x0!))); }
      agir(a.acao, u);
    });
    return b;
  }));
}

function rotuloDe(acao: string): string {
  const nomes: Record<string, string> = { jogar_vr: 'Jogar no VR', jogar_pc: 'Jogar na versão adaptada para PC', continuar_pc: 'Continuar no PC', salvar_offline: 'Salvar para jogar sem internet',
    atualizar: 'Verificar atualização', 'tela:inicio': 'Voltar', 'tela:confirmar_inicio': 'Jogar do início', apagar_jogo: 'Sim, recomeçar', cancelar: 'Cancelar', 'tela:opcoes': 'Opções', 'tela:creditos': 'Créditos', 'tela:como_jogar_vr': 'Como jogar', 'tela:senha': 'Modo de teste', mais_opcoes: 'Mais opções',
    voltar: 'Voltar', musica: 'Volume da música', efeitos: 'Volume dos efeitos', vozes: 'Volume das vozes', bordas: 'Escurecer as bordas ao andar',
    reduzir_luz: 'Reduzir efeitos de iluminação', legendas: 'Legendas', 'abrir:senha': 'Ativar modo de teste', teste_desligar: 'Desligar modo de teste',
    'tela:como_jogar_pc': 'Ver teclado e mouse' };
  return nomes[acao] ?? acao.replace(/^tecla:/, 'tecla ');
}

function agir(acao: string, valor?: number): void {
  if (acao === 'jogar_vr') { acoes.jogarVR(); return; }
  if (acao === 'jogar_pc') { tela = 'aviso_pc'; desenhar(); return; }
  if (acao === 'continuar_pc') { acoes.jogarPC(); return; }
  if (acao === 'mais_opcoes') { telaCurta = false; desenhar(); return; }
  if (acao === 'cancelar') { tela = 'inicio'; desenhar(); return; }
  if (acao === 'apagar_jogo') { acoes.apagarJogo(); tela = 'inicio'; mensagem = 'progresso apagado: o jogo começa do início'; desenhar(); return; }
  if (acao.startsWith('tela:')) { tela = acao.slice(5) as Tela; senha = ''; desenhar(); return; }
  if (acao === 'salvar_offline') { void salvarOffline(); return; }
  if (acao === 'atualizar') { void verificarAtualizacao(); return; }
  if (acao === 'teste_desligar') { ligarModoTeste(false); mensagem = 'modo de teste desligado'; desenhar(); return; }
  if (acao.startsWith('tecla:')) {
    const k = acao.slice(6);
    if (k === '⌫') senha = senha.slice(0, -1);
    else if (k === 'OK') {
      if (senha === SENHA_TESTE) { ligarModoTeste(true); mensagem = 'modo de teste ligado'; tela = 'inicio'; }
      else { senhaErrou = performance.now() / 1000; setTimeout(desenhar, 420); }
      senha = '';
    } else if (senha.length < 6) senha += k;
    desenhar(); return;
  }
  if (acao === 'voltar') { tela = 'inicio'; desenhar(); return; }
  if (acao === 'abrir:senha') { tela = 'senha'; senha = ''; desenhar(); return; }
  // o resto são as opções (volume, giro, legendas...): iguais às do menu do jogo
  acoes.agirOpcao(acao, valor);
  desenhar();
}

// ---------- jogar sem internet ----------
function lerOffline(): string | null { try { return localStorage.getItem(CHAVE_OFFLINE); } catch { return null; } }

/** Baixa todos os arquivos do jogo para o cache do navegador (o service worker usa o mesmo cache). */
async function salvarOffline(): Promise<void> {
  if (salvando >= 0) return;
  if (!('caches' in window)) { avisarNaTela('este navegador não guarda o jogo'); return; }
  try {
    salvando = 0; desenhar();
    const lista = await (await fetch(url('lista_offline.json'), { cache: 'no-store' })).json() as { versao: string; arquivos: { url: string; bytes: number }[] };
    const cache = await caches.open('nave-' + lista.versao);
    const total = lista.arquivos.reduce((s, a) => s + a.bytes, 0) || 1;
    let feito = 0;
    const fila = [...lista.arquivos];
    const trabalhar = async () => {
      for (let a = fila.shift(); a; a = fila.shift()) {
        const u = new URL(a.url, location.href).href;
        if (!(await cache.match(u))) { const r = await fetch(u); if (r.ok) await cache.put(u, r); }
        feito += a.bytes; const k = feito / total;
        if (Math.round(k * 100) !== Math.round(salvando * 100)) { salvando = k; desenhar(); }
      }
    };
    await Promise.all([trabalhar(), trabalhar(), trabalhar(), trabalhar()]);
    try { localStorage.setItem(CHAVE_OFFLINE, lista.versao); } catch { /* */ }
    salvando = -1; mensagem = lista.versao === __VERSAO_CACHE__ ? '' : 'salvo (recarregue para usar a versão nova)';
  } catch {
    salvando = -1; mensagem = 'sem internet agora: tente de novo depois';
  }
  desenhar();
}

/** Procura uma versão nova no GitHub Pages; se houver, recarrega com ela. */
async function verificarAtualizacao(): Promise<void> {
  avisarNaTela('procurando versão nova…');
  try {
    const lista = await (await fetch(url('lista_offline.json'), { cache: 'no-store' })).json() as { versao: string };
    if (lista.versao === __VERSAO_CACHE__) { avisarNaTela('você já tem a versão mais nova'); return; }
    avisarNaTela('versão nova encontrada: atualizando…');
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    const nova = reg?.waiting ?? reg?.installing;
    if (nova) {
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      nova.postMessage('pular-espera');
      setTimeout(() => location.reload(), 4000);
    } else location.reload();
  } catch {
    avisarNaTela('sem internet agora: o jogo continua na versão salva');
  }
}
