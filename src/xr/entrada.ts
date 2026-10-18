// Entrada do jogador em "ações", iguais no VR e no PC: andar, girar, usar (gatilho/clique esquerdo),
// segurar (grip/clique direito), relógio (X/R), menu (Y/Esc). As missões só olham as ações,
// por isso a mesma missão funciona no Quest e no computador.
//
// Quest (xr-standard): botões[0] gatilho, [1] grip, [3] analógico, [4] A/X, [5] B/Y; eixos[2,3] analógico.
// O botão ≡ do controle esquerdo não chega ao navegador no WebXR; por isso o Y abre o menu.

import * as THREE from 'three';

export type Lado = 'esq' | 'dir';

export interface Mao {
  lado: Lado;
  conectada: boolean;
  pose: THREE.Group;        // onde a mão está (grip): é aqui que os objetos ficam presos
  mira: THREE.Group;        // de onde sai o raio (aponta para -Z)
  fonte: XRInputSource | null;
  gatilho: boolean; gatilhoBorda: boolean; gatilhoSoltou: boolean;
  segurar: boolean; segurarBorda: boolean; segurarSoltou: boolean;
  velocidade: THREE.Vector3; // m/s (para jogar objetos)
  anterior: THREE.Vector3;
}

function novaMao(lado: Lado): Mao {
  return { lado, conectada: false, pose: new THREE.Group(), mira: new THREE.Group(), fonte: null,
    gatilho: false, gatilhoBorda: false, gatilhoSoltou: false, segurar: false, segurarBorda: false, segurarSoltou: false,
    velocidade: new THREE.Vector3(), anterior: new THREE.Vector3() };
}

export const entrada = {
  modo: 'pc' as 'vr' | 'pc',
  maos: { esq: novaMao('esq'), dir: novaMao('dir') } as Record<Lado, Mao>,
  andar: new THREE.Vector2(),    // x = lado, y = frente (-1 a 1)
  girar: 0,                      // -1 a 1 (analógico direito)
  relogioBorda: false,           // X (VR) ou R (PC)
  menuBorda: false,              // Y (VR) ou Esc (PC)
  pularFalaBorda: false,         // Espaço (PC)
  trocarMaoBorda: false,         // Q (PC)
  botoesVivos: new Set<string>(), // para a tela dos botões do modo de teste
  // PC
  pc: { yaw: 0, pitch: 0, preso: false, teclas: new Set<string>(), mouse: new THREE.Vector2(), cliqueEsq: false, cliqueDir: false,
    rodaPassos: 0, cliqueEsqBorda: false, cliqueEsqSoltou: false, cliqueDirBorda: false },
};

// ---------- VR ----------
export function ligarControlesVR(renderizador: THREE.WebGLRenderer, rig: THREE.Object3D): void {
  for (let i = 0; i < 2; i++) {
    const mira = renderizador.xr.getController(i);
    const grip = renderizador.xr.getControllerGrip(i);
    rig.add(mira, grip);
    mira.addEventListener('connected', (e) => {
      const fonte = (e as unknown as { data: XRInputSource }).data;
      const lado: Lado = fonte.handedness === 'left' ? 'esq' : 'dir';
      const m = entrada.maos[lado];
      m.conectada = true; m.fonte = fonte;
      // os grupos que o resto do jogo usa ficam dentro dos do Three (que seguem o controle)
      mira.add(m.mira); grip.add(m.pose);
    });
    mira.addEventListener('disconnected', () => {
      for (const m of Object.values(entrada.maos)) if (m.mira.parent === mira) { m.conectada = false; m.fonte = null; mira.remove(m.mira); grip.remove(m.pose); }
    });
  }
}

const anteriorBotoes = new Map<string, boolean>();
function borda(chave: string, agora: boolean): boolean { const a = anteriorBotoes.get(chave) ?? false; anteriorBotoes.set(chave, agora); return agora && !a; }
function soltou(chave: string, agora: boolean): boolean { const a = anteriorBotoes.get(chave + '_s') ?? false; anteriorBotoes.set(chave + '_s', agora); return !agora && a; }

/** Lê os controles do Quest a cada quadro. */
export function lerVR(dt: number): void {
  entrada.andar.set(0, 0); entrada.girar = 0; entrada.relogioBorda = false; entrada.menuBorda = false;
  entrada.botoesVivos.clear();
  for (const m of Object.values(entrada.maos)) {
    const gp = m.fonte?.gamepad;
    const bt = (i: number) => !!gp?.buttons[i]?.pressed;
    m.gatilho = bt(0); m.segurar = bt(1) || (gp?.buttons[1]?.value ?? 0) > 0.6;
    m.gatilhoBorda = borda(m.lado + 'g', m.gatilho); m.gatilhoSoltou = soltou(m.lado + 'g', m.gatilho);
    m.segurarBorda = borda(m.lado + 's', m.segurar); m.segurarSoltou = soltou(m.lado + 's', m.segurar);
    const ax = gp?.axes ?? [];
    const sx = ax.length >= 4 ? ax[2] : ax[0] ?? 0, sy = ax.length >= 4 ? ax[3] : ax[1] ?? 0;
    const morto = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    if (m.lado === 'esq') {
      entrada.andar.set(morto(sx), -morto(sy));
      if (borda('x', bt(4))) entrada.relogioBorda = true;
      if (borda('y', bt(5))) entrada.menuBorda = true;
      if (bt(4)) entrada.botoesVivos.add('X'); if (bt(5)) entrada.botoesVivos.add('Y');
      if (m.gatilho) entrada.botoesVivos.add('gatilho E'); if (m.segurar) entrada.botoesVivos.add('grip E');
      if (gp && gp.buttons.length > 6) for (let i = 6; i < gp.buttons.length; i++) if (gp.buttons[i]?.pressed) { entrada.botoesVivos.add('≡'); if (borda('menu' + i, true)) entrada.menuBorda = true; }
    } else {
      entrada.girar = morto(sx);
      if (bt(4)) entrada.botoesVivos.add('A'); if (bt(5)) entrada.botoesVivos.add('B');
      if (m.gatilho) entrada.botoesVivos.add('gatilho D'); if (m.segurar) entrada.botoesVivos.add('grip D');
    }
    const p = m.pose.getWorldPosition(new THREE.Vector3());
    if (dt > 0) m.velocidade.copy(p).sub(m.anterior).divideScalar(dt);
    m.anterior.copy(p);
  }
}

/** Vibração curta no controle (o relógio vibrando). */
export function vibrar(lado: Lado, forca = 0.6, ms = 120): void {
  const gp = entrada.maos[lado].fonte?.gamepad as (Gamepad & { hapticActuators?: { pulse: (v: number, d: number) => Promise<boolean> }[] }) | undefined;
  try { void gp?.hapticActuators?.[0]?.pulse(forca, ms); } catch { /* sem vibração */ }
}

// ---------- PC ----------
export function ligarPC(tela: HTMLCanvasElement, aoSoltarMouse: () => void): void {
  const pc = entrada.pc;
  tela.addEventListener('contextmenu', (e) => e.preventDefault());
  tela.addEventListener('mousedown', (e) => {
    if (e.button === 0) { pc.cliqueEsq = true; pc.cliqueEsqBorda = true; }
    if (e.button === 2) { pc.cliqueDir = true; pc.cliqueDirBorda = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) { pc.cliqueEsq = false; pc.cliqueEsqSoltou = true; }
    if (e.button === 2) pc.cliqueDir = false;
  });
  tela.addEventListener('mousemove', (e) => {
    const r = tela.getBoundingClientRect();
    pc.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  document.addEventListener('mousemove', (e) => {
    if (!pc.preso) return;
    pc.yaw -= e.movementX * 0.0022 * (window.__sensibilidade ?? 1);
    pc.pitch = THREE.MathUtils.clamp(pc.pitch - e.movementY * 0.0022 * (window.__sensibilidade ?? 1), -1.4, 1.4);
  });
  tela.addEventListener('wheel', (e) => { pc.rodaPassos += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  document.addEventListener('pointerlockchange', () => {
    const antes = pc.preso;
    pc.preso = document.pointerLockElement === tela;
    if (antes && !pc.preso) { pc.teclas.clear(); aoSoltarMouse(); } // Esc solta o mouse: abre o menu
  });
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { pc.teclas.add(k); e.preventDefault(); }
    if (k === 'r' && !e.repeat) entrada.relogioBorda = true;
    if (k === 'q' && !e.repeat) entrada.trocarMaoBorda = true;
    if (k === ' ' && !e.repeat) { entrada.pularFalaBorda = true; e.preventDefault(); }
    // sem o mouse preso, o Esc chega aqui; com ele preso, o navegador costuma soltar sozinho (e o jogo pausa)
    if (k === 'escape') { if (!pc.preso) entrada.menuBorda = true; else document.exitPointerLock(); }
  });
  window.addEventListener('keyup', (e) => pc.teclas.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => pc.teclas.clear());
}

declare global { interface Window { __sensibilidade?: number } }

/** Lê teclado e mouse a cada quadro (a mão direita do PC fica na frente da câmera). */
export function lerPC(dt: number, camera: THREE.Camera): void {
  const pc = entrada.pc, t = pc.teclas;
  const f = (t.has('w') || t.has('arrowup') ? 1 : 0) - (t.has('s') || t.has('arrowdown') ? 1 : 0);
  const l = (t.has('d') || t.has('arrowright') ? 1 : 0) - (t.has('a') || t.has('arrowleft') ? 1 : 0);
  entrada.andar.set(l, f);
  entrada.girar = 0;
  const m = entrada.maos.dir;
  m.conectada = true;
  m.gatilho = pc.cliqueEsq; m.gatilhoBorda = pc.cliqueEsqBorda; m.gatilhoSoltou = pc.cliqueEsqSoltou;
  // clique direito alterna segurar/soltar
  m.segurarBorda = pc.cliqueDirBorda; m.segurarSoltou = false;
  pc.cliqueEsqBorda = false; pc.cliqueEsqSoltou = false; pc.cliqueDirBorda = false;
  // a "mão" fica 45 cm à frente, um pouco à direita e abaixo; o raio sai do centro da tela (ou do mouse solto)
  m.mira.position.copy(camera.getWorldPosition(new THREE.Vector3()));
  m.mira.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
  if (!pc.preso) {
    const dir = new THREE.Vector3(pc.mouse.x, pc.mouse.y, 0.5).unproject(camera as THREE.PerspectiveCamera).sub(m.mira.position).normalize();
    m.mira.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
  }
  m.mira.updateMatrixWorld(true);
  const p = new THREE.Vector3(0.18, -0.2, -0.45).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())).add(camera.getWorldPosition(new THREE.Vector3()));
  m.pose.position.copy(p); m.pose.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion())); m.pose.updateMatrixWorld(true);
  if (dt > 0) m.velocidade.copy(p).sub(m.anterior).divideScalar(dt);
  m.anterior.copy(p);
}

/** No fim do quadro: bordas já consumidas. */
export function limparBordas(): void {
  entrada.relogioBorda = false; entrada.menuBorda = false; entrada.pularFalaBorda = false; entrada.trocarMaoBorda = false;
  entrada.pc.rodaPassos = 0;
}
