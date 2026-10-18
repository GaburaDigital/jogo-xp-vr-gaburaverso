// O mundo 3D: renderizador (com WebXR), cena, luzes, modelos da nave e dos personagens.
// Muito daqui vem do Editor de Cenas (src/mundo.ts do editor): holograma, boca pela voz, janela do portal
// e as caixas de colisão das salas. Assim o jogo fica igual ao que o autor aprovou no editor.

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { url } from '../nucleo/dados';
import type { Camada } from '../cenas/tocador';
import type { Iluminacao, Vec3 } from '../nucleo/modelo';

export let renderizador: THREE.WebGLRenderer;
export let cena3d: THREE.Scene;
export let camera: THREE.PerspectiveCamera;

// ---------- modelos ----------
const carregador = new GLTFLoader();
const cache = new Map<string, Promise<GLTF | null>>();
export function gltf(nome: string): Promise<GLTF | null> {
  let p = cache.get(nome);
  if (!p) {
    p = carregador.loadAsync(url('modelos/' + nome)).catch((e: unknown) => { console.warn('modelo não carregou', nome, e); return null; });
    cache.set(nome, p);
  }
  return p;
}

/** Caixa de parede vista de cima: centro, meia-largura, meia-espessura e giro (rad). */
export interface Parede { c: THREE.Vector3; hx: number; hz: number; rot: number; porta?: string }

/** Um osso da boca (do extras.gabura_fala do GLB). */
interface OssoBoca {
  no: THREE.Object3D; caminho: 'rotation' | 'translation' | 'scale'; modo: 'envelope' | 'padrao';
  fechado: number[]; aberto: number[]; desenho: THREE.Interpolant | null; duracao: number;
}

export interface Instancia {
  id: string;
  modelo: string;
  raiz: THREE.Group;
  obj: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  clipes: Map<string, THREE.AnimationClip>;
  acoes: Map<string, THREE.AnimationAction>;
  brilho: THREE.MeshStandardMaterial[];
  boca: OssoBoca[];
  paredes: Parede[];       // no espaço do mundo (salas e objetos grandes)
  raioSombra: number;
  holograma: boolean;
}
export const instancias = new Map<string, Instancia>();

export function iniciarMundo(caixa: HTMLElement): void {
  renderizador = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: true });
  renderizador.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderizador.outputColorSpace = THREE.SRGBColorSpace;
  renderizador.toneMapping = THREE.ACESFilmicToneMapping;
  renderizador.xr.enabled = true;
  renderizador.xr.setReferenceSpaceType('local-floor');
  renderizador.xr.setFoveation(1);
  caixa.append(renderizador.domElement);
  cena3d = new THREE.Scene();
  cena3d.background = new THREE.Color('#0a141c');
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
  camera.rotation.order = 'YXZ';
  iniciarLuzes();
  const ajustar = () => {
    const w = caixa.clientWidth || innerWidth, h = caixa.clientHeight || innerHeight;
    if (renderizador.xr.isPresenting) return;
    renderizador.setSize(w, h, false);
    renderizador.domElement.style.width = '100%'; renderizador.domElement.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(ajustar).observe(caixa); ajustar();
}

// ---------- holograma (igual ao editor) ----------
function materialHolograma(m: THREE.Material): THREE.Material {
  const n = m.clone() as THREE.MeshStandardMaterial;
  if (n.color) n.color = new THREE.Color('#b8e6ff');
  n.transparent = true; n.opacity = 0.82;
  if (n.emissive) n.emissive = new THREE.Color('#123a48');
  return n;
}
function virarHolograma(obj: THREE.Object3D, brilho: THREE.MeshStandardMaterial[]): void {
  const prof = new THREE.MeshBasicMaterial({ colorWrite: false });
  const malhas: THREE.Mesh[] = [];
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) malhas.push(o as THREE.Mesh); });
  for (const o of malhas) {
    o.material = Array.isArray(o.material) ? o.material.map(materialHolograma) : materialHolograma(o.material);
    o.renderOrder = 2;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => { if ((mt as THREE.MeshStandardMaterial).emissive) brilho.push(mt as THREE.MeshStandardMaterial); });
    let d: THREE.Mesh;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      const s = o as THREE.SkinnedMesh;
      const sd = new THREE.SkinnedMesh(s.geometry, prof); sd.bind(s.skeleton, s.bindMatrix); d = sd;
    } else d = new THREE.Mesh(o.geometry, prof);
    d.position.copy(o.position); d.quaternion.copy(o.quaternion); d.scale.copy(o.scale);
    d.renderOrder = 1; d.frustumCulled = false; o.frustumCulled = false;
    o.parent?.add(d);
  }
}

// ---------- boca pela voz (igual ao editor) ----------
const PROP_TRILHA = { rotation: 'quaternion', translation: 'position', scale: 'scale' } as const;
function lerBoca(obj: THREE.Object3D, animacoes: THREE.AnimationClip[]): OssoBoca[] {
  const info = obj.userData.gabura_fala as { boca?: { no: string; caminho: OssoBoca['caminho']; modo: OssoBoca['modo']; fechado: number[]; aberto: number[] }[] } | undefined;
  if (!info?.boca) return [];
  const falar = animacoes.find((a) => a.name === 'falar');
  const out: OssoBoca[] = [];
  for (const b of info.boca) {
    const no = obj.getObjectByName(b.no);
    if (!no) continue;
    const trilha = falar?.tracks.find((t) => t.name === `${THREE.PropertyBinding.sanitizeNodeName(b.no)}.${PROP_TRILHA[b.caminho]}`);
    out.push({ no, caminho: b.caminho, modo: b.modo, fechado: b.fechado, aberto: b.aberto,
      desenho: b.modo === 'padrao' && trilha ? trilha.createInterpolant() : null, duracao: falar?.duration || 1 });
  }
  return out;
}
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion();
function porNaBoca(o: OssoBoca, v: ArrayLike<number>): void {
  if (o.caminho === 'rotation') o.no.quaternion.set(v[0], v[1], v[2], v[3]);
  else if (o.caminho === 'translation') o.no.position.set(v[0], v[1], v[2]);
  else o.no.scale.set(v[0], v[1], v[2]);
}
function misturar(o: OssoBoca, de: ArrayLike<number>, para: ArrayLike<number>, k: number): number[] {
  if (o.caminho === 'rotation') { qA.set(de[0], de[1], de[2], de[3]); qB.set(para[0], para[1], para[2], para[3]); qA.slerp(qB, k); return [qA.x, qA.y, qA.z, qA.w]; }
  return [0, 1, 2].map((i) => de[i] + (para[i] - de[i]) * k);
}

// ---------- janela do portal (igual ao editor) ----------
function prepararJanelaPortal(raiz: THREE.Object3D, gp: { mascara: string; redemoinho: string; opacidade_redemoinho: number }): void {
  const masc = raiz.getObjectByName(gp.mascara) as THREE.Mesh | undefined;
  if (masc) {
    masc.material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    masc.renderOrder = 10;
  }
  const red = raiz.getObjectByName(gp.redemoinho) as THREE.Mesh | undefined;
  if (red) { const m = (red.material as THREE.Material).clone(); m.transparent = true; m.opacity = gp.opacidade_redemoinho; m.depthWrite = false; red.material = m; red.renderOrder = 20; }
}
function prepararAlemDoPortal(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const conv = (mt: THREE.Material) => { const n = mt.clone(); n.stencilWrite = true; n.stencilRef = 1; n.stencilFunc = THREE.EqualStencilFunc;
      n.stencilFail = THREE.KeepStencilOp; n.stencilZFail = THREE.KeepStencilOp; n.stencilZPass = THREE.KeepStencilOp; n.depthTest = false; return n; };
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    m.renderOrder = 11; m.frustumCulled = false;
  });
}

/** Caixas de colisão (salas e objetos grandes) no espaço do mundo. */
function lerParedes(obj: THREE.Object3D, raiz: THREE.Object3D): Parede[] {
  const out: Parede[] = [];
  raiz.updateMatrixWorld(true);
  obj.traverse((o) => {
    const d = (o.userData.gabura_sala ?? o.userData.gabura_objeto) as { colisores?: { c: number[]; t: number[]; rotY: number; porta?: string }[] } | undefined;
    if (!d?.colisores?.length) return;
    const giroBase = new THREE.Euler().setFromQuaternion(o.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
    const s = raiz.scale.x;
    for (const k of d.colisores) {
      const c = new THREE.Vector3(k.c[0], k.c[1], k.c[2]).applyMatrix4(o.matrixWorld);
      out.push({ c, hx: (k.t[0] / 2) * s, hz: (k.t[2] / 2) * s, rot: THREE.MathUtils.degToRad(k.rotY) + giroBase, porta: k.porta });
    }
  });
  return out;
}

export interface OpcoesInstancia { holograma?: boolean; alemDoPortal?: boolean; pos?: Vec3; rotY?: number; rotX?: number; escala?: number; }

/** Cria um objeto da cena a partir do .glb (cada instância é uma cópia, com seu próprio mixer). */
export async function criarInstancia(id: string, modelo: string, o: OpcoesInstancia = {}): Promise<Instancia> {
  const raiz = new THREE.Group(); raiz.name = id; raiz.userData.id = id;
  const inst: Instancia = { id, modelo, raiz, obj: null, mixer: null, clipes: new Map(), acoes: new Map(), brilho: [], boca: [], paredes: [], raioSombra: 0.3, holograma: !!o.holograma };
  instancias.set(id, inst);
  if (o.pos) posicionar(id, o.pos, o.rotY ?? 0, o.escala ?? 1, true, o.rotX ?? 0);
  cena3d.add(raiz);
  const g = await gltf(modelo);
  if (!g) return inst;
  const obj = SkeletonUtils.clone(g.scene);
  if (o.holograma) virarHolograma(obj, inst.brilho);
  raiz.add(obj);
  inst.obj = obj;
  inst.mixer = new THREE.AnimationMixer(obj);
  for (const cl of g.animations) inst.clipes.set(cl.name, cl);
  inst.boca = lerBoca(obj, g.animations);
  obj.traverse((x) => {
    if (x.name === 'casco') x.userData.casco = true;
    const gp = x.userData.gabura_portal as { mascara: string; redemoinho: string; opacidade_redemoinho: number } | undefined;
    if (gp) prepararJanelaPortal(x, gp);
  });
  if (o.alemDoPortal) prepararAlemDoPortal(obj);
  inst.paredes = lerParedes(obj, raiz);
  const b = new THREE.Box3().setFromObject(obj), t = b.getSize(new THREE.Vector3());
  inst.raioSombra = THREE.MathUtils.clamp(Math.max(t.x, t.z) * 0.55 * raiz.scale.x, 0.18, 0.9);
  return inst;
}

export function posicionar(id: string, pos: Vec3, rotY: number, escala: number, visivel: boolean, rotX = 0): void {
  const inst = instancias.get(id); if (!inst) return;
  inst.raiz.position.set(pos[0], pos[1], pos[2]);
  inst.raiz.rotation.order = 'YXZ';
  inst.raiz.rotation.y = THREE.MathUtils.degToRad(rotY);
  inst.raiz.rotation.x = THREE.MathUtils.degToRad(rotX);
  inst.raiz.scale.setScalar(escala);
  inst.raiz.visible = visivel;
}

/** Aplica as camadas de animação daquele instante (com a boca pela voz, como no editor). */
export function animar(id: string, camadasBrutas: Camada[], boca: { abertura: number; tempo: number } | null = null): void {
  const inst = instancias.get(id);
  if (!inst?.mixer) return;
  const porClipe = new Map<string, Camada>();
  for (const c of camadasBrutas) { const ja = porClipe.get(c.clipe); if (ja) ja.peso += c.peso; else porClipe.set(c.clipe, { ...c }); }
  for (const o of inst.boca) porNaBoca(o, o.fechado);
  const usadas = new Set<string>();
  for (const cam of porClipe.values()) {
    const clipe = inst.clipes.get(cam.clipe);
    if (!clipe) continue;
    let a = inst.acoes.get(cam.clipe);
    if (!a) { a = inst.mixer.clipAction(clipe); a.play(); inst.acoes.set(cam.clipe, a); }
    a.enabled = true; a.setEffectiveWeight(cam.peso);
    const d = clipe.duration || 1;
    a.time = cam.loop ? ((cam.tempo % d) + d) % d : Math.min(Math.max(cam.tempo, 0), d);
    usadas.add(cam.clipe);
  }
  for (const [nome, a] of inst.acoes) if (!usadas.has(nome)) a.enabled = false;
  inst.mixer.update(0);
  if (!boca) return;
  for (const o of inst.boca) {
    if (o.modo === 'padrao' && o.desenho) {
      const d = o.duracao, v = o.desenho.evaluate(((boca.tempo % d) + d) % d);
      porNaBoca(o, misturar(o, o.fechado, v, Math.pow(boca.abertura, 0.6)));
    } else porNaBoca(o, misturar(o, o.fechado, o.aberto, Math.pow(boca.abertura, 1.2)));
  }
}

/** Brilho do holograma no ritmo da voz (0 a 1). */
export function brilhar(id: string, nivel: number): void {
  const inst = instancias.get(id);
  if (inst) for (const m of inst.brilho) m.emissiveIntensity = 1 + 2.4 * nivel;
}

/** Centro de qualquer coisa do mundo pelo id. */
export function posicaoDe(id: string): THREE.Vector3 | null {
  const inst = instancias.get(id);
  if (!inst?.obj) return null;
  const b = new THREE.Box3().setFromObject(inst.raiz);
  return b.isEmpty() ? inst.raiz.getWorldPosition(new THREE.Vector3()) : b.getCenter(new THREE.Vector3());
}

// ---------- colisão do jogador e dos objetos com as paredes (igual ao Simular VR do editor) ----------
export const portasAbertas = new Set<string>();
/** Tira um círculo (centro p, raio r) de dentro das caixas das paredes. Devolve true se encostou. */
export function empurrarParaFora(p: THREE.Vector3, raio: number): boolean {
  let encostou = false;
  for (let passada = 0; passada < 2; passada++) {
    for (const inst of instancias.values()) {
      if (!inst.paredes.length || !inst.raiz.visible) continue;
      for (const w of inst.paredes) {
        if (w.porta && portasAbertas.has(w.porta)) continue;
        if (Math.abs(p.x - w.c.x) > w.hx + w.hz + raio + 0.5 && Math.abs(p.z - w.c.z) > w.hx + w.hz + raio + 0.5) continue;
        const co = Math.cos(w.rot), si = Math.sin(w.rot);
        const dx = p.x - w.c.x, dz = p.z - w.c.z;
        const lx = co * dx - si * dz, lz = si * dx + co * dz;
        const qx = Math.max(-w.hx, Math.min(w.hx, lx)), qz = Math.max(-w.hz, Math.min(w.hz, lz));
        let ex = lx - qx, ez = lz - qz;
        const d = Math.hypot(ex, ez);
        let nlx = lx, nlz = lz;
        if (d > 1e-6) {
          if (d >= raio) continue;
          ex /= d; ez /= d; nlx = qx + ex * raio; nlz = qz + ez * raio;
        } else {
          const px = w.hx - Math.abs(lx), pz = w.hz - Math.abs(lz);
          if (px < pz) nlx = Math.sign(lx || 1) * (w.hx + raio); else nlz = Math.sign(lz || 1) * (w.hz + raio);
        }
        p.x = w.c.x + co * nlx + si * nlz;
        p.z = w.c.z - si * nlx + co * nlz;
        encostou = true;
      }
    }
  }
  return encostou;
}

// ---------- seta holográfica (igual ao editor) ----------
let seta: THREE.Group;
function criarSeta(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#4fd6d0', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 10).rotateX(Math.PI / 2), mat); haste.position.z = 0.08;
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 16).rotateX(Math.PI / 2), mat); ponta.position.z = 0.3;
  g.add(haste, ponta); g.renderOrder = 5;
  return g;
}
export function apontar(alvo: string | null, olho: THREE.Vector3, direcao: THREE.Vector3, tempo: number): void {
  seta ??= (() => { const s = criarSeta(); cena3d.add(s); return s; })();
  const destino = alvo ? posicaoDe(alvo) : null;
  if (!destino) { seta.visible = false; return; }
  const plano = new THREE.Vector3(direcao.x, 0, direcao.z).normalize();
  seta.position.copy(olho).addScaledVector(plano, 0.7).add(new THREE.Vector3(0, -0.35 + Math.sin(tempo * 4) * 0.02, 0));
  seta.lookAt(destino);
  seta.scale.setScalar(1 + Math.sin(tempo * 6) * 0.08);
  seta.visible = true;
}

// =====================================================================
// Luzes (modo "Jogo no Quest" aprovado; "Reduzir efeitos de iluminação" = só a luz geral)
// =====================================================================
const VAGAS = 2, ACENDER = 1.2;
let ceu: THREE.HemisphereLight, sol: THREE.DirectionalLight;
let vagas: THREE.PointLight[] = [];
let reduzida = false;
const acesasDesde = new Map<string, number>();
let grupoSombras: THREE.Group;
let texturaSombra: THREE.Texture;
const sombras = new Map<string, THREE.Mesh>();

function iniciarLuzes(): void {
  ceu = new THREE.HemisphereLight('#cfeaff', '#1a2a33', 1.5);
  sol = new THREE.DirectionalLight('#ffffff', 0.9); sol.position.set(4, 10, 3);
  cena3d.add(ceu, sol, sol.target);
  vagas = [...Array(VAGAS)].map(() => { const l = new THREE.PointLight('#ffffff', 0, 10, 1); cena3d.add(l); return l; });
  grupoSombras = new THREE.Group(); cena3d.add(grupoSombras);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 4, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  texturaSombra = new THREE.CanvasTexture(c);
}

/** "Reduzir efeitos de iluminação": só a luz geral, sem as luzes coloridas. */
export function reduzirLuz(v: boolean, ilum?: Iluminacao): void {
  reduzida = v;
  const g = (v ? ilum?.geral?.sem_sombras : ilum?.geral?.jogo) ?? (v ? { ceu: 2.2, sol: 1.2 } : { ceu: 1.5, sol: 0.9 });
  ceu.intensity = g.ceu; sol.intensity = g.sol;
  for (const l of vagas) l.visible = !v; // a contagem de luzes não muda (o material não recompila)
}

/** Marca uma luz como acesa a partir de agora (evento da missão). */
export function acenderLuzDoEvento(evento: string, agora: number, instantaneo = false): void {
  if (!acesasDesde.has(evento)) acesasDesde.set(evento, instantaneo ? -1e9 : agora);
}
export function apagarLuzDoEvento(evento: string): void { acesasDesde.delete(evento); }

const corTmp = new THREE.Color();
/** A cada quadro: as 2 luzes acesas mais perto do jogador ocupam as vagas. */
export function atualizarLuzes(ilum: Iluminacao | undefined, olho: THREE.Vector3, agora: number): void {
  if (!ilum || reduzida) { for (const l of vagas) l.intensity = 0; return; }
  const lista = ilum.luzes.map((l) => {
    const desde = l.acende_evento ? acesasDesde.get(l.acende_evento) : -1e9;
    const v = desde === undefined ? 0 : THREE.MathUtils.clamp((agora - desde) / ACENDER, 0, 1);
    const ap = l.apagada ?? 0;
    return { l, v, f: ap + (1 - ap) * v, d: Math.hypot(l.pos[0] - olho.x, l.pos[1] - olho.y, l.pos[2] - olho.z) };
  }).filter((x) => x.f > 0.001).sort((a, b) => a.d - b.d).slice(0, VAGAS);
  vagas.forEach((pl, k) => {
    const x = lista[k];
    if (!x) { pl.intensity = 0; return; }
    pl.position.set(x.l.pos[0], x.l.pos[1], x.l.pos[2]);
    pl.color.set(x.l.cor_apagada ?? x.l.cor).lerp(corTmp.set(x.l.cor), x.v);
    pl.distance = x.l.alcance; pl.decay = 1; pl.intensity = x.l.intensidade * x.f;
  });
}

/** Sombra redonda embaixo dos personagens. */
export function atualizarSombras(lista: { id: string; raiz: THREE.Object3D; raio: number }[]): void {
  const vistos = new Set<string>();
  const w = new THREE.Vector3();
  for (const p of lista) {
    let s = sombras.get(p.id);
    if (!s) {
      s = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: texturaSombra, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      s.renderOrder = 3; grupoSombras.add(s); sombras.set(p.id, s);
    }
    vistos.add(p.id);
    p.raiz.getWorldPosition(w);
    const noChao = p.raiz.visible && w.y < 0.6;
    s.visible = noChao;
    if (!noChao) continue;
    s.position.set(w.x, 0.012, w.z); s.scale.setScalar(p.raio * (1 - Math.max(0, w.y) * 0.5));
  }
  for (const [id, s] of sombras) if (!vistos.has(id)) { grupoSombras.remove(s); sombras.delete(id); }
}
