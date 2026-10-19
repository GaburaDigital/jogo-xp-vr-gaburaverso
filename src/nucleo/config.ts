// Opções do jogador e progresso, guardados no navegador (localStorage).
// Se o navegador não deixar guardar (janela anônima), o jogo funciona igual, só não lembra.

export interface Opcoes {
  musica: number;            // 0 a 1 (grupo Músicas)
  efeitos: number;           // 0 a 1 (grupo Efeitos)
  vozes: number;             // 0 a 1 (grupo Vozes)
  giro: 'passos' | 'continuo';
  passoGiro: 30 | 45;
  bordas: boolean;           // escurecer as bordas ao andar (conforto)
  reduzirLuz: boolean;       // "Reduzir efeitos de iluminação"
  legendas: boolean;
  tamanhoLegenda: 'P' | 'M' | 'G';
  sensibilidadeMouse: number; // só no PC
  posicao: 'em_pe' | 'sentado'; // VR: sentado sobe a visão para a altura de quem está em pé
  ajusteAltura: number;       // m somados à altura real (medido ao escolher Sentado ou em "Ajustar altura agora")
}

export const OPCOES_PADRAO: Opcoes = {
  musica: 1, efeitos: 1, vozes: 1, giro: 'passos', passoGiro: 45, bordas: false,
  reduzirLuz: false, legendas: true, tamanhoLegenda: 'M', sensibilidadeMouse: 1, posicao: 'em_pe', ajusteAltura: 0,
};

export interface Progresso {
  cenasConcluidas: string[];  // ids das cenas que já terminaram
  eventos: string[];          // eventos que mudam o mundo (luz acesa, faixas do chão...)
}

const CH_OPCOES = 'nave_opcoes_v1', CH_PROGRESSO = 'nave_progresso_v1', CH_VR = 'nave_jogou_vr', CH_TESTE = 'nave_modo_teste';

function ler<T>(chave: string, padrao: T): T {
  try { const s = localStorage.getItem(chave); return s ? { ...padrao, ...JSON.parse(s) } as T : padrao; } catch { return padrao; }
}
function gravar(chave: string, v: unknown): void { try { localStorage.setItem(chave, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* sem armazenamento */ } }

export const opcoes: Opcoes = ler(CH_OPCOES, { ...OPCOES_PADRAO });
export const progresso: Progresso = ler(CH_PROGRESSO, { cenasConcluidas: [], eventos: [] });

export function salvarOpcoes(): void { gravar(CH_OPCOES, opcoes); }
export function salvarProgresso(): void { gravar(CH_PROGRESSO, progresso); }
/** Já existe partida salva? (alguma cena terminada ou algo aceso) */
export function temJogoSalvo(): boolean { return progresso.cenasConcluidas.length > 0 || progresso.eventos.length > 0; }
/** "Recomeçar jogo" / "Jogar do início": apaga só o progresso (as opções ficam). */
export function apagarProgresso(): void { progresso.cenasConcluidas = []; progresso.eventos = []; salvarProgresso(); }

/** No Quest: depois de entrar no VR uma vez, a tela inicial é pulada (até apagar os dados do navegador). */
export function jaJogouVR(): boolean { try { return localStorage.getItem(CH_VR) === '1'; } catch { return false; } }
export function marcarJogouVR(): void { gravar(CH_VR, '1'); }

/** Modo de teste: liga com a senha e fica ligado neste navegador. */
export function modoTesteLigado(): boolean { try { return localStorage.getItem(CH_TESTE) === '1'; } catch { return false; } }
export function ligarModoTeste(v: boolean): void { try { if (v) localStorage.setItem(CH_TESTE, '1'); else localStorage.removeItem(CH_TESTE); } catch { /* */ } }
export const SENHA_TESTE = '42';
