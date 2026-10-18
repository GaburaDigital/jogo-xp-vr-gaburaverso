// O que os eventos das cenas mudam no mundo e que precisa ficar assim (faixas do chão acesas,
// luz da ponte, LED do relógio...). Fica guardado no progresso: ao abrir o jogo de novo, a nave
// volta do jeito que o jogador deixou.
// Analogia Godot: é como guardar o estado de um AnimationPlayer "parado no fim" para cada objeto.

import { animar, acenderLuzDoEvento, apagarLuzDoEvento, instancias } from '../mundo/mundo';
import { progresso, salvarProgresso } from '../nucleo/config';
import { ledRelogio } from '../xr/jogador';
import { vibrar } from '../xr/entrada';
import { tempoGlobal } from '../cenas/diretor';

/** Clipes que ficam "segurados" no último quadro: objeto → clipe → instante em que começou. */
const segurados = new Map<string, Map<string, number>>();

/** Eventos que mudam o mundo de vez (os outros só acontecem na hora). */
const PERMANENTES: Record<string, [string, string][]> = {
  acender_faixas_chao: [['faixas_chao', 'acender_ponte']],
  acender_luz_ponte: [['painel_luzes', 'acender_ponte'], ['sala_ponte', 'acender_faixa']],
};
const LUZES = new Set(['acender_luz_ponte']);

function segurar(id: string, clipe: string, desde: number): void {
  if (!instancias.get(id)?.clipes.has(clipe)) return;
  let m = segurados.get(id); if (!m) { m = new Map(); segurados.set(id, m); }
  if (!m.has(clipe)) m.set(clipe, desde);
}

/** Um evento da cena aconteceu agora (ou, com "instantaneo", ao abrir o jogo com ele já feito). */
export function aplicarEvento(nome: string, instantaneo = false): void {
  const agora = instantaneo ? -1e6 : tempoGlobal();
  if (nome === 'relogio_vibrar' && !instantaneo) {
    // três pulsos no controle esquerdo, como um relógio vibrando
    for (let i = 0; i < 3; i++) setTimeout(() => vibrar('esq', 0.7, 140), i * 320);
  }
  if (nome === 'missao_completa_ponte') ledRelogio('ponte', true);
  for (const [id, clipe] of PERMANENTES[nome] ?? []) segurar(id, clipe, agora);
  if (LUZES.has(nome)) acenderLuzDoEvento(nome, agora, instantaneo);
  if ((PERMANENTES[nome] || nome.startsWith('missao_completa')) && !progresso.eventos.includes(nome)) { progresso.eventos.push(nome); salvarProgresso(); }
}

/** Ao abrir o jogo: tudo o que já tinha acontecido volta a valer, sem animação. */
export function reaplicarEventosSalvos(): void { for (const e of progresso.eventos) aplicarEvento(e, true); }

/** Recomeçar uma missão: desfaz os eventos dela. */
export function desfazerEventos(nomes: string[]): void {
  for (const nome of nomes) {
    for (const [id, clipe] of PERMANENTES[nome] ?? []) segurados.get(id)?.delete(clipe);
    if (LUZES.has(nome)) apagarLuzDoEvento(nome);
    if (nome === 'missao_completa_ponte') ledRelogio('ponte', false);
  }
  progresso.eventos = progresso.eventos.filter((e) => !nomes.includes(e)); salvarProgresso();
}

/** A cada quadro: os objetos com clipes segurados (o diretor não mexe neles). */
export function atualizarEfeitosMundo(): void {
  const agora = tempoGlobal();
  for (const [id, clipes] of segurados) {
    animar(id, [...clipes].map(([clipe, desde]) => ({ clipe, tempo: agora - desde, peso: 1, loop: false })));
  }
}
