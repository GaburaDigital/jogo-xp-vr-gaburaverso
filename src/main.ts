// Começo do jogo: tela inicial, carregamento da nave, entrar no VR ou na versão adaptada para PC,
// e o laço de cada quadro (entrada → jogador → missões → cenas → painéis → desenhar).
// Analogia Godot: é a cena principal com o _process() chamando cada sistema em ordem.

import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './estilo.css';
import * as THREE from 'three';
import { biblioteca, carregarDados, contextoAudio, prepararSons } from './nucleo/dados';
import { opcoes, progresso, salvarOpcoes, salvarProgresso, marcarJogouVR, modoTesteLigado, ligarModoTeste, SENHA_TESTE, apagarProgresso, temJogoSalvo } from './nucleo/config';
import { aplicarVolumesGrupos, atualizarOuvinte, iniciarAudio, pausarSom, tocar, tocarMusica } from './nucleo/audio';
import { apontar, setaVisivel, atualizarLuzes, atualizarSombras, camera, cena3d, criarColisoresDeMoveis, iniciarMundo, instancias, portasAbertas, reduzirLuz, renderizador } from './mundo/mundo';
import { entrada, lerPC, lerVR, ligarControlesVR, ligarPC, limparBordas, vibrarTipo } from './xr/entrada';
import { atualizarJogador, calibrarAltura, iniciarJogador, jogador, posicaoPes, prenderRelogio, teleportar, ALTURA_OLHOS } from './xr/jogador';
import { atualizarSeguraveis, definirApoios, objetoNaMao, segurando, seguraveis } from './interacao/seguraveis';
import { apertarBotao, atualizarPortas, botoesDasPortas, registrarPortas } from './interacao/portas';
import { CENAS_DO_JOGO, historicoAvulsas, tocadasAvulsas, vozesJuntas, atualizarDiretor, atualizarMusica, diretor, iniciarCena, montarNave, pedidoAtual, pularFala, tempoGlobal, zerarCena } from './cenas/diretor';
import { iniciarLegenda } from './interface/legenda';
import { abrirPainel, acionar, alvosAbertos, atualizarPaineis, fecharPainel, grupoPainel, iniciarPaineis, painelAberto, redesenhar, type ContextoPaineis } from './interface/paineis';
import { avisarNaTela, esconderTelaInicial, iniciarTelaInicial, mostrarTelaInicial, progressoCarregamento } from './interface/tela_inicial';
import { C } from './interface/svg';
import { abertura, atualizarAbertura, manualAbertura, montarAbertura, zerarAbertura, CAIXAS } from './missoes/abertura';
import { _consoleParaMundo, _lugaresTangram, _pecasTangram, atualizarPonte, cameraFocoPC, completarPonte, manualPonte, montarPonte, ponte, ponteConcluida, zerarPonte } from './missoes/ponte';
import { aplicarEvento, atualizarEfeitosMundo, desfazerEventos, reaplicarEventosSalvos } from './missoes/efeitos_mundo';
import { _atirarEm, _capturarTeste, _clones, _oQueAcerta, _simular, segurandoArma, atualizarTreino, clonesTocaveis, comecarTreino, completarTreino, manualTreino, montarTreino, treino, zerarTreino } from './missoes/treinamento';
import { _alvosOficina, _pecasOficina, atualizarOficina, cameraFocoOficinaPC, completarOficina, manualOficina, montarOficina, oficina, oficinaConcluida, trocarLedPeloAceso, zerarOficina } from './missoes/oficina';
import { atualizarToque, registrarFonteDeToque, registrarPersonagens } from './interacao/toque';
import { DESLOCAMENTO_TUNEL, _escuro, atualizarPortal, atualizarPortalDepois, atualizarTelaFinal, completarPortal, deslocarCena, fecharCreditos, irParaOTunel, manualPortal, montarPortal, mostrarCreditos, portal, tresLuzes, zerarPortal } from './missoes/portal';
import { url } from './nucleo/dados';

// =====================================================================
// Página
// =====================================================================
const app = document.getElementById('app')!;
app.innerHTML = '';
const caixaMundo = document.createElement('div'); caixaMundo.id = 'mundo'; app.append(caixaMundo);
const hud = document.createElement('div'); hud.id = 'hud'; hud.hidden = true;
hud.innerHTML = '<div class="mira"></div><div class="dica" hidden></div><div class="selo-pc">versão adaptada para PC · feita para VR</div><div class="clique" hidden>Clique para continuar</div><div class="qps" hidden></div>';
app.append(hud);
const dicaPC = hud.querySelector('.dica') as HTMLDivElement, miraPC = hud.querySelector('.mira') as HTMLDivElement;
const avisoClique = hud.querySelector('.clique') as HTMLDivElement, qpsPC = hud.querySelector('.qps') as HTMLDivElement;

iniciarMundo(caixaMundo);
iniciarJogador();
iniciarLegenda();

let pronto = false;
let jogando = false;
let medidorQps = false;
let senhaVR = '', senhaErrouVR = 0;
let confirmarTipo: 'jogo' | 'missao' = 'jogo';
let contagemAltura = 0;
let fotoCreditos: string | null = null;   // public/imagens/creditos_foto.jpg (o autor manda); sem ela, espaço reservado
const tela = renderizador.domElement;

// =====================================================================
// Painéis (menu de pausa e companhia)
// =====================================================================
const NOMES_MISSAO: Record<string, string> = { sala_abertura: 'Abertura', ponte_navegacao: 'Ponte', treino_captura: 'Treinamento', oficina_energia: 'Oficina', portal_saida: 'Portal', tunel_despedida: 'Despedida', livre: 'Explorar a nave' };
const OBJETIVOS: [RegExp, string][] = [
  [/mirante/, 'Ir até o mirante, perto da janela.'], [/olhar pela janela/, 'Olhar pela janela.'], [/andar até as caixas/, 'Andar até as caixas.'],
  [/pegar o primeiro objeto/, 'Pegar uma caixa.'], [/relógio/, 'Levantar o pulso esquerdo e olhar o relógio.'],
  [/cyberdeck \(embaixo/, 'Achar o cyberdeck da Gabura na ponte.'], [/encaixar o cyberdeck/, 'Encaixar o cyberdeck no console do tangram.'],
  [/tangram/, 'Montar o foguete do tangram no console.'],
  [/suporte da arma/, 'Ir até o posto, ao lado do suporte da arma.'], [/pegar a arma/, 'Pegar a arma de captura laser no suporte.'],
  [/capturar os 16/, 'Capturar os 16 clones. Mire só no clone: acertar o esconderijo não conta.'],
  [/posto da protoboard/, 'Pisar no posto, na frente da protoboard.'], [/montar o circuito/, 'Montar o circuito seguindo o quadro do esquema.'],
  [/ir até a alavanca/, 'Ir até a alavanca, na frente do portal.'], [/puxar a alavanca/, 'Puxar a alavanca.'], [/atravessar o portal/, 'Atravessar o portal.'],
];
/** Missões com sala (podem ser feitas em qualquer ordem depois da abertura). */
const MISSOES = [
  { id: 'ponte_navegacao', nome: 'Ponte (em frente)', luz: 'acender_luz_ponte', dentro: (p: THREE.Vector3) => p.z < -9.6 },
  { id: 'treino_captura', nome: 'Treinamento (à esquerda)', luz: 'acender_luz_treinamento', dentro: (p: THREE.Vector3) => p.x < -9.6 },
  { id: 'oficina_energia', nome: 'Oficina (à direita)', luz: 'acender_luz_oficina', dentro: (p: THREE.Vector3) => p.x > 9.6 },
];
function missaoAtual(): string {
  if (diretor.ativa) return diretor.ativa.cena.id;
  if (!progresso.cenasConcluidas.includes('sala_abertura')) return 'sala_abertura';
  return 'livre';
}
function objetivo(): string {
  const p = pedidoAtual();
  if (p) return OBJETIVOS.find(([r]) => r.test(p))?.[1] ?? p;
  const m = missaoAtual();
  if (m === 'livre') {
    const faltam = MISSOES.filter((x) => !progresso.cenasConcluidas.includes(x.id)).map((x) => x.nome);
    if (!faltam.length) return progresso.cenasConcluidas.includes('portal_saida') ? 'Você terminou o jogo! Atravesse o portal de novo para rever a despedida.' : 'As três luzes estão acesas! Vá até a câmara do portal, atrás da sala central, e puxe a alavanca.';
    return 'Escolha uma missão: ' + faltam.join(', ') + '.';
  }
  return 'Escute a Gabu_IA.';
}
function contexto(): ContextoPaineis {
  return {
    vr: entrada.modo === 'vr', modoTeste: modoTesteLigado(),
    missao: { nome: NOMES_MISSAO[missaoAtual()] ?? 'Nave', objetivo: objetivo(),
      luzes: { ponte: progresso.eventos.includes('acender_luz_ponte'), treinamento: progresso.eventos.includes('acender_luz_treinamento'), oficina: progresso.eventos.includes('acender_luz_oficina'), portal: progresso.eventos.includes('abrir_portal') } },
    senha: senhaVR, senhaErrou: senhaErrouVR, botoesVivos: entrada.botoesVivos, medidorQps, atravessar: jogador.atravessar, versao: __VERSAO_APP__,
    confirmar: confirmarTipo, nomeReiniciar: NOMES_MISSAO[missaoParaReiniciar() ?? ''] ?? '', contagemAltura, botoesBrutos: entrada.botoesBrutos,
    creditos: portal.creditos, fotoCreditos,
  };
}

let ultimoRedesenho = 0;
function redesenharLogo(): void { const t = performance.now(); if (t - ultimoRedesenho > 60) { ultimoRedesenho = t; void redesenhar(); } else setTimeout(() => void redesenhar(), 70); }

/** As ações das Opções (iguais no menu do jogo e na tela inicial). */
function agirOpcao(acao: string, valor?: number): boolean {
  const [nome, arg] = acao.split(':');
  if (nome === 'musica' || nome === 'efeitos' || nome === 'vozes') { opcoes[nome] = Math.round((valor ?? 0) * 20) / 20; aplicarVolumesGrupos(); }
  else if (nome === 'giro') opcoes.giro = arg === '0' ? 'passos' : 'continuo';
  else if (nome === 'passo') opcoes.passoGiro = arg === '0' ? 30 : 45;
  else if (nome === 'bordas') opcoes.bordas = !opcoes.bordas;
  else if (nome === 'sensibilidade') { opcoes.sensibilidadeMouse = Math.max(0.2, (valor ?? 0.5) * 2); window.__sensibilidade = opcoes.sensibilidadeMouse; }
  else if (nome === 'reduzir_luz') { opcoes.reduzirLuz = !opcoes.reduzirLuz; reduzirLuz(opcoes.reduzirLuz, biblioteca.pacote?.iluminacao); }
  else if (nome === 'legendas') opcoes.legendas = !opcoes.legendas;
  else if (nome === 'tamanho_legenda') opcoes.tamanhoLegenda = (['P', 'M', 'G'] as const)[+arg] ?? 'M';
  else if (nome === 'posicao') {
    opcoes.posicao = arg === '1' ? 'sentado' : 'em_pe';
    // sentado: mede agora (a altura atual vira 1,60 m); em pé: a altura real do jogador
    opcoes.ajusteAltura = opcoes.posicao === 'sentado' && entrada.modo === 'vr' ? calibrarAltura() : 0;
    jogador.alturaExtra = opcoes.ajusteAltura;
  }
  else if (nome === 'ajustar_altura') { ajustarAltura(); }
  else return false;
  salvarOpcoes();
  return true;
}

/** "Ajustar altura agora": 3 segundos para ficar na posição de jogar e olhar para frente. */
function ajustarAltura(): void {
  if (contagemAltura) return;
  contagemAltura = 3; redesenharLogo();
  const passo = () => {
    contagemAltura--;
    if (contagemAltura <= 0) {
      contagemAltura = 0;
      if (entrada.modo === 'vr') { opcoes.ajusteAltura = calibrarAltura(); opcoes.posicao = opcoes.ajusteAltura > 0.25 ? 'sentado' : 'em_pe'; jogador.alturaExtra = opcoes.ajusteAltura; salvarOpcoes(); }
      tocar('sfx_botao_porta');
    } else setTimeout(passo, 1000);
    redesenharLogo();
  };
  setTimeout(passo, 1000);
}

function pausar(sim: boolean): void {
  if (sim) { if (!painelAberto()) abrirPainel('pausa'); void pausarSom(true); if (document.pointerLockElement) document.exitPointerLock(); }
  else { fecharPainel(); void pausarSom(false); if (entrada.modo === 'pc' && !emFoco()) prenderMouse(); }
}

function agir(acao: string, valor?: number): void {
  if (agirOpcao(acao, valor)) { redesenharLogo(); return; }
  const [nome, arg] = acao.split(':');
  if (nome === 'continuar') pausar(false);
  else if (nome === 'abrir') abrirPainel(arg as 'opcoes');
  else if (nome === 'voltar') abrirPainel(portal.creditos >= 0 ? 'creditos' : painelAberto() === 'senha' ? 'opcoes' : 'pausa');
  else if (nome === 'creditos_sair') { fecharCreditos(); sair(); }
  else if (nome === 'confirmar') { confirmarTipo = arg === 'missao' && missaoParaReiniciar() ? 'missao' : 'jogo'; abrirPainel('confirmar'); }
  else if (nome === 'confirmar_sim') { if (confirmarTipo === 'jogo') recomecarJogo(); else reiniciarMissao(missaoParaReiniciar()!); pausar(false); }
  else if (nome === 'recomecar') { recomecarMissao(); pausar(false); }
  else if (nome === 'sair') sair();
  else if (nome === 'teste_desligar') { ligarModoTeste(false); redesenharLogo(); }
  else if (nome === 'tecla') {
    if (arg === '⌫') senhaVR = senhaVR.slice(0, -1);
    else if (arg === 'OK') { if (senhaVR === SENHA_TESTE) { ligarModoTeste(true); senhaVR = ''; abrirPainel('teste'); return; } senhaErrouVR = performance.now() / 1000; senhaVR = ''; }
    else if (senhaVR.length < 6) senhaVR += arg;
    redesenharLogo();
  }
  else if (nome === 'ir') { irPara(arg); pausar(false); }
  else if (nome === 'completar') { completarMissao(); pausar(false); }
  else if (nome === 'qps') { medidorQps = !medidorQps; redesenharLogo(); }
  else if (nome === 'atravessar') { jogador.atravessar = !jogador.atravessar; redesenharLogo(); }
}

// =====================================================================
// Missões: começar, recomeçar, pular (modo de teste)
// =====================================================================
const EVENTOS_DA_CENA: Record<string, string[]> = {
  sala_abertura: ['acender_faixas_chao'],
  ponte_navegacao: ['missao_completa_ponte', 'acender_luz_ponte'],
  treino_captura: ['missao_completa_treinamento', 'acender_luz_treinamento'],
  oficina_energia: ['missao_completa_oficina', 'acender_luz_oficina'],
  portal_saida: ['abrir_portal'],
  tunel_despedida: [],
};

/** Começa a cena de uma missão (o treinamento também solta os clones da máquina). */
function iniciarMissao(id: string): void {
  if (id === 'treino_captura') comecarTreino();
  if (id === 'tunel_despedida') { irParaOTunel(); return; }   // o túnel começa com a troca (escurece, leva o jogador)
  void iniciarCena(id);
}
/** A missão volta ao começo (o que o jogador mexeu volta para o lugar). */
function zerarMissao(id: string): void {
  if (id === 'ponte_navegacao') zerarPonte();
  if (id === 'treino_captura') zerarTreino();
  if (id === 'oficina_energia') zerarOficina();
  if (id === 'portal_saida' || id === 'tunel_despedida') zerarPortal();
}
/** As 3 luzes acesas: a faixa do chão até a câmara do portal acende. */
function conferirTresLuzes(instantaneo = false): void { if (tresLuzes() && !progresso.eventos.includes('acender_caminho_portal')) aplicarEvento('acender_caminho_portal', instantaneo); }

function marcarConcluida(id: string): void {
  if (!progresso.cenasConcluidas.includes(id)) progresso.cenasConcluidas.push(id);
  const r = diretor.rodando.get(id); if (r) { r.geracao++; r.estado = 'terminada'; if (diretor.ativa === r) diretor.ativa = null; }
  for (const e of EVENTOS_DA_CENA[id] ?? []) aplicarEvento(e, true);
  conferirTresLuzes(true);
  salvarProgresso();
}

function comecarAbertura(): void {
  const c = diretor.rodando.get('sala_abertura')!.cena;
  teleportar(c.jogador.pos, c.jogador.rotY);
  void iniciarCena('sala_abertura');
}

/** Qual missão "Reiniciar missão" reinicia: a que está tocando; senão, a última concluída; senão nenhuma (vira "Recomeçar jogo"). */
function missaoParaReiniciar(): string | null {
  if (diretor.ativa) return diretor.ativa.cena.id;
  const feitas = progresso.cenasConcluidas.filter((c) => c in EVENTOS_DA_CENA);
  return feitas.length ? feitas[feitas.length - 1] : null;
}

/** Volta uma missão para o começo, desfazendo o que ela mudou no mundo, e já começa de novo. */
function reiniciarMissao(id: string): void {
  diretor.forcarAguardar = false; sairDoFoco();
  if (id === 'sala_abertura') { recomecarJogo(); return; }  // a abertura é o começo do jogo
  zerarCena(id); desfazerEventos(EVENTOS_DA_CENA[id] ?? []);
  zerarMissao(id);
  const c = diretor.rodando.get(id)!.cena; teleportar(c.jogador.pos, c.jogador.rotY);
  iniciarMissao(id);
}

/** "Recomeçar jogo": tudo do zero, o jogador onde o jogo começa. */
function recomecarJogo(): void { zerarTudo(); comecarAbertura(); }
/** A nave volta ao estado do começo do jogo e o progresso salvo é apagado. */
function zerarTudo(): void {
  diretor.forcarAguardar = false; sairDoFoco();
  for (const c of CENAS_DO_JOGO) zerarCena(c);
  zerarAbertura(); zerarPonte(); zerarTreino(); zerarOficina(); zerarPortal();
  desfazerEventos([...Object.values(EVENTOS_DA_CENA).flat(), 'acender_caminho_portal']);
  apagarProgresso();
}
function recomecarMissao(): void { const id = missaoParaReiniciar(); if (id) reiniciarMissao(id); else recomecarJogo(); }

function irPara(id: string): void {
  diretor.forcarAguardar = false; sairDoFoco();
  if (id === 'sala_abertura') recomecarJogo();
  else if (id in EVENTOS_DA_CENA) {
    marcarConcluida('sala_abertura');
    if (id === 'portal_saida' || id === 'tunel_despedida') {
      // o final precisa das 3 missões feitas (modo de teste: completa as três)
      for (const m of ['ponte_navegacao', 'treino_captura', 'oficina_energia']) if (!progresso.cenasConcluidas.includes(m)) marcarConcluida(m);
      ponteConcluida(); completarTreino(); oficinaConcluida();
    }
    zerarCena(id); zerarMissao(id); desfazerEventos(EVENTOS_DA_CENA[id]);
    const c = diretor.rodando.get(id)!.cena; teleportar(c.jogador.pos, c.jogador.rotY);
    iniciarMissao(id);
  } else {
    marcarConcluida('sala_abertura');
    if (diretor.ativa) { const id = diretor.ativa.cena.id; zerarCena(id); zerarMissao(id); }
    teleportar([0, 0, 0.8], 0);
  }
}

/** "Completar a missão" do modo de teste: a ação que falta acontece sozinha e a cena segue até o fim. */
function completarMissao(): void {
  const m = missaoAtual();
  if (m === 'sala_abertura') abertura.pegouCaixa = true;
  if (m === 'ponte_navegacao') completarPonte();
  if (m === 'treino_captura') completarTreino();
  if (m === 'oficina_energia') completarOficina();
  if (m === 'portal_saida') completarPortal();
  diretor.forcarAguardar = true;
}

diretor.manual = (texto) => manualAbertura(texto) || manualPonte(texto) || manualTreino(texto) || manualOficina(texto) || manualPortal(texto);
diretor.aoEvento = (nome) => { aplicarEvento(nome); if (nome === 'ligar_console') ponte.tangramAtivo = true; if (nome === 'acender_led') trocarLedPeloAceso();
  if (nome === 'iniciar_tunel') irParaOTunel();
  if (nome === 'mostrar_creditos') { if (document.pointerLockElement) document.exitPointerLock(); mostrarCreditos(() => { abrirPainel('creditos'); redesenharLogo(); }); }
};
diretor.aoTerminar = (id) => {
  diretor.forcarAguardar = false;
  for (const e of EVENTOS_DA_CENA[id] ?? []) aplicarEvento(e, true);
  conferirTresLuzes();
};

// =====================================================================
// PC: mouse preso, câmera de foco do tangram
// =====================================================================
function prenderMouse(): void {
  if (entrada.modo !== 'pc' || !jogando) return;
  try { const p = tela.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => { avisoClique.hidden = false; }); } catch { avisoClique.hidden = false; }
}
let guardado: { pos: THREE.Vector3; yaw: number; pitch: number } | null = null;
let ultimoFoco: { pos: THREE.Vector3; alvo: THREE.Vector3 } | null = null;   // para a volta suave depois de sair do foco
let foco = 0; // 0 = normal, 1 = câmera no console (transição suave)
/** PC: a câmera parou num posto de montagem (tangram ou protoboard)? */
function emFoco(): boolean { return ponte.focoPC || oficina.focoPC; }
function sairDoFoco(): void { ponte.focoPC = false; oficina.focoPC = false; }

function aplicarFocoPC(dt: number): void {
  const alvo = emFoco() ? 1 : 0;
  if (alvo === 1 && !guardado) guardado = { pos: jogador.rig.position.clone(), yaw: entrada.pc.yaw, pitch: entrada.pc.pitch };
  foco = THREE.MathUtils.clamp(foco + Math.sign(alvo - foco) * dt * 2.5, 0, 1);
  if (foco === 0 && guardado && alvo === 0) {
    jogador.rig.position.copy(guardado.pos); entrada.pc.yaw = guardado.yaw; entrada.pc.pitch = guardado.pitch;
    jogador.rig.rotation.y = guardado.yaw; camera.rotation.set(guardado.pitch, 0, 0); camera.position.y = ALTURA_OLHOS;
    guardado = null; prenderMouse(); return;
  }
  if (!guardado) return;
  const f = oficina.focoPC ? cameraFocoOficinaPC() : ponte.focoPC ? cameraFocoPC() : ultimoFoco; if (!f) return;
  ultimoFoco = f;
  const k = foco * foco * (3 - 2 * foco);
  const d = f.alvo.clone().sub(f.pos);
  const yawF = Math.atan2(-d.x, -d.z), pitchF = Math.atan2(d.y, Math.hypot(d.x, d.z));
  const pos0 = guardado.pos.clone().setY(ALTURA_OLHOS);
  const p = pos0.lerp(f.pos, k);
  jogador.rig.position.set(p.x, 0, p.z); camera.position.y = p.y;
  let dy = yawF - guardado.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  jogador.rig.rotation.y = guardado.yaw + dy * k;
  camera.rotation.set(guardado.pitch + (pitchF - guardado.pitch) * k, 0, 0);
  entrada.pc.yaw = jogador.rig.rotation.y; entrada.pc.pitch = camera.rotation.x;
}

// =====================================================================
// VR: mãos, aviso perto da mão e medidor de quadros
// =====================================================================
function placaTexto(larg: number): { malha: THREE.Mesh; escrever: (t: string) => void } {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const malha = new THREE.Mesh(new THREE.PlaneGeometry(larg, larg * 160 / 1024), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  malha.renderOrder = 950; malha.visible = false;
  let atual = '';
  return { malha, escrever: (t: string) => {
    if (t === atual) return; atual = t; malha.visible = !!t; if (!t) return;
    const g = cv.getContext('2d')!; g.clearRect(0, 0, 1024, 160);
    g.font = "800 64px 'Baloo 2', sans-serif"; const w = Math.min(1000, g.measureText(t).width + 70);
    g.fillStyle = 'rgba(12,26,36,0.9)'; g.strokeStyle = C.lima; g.lineWidth = 5;
    g.beginPath(); g.roundRect((1024 - w) / 2, 20, w, 120, 40); g.fill(); g.stroke();
    g.fillStyle = C.texto; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 512, 84);
    tex.needsUpdate = true;
  } };
}
const dicaVR = placaTexto(0.3);
const qpsVR = placaTexto(0.16);
camera.add(qpsVR.malha); qpsVR.malha.position.set(-0.28, 0.22, -0.8);
cena3d.add(dicaVR.malha);

// =====================================================================
// Entrar no jogo
// =====================================================================
async function carregar(): Promise<void> {
  await Promise.all([carregarDados(), document.fonts.load("800 40px 'Baloo 2'"), document.fonts.load("700 40px 'Nunito'"), document.fonts.load("400 40px 'Nunito'")]);
  // o túnel fica longe da nave (no Editor de Cenas ele está na origem)
  const tunel = biblioteca.pacote?.cenas.find((c) => c.id === 'tunel_despedida'); if (tunel) deslocarCena(tunel, DESLOCAMENTO_TUNEL);
  await montarNave((k) => progressoCarregamento(Math.min(0.97, k)));
  montarPortal();
  void fetch(url('imagens/creditos_foto.jpg')).then(async (r) => { if (!r.ok || !/image/.test(r.headers.get('content-type') ?? '')) return;
    const b = await r.blob(); const fr = new FileReader(); fr.onload = () => { fotoCreditos = String(fr.result); }; fr.readAsDataURL(b); }).catch(() => {});
  registrarPortas();
  montarAbertura();
  montarPonte();
  montarOficina();
  await montarTreino();
  const atores = new Set(biblioteca.pacote!.cenas.flatMap((c) => c.atores.filter((a) => a.personagem || a.holograma || a.relogio).map((a) => a.id)));
  definirApoios((id) => seguraveis.has(id) || atores.has(id) || /^fora_|^porta_|ceu_nave|astros|titulo|arma_laser|led_circuito/.test(id));
  // colisão de todos os móveis (só para o jogador; o que está em cima deles não é empurrado)
  const NAO_MOVEL = /^(sala_|corredor_|porta_|mirante|janelao|astros|ceu_nave|faixas_chao|painel_luzes|fora_|titulo|alem_|tunel|portal$|led|resistor|jumper|arma_laser|lata_|balde_)/;
  const moveis = criarColisoresDeMoveis((inst) => !seguraveis.has(inst.id) && !atores.has(inst.id) && !NAO_MOVEL.test(inst.id));
  // console do tangram: colisor mais raso, para alcançar as peças do fundo (teste no Quest, 19/10)
  for (const w of instancias.get('console_tangram')?.paredes ?? []) if (w.movel) w.hz *= 0.6;
  console.info('móveis com colisão:', moveis.join(', '));
  // vibradinha ao tocar nos personagens (e nos clones soltos pela sala)
  registrarPersonagens(['gabura', 'gabura_gato', 'metalgabutron']);
  registrarFonteDeToque(clonesTocaveis);
  reduzirLuz(opcoes.reduzirLuz, biblioteca.pacote?.iluminacao);
  window.__sensibilidade = opcoes.sensibilidadeMouse;
  // o que já tinha acontecido nas outras vezes
  reaplicarEventosSalvos();
  if (progresso.cenasConcluidas.includes('ponte_navegacao')) ponteConcluida();
  if (progresso.cenasConcluidas.includes('treino_captura')) completarTreino();
  if (progresso.cenasConcluidas.includes('oficina_energia')) oficinaConcluida();
  conferirTresLuzes(true);
  await prepararSons(['sfx_passar_mao', 'sfx_segurar', 'sfx_soltar', 'sfx_caixa_impacto', 'sfx_porta_abrir', 'sfx_porta_fechar', 'sfx_botao_porta',
    'sfx_tangram_girar', 'sfx_tangram_encaixa', 'sfx_tangram_completo', 'sfx_encaixe_cyberdeck', 'mus_sala_central', 'mus_abertura',
    'sfx_alavanca_puxar', 'sfx_alavanca_travada', 'mus_creditos', 'sfx_arma_disparo', 'sfx_bolinha_esconderijo', 'sfx_captura', 'sfx_botao_nao_aperte', 'sfx_protoboard_encaixe', 'sfx_peca_errada', 'treino_gojo_001', 'treino_fred_001']);
  pronto = true;
  progressoCarregamento(1);
  renderizador.setAnimationLoop(quadro);
}

function comecarJogo(): void {
  jogando = true;
  esconderTelaInicial();
  iniciarAudio(); aplicarVolumesGrupos();
  prenderRelogio();
  if (!progresso.cenasConcluidas.includes('sala_abertura')) comecarAbertura();
  else if (!diretor.ativa) teleportar([0, 0, 0.8], 0);
}

async function jogarVR(): Promise<void> {
  // o pedido do VR e o som precisam sair direto do toque no botão (sem esperar nada antes)
  iniciarAudio();
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr) { avisarNaTela('este navegador não abre o VR: use o navegador do Meta Quest'); return; }
  try {
    const sessao = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    entrada.modo = 'vr';
    await renderizador.xr.setSession(sessao);
    marcarJogouVR();
    jogador.alturaExtra = opcoes.posicao === 'sentado' ? opcoes.ajusteAltura : 0;
    jogador.rig.position.set(0, 0, 0); jogador.rig.rotation.set(0, 0, 0); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
    comecarJogo();
    sessao.addEventListener('visibilitychange', () => { if (sessao.visibilityState !== 'visible' && !painelAberto()) pausar(true); });
    sessao.addEventListener('end', () => { jogando = false; entrada.modo = 'pc'; fecharPainel(); void pausarSom(true); camera.position.set(0, ALTURA_OLHOS, 0); mostrarTelaInicial(); });
  } catch (e) {
    console.warn(e); avisarNaTela('não deu para entrar no VR aqui: no Meta Quest, use o navegador do óculos');
  }
}

function jogarPC(): void {
  entrada.modo = 'pc';
  hud.hidden = false;
  comecarJogo();
  prenderMouse();
}

function sair(): void {
  fecharPainel(); void pausarSom(true); tocarMusica(null);
  if (entrada.modo === 'vr') { void renderizador.xr.getSession()?.end(); return; }
  jogando = false; hud.hidden = true; sairDoFoco();
  if (document.pointerLockElement) document.exitPointerLock();
  mostrarTelaInicial();
}

ligarControlesVR(renderizador, jogador.rig);
ligarPC(tela, () => { if (jogando && entrada.modo === 'pc' && !emFoco() && !painelAberto()) pausar(true); });
tela.addEventListener('mousedown', () => {
  if (!jogando || entrada.modo !== 'pc' || emFoco() || painelAberto()) return;
  if (!document.pointerLockElement) prenderMouse();
});
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) avisoClique.hidden = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden && jogando && !painelAberto()) pausar(true); });

iniciarPaineis(contexto, agir);
iniciarTelaInicial(app, { jogarVR: () => void jogarVR(), jogarPC, agirOpcao: (a, v) => { agirOpcao(a, v); }, contexto, temJogoSalvo, apagarJogo: zerarTudo });
// service worker: guarda o jogo para abrir sem internet (só no site publicado)
if ('serviceWorker' in navigator && import.meta.env.PROD) void navigator.serviceWorker.register('./sw.js').catch(() => {});
void carregar().catch((e) => { console.error(e); avisarNaTela('não deu para carregar a nave: ' + String(e)); });

// =====================================================================
// Cada quadro
// =====================================================================
const relogioQuadro = new THREE.Clock();
let nQps = 0, ultimoQps = 0, redesenhoTeste = 0;
const raioBotao = new THREE.Raycaster();

/** Só para os testes automáticos: acelera a simulação (o Chrome sem placa de vídeo roda a ~5 quadros por segundo). */
const testeTempo = { escala: 1 };
function quadro(): void {
  const dt = Math.min(0.05, relogioQuadro.getDelta()) * testeTempo.escala;
  if (!jogando) { renderizador.render(cena3d, camera); return; }
  if (entrada.modo === 'vr') lerVR(dt); else lerPC(dt, camera);

  // ---- menu ----
  if (entrada.menuBorda && portal.creditos < 0) {
    if (emFoco()) { sairDoFoco(); }
    else if (painelAberto()) pausar(false);
    else pausar(true);
  }
  const pausado = !!painelAberto();
  jogador.parado = pausado || emFoco() || foco > 0 || portal.creditos >= 0 || jogador.viajando;
  atualizarJogador(dt);
  if (entrada.modo === 'pc') aplicarFocoPC(dt);
  const agora = tempoGlobal();

  if (!pausado) {
    atualizarPortas(dt, agora);
    atualizarSeguraveis(dt, agora, emFoco());
    atualizarPonte(dt, false);
    atualizarTreino(dt, false);
    atualizarOficina(dt, false);
    atualizarPortal(dt, false);
    atualizarAbertura();
    atualizarToque(agora);
    usarBotoesDasPortas();
    comecarMissaoDaSala();
  }
  atualizarDiretor(dt, pausado);
  atualizarPortalDepois();
  atualizarTelaFinal(dt);
  // na câmera de foco do PC a seta da cena atrapalha a montagem
  if (emFoco()) apontar(null, camera.position, camera.position, 0);
  if (portal.creditos >= 0) tocarMusica('mus_creditos'); else atualizarMusica();
  atualizarEfeitosMundo();
  atualizarPaineis();
  if (entrada.pularFalaBorda && !pausado) pularFala();

  // ---- luzes, sombras, som 3D ----
  const olho = camera.getWorldPosition(new THREE.Vector3());
  atualizarLuzes(biblioteca.pacote?.iluminacao, olho, agora);
  const sombras: { id: string; raiz: THREE.Object3D; raio: number }[] = [];
  for (const id of ['gabura', ...CAIXAS, 'caixa_pizza_1', 'caixa_pizza_2', 'caixa_pizza_fatia']) { const i = instancias.get(id); if (i) sombras.push({ id, raiz: i.raiz, raio: i.raioSombra }); }
  atualizarSombras(sombras);
  atualizarOuvinte(camera);

  // ---- avisos ----
  atualizarDicas();
  if (painelAberto() === 'teste' && performance.now() - redesenhoTeste > 200) { redesenhoTeste = performance.now(); void redesenhar(); }
  nQps++;
  if (performance.now() - ultimoQps > 500) {
    const q = Math.round((nQps * 1000) / (performance.now() - ultimoQps)); nQps = 0; ultimoQps = performance.now();
    qpsPC.hidden = !medidorQps || entrada.modo === 'vr'; qpsPC.textContent = q + ' qps';
    qpsVR.escrever(medidorQps && entrada.modo === 'vr' ? q + ' qps' : '');
  }
  limparBordas();
  renderizador.render(cena3d, camera);
}

/** Cada missão começa quando o jogador entra na sala dela (depois da abertura, em qualquer ordem).
 *  Entrar na sala de outra missão com uma pela metade: a de antes volta ao começo (pode fazer de novo depois). */
function comecarMissaoDaSala(): void {
  if (!progresso.cenasConcluidas.includes('sala_abertura')) return;
  const pes = posicaoPes();
  const m = MISSOES.find((x) => x.dentro(pes)); if (!m) return;
  const r = diretor.rodando.get(m.id);
  if (!r || r.estado !== 'nao_iniciada' || diretor.ativa === r) return;
  if (diretor.ativa) {
    const antiga = diretor.ativa.cena.id;
    if (antiga === 'sala_abertura') return;
    sairDoFoco(); zerarCena(antiga); zerarMissao(antiga);
  }
  iniciarMissao(m.id);
}

/** Botões das portas: no VR também pelo raio + gatilho; no PC, mira + clique esquerdo. */
function usarBotoesDasPortas(): void {
  const m = entrada.maos.dir;
  if (!m.gatilhoBorda || emFoco()) return;
  const lista = botoesDasPortas(); if (!lista.length) return;
  raioBotao.set(m.mira.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).applyQuaternion(m.mira.getWorldQuaternion(new THREE.Quaternion())));
  raioBotao.far = 3;
  for (const b of lista) if (raioBotao.intersectObject(b.obj, true).length) { apertarBotao(b.porta); vibrarTipo('dir', 'encaixe'); return; }
}

function botaoNaMira(): boolean {
  const m = entrada.maos.dir;
  raioBotao.set(m.mira.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).applyQuaternion(m.mira.getWorldQuaternion(new THREE.Quaternion())));
  raioBotao.far = 3;
  return botoesDasPortas().some((b) => raioBotao.intersectObject(b.obj, true).length > 0);
}

let ultimaDica = '';
function atualizarDicas(): void {
  const pausado = !!painelAberto();
  if (entrada.modo === 'vr') {
    const fonte = [ponte, oficina, treino, portal].find((x) => x.dicaLado && x.dicaTexto);
    const lado = fonte?.dicaLado;
    if (fonte && lado && !pausado) {
      const p = entrada.maos[lado].pose.getWorldPosition(new THREE.Vector3()); p.y += 0.12;
      dicaVR.malha.position.copy(p); dicaVR.malha.lookAt(camera.getWorldPosition(new THREE.Vector3()));
      dicaVR.escrever(fonte.dicaTexto);
    } else dicaVR.escrever('');
    return;
  }
  // PC: texto curto embaixo da mira, conforme o que está na frente
  let t = '';
  if (!pausado) {
    const m = entrada.maos.dir;
    const dicaMissao = ponte.dicaTexto || oficina.dicaTexto || treino.dicaTexto || portal.dicaTexto;
    if (dicaMissao) t = dicaMissao;
    else if (segurando(m)) t = 'Clique direito: soltar';
    else if (objetoNaMao(m)) t = 'Clique direito: pegar';
    else if (botaoNaMira()) t = 'Clique: apertar o botão';
    else if (pedidoAtual() && /relógio/.test(pedidoAtual()!)) t = 'R: olhar o relógio';
  }
  if (t !== ultimaDica) { ultimaDica = t; dicaPC.textContent = t; dicaPC.hidden = !t; }
  miraPC.hidden = pausado || emFoco();
  // com a arma na mão, o aviso vai para baixo (não tapa a mira)
  dicaPC.classList.toggle('embaixo', emFoco() || segurandoArma());
}

// =====================================================================
// Para os testes automáticos no computador (Playwright)
// =====================================================================
declare global { interface Window { __jogo?: unknown } }
window.__jogo = {
  pronto: () => pronto, jogando: () => jogando, diretor, progresso, ponte, abertura, entrada, jogador, seguraveis, instancias, camera,
  agir, acionar, alvosAbertos, painelAberto, irPara, completarMissao, teleportar, tocar,
  pecas: _pecasTangram, lugares: _lugaresTangram, consoleParaMundo: _consoleParaMundo,
  portal, escuro: _escuro, historicoAvulsas, tocadasAvulsas, vozesJuntas, setaVisivel, capturarTeste: _capturarTeste, ctxAgora: () => contextoAudio().currentTime, testeTempo, treino, oficina, clones: _clones, oQueAcerta: _oQueAcerta, simularClones: _simular, atirarEm: _atirarEm, pecasOficina: _pecasOficina, alvosOficina: _alvosOficina,
  estadoCenas: () => [...diretor.rodando.values()].map((r) => ({ id: r.cena.id, estado: r.estado, t: +r.t.toFixed(2) })),
  pedido: pedidoAtual, ctx: () => contextoAudio().state, three: THREE, prenderRelogio, portasAbertas, grupoPainel,
};
