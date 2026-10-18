// Abertura (sala central): as caixas de teste para aprender a pegar, soltar e empurrar,
// e as falas opcionais da Gabu_IA (olhar o painel das luzes, empurrar uma caixa, empilhar três).

import * as THREE from 'three';
import { ganchos, registrarSeguravel, restaurar, seguraveis } from '../interacao/seguraveis';
import { diretor, falaPorEvento, zerarFalasPorEvento } from '../cenas/diretor';
import { posicaoDe } from '../mundo/mundo';
import { olhar } from '../xr/jogador';

export const CAIXAS = ['caixa_teste_1', 'caixa_teste_2', 'caixa_teste_3', 'caixa_teste_4', 'caixa_teste_5', 'caixa_teste_6'];
export const abertura = { pegouCaixa: false };

/** As falas por evento só entram quando a cena não está no meio de uma fala dela. */
function podeComentar(): boolean { return !diretor.ativa || diretor.ativa.estado === 'aguardando'; }

export function montarAbertura(): void {
  for (const id of CAIXAS) if (registrarSeguravel(id)) diretor.fisicos.add(id);
  const pegar = ganchos.aoPegar, pousar = ganchos.aoPousar, empurrar = ganchos.aoEmpurrar, soltarAntes = ganchos.aoSoltar;
  ganchos.aoPegar = (s) => { pegar(s); if (CAIXAS.includes(s.id)) abertura.pegouCaixa = true; };
  ganchos.aoEmpurrar = (s) => { empurrar(s); if (CAIXAS.includes(s.id) && podeComentar()) falaPorEvento('sala_caixa_empurrada'); };
  ganchos.aoSoltar = (s) => { soltarAntes(s); };
  ganchos.aoPousar = (s, v) => {
    pousar(s, v);
    if (!CAIXAS.includes(s.id)) return;
    // jogou uma caixa (caiu rápido) também conta como "empurrou"
    if (v > 2.2 && podeComentar()) falaPorEvento('sala_caixa_empurrada');
    // torre de 3: esta caixa está pousada em cima de outras duas
    if (s.inst.raiz.position.y > s.altura * 1.7 && podeComentar()) falaPorEvento('sala_torre_3_caixas');
  };
}

export function manualAbertura(texto: string): boolean {
  if (/pegar o primeiro objeto/.test(texto)) return abertura.pegouCaixa;
  return false;
}

/** Olhar o painel das três luzes (perto dele) puxa um comentário da Gabu_IA, uma vez. */
export function atualizarAbertura(): void {
  if (!podeComentar()) return;
  const painel = posicaoDe('painel_luzes'); if (!painel) return;
  const { origem, direcao } = olhar();
  const para = painel.clone().sub(origem);
  if (para.length() < 3.2 && THREE.MathUtils.radToDeg(direcao.angleTo(para.normalize())) < 18) falaPorEvento('sala_olhar_painel');
}

export function zerarAbertura(): void {
  abertura.pegouCaixa = false;
  for (const id of CAIXAS) { restaurar(id); const s = seguraveis.get(id); if (s) s.ativo = true; }
  zerarFalasPorEvento(['sala_olhar_painel', 'sala_caixa_empurrada', 'sala_torre_3_caixas']);
}
