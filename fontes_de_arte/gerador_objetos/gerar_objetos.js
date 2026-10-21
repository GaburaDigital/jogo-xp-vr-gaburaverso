// Gerador dos objetos da ponte (Gaburaverso, jogo 1).
// Uso: gerar_o.html?o=porta&tipo=auto|botao|portal  (ou o=janela, astros, mesa, pizza, caneca, cyberdeck, console)
// Regras: medidas em metros, frente para +Z, chão em y = 0; cores por vértice;
// material "cores" (comum) e "brilho" (sem luz, só para telas e LEDs).
// Peças que o jogo mexe são nós separados com nome. "Acender" = esconder a capa apagada
// que fica 1 mm na frente da parte acesa (clipe de escala 1 → 0).
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const Q = new URLSearchParams(location.search);
const OBJ = Q.get('o') || 'mesa';
const TIPO = Q.get('tipo') || 'auto';

// ---------- Paleta (manual Gaburaverso + model sheets aprovados) ----------
const COR = {
  creme: '#efe8d8', marinho: '#26303d', marinho_claro: '#323e4d', cinza: '#8d98a4', preto: '#14181d',
  aqua: '#4fd6d0', lima: '#8fd651', petroleo: '#0c1a24', petroleo_claro: '#1f3a48', violeta: '#7b4fd6', lavanda: '#c9b6ff',
  coral: '#ff7a6b', amarelo: '#e2a72e', queijo: '#f4d58a', borda_pizza: '#d2ad74', calabresa: '#c0392b',
  papelao: '#c9a46b', papelao_escuro: '#a7804b', oliva: '#5f6b3a', oliva_escuro: '#3c4426',
  tela_verde: '#6f8a76', tela_brilho: '#c9dccd', moldura_tela: '#1d2328', vermelho: '#b3302a', cabo: '#6b7680', cafe: '#3b2418',
  branco: '#f6f3ea',
};
const MAT = {
  cores: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, name: 'nave_cores' }),
  brilho: new THREE.MeshBasicMaterial({ vertexColors: true, name: 'nave_brilho' }),
  vidro: new THREE.MeshStandardMaterial({ color: '#9fe8e4', transparent: true, opacity: 0.12, roughness: 0.1, name: 'nave_vidro', depthWrite: false }),
};
const deg = THREE.MathUtils.degToRad;

// ---------- Ajudantes ----------
// Prepara uma geometria: aplica transformação, deixa só posição+normal e pinta.
function pintar(geo, cor, m) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
  if (!g.attributes.normal) g.computeVertexNormals();
  g = mergeVertices(g, 1e-5);
  const c = new THREE.Color(cor); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const M = (pos = [0, 0, 0], rot = [0, 0, 0], esc = [1, 1, 1]) => new THREE.Matrix4().compose(
  new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...esc));
// Uma "malha" é um balde de peças que vira um nó só no final.
class Balde {
  constructor() { this.comum = []; this.brilho = []; }
  add(geo, cor, m, brilha = false) { (brilha ? this.brilho : this.comum).push(pintar(geo, cor, m)); return this; }
  malha(nome) {
    const grupos = [], mats = [];
    if (this.comum.length) { grupos.push(mergeGeometries(this.comum)); mats.push(MAT.cores); }
    if (this.brilho.length) { grupos.push(mergeGeometries(this.brilho)); mats.push(MAT.brilho); }
    const g = grupos.length > 1 ? mergeGeometries(grupos, true) : grupos[0];
    const mesh = new THREE.Mesh(g, mats.length > 1 ? mats : mats[0]); mesh.name = nome; return mesh;
  }
}
const caixa = (w, h, d, r = 0) => (r <= 0.004 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, r));
const cil = (r, h, s = 12) => new THREE.CylinderGeometry(r, r, h, s);
// Placa recortada: forma 2D (x, y) extrudada em Z, centrada na espessura
function placa(forma, esp, seg = 8) {
  const g = new THREE.ExtrudeGeometry(forma, { depth: esp, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -esp / 2); return g;
}
function retArred(f, x0, y0, x1, y1, rTopo, rBase = 0) {
  f.moveTo(x0 + rBase, y0); f.lineTo(x1 - rBase, y0);
  if (rBase) f.quadraticCurveTo(x1, y0, x1, y0 + rBase);
  f.lineTo(x1, y1 - rTopo); if (rTopo) f.absarc(x1 - rTopo, y1 - rTopo, rTopo, 0, Math.PI / 2, false);
  f.lineTo(x0 + rTopo, y1); if (rTopo) f.absarc(x0 + rTopo, y1 - rTopo, rTopo, Math.PI / 2, Math.PI, false);
  f.lineTo(x0, y0 + rBase); if (rBase) f.quadraticCurveTo(x0, y0, x0 + rBase, y0);
  return f;
}
const no = (nome, filhos = [], pos = [0, 0, 0], rot = [0, 0, 0]) => {
  const o = new THREE.Group(); o.name = nome; o.position.set(...pos); o.rotation.set(...rot);
  for (const f of filhos) o.add(f); return o;
};
const trilhaEsc = (nome, t, v) => new THREE.VectorKeyframeTrack(nome + '.scale', t, v.flatMap((s) => [s, s, s]));
const trilhaPos = (nome, t, v) => new THREE.VectorKeyframeTrack(nome + '.position', t, v.flat());
const trilhaRot = (nome, t, eul) => new THREE.QuaternionKeyframeTrack(nome + '.quaternion', t,
  eul.flatMap(([x, y, z]) => new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(x), deg(y), deg(z))).toArray()));
// Suaviza um movimento A → B em vários quadros (entra e sai devagar)
function suave(t0, t1, a, b, n = 6) {
  const ts = [], vs = [];
  for (let i = 0; i <= n; i++) { const k = i / n; const e = k * k * (3 - 2 * k); ts.push(t0 + (t1 - t0) * k); vs.push(a.map((x, j) => x + (b[j] - x) * e)); }
  return [ts, vs];
}

const raiz = new THREE.Group(); const clipes = [];

// =====================================================================
// 1. PORTA AUTOMÁTICA (tipo: auto | botao | portal)
// =====================================================================
function porta() {
  raiz.name = TIPO === 'auto' ? 'porta_ponte' : TIPO === 'botao' ? 'porta_botao' : 'porta_portal';
  const PROF = 0.6;
  // Moldura: retângulo com topo arredondado, furo do vão (2,0 × 2,4 com cantos de 0,5)
  // Forma em "U" (o vão toca o chão, então não pode ser furo)
  const fora = new THREE.Shape();
  fora.moveTo(-1.4, 0); fora.lineTo(-1.0, 0); fora.lineTo(-1.0, 1.9); fora.absarc(-0.5, 1.9, 0.5, Math.PI, Math.PI / 2, true);
  fora.lineTo(0.5, 2.4); fora.absarc(0.5, 1.9, 0.5, Math.PI / 2, 0, true); fora.lineTo(1.0, 0); fora.lineTo(1.4, 0);
  fora.lineTo(1.4, 2.05); fora.absarc(0.7, 2.05, 0.7, 0, Math.PI / 2, false); fora.lineTo(-0.7, 2.75);
  fora.absarc(-0.7, 2.05, 0.7, Math.PI / 2, Math.PI, false); fora.lineTo(-1.4, 0);
  const moldura = new Balde();
  moldura.add(placa(fora, PROF, 5), COR.creme); // 5 segmentos por curva: leve, quase sem facetas a 1 m
  moldura.add(caixa(2.0, 0.012, PROF), COR.preto, M([0, 0.006, 0])); // soleira
  moldura.add(caixa(2.0, 0.05, 0.06), COR.marinho, M([0, 0.025, 0])); // trilho
  const nos = [moldura.malha('moldura')];

  // Faixa de luz em cima (frente e verso). Acesa embaixo, capa apagada 1 mm na frente.
  const corLuz = TIPO === 'portal' ? COR.violeta : COR.lima;
  const faixaGeo = caixa(1.0, 0.1, 0.012);
  const acesa = new Balde(), apagada = new Balde();
  for (const z of [1, -1]) {
    acesa.add(faixaGeo, corLuz, M([0, 2.58, z * (PROF / 2 + 0.004)]), true);
    apagada.add(caixa(1.004, 0.104, 0.004), COR.marinho_claro, M([0, 2.58, z * (PROF / 2 + 0.012)]));
  }
  nos.push(acesa.malha('faixa_acesa'), apagada.malha('faixa_apagada'));

  // Folhas: metade do vão cada, com escotilha redonda (aro cinza + vidro aqua)
  function folha(lado) {
    const s = lado === 'L' ? -1 : 1;
    const f = new THREE.Shape();
    if (s < 0) { f.moveTo(-1, 0.05); f.lineTo(0, 0.05); f.lineTo(0, 2.4); f.lineTo(-0.5, 2.4); f.absarc(-0.5, 1.9, 0.5, Math.PI / 2, Math.PI, false); f.lineTo(-1, 0.05); }
    else { f.moveTo(0, 0.05); f.lineTo(1, 0.05); f.lineTo(1, 1.9); f.absarc(0.5, 1.9, 0.5, 0, Math.PI / 2, false); f.lineTo(0, 2.4); f.lineTo(0, 0.05); }
    const b = new Balde();
    b.add(placa(f, 0.06, 4), COR.marinho);
    b.add(cil(0.22, 0.08, 10), COR.cinza, M([s * 0.42, 1.5, 0], [Math.PI / 2, 0, 0]));
    b.add(cil(0.16, 0.09, 10), COR.aqua, M([s * 0.42, 1.5, 0], [Math.PI / 2, 0, 0]));
    b.add(caixa(0.02, 2.2, 0.065), COR.marinho_claro, M([s * 0.01, 1.17, 0])); // vedação do meio
    return b.malha('folha_' + lado);
  }
  nos.push(folha('L'), folha('R'));

  if (TIPO === 'botao') {
    // Painel ao lado, a 1,1 m do chão; o botão é um nó para afundar quando apertado
    const p = new Balde();
    p.add(caixa(0.22, 0.32, 0.04, 0.02), COR.marinho_claro, M([1.62, 1.1, PROF / 2 - 0.02]));
    p.add(cil(0.075, 0.012, 12), COR.creme, M([1.62, 1.1, PROF / 2 + 0.004], [Math.PI / 2, 0, 0]));
    nos.push(p.malha('painel'));
    const bt = new Balde(); bt.add(cil(0.055, 0.04, 12), COR.lima, M([0, 0, 0], [Math.PI / 2, 0, 0]));
    nos.push(no('botao', [bt.malha('botao_malha')], [1.62, 1.1, PROF / 2 + 0.02]));
    const [t, v] = suave(0, 0.12, [1.62, 1.1, PROF / 2 + 0.02], [1.62, 1.1, PROF / 2 + 0.002], 3);
    const [t2, v2] = suave(0.12, 0.3, v[v.length - 1], v[0], 3);
    clipes.push(new THREE.AnimationClip('apertar', 0.3, [trilhaPos('botao', [...t, ...t2.slice(1)], [...v, ...v2.slice(1)])]));
  }
  if (TIPO === 'portal') {
    // 3 luzes (uma por missão), na frente e no verso, acima da faixa violeta
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.34;
      const a = new Balde(), c = new Balde();
      for (const z of [1, -1]) {
        a.add(cil(0.06, 0.012, 10), [COR.aqua, COR.violeta, COR.amarelo][i], M([x, 2.665, z * (PROF / 2 + 0.006)], [Math.PI / 2, 0, 0]), true);
        c.add(cil(0.062, 0.004, 10), COR.marinho_claro, M([x, 2.665, z * (PROF / 2 + 0.014)], [Math.PI / 2, 0, 0]));
      }
      nos.push(a.malha(`luz_${i}_acesa`), c.malha(`luz_${i}_apagada`));
    }
    clipes.push(new THREE.AnimationClip('acender_luzes', 3, [0, 1, 2].map((i) => trilhaEsc(`luz_${i}_apagada`, [0, 0.6 + i * 0.8, 0.62 + i * 0.8, 3], [1, 1, 0, 0]))));
  }
  for (const n of nos) raiz.add(n);
  // Abrir / fechar: folhas correm 0,98 m para dentro da parede; faixa acende
  const [ta, va] = suave(0.1, 1.2, [0, 0, 0], [-0.98, 0, 0], 8);
  const [, vb] = suave(0.1, 1.2, [0, 0, 0], [0.98, 0, 0], 8);
  const ab = [trilhaPos('folha_L', [0, ...ta], [[0, 0, 0], ...va]), trilhaPos('folha_R', [0, ...ta], [[0, 0, 0], ...vb]),
    trilhaEsc('faixa_apagada', [0, 0.08, 0.1, 1.2], [1, 1, 0, 0])];
  clipes.push(new THREE.AnimationClip('abrir', 1.2, ab));
  const [tf, vf] = suave(0, 1.1, [-0.98, 0, 0], [0, 0, 0], 8); const [, vg] = suave(0, 1.1, [0.98, 0, 0], [0, 0, 0], 8);
  clipes.push(new THREE.AnimationClip('fechar', 1.2, [trilhaPos('folha_L', [...tf, 1.2], [...vf, [0, 0, 0]]), trilhaPos('folha_R', [...tf, 1.2], [...vg, [0, 0, 0]]),
    trilhaEsc('faixa_apagada', [0, 1.1, 1.12, 1.2], [0, 0, 1, 1])]));
  if (TIPO === 'portal') { /* a porta do portal só abre quando as 3 luzes estiverem acesas (lógica do jogo) */ }
}

// =====================================================================
// 2. JANELÃO PANORÂMICO: arco de ~11 m, 5 vidros; côncavo para +Z (para o jogador)
// =====================================================================
function janela({ nome = 'janelao', R = 7, N = 5, passo = deg(18) } = {}) {
  raiz.name = nome;
  const PASSO = passo, CORDA = 2 * R * Math.sin(PASSO / 2);
  const b = new Balde(); const vidros = [];
  const ponto = (a) => [R * Math.sin(a), R - R * Math.cos(a)]; // x, z
  for (let i = 0; i < N; i++) {
    const a = (i - (N - 1) / 2) * PASSO; const [x, z] = ponto(a); const rot = [0, -a, 0];
    const fora = (d) => [x - Math.sin(a) * -d, z - Math.cos(a) * d]; // desloca para fora (-normal) d metros
    const [bx, bz] = fora(0.05);
    b.add(caixa(CORDA + 0.02, 0.85, 0.22), COR.marinho, M([bx, 0.425, bz], rot)); // base escura
    const [px, pz] = fora(-0.05);
    b.add(caixa(CORDA + 0.04, 0.06, 0.36, 0.02), COR.creme, M([px, 0.88, pz], rot)); // parapeito
    b.add(caixa(CORDA + 0.04, 0.22, 0.26), COR.creme, M([bx, 2.71, bz], rot)); // viga de cima
    const vg = new THREE.PlaneGeometry(CORDA, 1.72); vg.applyMatrix4(M([x, 1.74, z], rot)); vidros.push(vg);
  }
  // Montantes nas junções (6), azul-marinho
  for (let i = 0; i <= N; i++) {
    const a = (i - N / 2) * PASSO; const [x, z] = ponto(a);
    b.add(caixa(0.14, 1.76, 0.2, 0.03), COR.marinho, M([x + Math.sin(a) * 0.04, 1.74, z - Math.cos(a) * 0.04], [0, -a, 0]));
  }
  raiz.add(b.malha('moldura'));
  const vidro = new THREE.Mesh(mergeGeometries(vidros), MAT.vidro); vidro.name = 'vidro'; raiz.add(vidro);
}

// =====================================================================
// 2b. ASTROS GEOMÉTRICOS (lá fora). Cada um é um nó: o jogo instancia cópias.
// =====================================================================
function astros() {
  raiz.name = 'astros';
  const flat = (g) => g.toNonIndexed(); // facetado (low-poly de verdade)
  const add = (nome, b, pos) => { const m = b.malha(nome); m.position.set(...pos); raiz.add(m); };
  add('planeta_violeta', new Balde().add(flat(new THREE.IcosahedronGeometry(3, 1)), COR.violeta), [-9, 4, -30]);
  const anel = new Balde().add(flat(new THREE.IcosahedronGeometry(2, 1)), COR.lavanda)
    .add(new THREE.TorusGeometry(3.1, 0.18, 4, 28), COR.aqua, M([0, 0, 0], [deg(72), deg(12), 0], [1, 1, 0.35]));
  add('planeta_anel', anel, [10, 7, -36]);
  add('lua_cubo', new Balde().add(caixa(1.6, 1.6, 1.6), COR.creme, M([0, 0, 0], [deg(30), deg(40), 0])), [3, 9, -24]);
  add('lua', new Balde().add(flat(new THREE.OctahedronGeometry(1.1, 0)), COR.creme), [-3, 10, -26]);
  add('cristal', new Balde().add(flat(new THREE.OctahedronGeometry(0.7, 0)), COR.amarelo, M([0, 0, 0], [0, 0, 0], [0.6, 1.4, 0.6])), [6, 3, -18]);
  add('cometa', new Balde().add(flat(new THREE.TetrahedronGeometry(0.6)), COR.coral)
    .add(new THREE.ConeGeometry(0.35, 2.2, 5, 1, true), COR.amarelo, M([1.2, 0.2, 0], [0, 0, deg(-80)]), true), [-12, 9, -28]);
  // Campo de estrelas: octaedros pequenos numa casca à frente e acima (uma chamada de desenho)
  const est = new Balde(); let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    const az = (rnd() - 0.5) * Math.PI * 1.4, el = rnd() * 1.1 - 0.15, r = 55 + rnd() * 10;
    const p = [Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, -Math.cos(az) * Math.cos(el) * r];
    const t = 0.12 + rnd() * 0.22; const cor = rnd() < 0.2 ? COR.aqua : rnd() < 0.3 ? COR.lavanda : COR.branco;
    est.add(new THREE.OctahedronGeometry(t, 0), cor, M(p, [rnd(), rnd(), 0]), true);
  }
  raiz.add(est.malha('estrelas'));
}

// =====================================================================
// 3. MESA DE TRABALHO 1,8 × 0,9 m, tampo a 0,78 m
// =====================================================================
function mesa() {
  raiz.name = 'mesa';
  const b = new Balde();
  b.add(caixa(1.8, 0.05, 0.9, 0.02), COR.creme, M([0, 0.755, 0]));
  for (const s of [-1, 1]) b.add(caixa(0.06, 0.73, 0.8, 0.02), COR.marinho, M([s * 0.84, 0.365, 0]));
  b.add(caixa(1.62, 0.16, 0.04), COR.marinho, M([0, 0.6, -0.36])); // travessa de trás
  b.add(caixa(0.5, 0.12, 0.7, 0.01), COR.marinho_claro, M([0.5, 0.665, 0.02])); // gaveta
  b.add(caixa(0.16, 0.025, 0.025, 0.008), COR.creme, M([0.5, 0.665, 0.38])); // puxador
  raiz.add(b.malha('mesa_malha'));
}

// =====================================================================
// 4. CAIXA DE PIZZA (40 × 40 × 5 cm) com tampa que abre e fatia esquecida
// =====================================================================
function pizza() {
  raiz.name = 'caixa_pizza';
  const L = 0.4, H = 0.05, e = 0.005;
  const base = new Balde();
  base.add(caixa(L, e, L), COR.papelao, M([0, e / 2, 0]));
  for (const [x, z, w, d] of [[0, L / 2 - e / 2, L, e], [0, -L / 2 + e / 2, L, e], [L / 2 - e / 2, 0, e, L], [-L / 2 + e / 2, 0, e, L]])
    base.add(caixa(w, H - e, d), COR.papelao_escuro, M([x, H / 2, z]));
  raiz.add(base.malha('base'));
  // Tampa: dobradiça na borda de trás; a malha fica para a frente (+Z)
  const t = new Balde();
  t.add(caixa(L + 0.004, e, L + 0.004), COR.papelao, M([0, e / 2, L / 2]));
  t.add(caixa(L + 0.004, 0.04, e), COR.papelao, M([0, -0.018, L + 0.001])); // aba da frente
  // Desenho da pizza na tampa, em peças planas (sem textura)
  // discos planos virados para cima (só a face de cima: barato)
  const disco = (r, s) => new THREE.CircleGeometry(r, s).rotateX(-Math.PI / 2);
  const y = e + 0.001;
  t.add(disco(0.13, 16), COR.borda_pizza, M([0, y, L / 2]));
  t.add(disco(0.11, 16), COR.queijo, M([0, y + 0.0008, L / 2]));
  for (const [dx, dz] of [[0.05, 0.03], [-0.04, 0.05], [-0.05, -0.04], [0.03, -0.06], [0.0, 0.0]])
    t.add(disco(0.02, 8), COR.coral, M([dx, y + 0.0016, L / 2 + dz]));
  const tampa = no('tampa', [t.malha('tampa_malha')], [0, H, -L / 2]);
  raiz.add(tampa);
  // Fatia esquecida (o jogo esconde nas caixas que não têm)
  const f = new Balde(); const ang = deg(42), r = 0.15;
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.absarc(0, 0, r, Math.PI / 2 - ang / 2, Math.PI / 2 + ang / 2, false); fs.lineTo(0, 0);
  f.add(placa(fs, 0.01, 6), COR.queijo, M([0, 0, 0], [-Math.PI / 2, 0, 0]));
  const borda = new THREE.TorusGeometry(r, 0.012, 4, 6, ang); borda.rotateZ(Math.PI / 2 - ang / 2); borda.rotateX(-Math.PI / 2);
  f.add(borda, COR.borda_pizza);
  for (const [dx, dz] of [[0.012, -0.07], [-0.01, -0.11]]) f.add(new THREE.CircleGeometry(0.016, 8).rotateX(-Math.PI / 2), COR.coral, M([dx, 0.0055, dz]));
  raiz.add(no('fatia', [f.malha('fatia_malha')], [-0.03, e + 0.005, 0.08], [0, deg(25), 0]));
  const [ta, va] = suave(0, 0.7, [0], [-108], 7);
  clipes.push(new THREE.AnimationClip('abrir', 0.8, [trilhaRot('tampa', [...ta, 0.8], [...va.map((v) => [v[0], 0, 0]), [-108, 0, 0]])]));
  const [tb, vb] = suave(0, 0.6, [-108], [0], 6);
  clipes.push(new THREE.AnimationClip('fechar', 0.6, [trilhaRot('tampa', tb, vb.map((v) => [v[0], 0, 0]))]));
}

// =====================================================================
// 4b. CANECA AQUA 8 × 10 cm
// =====================================================================
function caneca() {
  raiz.name = 'caneca';
  const perfil = [[0, 0], [0.038, 0], [0.04, 0.004], [0.04, 0.1], [0.035, 0.1], [0.035, 0.012], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y));
  const b = new Balde();
  b.add(new THREE.LatheGeometry(perfil, 14), COR.aqua);
  b.add(cil(0.0352, 0.002, 14), COR.cafe, M([0, 0.07, 0]));
  b.add(new THREE.TorusGeometry(0.026, 0.007, 5, 8, Math.PI), COR.aqua, M([0.04, 0.052, 0], [0, 0, -Math.PI / 2]));
  raiz.add(b.malha('caneca_malha'));
}

// =====================================================================
// 5. CYBERDECK 42 × 32 × 12 cm (em pé, tela na frente, alça em cima)
// =====================================================================
function cyberdeck() {
  raiz.name = 'cyberdeck';
  const b = new Balde();
  b.add(caixa(0.36, 0.28, 0.12, 0.015), COR.creme, M([0, 0.14, 0]));
  for (const s of [-1, 1]) {
    b.add(caixa(0.04, 0.25, 0.13, 0.012), COR.oliva, M([s * 0.195, 0.135, 0]));
    b.add(caixa(0.004, 0.02, 0.07), COR.oliva_escuro, M([s * 0.216, 0.07, 0])); // frestinha lateral
  }
  // Alça preta (tubo)
  const curva = new THREE.CurvePath();
  curva.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.13, 0.275, 0), new THREE.Vector3(-0.13, 0.335, 0), new THREE.Vector3(-0.07, 0.335, 0)));
  curva.add(new THREE.LineCurve3(new THREE.Vector3(-0.07, 0.335, 0), new THREE.Vector3(0.07, 0.335, 0)));
  curva.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.07, 0.335, 0), new THREE.Vector3(0.13, 0.335, 0), new THREE.Vector3(0.13, 0.275, 0)));
  b.add(new THREE.TubeGeometry(curva, 12, 0.011, 6, false), COR.preto);
  // Moldura da tela, grade de ventilação e botões
  const zf = 0.06;
  b.add(caixa(0.24, 0.165, 0.012, 0.012), COR.moldura_tela, M([-0.03, 0.18, zf]));
  for (let i = 0; i < 5; i++) b.add(caixa(0.009, 0.045, 0.006), COR.moldura_tela, M([-0.13 + i * 0.02, 0.055, zf + 0.002]));
  b.add(cil(0.022, 0.016, 14), COR.preto, M([0.05, 0.058, zf + 0.004], [Math.PI / 2, 0, 0]));
  b.add(cil(0.022, 0.016, 14), COR.vermelho, M([0.12, 0.058, zf + 0.004], [Math.PI / 2, 0, 0]));
  // Cartucho amarelo saindo da lateral direita, com etiqueta oliva
  b.add(caixa(0.07, 0.08, 0.06, 0.006), COR.amarelo, M([0.235, 0.2, 0]));
  b.add(caixa(0.004, 0.032, 0.036), COR.oliva, M([0.271, 0.205, 0]));
  // Cabo enrolado saindo da lateral
  // Sem cabo (um fio rígido ficaria estranho ao carregar): só a entrada do conector na lateral
  b.add(caixa(0.006, 0.026, 0.044), COR.moldura_tela, M([0.217, 0.11, 0]));
  b.add(caixa(0.004, 0.01, 0.028), COR.cabo, M([0.219, 0.11, 0]));
  raiz.add(b.malha('cyberdeck_malha'));
  // Tela: desligada (verde-acinzentada, com reflexo) cobre a ligada (aqua com o foguete)
  const lig = new Balde();
  lig.add(caixa(0.21, 0.135, 0.002), COR.aqua, M([-0.03, 0.18, zf + 0.007]), true);
  const fog = foguete2D(0.02);
  lig.add(fog, COR.petroleo, M([-0.03, 0.172, zf + 0.0085]), true);
  const desl = new Balde();
  desl.add(caixa(0.212, 0.137, 0.002), COR.tela_verde, M([-0.03, 0.18, zf + 0.0105]));
  desl.add(caixa(0.04, 0.004, 0.001), COR.tela_brilho, M([-0.11, 0.232, zf + 0.012]));
  raiz.add(lig.malha('tela_ligada'));
  raiz.add(no('tela_desligada', [desl.malha('tela_desligada_malha')], [0, 0, 0]));
  raiz.add(no('ponto_alca', [], [0, 0.335, 0])); // onde a mão segura
  clipes.push(new THREE.AnimationClip('ligar', 1, [trilhaEsc('tela_desligada', [0, 0.3, 0.32, 1], [1, 1, 0, 0])]));
}

// ---------- Tangram: foguete com as 7 peças (unidade: lado do quadrado = 1) ----------
const PECAS = [
  ['grande_1', [[-1, 0], [1, 0], [1, 2]], COR.coral],
  ['grande_2', [[-1, 0], [1, 2], [-1, 2]], COR.aqua],
  ['medio', [[-1, 2], [1, 2], [0, 3]], COR.amarelo],
  ['pequeno_1', [[1, 0], [2, 0], [1, 1]], COR.lima],
  ['pequeno_2', [[-1, 0], [-1, 1], [-2, 0]], COR.lavanda],
  ['quadrado', [[-0.5, -1], [0.5, -1], [0.5, 0], [-0.5, 0]], COR.violeta],
  ['paralelogramo', [[-0.5, -1], [0.5, -1], [-0.5, -2], [-1.5, -2]], COR.creme],
];
function forma(pts, u, cx = 0, cy = 0) {
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo : s.moveTo).call(s, (x - cx) * u, (y - cy) * u)); s.closePath(); return s;
}
// Foguete plano (para a tela do cyberdeck): união das 7 formas, no plano XY
function foguete2D(u) {
  return mergeGeometries(PECAS.map(([, p]) => { const g = new THREE.ShapeGeometry(forma(p, u, 0, 0.5)); g.deleteAttribute('uv'); return g.toNonIndexed(); }));
}

// =====================================================================
// 6. CONSOLE DO TANGRAM 2,0 × 0,9 m; tampo inclinado de 0,85 (frente) a 0,95 (fundo)
// =====================================================================
function console_() {
  raiz.name = 'console_tangram';
  const b = new Balde();
  // Base: perfil lateral extrudado ao longo de X
  const perfil = new THREE.Shape();
  [[-0.42, 0], [0.42, 0], [0.42, 0.93], [-0.42, 0.835]].forEach(([u, v], i) => (i ? perfil.lineTo : perfil.moveTo).call(perfil, u, v)); // u = -z
  const baseG = new THREE.ExtrudeGeometry(perfil, { depth: 1.8, bevelEnabled: false }); baseG.rotateY(Math.PI / 2); baseG.translate(-0.9, 0, 0);
  b.add(baseG, COR.marinho);
  b.add(caixa(1.7, 0.08, 0.04), COR.preto, M([0, 0.04, 0.4])); // rodapé recuado
  // Tampo inclinado: sistema local do tampo (y = 0 é o meio da placa)
  const a = Math.atan2(0.1, 0.9);
  const TOPO = M([0, 0.9, 0], [a, 0, 0]);
  const noTopo = (m) => TOPO.clone().multiply(m);
  b.add(caixa(2.0, 0.04, 0.94, 0.015), COR.creme, TOPO);
  const ys = 0.021; // superfície do tampo
  b.add(caixa(1.16, 0.003, 0.7), COR.petroleo, noTopo(M([-0.3, ys, 0.05]))); // área escura da silhueta
  b.add(caixa(0.6, 0.003, 0.76), COR.marinho_claro, noTopo(M([0.67, ys, 0.02]))); // bandeja das peças
  // Suporte do cyberdeck atrás da silhueta, com encaixe Lima
  b.add(caixa(0.5, 0.12, 0.16, 0.02), COR.marinho_claro, noTopo(M([-0.3, ys + 0.06, -0.37])));
  b.add(caixa(0.4, 0.012, 0.13, 0.005), COR.lima, noTopo(M([-0.3, ys + 0.125, -0.37])));
  // Posto no chão à frente: pisar aqui trava o corpo (Lima = interativo)
  const anel = new THREE.RingGeometry(0.27, 0.34, 24); anel.rotateX(-Math.PI / 2);
  b.add(anel, COR.lima, M([0, 0.004, 0.95]), true);
  raiz.add(b.malha('console_malha'));
  raiz.add(no('ponto_cyberdeck', [], new THREE.Vector3(-0.3, ys + 0.131, -0.37).applyMatrix4(TOPO).toArray(), [a, 0, 0]));

  // Silhueta do foguete: unidade de 0,13 m; "para cima" do foguete = para o fundo (-Z)
  const U = 0.13, CX = -0.3, CZ = 0.06;
  const aoTopo = (x, y) => [CX + x * U, CZ - (y - 0.5) * U];
  const sil = (cor, dy, brilha) => {
    const bb = new Balde();
    for (const [, pts] of PECAS) {
      const g = new THREE.ShapeGeometry(forma(pts, U, 0, 0.5)); g.deleteAttribute('uv');
      bb.add(g, cor, noTopo(M([CX, ys + dy, CZ], [-Math.PI / 2, 0, 0])), brilha);
    }
    return bb;
  };
  raiz.add(sil(COR.aqua, 0.0025, true).malha('silhueta_acesa'));
  raiz.add(no('silhueta_apagada', [sil(COR.petroleo_claro, 0.0035, false).malha('silhueta_apagada_malha')]));
  clipes.push(new THREE.AnimationClip('acender', 1, [trilhaEsc('silhueta_apagada', [0, 0.3, 0.32, 1], [1, 1, 0, 0])]));

  // Peças soltas na bandeja (nós separados, com o alvo de encaixe em userData)
  const ESP = 0.018;
  const BANDEJA = { grande_1: [0.53, -0.22, 90], grande_2: [0.82, -0.2, 225], medio: [0.53, 0.06, 0], pequeno_1: [0.85, 0.08, 135],
    pequeno_2: [0.7, 0.07, 45], quadrado: [0.5, 0.26, 45], paralelogramo: [0.79, 0.27, 0] };
  const alvos = {};
  const qTopo = new THREE.Quaternion().setFromEuler(new THREE.Euler(a, 0, 0));
  for (const [nome, pts, cor] of PECAS) {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const g = new THREE.ExtrudeGeometry(forma(pts, U, cx, cy), { depth: ESP, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const pb = new Balde(); pb.add(g, cor);
    const m = pb.malha('peca_' + nome + '_malha');
    const [tx, tz, rotGraus] = BANDEJA[nome];
    const pTopo = new THREE.Vector3(tx, ys + 0.003, tz);
    const p = pTopo.clone().applyMatrix4(TOPO);
    const q = qTopo.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deg(rotGraus)));
    const n = no('peca_' + nome, [m]); n.position.copy(p); n.quaternion.copy(q);
    const [ax, az] = aoTopo(cx, cy);
    const alvo = new THREE.Vector3(ax, ys + 0.0045, az).applyMatrix4(TOPO);
    alvos['peca_' + nome] = { posicao: alvo.toArray().map((v) => +v.toFixed(4)), giro_graus: 0, giro_inicial_graus: rotGraus };
    raiz.add(n);
  }
  raiz.getObjectByName('silhueta_acesa').userData = { alvos, tolerancia_m: 0.03, passo_giro_graus: 45, referencia: 'posições no espaço do console' };
}

// =====================================================================
// 7. ARMA LASER DE TELETRANSPORTE (30 × 19 × 6 cm). Origem = centro da empunhadura
// (onde a mão segura); o cano aponta para +Z. Tudo fica dentro do nó "modelo",
// que é o que recua no tiro (o nó raiz fica livre para o jogo posicionar na mão).
// =====================================================================
COR.laranja = '#ff8a1f'; COR.laranja_escuro = '#d96a0b';
function arma() {
  raiz.name = 'arma_laser';
  const cm = (v) => v / 100;
  const ZX = (g) => g.rotateY(-Math.PI / 2); // forma desenhada em XY com x = frente (z)
  const b = new Balde();
  // Corpo laranja (cápsula deitada ao longo de Z) e friso azul-marinho
  const corpo = new THREE.CapsuleGeometry(0.03, 0.13, 3, 10); corpo.rotateX(Math.PI / 2);
  b.add(corpo, COR.laranja, M([0, cm(7.4), cm(4.8)], [0, 0, 0], [1, 1.08, 1]));
  b.add(caixa(0.0625, 0.006, 0.15), COR.marinho, M([0, cm(6.9), cm(4.8)]));
  // Aleta violeta atrás
  const aleta = new THREE.Shape(); aleta.moveTo(cm(-3.4), cm(10.2)); aleta.lineTo(cm(-6.2), cm(15.4)); aleta.lineTo(cm(-5.2), cm(15.6)); aleta.lineTo(cm(1.1), cm(10.2)); aleta.closePath();
  b.add(ZX(placa(aleta, 0.008, 2)), COR.violeta);
  // Base da cúpula (lavanda) — o cristal aqua sai por cima
  b.add(new THREE.SphereGeometry(0.03, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), COR.lavanda, M([0, cm(10.2), cm(5.4)]));
  // Empunhadura azul-marinho, inclinada para trás, com ranhuras
  b.add(caixa(0.032, 0.1, 0.036, 0.008), COR.marinho, M([0, cm(0.2), 0], [deg(-7), 0, 0]));
  for (const y of [-2.6, -0.8, 1.0]) b.add(caixa(0.034, 0.004, 0.026), COR.marinho_claro, M([0, cm(y), cm(-0.2 - y * 0.12)], [deg(-7), 0, 0]));
  // Guarda do gatilho (creme): arco + haste de volta ao corpo
  const arco = new THREE.TorusGeometry(0.024, 0.0045, 4, 8, Math.PI / 2); arco.rotateZ(Math.PI);
  b.add(ZX(arco), COR.creme, M([0, cm(4.4), cm(6.2)]));
  b.add(cil(0.0045, 0.024, 6), COR.creme, M([0, cm(3.2), cm(6.2)]));
  // Cano azul-marinho e emissor facetado
  const cano = cil(0.017, 0.08, 10); cano.rotateX(Math.PI / 2);
  b.add(cano, COR.marinho, M([0, cm(7.4), cm(17.4)]));
  const emi = new THREE.CylinderGeometry(0.021, 0.011, 0.022, 6); emi.rotateX(Math.PI / 2);
  b.add(emi, COR.cinza, M([0, cm(7.4), cm(22.5)]));
  const modelo = no('modelo', [b.malha('arma_malha')]);
  // Anéis aqua (cada um um nó, para pulsar no tiro)
  [[15.3, 0.0235], [17.4, 0.0213], [19.4, 0.019]].forEach(([z, r], i) => {
    const a = new Balde(); const g = cil(r, 0.011, 10); g.rotateX(Math.PI / 2); a.add(g, COR.aqua, null, true);
    modelo.add(no('anel_' + i, [a.malha('anel_' + i + '_malha')], [0, cm(7.4), cm(z)]));
  });
  // Ponta e cristal (brilham)
  const ponta = new Balde(); ponta.add(new THREE.OctahedronGeometry(0.008, 0).toNonIndexed(), COR.aqua, M([0, 0, 0], [0, 0, 0], [1, 1, 1.4]), true);
  modelo.add(no('ponta', [ponta.malha('ponta_malha')], [0, cm(7.4), cm(23.8)]));
  const cri = new Balde(); cri.add(new THREE.OctahedronGeometry(0.014, 0).toNonIndexed(), COR.aqua, M([0, 0, 0], [0, deg(45), 0], [1, 1.5, 1]), true);
  modelo.add(no('cristal', [cri.malha('cristal_malha')], [0, cm(12.6), cm(5.4)]));
  // LEDs de carga dos dois lados: acesos embaixo, capa apagada por cima
  const acesos = new Balde();
  for (let i = 0; i < 3; i++) {
    const z = cm(7.6 + i * 1.8); const capa = new Balde();
    for (const s of [-1, 1]) {
      // discos planos virados para fora (6 triângulos cada)
      const g = new THREE.CircleGeometry(0.005, 6); g.rotateY(s * Math.PI / 2);
      acesos.add(g, COR.aqua, M([s * 0.0278, cm(5.5), z]), true);
      const c = new THREE.CircleGeometry(0.0055, 6); c.rotateY(s * Math.PI / 2);
      capa.add(c, COR.marinho, M([s * 0.0284, 0, 0]));
    }
    const nc = no(`led_${i}_apagado`, [capa.malha(`led_${i}_apagado_malha`)], [0, cm(5.5), z]); nc.scale.setScalar(0.0001);
    modelo.add(nc);
  }
  modelo.add(acesos.malha('leds_acesos'));
  // Gatilho Lima (gira para trás quando aperta)
  const gt = new Balde(); gt.add(caixa(0.008, 0.02, 0.007), COR.lima, M([0, -0.01, 0.002], [deg(-20), 0, 0]));
  modelo.add(no('gatilho', [gt.malha('gatilho_malha')], [0, cm(4.4), cm(4.3)]));
  modelo.add(no('ponto_emissor', [], [0, cm(7.4), cm(24.5)]));
  raiz.add(modelo);
  // DISPARAR (0,9 s): gatilho, anéis acendem do fundo para a ponta, recuo, LEDs apagam e recarregam um a um
  const pulso = (n, t0) => trilhaEsc(n, [0, t0, t0 + 0.06, t0 + 0.16, 0.9], [1, 1, 1.35, 1, 1]);
  clipes.push(new THREE.AnimationClip('disparar', 0.9, [
    trilhaRot('gatilho', [0, 0.05, 0.18, 0.9], [[0, 0, 0], [-25, 0, 0], [0, 0, 0], [0, 0, 0]]),
    pulso('anel_0', 0.02), pulso('anel_1', 0.06), pulso('anel_2', 0.1), pulso('ponta', 0.13),
    trilhaEsc('cristal', [0, 0.05, 0.15, 0.4, 0.9], [1, 1.3, 0.8, 1, 1]),
    trilhaPos('modelo', [0, 0.04, 0.12, 0.3, 0.9], [[0, 0, 0], [0, 0.004, -0.012], [0, 0.002, -0.004], [0, 0, 0], [0, 0, 0]]),
    trilhaRot('modelo', [0, 0.04, 0.2, 0.9], [[0, 0, 0], [-6, 0, 0], [0, 0, 0], [0, 0, 0]]),
    ...[0, 1, 2].map((i) => trilhaEsc(`led_${i}_apagado`, [0, 0.04, 0.05, 0.42 + i * 0.15, 0.43 + i * 0.15, 0.9], [0.0001, 0.0001, 1, 1, 0.0001, 0.0001])),
  ]));
}

// 7b. SUPORTE no posto de tiro: haste azul-marinho, braço e garfo Lima a 1,0 m.
function suporte() {
  raiz.name = 'suporte_arma';
  const b = new Balde();
  b.add(cil(0.13, 0.03, 8), COR.marinho_claro, M([0, 0.015, -0.12]));
  b.add(caixa(0.05, 0.94, 0.05, 0.012), COR.marinho, M([0, 0.49, -0.12]));
  b.add(caixa(0.04, 0.03, 0.18), COR.marinho, M([0, 0.95, -0.04]));
  // Garfo Lima: duas abas que seguram o corpo da arma
  for (const s of [-1, 1]) b.add(caixa(0.012, 0.045, 0.1), COR.lima, M([s * 0.038, 0.99, 0.05]));
  b.add(caixa(0.088, 0.012, 0.1), COR.lima, M([0, 0.968, 0.05]));
  raiz.add(b.malha('suporte_malha'));
  raiz.add(no('ponto_arma', [], [0, 0.974 - 0.041, 0.0])); // a origem da arma (empunhadura) fica aqui
}

// 7c. BOLINHA DE ENERGIA: núcleo aqua com 3 tetraedros lavanda girando em volta.
function projetil() {
  raiz.name = 'projetil';
  const n = new Balde(); n.add(new THREE.IcosahedronGeometry(0.02, 0).toNonIndexed(), COR.aqua, null, true);
  raiz.add(n.malha('nucleo'));
  const o = new Balde();
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; o.add(new THREE.TetrahedronGeometry(0.008).toNonIndexed(), COR.lavanda, M([Math.cos(a) * 0.034, Math.sin(a) * 0.012, Math.sin(a) * 0.034]), true); }
  raiz.add(no('orbita', [o.malha('orbita_malha')]));
  clipes.push(new THREE.AnimationClip('girar', 0.6, [trilhaRot('orbita', [0, 0.2, 0.4, 0.6], [[0, 0, 0], [0, 120, 20], [0, 240, 0], [0, 360, 0]])]));
}

// =====================================================================
// 8. CÂMARA DE CAPTURA (sala de treinamento): tubo de vidro de 3,0 m, base com contador,
// tampa com anel violeta de chegada e 16 vagas misturadas (qualquer clone em qualquer vaga).
// =====================================================================
const VAGAS = [[0.595, 2.34, -0.766], [-0.932, 2.34, 0.27], [0.468, 0.887, 0.086], [0.04, 1.607, -0.752], [0.092, 1.052, 0.966], [0.967, 2.34, 0.076], [-0.442, 0.831, -0.864], [-0.894, 1.539, -0.376], [-0.466, 2.34, -0.524], [0.492, 0.81, -0.836], [-0.448, 0.81, 0.056], [0.887, 1.551, -0.393], [0.101, 2.038, 0.144], [0.752, 1.587, 0.613], [-0.263, 2.34, 0.934], [-0.582, 1.55, 0.586]];
function tubo() {
  raiz.name = 'camara_captura';
  const b = new Balde();
  b.add(cil(1.7, 0.35, 16), COR.marinho, M([0, 0.175, 0]));
  b.add(cil(1.56, 0.02, 16), COR.petroleo_claro, M([0, 0.36, 0]));   // piso do tubo
  b.add(cil(1.65, 0.25, 16), COR.marinho, M([0, 2.925, 0]));         // tampa
  b.add(cil(1.56, 0.02, 16), COR.creme, M([0, 2.79, 0]));            // aro de cima
  for (const a of [45, 135, 225, 315]) {                               // 4 colunas creme (nenhuma na frente)
    const r = deg(a); b.add(caixa(0.12, 2.43, 0.12), COR.creme, M([Math.sin(r) * 1.53, 1.585, Math.cos(r) * 1.53], [0, r, 0]));
  }
  // Painel do contador na frente da base: 8 ícones de Gojo (aqua) em cima, 8 de Fred (amarelo) embaixo, e o visor do número
  b.add(caixa(1.5, 0.27, 0.04, 0.02), COR.marinho_claro, M([0, 0.175, 1.69]));
  b.add(caixa(0.26, 0.2, 0.01), COR.petroleo, M([0.6, 0.175, 1.712]));
  raiz.add(b.malha('tubo_malha'));
  raiz.add(no('visor_numero', [], [0.6, 0.175, 1.72])); // o jogo escreve aqui o total (ex.: 5/16)
  const icone = (tipo) => {
    const g = []; const add = (geo, m) => { geo.applyMatrix4(m); g.push(geo); };
    if (tipo === 'gojo') {
      add(new THREE.CircleGeometry(0.03, 6), M());
      for (const s of [-1, 1]) { const o = new THREE.Shape(); o.moveTo(s * 0.012, 0.02); o.lineTo(s * 0.032, 0.046); o.lineTo(s * 0.03, 0.012); o.closePath(); add(new THREE.ShapeGeometry(o), M()); }
    } else {
      add(new THREE.CircleGeometry(0.026, 6), M());
      for (const s of [-1, 1]) add(new THREE.CircleGeometry(0.011, 5), M([s * 0.02, 0.022, 0]));
    }
    return g.map((x) => { x.deleteAttribute('uv'); return x; });
  };
  const acesos = new Balde();
  for (const [lin, tipo, cor] of [[0.225, 'gojo', COR.aqua], [0.12, 'fred', COR.amarelo]]) {
    for (let i = 0; i < 8; i++) {
      const x = -0.66 + i * 0.13; const capa = new Balde();
      for (const g of icone(tipo)) {
        acesos.add(g, cor, M([x, lin, 1.712]), true);
        capa.add(g, COR.petroleo_claro, M([0, 0, 0.003]));
      }
      raiz.add(no(`contador_${tipo}_${i}_apagado`, [capa.malha(`contador_${tipo}_${i}_apagado_malha`)], [x, lin, 1.712]));
    }
  }
  raiz.add(acesos.malha('contador_acesos'));
  // Anel de chegada (violeta, brilha) embaixo da tampa: pisca quando um clone chega
  const anel = new THREE.RingGeometry(1.15, 1.48, 16); anel.rotateX(Math.PI / 2);
  raiz.add(no('anel_chegada', [new Balde().add(anel, COR.violeta, null, true).malha('anel_chegada_malha')], [0, 2.775, 0]));
  // Vidro (transparente, dos dois lados), aberto em cima e embaixo
  const vg = new THREE.CylinderGeometry(1.5, 1.5, 2.43, 16, 1, true); vg.translate(0, 1.585, 0);
  const matVidro = MAT.vidro.clone(); matVidro.side = THREE.DoubleSide; matVidro.opacity = 0.16;
  const vidro = new THREE.Mesh(vg, matVidro); vidro.name = 'vidro'; raiz.add(vidro);
  // Vagas: pontos vazios; o jogo sorteia uma vaga livre para cada clone capturado
  VAGAS.forEach((p, i) => { const v = no('vaga_' + String(i).padStart(2, '0'), [], p, [0, (i * 137) % 360 * Math.PI / 180, 0]); v.userData = { raio_m: 0.41 }; raiz.add(v); });
  raiz.userData = { vagas: VAGAS.length, raio_bolha_m: 0.41, folga_minima_m: 0.1, oscilacao_m: 0.03 };
  const p = (t0) => [0, t0, t0 + 0.12, t0 + 0.5, 1.2];
  clipes.push(new THREE.AnimationClip('chegada', 1.2, [trilhaEsc('anel_chegada', p(0.05), [1, 1, 1.12, 1, 1])]));
  // Demonstração do contador: acende todos os ícones um a um
  clipes.push(new THREE.AnimationClip('contar_todos', 4.2, [
    ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [['gojo', i * 0.5], ['fred', i * 0.5 + 0.25]]).map(([tipo, t], k) =>
      trilhaEsc(`contador_${tipo}_${k >> 1}_apagado`, [0, t + 0.1, t + 0.12, 4.2], [1, 1, 0.0001, 0.0001]))]));
}

// =====================================================================
// 9. OFICINA DO METALGABUTRON
// Circuito fácil: pilhas 3 V → jumper vermelho → resistor 220 Ω → LED (perna longa no +) → jumper preto → −.
// =====================================================================
COR.led = '#c0392b'; COR.led_aceso = '#ff6a55'; COR.resistor = '#e9d3a6'; COR.marrom = '#6b3a1f'; COR.dourado = '#c9a46b';
COR.metal_perna = '#9aa5a8'; COR.queimado = '#3b2a2f'; COR.fumaca = '#b9c0c4'; COR.madeira = '#c9a46b';

// Protoboard: tampo inclinado; coordenadas do tampo (x = largura, z = profundidade, -z = fundo)
const PB = { a: Math.atan2(0.2, 1.0) };
PB.TOPO = M([0, 0.9, 0], [PB.a, 0, 0]);
PB.ys = 0.021;
PB.col = (i) => -0.568 + i * 0.1514;            // 10 colunas (i = 0..9)
PB.lin = (j) => -0.262 + j * 0.13;              // 5 furos por coluna (j = 0..4)
PB.zMais = -0.408; PB.zMenos = 0.4;              // trilhos + (fundo) e − (frente)
// Onde cada peça encaixa (centro entre as pernas, no plano do tampo) e giro em Y
PB.ALVOS = {
  jumper_vermelho: { x: PB.col(3), z: (PB.zMais + PB.lin(0)) / 2, giro: 90 },   // + → coluna 4
  resistor: { x: (PB.col(3) + PB.col(6)) / 2, z: PB.lin(1), giro: 0 },          // coluna 4 → 7
  led: { x: (PB.col(6) + PB.col(8)) / 2, z: PB.lin(2), giro: 0 },               // perna longa (+) na coluna 7
  jumper_preto: { x: PB.col(8), z: (PB.lin(4) + PB.zMenos) / 2, giro: 90 },     // coluna 9 → −
};
function protoboard() {
  raiz.name = 'protoboard';
  const b = new Balde(); const T = PB.TOPO, nt = (m) => T.clone().multiply(m), ys = PB.ys;
  const perfil = new THREE.Shape();
  [[-0.48, 0], [0.48, 0], [0.48, 0.99], [-0.48, 0.8]].forEach(([u, v], i) => (i ? perfil.lineTo : perfil.moveTo).call(perfil, u, v));
  const base = new THREE.ExtrudeGeometry(perfil, { depth: 1.84, bevelEnabled: false }); base.rotateY(Math.PI / 2); base.translate(-0.92, 0, 0);
  b.add(base, COR.marinho);
  b.add(caixa(1.74, 0.08, 0.04), COR.preto, M([0, 0.04, 0.46]));
  b.add(caixa(2.0, 0.04, 1.02, 0.015), COR.creme, T);
  // trilhos: faixa vermelha (+) no fundo e preta (−) na frente
  b.add(caixa(1.62, 0.002, 0.012), COR.vermelho, nt(M([0.17, ys, -0.452])));
  b.add(caixa(1.62, 0.002, 0.012), COR.preto, nt(M([0.17, ys, 0.444])));
  b.add(caixa(1.6, 0.002, 0.08), COR.vermelho, nt(M([0.17, ys - 0.0005, PB.zMais])));
  b.add(caixa(1.6, 0.002, 0.08), COR.cinza, nt(M([0.17, ys - 0.0005, PB.zMenos])));
  // colunas (faixas claras) e furos (discos escuros)
  const disco = (r) => new THREE.CircleGeometry(r, 6).rotateX(-Math.PI / 2);
  for (let i = 0; i < 10; i++) {
    b.add(caixa(0.075, 0.002, 0.6), '#d9dfe2', nt(M([PB.col(i), ys, PB.lin(2)])));
    for (let j = 0; j < 5; j++) b.add(disco(0.02), COR.marinho_claro, nt(M([PB.col(i), ys + 0.0015, PB.lin(j)])));
    b.add(disco(0.02), COR.marinho_claro, nt(M([PB.col(i), ys + 0.0015, PB.zMais])));
    b.add(disco(0.02), COR.marinho_claro, nt(M([PB.col(i), ys + 0.0015, PB.zMenos])));
  }
  // suporte das pilhas: bandejinha baixa com laterais e pontas (contatos), e duas pilhas de 1,5 V EM SÉRIE.
  // Pilha da trás: + no fundo (fio vermelho), − na frente; pilha da frente: + encostado no − da outra, − na frente (fio preto).
  const XP = -0.83, YB = ys + 0.012;
  b.add(caixa(0.2, 0.024, 0.62, 0.008), COR.marinho_claro, nt(M([XP, YB, 0.0])));
  for (const s of [-1, 1]) b.add(caixa(0.02, 0.05, 0.6), COR.marinho_claro, nt(M([XP + s * 0.09, YB + 0.025, 0.0])));
  for (const z of [-0.3, 0.3]) b.add(caixa(0.2, 0.09, 0.02), COR.marinho_claro, nt(M([XP, YB + 0.045, z])));
  const yP = YB + 0.012 + 0.066;
  const pilha = (z0) => { // z0 = ponta + ; a pilha vai de z0 até z0 + 0.25 (− na frente)
    const corpo = cil(0.065, 0.2, 10); corpo.rotateX(Math.PI / 2); b.add(corpo, COR.amarelo, nt(M([XP, yP, z0 + 0.012 + 0.1])));
    const fundo = cil(0.065, 0.038, 10); fundo.rotateX(Math.PI / 2); b.add(fundo, COR.preto, nt(M([XP, yP, z0 + 0.012 + 0.2 + 0.019])));
    const nub = cil(0.022, 0.012, 8); nub.rotateX(Math.PI / 2); b.add(nub, COR.cinza, nt(M([XP, yP, z0 + 0.006])));
    b.add(caixa(0.05, 0.012, 0.003), COR.vermelho, nt(M([XP, yP + 0.066, z0 + 0.05]))); b.add(caixa(0.012, 0.05, 0.003), COR.vermelho, nt(M([XP, yP + 0.066, z0 + 0.05]), ).multiply(M([0, 0, 0], [Math.PI / 2, 0, 0])));
  };
  pilha(-0.29); pilha(-0.29 + 0.25 + 0.0);
  // molinha do polo − (entre a última pilha e a parede da frente do suporte)
  { const pts = []; const z0 = 0.212, z1 = 0.29;
    for (let i = 0; i <= 48; i++) { const k = i / 48, a = k * Math.PI * 2 * 6; pts.push(new THREE.Vector3(XP + Math.cos(a) * 0.034, yP + Math.sin(a) * 0.034, z0 + k * (z1 - z0)).applyMatrix4(T)); }
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.004, 3, false), COR.metal_perna);
    b.add(caixa(0.08, 0.08, 0.004), COR.metal_perna, nt(M([XP, yP, 0.288]))); }
  // fios das pilhas até os trilhos (presos dos dois lados)
  const fio = (pts, cor) => b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p).applyMatrix4(T))), 10, 0.012, 5, false), cor);
  fio([[-0.83, ys + 0.09, -0.31], [-0.8, ys + 0.07, -0.39], [-0.66, ys + 0.03, PB.zMais], [PB.col(0) - 0.04, ys + 0.012, PB.zMais]], COR.vermelho);
  fio([[-0.83, ys + 0.09, 0.31], [-0.8, ys + 0.07, 0.38], [-0.66, ys + 0.03, PB.zMenos], [PB.col(0) - 0.04, ys + 0.012, PB.zMenos]], COR.preto);
  // posto no chão à frente (Lima)
  const anel = new THREE.RingGeometry(0.27, 0.34, 24); anel.rotateX(-Math.PI / 2);
  b.add(anel, COR.lima, M([0, 0.004, 0.95]), true);
  raiz.add(b.malha('protoboard_malha'));
  // pontos de encaixe (nós vazios no plano do tampo) + saída do conduíte para o motor
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(PB.a, 0, 0));
  for (const [nome, al] of Object.entries(PB.ALVOS)) {
    const n = no('alvo_' + nome); n.position.copy(new THREE.Vector3(al.x, ys + 0.001, al.z).applyMatrix4(T));
    n.quaternion.copy(q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deg(al.giro)))); raiz.add(n);
  }
  raiz.add(no('ponto_conduite', [], [0.9, 0.5, -0.48]));
  raiz.userData = { encaixe_tolerancia_m: 0.04, circuito: 'pilhas 3V -> jumper vermelho -> resistor 220 ohms -> LED (perna longa no +) -> jumper preto -> trilho -' };
}

// Pernas de metal: do ponto (x, 0) sobem até (x, h) — origem da peça = tampo, entre as pernas
const perna = (b, x, h, z = 0) => b.add(cil(0.004, h, 5), COR.metal_perna, M([x, h / 2, z]));
function led() {
  raiz.name = 'led';
  const meio = (PB.col(8) - PB.col(6)) / 2; // 0,1514 m
  const b = new Balde();
  // pernas: + (longa, com dobra) em -X; − (curta) em +X
  perna(b, -meio, 0.05); perna(b, meio, 0.05);
  const diag = (x0, x1, y0, y1) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); b.add(cil(0.004, L, 5), COR.metal_perna, M([(x0 + x1) / 2, (y0 + y1) / 2, 0], [0, 0, -Math.atan2(dx, dy)])); };
  diag(-meio, -0.11, 0.05, 0.08); diag(-0.11, -0.012, 0.08, 0.12);   // perna longa: dobra a mais
  diag(meio, 0.012, 0.05, 0.12);
  b.add(caixa(0.012, 0.003, 0.003), COR.vermelho, M([-meio - 0.02, 0.06, 0])); b.add(caixa(0.003, 0.012, 0.003), COR.vermelho, M([-meio - 0.02, 0.06, 0])); // sinal +
  raiz.add(b.malha('led_pernas'));
  // cúpula: acesa (brilho) embaixo e apagada por cima (lado chato = negativo, no +X)
  const cupula = (r, cor, brilha) => {
    const bb = new Balde();
    bb.add(cil(r, 0.05, 10), cor, M([0, 0.145, 0]), brilha);
    bb.add(new THREE.SphereGeometry(r, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), cor, M([0, 0.17, 0]), brilha);
    bb.add(cil(r + 0.006, 0.012, 10), cor, M([0, 0.124, 0]), brilha);
    return bb;
  };
  raiz.add(cupula(0.038, COR.led_aceso, true).malha('cupula_acesa'));
  const ap = cupula(0.0395, COR.led, false); ap.add(caixa(0.004, 0.013, 0.05), COR.preto, M([0.046, 0.124, 0]));
  raiz.add(no('cupula_apagada', [ap.malha('cupula_apagada_malha')], [0, 0, 0]));
  clipes.push(new THREE.AnimationClip('acender', 0.6, [trilhaEsc('cupula_apagada', [0, 0.05, 0.07, 0.6], [1, 1, 0.0001, 0.0001])]));
  raiz.userData = { perna_positiva: 'x negativo (longa, com dobra)', perna_negativa: 'x positivo (curta, lado chato)' };
}
function resistor(queimado = false) {
  raiz.name = queimado ? 'resistor_queimado' : 'resistor';
  const meio = (PB.col(6) - PB.col(3)) / 2; // 0,227 m
  const b = new Balde(); const y = 0.05;
  perna(b, -meio, y); perna(b, meio, y);
  const lig = cil(0.004, meio * 2 - 0.02, 5); lig.rotateZ(Math.PI / 2); b.add(lig, COR.metal_perna, M([0, y, 0]));
  const corpo = new THREE.CapsuleGeometry(0.03, 0.17, 2, 10); corpo.rotateZ(Math.PI / 2);
  b.add(corpo, queimado ? COR.queimado : COR.resistor, M([0, y, 0], [0, 0, 0], [1, 1, 1]));
  if (!queimado) {
    // vermelho, vermelho, marrom (= 22 × 10 = 220 Ω) e dourado (tolerância)
    [[-0.06, COR.vermelho], [-0.03, COR.vermelho], [0, COR.marrom], [0.06, COR.dourado]].forEach(([x, cor]) => {
      const f = cil(0.0315, 0.014, 10); f.rotateZ(Math.PI / 2); b.add(f, cor, M([x, y, 0]));
    });
  } else {
    b.add(caixa(0.006, 0.062, 0.062), COR.preto, M([0.01, y, 0], [0, 0, 0.4])); // rachadura
    const fu = new Balde();
    [[0, 0.05, 0.022], [0.012, 0.085, 0.016], [-0.006, 0.115, 0.012]].forEach(([x, yy, r]) => fu.add(new THREE.IcosahedronGeometry(r, 0).toNonIndexed(), COR.fumaca, M([x, yy, 0])));
    raiz.add(no('fumaca', [fu.malha('fumaca_malha')], [0, y, 0]));
    clipes.push(new THREE.AnimationClip('fumegar', 2, [trilhaPos('fumaca', [0, 1, 2], [[0, y, 0], [0.006, y + 0.02, 0], [0, y, 0]]), trilhaEsc('fumaca', [0, 1, 2], [0.9, 1.15, 0.9])]));
  }
  raiz.add(b.malha(raiz.name + '_malha'));
}
function jumper(tipo) {
  const vao = { vermelho: PB.lin(0) - PB.zMais, preto: PB.zMenos - PB.lin(4), curto: 0.07 }[tipo];
  const cor = { vermelho: COR.vermelho, preto: COR.preto, curto: COR.amarelo }[tipo];
  raiz.name = 'jumper_' + tipo;
  const b = new Balde(); const h = 0.06, e = 0.022, m = vao / 2;
  for (const s of [-1, 1]) {
    b.add(caixa(e, h - 0.02, e), cor, M([s * m, (h - 0.02) / 2 + 0.02, 0]));
    b.add(cil(0.005, 0.022, 5), COR.metal_perna, M([s * m, 0.011, 0]));
  }
  b.add(caixa(vao + e, e, e), cor, M([0, h + e / 2, 0]));
  raiz.add(b.malha(raiz.name + '_malha'));
  raiz.userData = { vao_m: +vao.toFixed(3) };
}
// Plataforma do MetalgabuTRON (0,35 m) com rampa: o rosto dele fica acima da protoboard
function plataforma() {
  raiz.name = 'plataforma_metal';
  const b = new Balde(); const H = 0.35;
  // corpo azul-marinho até 4 cm abaixo do topo; o aro creme fica EM CIMA (sem faces sobrepostas)
  b.add(cil(0.55, H - 0.04, 12), COR.marinho, M([0, (H - 0.04) / 2, 0]));
  b.add(cil(0.57, 0.04, 12), COR.creme, M([0, H - 0.02, 0]));
  b.add(cil(0.5, 0.006, 12), COR.marinho_claro, M([0, H + 0.003, 0]));
  // rampa para as rodinhas (sobe pelo lado +X)
  const r = new THREE.Shape(); r.moveTo(0, 0); r.lineTo(0.9, 0); r.lineTo(0, H); r.closePath();
  const rampa = new THREE.ExtrudeGeometry(r, { depth: 0.5, bevelEnabled: false }); rampa.translate(0, 0, -0.25);
  b.add(rampa, COR.marinho_claro, M([0.5, 0, 0]));
  for (const z of [-0.12, 0, 0.12]) b.add(caixa(0.8, 0.006, 0.03), COR.cinza, M([0.95, H / 2 + 0.005, z], [0, 0, -Math.atan2(H, 0.9)]));
  raiz.add(b.malha('plataforma_malha'));
  raiz.add(no('ponto_metal', [], [0, H + 0.004, 0]));
}
function bandeja() {
  raiz.name = 'bandeja_pecas';
  const b = new Balde();
  b.add(caixa(0.9, 0.04, 0.55, 0.012), COR.marinho_claro, M([0, 0.02, 0]));
  for (const [x, z, w, d] of [[0, -0.265, 0.9, 0.02], [0, 0.265, 0.9, 0.02], [-0.44, 0, 0.02, 0.55], [0.44, 0, 0.02, 0.55]]) b.add(caixa(w, 0.05, d), COR.marinho, M([x, 0.045, z]));
  for (const [x, z] of [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]]) b.add(cil(0.025, 0.74, 6), COR.marinho, M([x, -0.37, z]));
  raiz.add(b.malha('bandeja_malha'));
  // vagas das peças na bandeja (o jogo coloca as peças aqui)
  [['led', -0.25, -0.12], ['resistor', 0.15, -0.14], ['resistor_queimado', 0.15, 0.13], ['jumper_vermelho', -0.3, 0.14], ['jumper_preto', -0.1, 0.14], ['jumper_curto', 0.35, 0.02]]
    .forEach(([n, x, z]) => raiz.add(no('lugar_' + n, [], [x, 0.042, z])));
}

// Motor retrô na parede (parede em z = 0, frente para +Z): carcaça com aletas, luz "ligado", engrenagem de 1,6 m
function motor() {
  raiz.name = 'motor_engrenagem';
  const b = new Balde(); const Y = 1.6, XM = -0.95, XG = 0.6;
  b.add(caixa(0.9, 0.95, 0.06, 0.02), COR.marinho_claro, M([XM, Y, 0.03]));        // placa na parede
  b.add(caixa(0.7, 0.75, 0.42, 0.06), COR.marinho, M([XM, Y, 0.27]));
  for (let i = 0; i < 6; i++) b.add(caixa(0.72, 0.035, 0.38), COR.marinho_claro, M([XM, Y - 0.28 + i * 0.112, 0.27]));
  const tampa = cil(0.2, 0.04, 12); tampa.rotateX(Math.PI / 2); b.add(tampa, COR.creme, M([XM, Y, 0.5]));
  const cubo = cil(0.06, 0.03, 8); cubo.rotateX(Math.PI / 2); b.add(cubo, COR.cinza_escuro || '#5c6672', M([XM, Y, 0.53]));
  b.add(caixa(1.2, 0.09, 0.09), COR.cinza, M([(XM + XG) / 2 + 0.1, Y, 0.27]));        // eixo até a engrenagem
  // conduíte: desce pela parede e sai pelo chão
  const cond = new THREE.CatmullRomCurve3([[XM, Y - 0.4, 0.2], [XM, 0.3, 0.1], [XM, 0.06, 0.15], [XM + 0.1, 0.05, 0.6]].map((p) => new THREE.Vector3(...p)));
  b.add(new THREE.TubeGeometry(cond, 10, 0.04, 6, false), '#5c6672');
  raiz.add(b.malha('motor_malha'));
  // luz "ligado": acesa embaixo, capa apagada por cima
  const la = new Balde(); const g = new THREE.SphereGeometry(0.05, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI / 2);
  la.add(g, COR.led_aceso, M([XM - 0.24, Y + 0.3, 0.48]), true); raiz.add(la.malha('luz_acesa'));
  const lc = new Balde(); const g2 = new THREE.SphereGeometry(0.052, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); g2.rotateX(Math.PI / 2);
  lc.add(g2, '#7a2b26', M([0, 0, 0])); raiz.add(no('luz_apagada', [lc.malha('luz_apagada_malha')], [XM - 0.24, Y + 0.3, 0.481]));
  // engrenagem amarela de 12 dentes (facetada), com cubo e 3 parafusos
  const R = 0.8, ri = 0.66, eng = new THREE.Shape(); const N = 12;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, d = Math.PI * 2 / N;
    const pts = [[ri, a0], [R, a0 + d * 0.15], [R, a0 + d * 0.45], [ri, a0 + d * 0.6]];
    pts.forEach(([r, a], k) => { const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0 && k === 0) eng.moveTo(x, y); else eng.lineTo(x, y); });
  }
  eng.closePath();
  const furo = new THREE.Path(); furo.absarc(0, 0, 0.12, 0, Math.PI * 2, true); eng.holes.push(furo);
  const ge = new Balde(); ge.add(placa(eng, 0.08, 1), COR.amarelo);
  const cuboG = cil(0.16, 0.12, 10); cuboG.rotateX(Math.PI / 2); ge.add(cuboG, COR.marinho);
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3, p = cil(0.05, 0.1, 6); p.rotateX(Math.PI / 2); ge.add(p, COR.dourado, M([Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.01])); }
  raiz.add(no('engrenagem', [ge.malha('engrenagem_malha')], [XG, Y, 0.27]));
  clipes.push(new THREE.AnimationClip('ligar', 0.4, [trilhaEsc('luz_apagada', [0, 0.1, 0.12, 0.4], [1, 1, 0.0001, 0.0001])]));
  const voltas = [0, 1, 2, 3, 4].map((k) => k * 1.5);
  clipes.push(new THREE.AnimationClip('girar', 6, [trilhaRot('engrenagem', voltas, [0, -90, -180, -270, -360].map((g) => [0, 0, g]))]));
}

// Quadro do esquema (parede em z = 0): desenho em peças planas + nomes numa textura pequena
function quadro() {
  raiz.name = 'quadro_esquema';
  const CY = 1.45, Z = 0.045; const P = (x, y, z = 0) => [x, CY + y, Z + z];
  const b = new Balde();
  b.add(caixa(2.0, 1.3, 0.04, 0.02), COR.madeira, M([0, CY, 0.02]));
  b.add(caixa(1.86, 1.16, 0.01), COR.petroleo, M([0, CY, 0.042]));
  const linha = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0); b.add(caixa(L + 0.02, 0.02, 0.004), COR.branco, M(P((x0 + x1) / 2, (y0 + y1) / 2), [0, 0, Math.atan2(y1 - y0, x1 - x0)])); };
  // fios do circuito (laço)
  linha(-0.62, 0.36, 0.62, 0.36); linha(0.62, 0.36, 0.62, -0.36); linha(0.62, -0.36, 0.38, -0.36); linha(0.18, -0.36, -0.62, -0.36);
  linha(-0.62, -0.36, -0.62, -0.25); linha(-0.62, 0.25, -0.62, 0.36);
  raiz.add(b.malha('quadro_malha'));
  const desenho = (nome, f) => { const d = new Balde(); f(d); raiz.add(d.malha('desenho_' + nome)); };
  // pilhas (duas, em pé, + em cima)
  desenho('pilhas', (d) => { d.add(caixa(0.16, 0.22, 0.004), COR.amarelo, M(P(-0.62, 0.12, 0.004))); d.add(caixa(0.16, 0.22, 0.004), COR.amarelo, M(P(-0.62, -0.12, 0.004)));
    d.add(caixa(0.06, 0.03, 0.004), COR.cinza, M(P(-0.62, 0.245, 0.004))); d.add(caixa(0.16, 0.012, 0.005), COR.petroleo, M(P(-0.62, 0, 0.005))); });
  // resistor com as faixas
  desenho('resistor', (d) => { d.add(caixa(0.34, 0.1, 0.004), COR.resistor, M(P(-0.05, 0.36, 0.004)));
    [[-0.1, COR.vermelho], [-0.06, COR.vermelho], [-0.02, COR.marrom], [0.06, COR.dourado]].forEach(([x, c]) => d.add(caixa(0.022, 0.1, 0.005), c, M(P(x - 0.05 + 0.05, 0.36, 0.005)))); });
  // jumpers (vermelho no fio de cima? não: no fio de baixo, perto das pilhas) — "ponte" em U
  desenho('jumper', (d) => { for (const s of [-1, 1]) d.add(caixa(0.025, 0.1, 0.004), COR.aqua, M(P(-0.2 + s * 0.08, -0.31, 0.004))); d.add(caixa(0.185, 0.025, 0.004), COR.aqua, M(P(-0.2, -0.26, 0.004))); });
  // LED de verdade: cúpula vermelha, aba, perna longa (+) e perna curta (−) com dobra
  desenho('led', (d) => {
    d.add(caixa(0.14, 0.14, 0.004), COR.led, M(P(0.3, -0.03, 0.004))); d.add(new THREE.CircleGeometry(0.07, 10, 0, Math.PI), COR.led, M(P(0.3, 0.04, 0.006)));
    d.add(caixa(0.18, 0.025, 0.004), COR.led, M(P(0.3, -0.1, 0.005)));
    d.add(caixa(0.014, 0.26, 0.004), COR.metal_perna, M(P(0.38, -0.24, 0.004)));                         // + longa (à direita, vem do fio da direita)
    d.add(caixa(0.014, 0.12, 0.004), COR.metal_perna, M(P(0.22, -0.17, 0.004)));                         // − curta
    d.add(caixa(0.05, 0.014, 0.004), COR.metal_perna, M(P(0.2, -0.23, 0.004))); d.add(caixa(0.014, 0.13, 0.004), COR.metal_perna, M(P(0.18, -0.3, 0.004)));
    for (const [x, y] of [[0.43, -0.06]]) { d.add(caixa(0.05, 0.012, 0.004), COR.vermelho, M(P(x, y, 0.006))); d.add(caixa(0.012, 0.05, 0.004), COR.vermelho, M(P(x, y, 0.006))); }
    d.add(caixa(0.05, 0.012, 0.004), COR.aqua, M(P(0.13, -0.06, 0.006)));
  });
  // destaques Lima atrás de cada desenho (escala 0 → 1 quando a peça certa encaixa)
  for (const [nome, x, y, w, h] of [['pilhas', -0.62, 0, 0.24, 0.56], ['resistor', -0.05, 0.36, 0.42, 0.18], ['led', 0.3, -0.12, 0.34, 0.44], ['jumper', -0.2, -0.28, 0.26, 0.17]]) {
    const dd = new Balde(); const e = 0.016; // moldura Lima em volta do desenho
    for (const [mx, my, mw, mh] of [[0, h / 2, w, e], [0, -h / 2, w, e], [-w / 2, 0, e, h + e], [w / 2, 0, e, h + e]]) dd.add(caixa(mw, mh, 0.002), COR.lima, M([mx, my, 0]), true);
    const n = no('destaque_' + nome, [dd.malha('destaque_' + nome + '_malha')], P(x, y, 0.001)); n.scale.setScalar(0.0001); raiz.add(n);
  }
  // nomes: textura pequena com fundo transparente
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640; const x = cv.getContext('2d');
  const txt = (s, px, py, cor, tam = 50, al = 'center') => { x.font = `bold ${tam}px sans-serif`; x.fillStyle = cor; x.textAlign = al; x.fillText(s, px, py); };
  const U = (vx) => 512 + vx * 1024 / 1.86, V = (vy) => 320 - vy * 640 / 1.16;
  txt('PILHAS 3 V', U(-0.45), V(0.02), '#e2a72e', 46, 'left');
  txt('RESISTOR 220 Ω', U(-0.12), V(0.21), '#e8f3f2', 40);
  txt('LED', U(0.42), V(0.02), '#ff7a6b', 50, 'left');
  txt('+ perna longa', U(0.42), V(-0.2), '#ff7a6b', 32, 'left');
  txt('− perna curta', U(0.15), V(-0.16), '#4fd6d0', 32, 'right');
  txt('JUMPER', U(-0.2), V(-0.47), '#4fd6d0', 42);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const nomes = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.16), new THREE.MeshBasicMaterial({ map: tex, transparent: true, name: 'quadro_nomes' }));
  nomes.position.set(0, CY, Z + 0.012); nomes.name = 'nomes'; raiz.add(nomes);
  clipes.push(new THREE.AnimationClip('destacar_todos', 3, ['pilhas', 'jumper', 'resistor', 'led'].map((n, i) => trilhaEsc('destaque_' + n, [0, 0.5 + i * 0.6, 0.55 + i * 0.6, 3], [0.0001, 0.0001, 1, 1]))));
}

// Braço reserva do MetalgabuTRON (igual ao dele: ombro, varetas, cotovelo, garra aberta)
function bracoReserva(b, x, y, z) {
  b.add(new THREE.SphereGeometry(0.09, 8, 5), COR.cinza, M([x, y, z]));
  b.add(cil(0.022, 0.16, 8), '#5c6672', M([x, y - 0.08, z]));
  b.add(new THREE.SphereGeometry(0.042, 6, 4), COR.cinza, M([x, y - 0.16, z]));
  b.add(cil(0.02, 0.14, 8), '#5c6672', M([x, y - 0.23, z]));
  b.add(new THREE.SphereGeometry(0.04, 6, 4), COR.cinza, M([x, y - 0.3, z]));
  for (const [ax, az] of [[0.03, 0.025], [-0.03, 0.025], [0, -0.035]]) b.add(new THREE.CapsuleGeometry(0.014, 0.05, 1, 4), COR.cinza, M([x + ax, y - 0.35, z + az], [az * 6, 0, -ax * 8]));
}
function prateleira() {
  raiz.name = 'prateleira_ferramentas';
  const b = new Balde();
  b.add(caixa(2.4, 1.9, 0.04), COR.marinho_claro, M([0, 1.15, 0.02]));                 // fundo na parede
  for (const y of [0.9, 1.5]) { b.add(caixa(2.4, 0.04, 0.36, 0.01), COR.creme, M([0, y, 0.2])); for (const x of [-1.1, 0, 1.1]) b.add(caixa(0.03, 0.12, 0.3), COR.marinho, M([x, y - 0.08, 0.17], [0, 0, 0])); }
  // ganchos e 2 braços reservas pendurados em cima
  for (const x of [-0.85, -0.45]) { b.add(cil(0.012, 0.1, 5), COR.cinza, M([x, 2.0, 0.07], [Math.PI / 2, 0, 0])); bracoReserva(b, x, 1.98, 0.14); }
  // prateleira de cima: multímetro, rolo de fio, caixa de peças
  b.add(caixa(0.18, 0.26, 0.07, 0.015), COR.amarelo, M([0.15, 1.65, 0.2]));
  b.add(caixa(0.13, 0.07, 0.01), COR.tela_verde, M([0.15, 1.72, 0.24]));
  const bt = cil(0.035, 0.02, 10); bt.rotateX(Math.PI / 2); b.add(bt, COR.marinho, M([0.15, 1.6, 0.24]));
  const rolo = new THREE.TorusGeometry(0.09, 0.05, 5, 10); b.add(rolo, COR.vermelho, M([0.55, 1.66, 0.2]));
  b.add(cil(0.04, 0.12, 8), COR.creme, M([0.55, 1.66, 0.2], [Math.PI / 2, 0, 0]));
  b.add(caixa(0.36, 0.24, 0.26, 0.015), COR.oliva, M([0.95, 1.64, 0.2]));
  for (const y of [1.59, 1.69]) b.add(caixa(0.08, 0.02, 0.01), COR.creme, M([0.95, y, 0.335]));
  // prateleira de baixo: chave de fenda, alicate, caixinha
  b.add(cil(0.025, 0.14, 8), COR.coral, M([-0.7, 0.945, 0.2], [0, 0, Math.PI / 2]));
  b.add(cil(0.006, 0.16, 5), COR.metal_perna, M([-0.55, 0.945, 0.2], [0, 0, Math.PI / 2]));
  for (const s of [-1, 1]) b.add(caixa(0.025, 0.24, 0.02), COR.aqua, M([-0.15, 1.02, 0.2], [0, 0, s * 0.35]));
  b.add(caixa(0.06, 0.08, 0.025), COR.metal_perna, M([-0.15, 1.15, 0.2]));
  b.add(caixa(0.3, 0.12, 0.2, 0.01), COR.marinho, M([0.5, 0.98, 0.2]));
  raiz.add(b.malha('prateleira_malha'));
}
function bancadaSolda() {
  raiz.name = 'bancada_solda';
  const b = new Balde(); const Y = 0.85;
  b.add(caixa(1.2, 0.04, 0.6, 0.012), COR.creme, M([0, Y - 0.02, 0]));
  for (const x of [-0.55, 0.55]) b.add(caixa(0.06, Y - 0.04, 0.55), COR.marinho, M([x, (Y - 0.04) / 2, 0]));
  // estação de solda: caixa com botão e mostrador
  b.add(caixa(0.3, 0.14, 0.22, 0.015), COR.marinho, M([-0.35, Y + 0.07, -0.05]));
  const bot = cil(0.035, 0.02, 10); bot.rotateX(Math.PI / 2); b.add(bot, COR.creme, M([-0.42, Y + 0.07, 0.065]));
  b.add(caixa(0.09, 0.04, 0.008), COR.coral, M([-0.29, Y + 0.08, 0.062]));
  // DESCANSO DO FERRO: base pesada + mola em espiral inclinada (o ferro fica dentro da mola)
  const inc = deg(40), cx = 0.05, cz = -0.02;
  b.add(cil(0.09, 0.03, 10), COR.marinho, M([cx, Y + 0.015, cz]));
  b.add(caixa(0.03, 0.1, 0.03), '#5c6672', M([cx, Y + 0.07, cz]));
  const helice = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * Math.PI * 2 * 7; helice.push(new THREE.Vector3(Math.cos(a) * 0.03, t * 0.17, Math.sin(a) * 0.03)); }
  const mola = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helice), 70, 0.003, 3, false);
  const mMola = M([cx, Y + 0.1, cz], [0, 0, -inc]); b.add(mola, COR.metal_perna, mMola);
  // ferro dentro da mola: cabo preto saindo por cima, ponta de metal para dentro
  const dir = new THREE.Vector3(Math.sin(inc), Math.cos(inc), 0);
  const ponto = (d) => new THREE.Vector3(cx, Y + 0.1, cz).addScaledVector(dir, d);
  const cabo = cil(0.018, 0.16, 8); b.add(cabo, '#2a2f36', M(ponto(0.25).toArray(), [0, 0, -inc]));
  b.add(cil(0.008, 0.16, 6), COR.metal_perna, M(ponto(0.1).toArray(), [0, 0, -inc]));
  b.add(new THREE.ConeGeometry(0.006, 0.03, 6), COR.cinza, M(ponto(0.005).toArray(), [0, 0, Math.PI - inc]));
  const cab = new THREE.CatmullRomCurve3([ponto(0.33), ponto(0.36).add(new THREE.Vector3(0.05, -0.05, 0)), new THREE.Vector3(-0.2, Y + 0.12, -0.1), new THREE.Vector3(-0.25, Y + 0.08, -0.06)]);
  b.add(new THREE.TubeGeometry(cab, 10, 0.007, 5, false), '#2a2f36'); // cabo preso nos dois lados (estação ↔ ferro)
  // rolo de solda no suporte
  b.add(caixa(0.12, 0.02, 0.08), COR.marinho, M([0.3, Y + 0.01, 0.12]));
  const rs = new THREE.TorusGeometry(0.035, 0.018, 6, 10); b.add(rs, COR.metal_perna, M([0.3, Y + 0.075, 0.12]));
  b.add(cil(0.006, 0.08, 5), '#5c6672', M([0.3, Y + 0.075, 0.12], [Math.PI / 2, 0, 0]));
  // terceira mão com lupa
  b.add(caixa(0.12, 0.025, 0.1), COR.marinho, M([0.42, Y + 0.012, -0.12]));
  b.add(cil(0.006, 0.22, 5), '#5c6672', M([0.42, Y + 0.13, -0.12]));
  const aro = new THREE.TorusGeometry(0.06, 0.008, 4, 12); b.add(aro, '#5c6672', M([0.42, Y + 0.28, -0.08], [-0.4, 0, 0]));
  b.add(cil(0.055, 0.004, 12), COR.aqua, M([0.42, Y + 0.28, -0.08], [Math.PI / 2 - 0.4, 0, 0]));
  for (const s of [-1, 1]) { b.add(cil(0.004, 0.12, 4), '#5c6672', M([0.42 + s * 0.06, Y + 0.18, -0.08], [0, 0, s * 0.8])); b.add(caixa(0.012, 0.03, 0.012), COR.vermelho, M([0.42 + s * 0.11, Y + 0.14, -0.08])); }
  raiz.add(b.malha('bancada_solda_malha'));
}

// =====================================================================
// 10. SALA CENTRAL: painel das 3 luzes, comunicador de pulso, mirantes e faixas no chão
// Cores das missões: ponte aqua, treinamento violeta, oficina amarelo; portal branco (no fim)
// =====================================================================
const MISSOES = [['ponte', COR.aqua], ['treinamento', COR.violeta], ['oficina', COR.amarelo]];
// Símbolos planos (no plano XY, ~raio 1): foguete do tangram, carinha de gato e engrenagem
function simbolo(tipo, k) {
  if (tipo === 'ponte') {
    const pts = [[0, 3], [1, 2], [1, 1], [2, 0], [0.5, 0], [0.5, -1], [-0.5, -2], [-1.5, -2], [-0.5, -1], [-0.5, 0], [-2, 0], [-1, 1], [-1, 2]];
    const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo : s.moveTo).call(s, x * k * 0.38, (y - 0.5) * k * 0.38)); s.closePath();
    return [new THREE.ShapeGeometry(s)];
  }
  if (tipo === 'treinamento') {
    const g = [new THREE.CircleGeometry(k * 0.62, 8).translate(0, -k * 0.12, 0)];
    for (const sx of [-1, 1]) { const o = new THREE.Shape(); o.moveTo(sx * k * 0.2, k * 0.3); o.lineTo(sx * k * 0.58, k * 0.85); o.lineTo(sx * k * 0.62, k * 0.15); o.closePath(); g.push(new THREE.ShapeGeometry(o)); }
    return g;
  }
  const s = new THREE.Shape(); const N = 8;
  for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, d = Math.PI * 2 / N;
    [[0.72, a0], [0.95, a0 + d * 0.15], [0.95, a0 + d * 0.45], [0.72, a0 + d * 0.6]].forEach(([r, a], j) => { const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k; if (i === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y); }); }
  s.closePath(); const h = new THREE.Path(); h.absarc(0, 0, k * 0.3, 0, Math.PI * 2, true); s.holes.push(h);
  return [new THREE.ShapeGeometry(s, 2)];
}
function painel() {
  raiz.name = 'painel_luzes';
  const Y = 1.5, b = new Balde();
  b.add(caixa(1.6, 0.85, 0.08, 0.06), COR.marinho, M([0, Y, 0.04]));
  b.add(caixa(1.4, 0.05, 0.01), COR.marinho_claro, M([0, Y + 0.33, 0.085]));
  MISSOES.forEach(([, ], i) => { const g = cil(0.21, 0.03, 14); g.rotateX(Math.PI / 2); b.add(g, COR.creme, M([(i - 1) * 0.5, Y - 0.03, 0.09])); });
  raiz.add(b.malha('painel_malha'));
  MISSOES.forEach(([nome, cor], i) => {
    const x = (i - 1) * 0.5, y = Y - 0.03;
    const ac = new Balde(); ac.add(new THREE.CircleGeometry(0.175, 14), cor, M([x, y, 0.106]), true);
    for (const g of simbolo(nome, 0.11)) { g.deleteAttribute('uv'); ac.add(g, COR.petroleo, M([x, y, 0.108]), true); }
    raiz.add(ac.malha(`luz_${nome}_acesa`));
    const ap = new Balde(); ap.add(new THREE.CircleGeometry(0.177, 14), COR.petroleo, M([0, 0, 0]));
    for (const g of simbolo(nome, 0.11)) { g.deleteAttribute('uv'); ap.add(g, '#2c4a58', M([0, 0, 0.002])); }
    raiz.add(no(`luz_${nome}_apagada`, [ap.malha(`luz_${nome}_apagada_malha`)], [x, y, 0.112]));
    clipes.push(new THREE.AnimationClip('acender_' + nome, 0.6, [trilhaEsc(`luz_${nome}_apagada`, [0, 0.1, 0.12, 0.6], [1, 1, 0.0001, 0.0001])]));
  });
}

// Comunicador de pulso: origem no centro do pulso; mostrador virado para +Z; braço ao longo de X
function comunicador() {
  raiz.name = 'comunicador';
  const Z = 0.032; // altura do mostrador acima do centro do pulso
  const b = new Balde();
  b.add(caixa(0.056, 0.048, 0.016, 0.008), COR.marinho, M([0, 0, Z]));
  b.add(caixa(0.05, 0.042, 0.004, 0.006), COR.creme, M([0, 0, Z + 0.008]));
  b.add(caixa(0.04, 0.024, 0.002), COR.petroleo, M([0, 0.004, Z + 0.0105]));
  const bt = cil(0.004, 0.006, 6); bt.rotateZ(Math.PI / 2); b.add(bt, COR.coral, M([0.031, 0.002, Z]));
  b.add(cil(0.0018, 0.008, 5), COR.cinza, M([-0.012, 0.027, Z + 0.002]));
  // pulseira em gomos em volta do pulso (eixo X)
  for (let k = 1; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2; const r = 0.034;
    b.add(caixa(0.024, 0.016, 0.006, 0.002), COR.marinho_claro, M([0, Math.sin(a) * r, Math.cos(a) * r - 0.002], [-a, 0, 0]));
  }
  raiz.add(b.malha('comunicador_malha'));
  const ant = new Balde(); ant.add(new THREE.SphereGeometry(0.0028, 6, 4), COR.lima, null, true);
  raiz.add(no('antena_luz', [ant.malha('antena_luz_malha')], [-0.012, 0.032, Z + 0.002]));
  // onda sonora: 7 barrinhas (escala Y)
  for (let i = 0; i < 7; i++) { const bb = new Balde(); bb.add(caixa(0.0035, 0.016, 0.001), COR.aqua, null, true); const n = no('barra_' + i, [bb.malha('barra_' + i + '_malha')], [-0.015 + i * 0.005, 0.004, Z + 0.0118]); n.scale.set(1, 0.2, 1); raiz.add(n); }
  // anel de chamada (pisca) em volta do mostrador
  const anel = new Balde(); for (const [x, y, w, h] of [[0, 0.0175, 0.044, 0.002], [0, -0.0095, 0.044, 0.002], [-0.021, 0.004, 0.002, 0.029], [0.021, 0.004, 0.002, 0.029]]) anel.add(caixa(w, h, 0.001), COR.aqua, M([x, y, 0]), true);
  const nAnel = no('anel_chamada', [anel.malha('anel_chamada_malha')], [0, 0, Z + 0.0112]); nAnel.scale.setScalar(0.0001); raiz.add(nAnel);
  // 3 LEDs das missões (acesos embaixo, capa apagada em cima)
  const acesos = new Balde();
  MISSOES.forEach(([nome, cor], i) => {
    const x = -0.012 + i * 0.012, y = -0.014;
    acesos.add(new THREE.CircleGeometry(0.0032, 8), cor, M([x, y, Z + 0.0102]), true);
    const c = new Balde(); c.add(new THREE.CircleGeometry(0.0034, 8), '#2c4a58', M()); raiz.add(no(`led_${nome}_apagado`, [c.malha(`led_${nome}_apagado_malha`)], [x, y, Z + 0.0106]));
  });
  raiz.add(acesos.malha('leds_acesos'));
  // CHAMAR (1 s, loop): anel pisca, LEDs correm, antena pisca
  const ts = [0, 0.25, 0.5, 0.75, 1];
  clipes.push(new THREE.AnimationClip('chamar', 1, [
    trilhaEsc('anel_chamada', ts, [1, 0.0001, 1, 0.0001, 1]),
    ...MISSOES.map(([n], i) => trilhaEsc(`led_${n}_apagado`, [0, 0.12 + i * 0.25, 0.13 + i * 0.25, 0.3 + i * 0.25, 0.31 + i * 0.25, 1], [1, 1, 0.0001, 0.0001, 1, 1])),
    trilhaEsc('antena_luz', ts, [1.5, 1, 1.5, 1, 1.5]),
  ]));
  // FALAR (2,4 s, loop): barrinhas viram onda sonora; LEDs piscam no ritmo
  const tf = []; for (let i = 0; i <= 48; i++) tf.push(i * 0.05);
  const vol = (t) => Math.min(1, Math.max(0, Math.sin(t * 11) * 0.5 + Math.sin(t * 17 + 1) * 0.35 + 0.3)) * (t < 2.2 ? 1 : 0);
  clipes.push(new THREE.AnimationClip('falar', 2.4, [
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => new THREE.VectorKeyframeTrack(`barra_${i}.scale`, tf, tf.flatMap((t) => { const v = vol(t) * (0.4 + 0.6 * Math.abs(Math.sin(t * 13 + i * 0.9))) * Math.sin(Math.PI * (i + 0.5) / 7); return [1, 0.2 + v * 0.8, 1]; }))),
    ...MISSOES.map(([n], i) => new THREE.VectorKeyframeTrack(`led_${n}_apagado.scale`, tf, tf.flatMap((t) => { const s = vol(t) > 0.35 + i * 0.12 ? 0.0001 : 1; return [s, s, s]; }))),
  ]));
}

// Mirante: versão menor do janelão (3 vidros, ~4,5 m em arco), raio da sala (6 m)
function mirante() { janela({ nome: 'mirante', R: 6, N: 3, passo: deg(12) }); }

// Faixas no chão (do anel do início até cada porta) e o anel do início
function faixas() {
  raiz.name = 'faixas_chao';
  const r0 = 1.5, r1 = 5.75, L = r1 - r0, W = 0.3;
  const base = new Balde();
  const anel = new THREE.RingGeometry(1.2, 1.3, 24); anel.rotateX(-Math.PI / 2); base.add(anel, COR.marinho_claro, M([0, 0.003, 0]));
  raiz.add(base.malha('inicio'));
  const dirs = { ponte: [0, -1], treinamento: [-1, 0], oficina: [1, 0], portal: [0, 1] };
  for (const [nome, cor] of [...MISSOES, ['portal', COR.branco]]) {
    const [dx, dz] = dirs[nome]; const rot = [0, Math.atan2(dx, dz), 0]; const c = [dx * (r0 + L / 2), 0, dz * (r0 + L / 2)];
    const ac = new Balde(); ac.add(caixa(W, 0.004, L, 0), cor, M([0, 0.002, 0]), true);
    for (let k = 0; k < 6; k++) { const s = new THREE.Shape(); s.moveTo(-0.09, -0.05); s.lineTo(0, 0.05); s.lineTo(0.09, -0.05); s.lineTo(0.09, -0.1); s.lineTo(0, 0); s.lineTo(-0.09, -0.1); s.closePath();
      const g = new THREE.ShapeGeometry(s); g.deleteAttribute('uv'); g.rotateX(-Math.PI / 2); ac.add(g, COR.petroleo, M([0, 0.0045, -L / 2 + 0.4 + k * (L - 0.8) / 5], [0, Math.PI, 0]), true); }
    const n = no('faixa_' + nome, [ac.malha('faixa_' + nome + '_acesa')], c, rot); raiz.add(n);
    const ap = new Balde(); ap.add(caixa(W + 0.004, 0.004, L + 0.004, 0), COR.marinho_claro, M()); 
    raiz.add(no('faixa_' + nome + '_apagada', [ap.malha('faixa_' + nome + '_apagada_malha')], [c[0], 0.0065, c[2]], rot));
    clipes.push(new THREE.AnimationClip('acender_' + nome, 0.8, [trilhaEsc('faixa_' + nome + '_apagada', [0, 0.1, 0.12, 0.8], [1, 1, 0.0001, 0.0001])]));
  }
}

// =====================================================================
// 11. SALA DE TREINAMENTO: máquina de clonagem, botão "não aperte", esconderijos e parapeito
// =====================================================================
COR.papelao2 = '#b98f57'; COR.palito = '#e9d3a6'; COR.lata = '#c9ced4'; COR.lata_esc = '#8d98a4';
function textoTex(linhas, w, h, fundo) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
  if (fundo) { x.fillStyle = fundo; x.fillRect(0, 0, w, h); }
  for (const [s, px, py, cor, tam] of linhas) { x.font = `900 ${tam}px sans-serif`; x.fillStyle = cor; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, px, py); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function placaTexto(tex, w, h, nome, transparente = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: transparente, name: nome })); m.name = nome; return m;
}
function maquina() {
  raiz.name = 'maquina_clonagem';
  const corpo = new THREE.Group(); corpo.name = 'corpo';
  const b = new Balde();
  b.add(caixa(1.6, 1.9, 1.2, 0.08), COR.marinho, M([0, 0.95, 0]));
  b.add(caixa(1.7, 0.16, 1.3, 0.05), COR.creme, M([0, 1.95, 0]));
  for (const [x, ang] of [[-0.42, 30], [0.42, -40]]) {               // mostradores (os ponteiros são nós)
    const d = cil(0.2, 0.03, 14); d.rotateX(Math.PI / 2); b.add(d, COR.creme, M([x, 1.1, 0.61]));
  }
  // cortina de tiras na saída da esteira
  b.add(caixa(0.8, 0.85, 0.04), COR.petroleo, M([0, 0.43, 0.6]));
  for (let i = 0; i < 6; i++) b.add(caixa(0.12, 0.8, 0.012), '#5c6672', M([-0.33 + i * 0.132, 0.45, 0.625]));
  // chaminé e base da antena
  b.add(cil(0.09, 0.5, 10), '#5c6672', M([0.6, 2.25, -0.3]));
  b.add(cil(0.04, 0.3, 8), '#5c6672', M([-0.62, 2.15, -0.3]));
  corpo.add(b.malha('maquina_malha'));
  // cúpula de vidro com a silhueta de um clone girando (brilho)
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.vidro.clone()); cup.material.opacity = 0.25; cup.position.set(0, 2.03, 0); cup.name = 'cupula'; corpo.add(cup);
  const sil = new Balde(); sil.add(new THREE.SphereGeometry(0.17, 10, 6), COR.aqua, M([0, 0.17, 0]), true);
  for (const s of [-1, 1]) sil.add(new THREE.ConeGeometry(0.06, 0.13, 4), COR.aqua, M([s * 0.1, 0.33, 0], [0, 0, -s * 0.3]), true);
  corpo.add(no('silhueta', [sil.malha('silhueta_malha')], [0, 2.03, 0]));
  // ponteiros
  for (const [nome, x] of [['ponteiro_L', -0.42], ['ponteiro_R', 0.42]]) { const p = new Balde(); p.add(caixa(0.02, 0.16, 0.01), COR.vermelho, M([0, 0.07, 0])); corpo.add(no(nome, [p.malha(nome + '_malha')], [x, 1.1, 0.63])); }
  // 3 luzes (acesas embaixo, capas apagadas em cima)
  const ac = new Balde();
  [[-0.55, COR.vermelho], [-0.4, COR.amarelo], [-0.25, COR.lima]].forEach(([x, cor], i) => {
    ac.add(new THREE.CircleGeometry(0.055, 10), cor, M([x, 1.6, 0.605]), true);
    const c = new Balde(); c.add(new THREE.CircleGeometry(0.058, 10), '#2c4a58', M()); corpo.add(no(`luz_${i}_apagada`, [c.malha(`luz_${i}_apagada_malha`)], [x, 1.6, 0.607]));
  });
  corpo.add(ac.malha('luzes_acesas'));
  // placa DEFEITO: acesa (vermelha, texto branco) com capa apagada
  const tAc = textoTex([['DEFEITO', 256, 64, '#ffffff', 84]], 512, 128, '#c0392b');
  const pa = placaTexto(tAc, 0.6, 0.15, 'placa_defeito_acesa'); pa.position.set(0.25, 1.6, 0.605); corpo.add(pa);
  const tAp = textoTex([['DEFEITO', 256, 64, '#3d5563', 84]], 512, 128, '#1d2328');
  const pp = placaTexto(tAp, 0.6, 0.15, 'placa_defeito_apagada_malha'); const np = no('placa_defeito_apagada', [pp], [0.25, 1.6, 0.607]); corpo.add(np);
  // antena parabólica torta (nó que cai ao desligar)
  const an = new Balde(); const perfil = [[0, 0], [0.22, 0.06], [0.26, 0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const prato = new THREE.LatheGeometry(perfil, 10); an.add(prato, COR.creme, M([0, 0.25, 0], [0.5, 0, 0])); an.add(cil(0.015, 0.3, 6), '#5c6672', M([0, 0.12, 0]));
  an.add(new THREE.SphereGeometry(0.03, 6, 4), COR.vermelho, M([0, 0.36, 0.06]));
  corpo.add(no('antena', [an.malha('antena_malha')], [-0.62, 2.3, -0.3], [0, 0.4, -0.35]));
  // fumacinha (aparece no defeito)
  const fu = new Balde(); [[0, 0, 0.1], [0.08, 0.16, 0.13], [-0.04, 0.34, 0.1]].forEach(([x, y, r]) => fu.add(new THREE.IcosahedronGeometry(r, 0).toNonIndexed(), '#b9c0c4', M([x, y, 0])));
  const nf = no('fumaca', [fu.malha('fumaca_malha')], [0.6, 2.6, -0.3]); nf.scale.setScalar(0.0001); corpo.add(nf);
  raiz.add(corpo);
  // esteira (fora do corpo, não treme): 3 m saindo da cortina para +Z
  const e = new Balde();
  e.add(caixa(0.9, 0.12, 3.0), '#5c6672', M([0, 0.3, 2.1]));
  e.add(caixa(0.82, 0.02, 3.0), COR.marinho_claro, M([0, 0.37, 2.1]));
  for (const s of [-1, 1]) e.add(caixa(0.04, 0.08, 3.0), COR.creme, M([s * 0.45, 0.4, 2.1]));
  for (const z of [0.8, 2.1, 3.4]) for (const s of [-1, 1]) e.add(caixa(0.06, 0.25, 0.06), '#5c6672', M([s * 0.38, 0.12, z]));
  raiz.add(e.malha('esteira_malha'));
  const rol = new Balde(); for (let i = 0; i < 9; i++) { const r = cil(0.045, 0.84, 8); r.rotateZ(Math.PI / 2); rol.add(r, COR.cinza, M([0, 0.33, 0.75 + i * 0.34])); }
  raiz.add(rol.malha('roletes'));
  // tiras pintadas que "andam" (o jogo desloca a textura; aqui, um nó que vai e volta)
  const tir = new Balde(); for (let i = 0; i < 8; i++) tir.add(caixa(0.8, 0.004, 0.06), COR.amarelo, M([0, 0.383, 0.75 + i * 0.38]));
  raiz.add(no('esteira_marcas', [tir.malha('esteira_marcas_malha')]));
  raiz.add(no('ponto_saida', [], [0, 0.4, 0.75])); raiz.add(no('ponto_fim_esteira', [], [0, 0.4, 3.55]));
  // DEFEITO (2 s, loop) e DESLIGAR (1,5 s)
  const T = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
  const sacode = T.map((t, i) => [Math.sin(i * 2.7) * 0.02, Math.abs(Math.sin(i * 1.9)) * 0.02, 0]);
  clipes.push(new THREE.AnimationClip('defeito', 2, [
    trilhaPos('corpo', T, sacode), trilhaRot('corpo', T, T.map((t, i) => [0, 0, Math.sin(i * 3.1) * 1.5])),
    trilhaRot('ponteiro_L', T, T.map((t, i) => [0, 0, Math.sin(i * 1.3) * 80])), trilhaRot('ponteiro_R', T, T.map((t, i) => [0, 0, Math.cos(i * 1.7) * 80])),
    ...[0, 1, 2].map((k) => trilhaEsc(`luz_${k}_apagada`, T, T.map((t, i) => ((i + k) % 3 === 0 ? 0.0001 : 1)))),
    trilhaEsc('placa_defeito_apagada', T, T.map((t, i) => (i % 2 ? 0.0001 : 1))),
    trilhaEsc('fumaca', [0, 0.5, 1.0, 1.5, 2.0], [0.4, 1.0, 1.3, 0.8, 0.4]),
    trilhaPos('fumaca', [0, 1, 2], [[0.6, 2.55, -0.3], [0.63, 2.75, -0.3], [0.6, 2.55, -0.3]]),
    trilhaRot('silhueta', [0, 0.5, 1, 1.5, 2], [0, -90, -180, -270, -360].map((g) => [0, g, 0])),
    trilhaPos('esteira_marcas', [0, 2], [[0, 0, 0], [0, 0, 0.38]]),
    trilhaRot('antena', T, T.map((t, i) => [Math.sin(i * 2) * 8, 23, -20 + Math.cos(i * 2.3) * 8])),
  ]));
  clipes.push(new THREE.AnimationClip('desligar', 1.5, [
    trilhaRot('antena', [0, 0.4, 0.8, 1.1, 1.5], [[0, 23, -20], [0, 23, -50], [0, 23, -95], [0, 23, -85], [0, 23, -90]]),
    trilhaRot('ponteiro_L', [0, 1.5], [[0, 0, 40], [0, 0, 100]]), trilhaRot('ponteiro_R', [0, 1.5], [[0, 0, -40], [0, 0, 100]]),
    ...[0, 1, 2].map((k) => trilhaEsc(`luz_${k}_apagada`, [0, 1.5], [1, 1])), trilhaEsc('placa_defeito_apagada', [0, 1.5], [1, 1]),
    trilhaEsc('fumaca', [0, 0.6, 0.8, 1.5], [1, 0.6, 0.0001, 0.0001]), trilhaPos('corpo', [0, 0.3, 0.5, 1.5], [[0, 0, 0], [0, -0.03, 0], [0, 0.01, 0], [0, 0, 0]]),
  ]));
}
function botaoCuidado() {
  raiz.name = 'botao_cuidado';
  const b = new Balde();
  b.add(caixa(0.3, 0.9, 0.3, 0.03), COR.marinho_claro, M([0, 0.45, 0]));
  b.add(caixa(0.45, 0.1, 0.45, 0.03), COR.marinho, M([0, 0.95, 0]));
  b.add(cil(0.012, 0.6, 5), '#5c6672', M([0.2, 1.3, -0.1]));
  b.add(caixa(0.62, 0.42, 0.03, 0.01), COR.amarelo, M([0.2, 1.68, -0.1]));
  raiz.add(b.malha('pedestal_malha'));
  const bt = new Balde(); bt.add(cil(0.15, 0.08, 14), COR.vermelho); bt.add(cil(0.16, 0.02, 14), COR.preto, M([0, -0.04, 0]));
  raiz.add(no('botao', [bt.malha('botao_malha')], [0, 1.04, 0]));
  const tex = textoTex([['⚠', 90, 128, '#14181d', 130], ['CUIDADO!', 330, 70, '#14181d', 70], ['NÃO APERTE', 330, 140, '#14181d', 52], ['ESTE BOTÃO!', 330, 196, '#14181d', 52]], 512, 256, '#e2a72e');
  const pl = placaTexto(tex, 0.58, 0.29, 'placa_cuidado'); pl.position.set(0.2, 1.68, -0.084); raiz.add(pl);
  clipes.push(new THREE.AnimationClip('apertar', 0.5, [trilhaPos('botao', [0, 0.1, 0.3, 0.5], [[0, 1.04, 0], [0, 0.99, 0], [0, 0.99, 0], [0, 1.04, 0]])]));
}
// Caixa de papelão aberta com cara de robô pintada (tipo 1, 2 ou 3) e respingos
function caixaRobo(tipo = 1, larg = 0.8, alt = 0.7, prof = 0.7) {
  const b = new Balde(); const e = 0.015;
  b.add(caixa(larg, e, prof), COR.papelao_escuro, M([0, e / 2, 0]));
  b.add(caixa(larg, alt, e), COR.papelao, M([0, alt / 2, prof / 2])); b.add(caixa(larg, alt, e), COR.papelao, M([0, alt / 2, -prof / 2]));
  b.add(caixa(e, alt, prof), COR.papelao2, M([larg / 2, alt / 2, 0])); b.add(caixa(e, alt, prof), COR.papelao2, M([-larg / 2, alt / 2, 0]));
  // abas abertas: cada aba gira em volta da DOBRA (a borda de cima da parede), inclinada para fora
  const aba = (comp, largA, ang, eixo, pos) => {
    const g = caixa(largA, comp, e); g.translate(0, comp / 2, 0); // começa na dobra (y = 0) e sobe
    if (eixo === 'z') g.rotateY(Math.PI / 2);
    const m = new THREE.Matrix4().makeTranslation(...pos).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(eixo === 'x' ? ang : 0, 0, eixo === 'z' ? ang : 0)));
    b.add(g, COR.papelao_escuro, m);
  };
  const ABRE = deg(58); // 0 = em pé; 58° = aberta, inclinada para fora (não cobre a cara pintada)
  aba(prof * 0.48, larg, ABRE, 'x', [0, alt, prof / 2]);
  aba(prof * 0.48, larg, -ABRE, 'x', [0, alt, -prof / 2]);
  aba(larg * 0.45, prof, -ABRE, 'z', [larg / 2, alt, 0]);
  aba(larg * 0.45, prof, ABRE, 'z', [-larg / 2, alt, 0]);
  const z = prof / 2 + e / 2 + 0.002, cy = alt * 0.5; const P = (x, y, dz = 0) => M([x, cy + y, z + dz]);
  const plano = (g, cor, m) => { g.deleteAttribute && g.attributes.uv && g.deleteAttribute('uv'); b.add(g, cor, m); };
  if (tipo === 1) {
    for (const [x, y, w, h] of [[0, 0.13, 0.5, 0.03], [0, -0.13, 0.5, 0.03], [-0.235, 0, 0.03, 0.29], [0.235, 0, 0.03, 0.29]]) plano(new THREE.PlaneGeometry(w, h), COR.marinho, P(x, y));
    for (const x of [-0.1, 0.1]) plano(new THREE.PlaneGeometry(0.08, 0.08), COR.aqua, P(x, 0.04, 0.001));
    for (let i = 0; i < 4; i++) plano(new THREE.PlaneGeometry(0.05, 0.025), COR.marinho, P(-0.09 + i * 0.06, -0.07, 0.001));
  } else if (tipo === 2) {
    for (const x of [-0.12, 0.12]) { plano(new THREE.CircleGeometry(0.08, 10), COR.marinho, P(x, 0.06)); plano(new THREE.CircleGeometry(0.06, 10), COR.creme, P(x, 0.06, 0.001)); plano(new THREE.CircleGeometry(0.025, 8), COR.marinho, P(x, 0.06, 0.002)); }
    const sorriso = new THREE.RingGeometry(0.1, 0.13, 10, 1, Math.PI * 1.15, Math.PI * 0.7); plano(sorriso, COR.coral, P(0, 0.0, 0.001));
    b.add(cil(0.008, 0.25, 5), COR.marinho, M([0, alt + 0.12, prof / 2 - 0.05])); b.add(new THREE.SphereGeometry(0.03, 6, 4), COR.coral, M([0, alt + 0.25, prof / 2 - 0.05]));
  } else {
    for (const s of [-1, 1]) { const tri = new THREE.Shape(); tri.moveTo(s * 0.04, 0.12); tri.lineTo(s * 0.2, 0.12); tri.lineTo(s * 0.12, 0.0); tri.closePath(); plano(new THREE.ShapeGeometry(tri), COR.violeta, P(0, 0)); }
    plano(new THREE.PlaneGeometry(0.3, 0.07), COR.marinho, P(0, -0.1));
    for (let i = 1; i < 4; i++) plano(new THREE.PlaneGeometry(0.012, 0.07), COR.creme, P(-0.15 + i * 0.075, -0.1, 0.001));
  }
  // respingos de tinta nas laterais e na frente
  [[COR.coral, 0.3, -0.22, 0.05], [COR.aqua, -0.3, 0.2, 0.035], [COR.amarelo, 0.25, 0.22, 0.03], [COR.lima, -0.28, -0.2, 0.04]].forEach(([cor, x, y, r]) => {
    plano(new THREE.CircleGeometry(r, 7), cor, P(x, y, 0.001)); plano(new THREE.CircleGeometry(r * 0.35, 5), cor, P(x + r * 1.4, y + r, 0.001));
  });
  plano(new THREE.CircleGeometry(0.06, 7), COR.violeta, M([larg / 2 + 0.01, alt * 0.4, 0.1], [0, Math.PI / 2, 0]));
  return b;
}
function esconderijo() {
  const tipo = TIPO; // caixa1, caixa2, caixa3, pilha, lata_aqua, lata_violeta, balde_amarelo, balde_coral
  if (tipo.startsWith('caixa')) {
    raiz.name = 'caixa_robo_' + tipo.slice(-1); raiz.add(caixaRobo(+tipo.slice(-1)).malha(raiz.name + '_malha'));
    raiz.add(no('ponto_dentro', [], [0, 0.02, 0])); raiz.add(no('ponto_atras', [], [0, 0, -0.75]));
    raiz.userData = { tipo: 'caixa', altura_borda_m: 0.7 };
  } else if (tipo === 'pilha') {
    raiz.name = 'caixas_bracinhos';
    const b = new Balde();
    b.add(caixa(0.9, 0.6, 0.8), COR.papelao2, M([0, 0.3, 0])); // caixa de baixo, fechada
    b.add(caixa(0.9, 0.02, 0.06), '#d8c8a8', M([0, 0.6, 0])); // fita
    raiz.add(b.malha('caixa_baixo'));
    const cima = caixaRobo(3); const n = no('caixa_cima', [cima.malha('caixa_cima_malha')], [0.03, 0.6, 0], [0, 0.08, 0]); raiz.add(n);
    // bracinhos de palito de picolé (dois palitos colados por braço, com "mãozinha" de tampinha)
    const br = new Balde();
    for (const s of [-1, 1]) {
      br.add(caixa(0.32, 0.035, 0.008, 0.012), COR.palito, M([s * 0.55, 0.95, 0.1], [0, 0, s * 0.5]));
      br.add(caixa(0.26, 0.035, 0.008, 0.012), COR.palito, M([s * 0.74, 1.13, 0.1], [0, 0, s * 1.2]));
      br.add(cil(0.04, 0.012, 8), COR.coral, M([s * 0.8, 1.27, 0.1], [Math.PI / 2, 0, 0]));
    }
    raiz.add(br.malha('bracinhos'));
    raiz.add(no('ponto_dentro', [], [0.03, 0.62, 0])); raiz.add(no('ponto_atras', [], [0, 0, -0.8]));
    raiz.userData = { tipo: 'caixa', altura_borda_m: 1.3 };
  } else if (tipo.startsWith('lata')) {
    const cor = tipo === 'lata_aqua' ? COR.aqua : COR.violeta; raiz.name = tipo;
    const b = new Balde(); const R = 0.4, H = 0.85;
    const perfil = [[0, 0.01], [R, 0.01], [R, H], [R + 0.02, H + 0.01], [R - 0.02, H + 0.02], [R - 0.02, 0.04], [0, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
    b.add(new THREE.LatheGeometry(perfil, 16), COR.lata);
    b.add(cil(R + 0.003, 0.4, 16), cor, M([0, 0.42, 0]));                      // rótulo colorido
    b.add(cil(R + 0.004, 0.03, 16), COR.lata_esc, M([0, 0.2, 0])); b.add(cil(R + 0.004, 0.03, 16), COR.lata_esc, M([0, 0.66, 0]));
    for (const [a, h] of [[0.3, 0.32], [1.1, 0.2], [2.4, 0.4], [4.0, 0.26]]) b.add(caixa(0.06, h, 0.02), cor, M([Math.sin(a) * (R + 0.01), H - h / 2 + 0.02, Math.cos(a) * (R + 0.01)], [0, a, 0])); // tinta escorrendo
    const alca = new THREE.TorusGeometry(R, 0.012, 4, 14, Math.PI); b.add(alca, COR.lata_esc, M([0, H, 0], [0, 0, 0]));
    // tampa caída no chão, encostada
    b.add(cil(R + 0.02, 0.03, 16), COR.lata_esc, M([R + 0.38, 0.05, 0.25], [0, 0, 0.18]));
    raiz.add(b.malha(tipo + '_malha'));
    raiz.add(no('ponto_dentro', [], [0, 0.04, 0])); raiz.add(no('ponto_atras', [], [0, 0, -0.7]));
    raiz.userData = { tipo: 'lata', altura_borda_m: H };
  } else {
    const cor = tipo === 'balde_amarelo' ? COR.amarelo : COR.coral; raiz.name = tipo;
    const b = new Balde(); const H = 0.5;
    const perfil = [[0, 0.01], [0.22, 0.01], [0.28, H], [0.3, H + 0.015], [0.265, H + 0.015], [0.205, 0.035], [0, 0.035]].map(([x, y]) => new THREE.Vector2(x, y));
    b.add(new THREE.LatheGeometry(perfil, 14), cor);
    b.add(new THREE.TorusGeometry(0.29, 0.008, 4, 12, Math.PI), '#5c6672', M([0, H, 0], [0.35, 0, 0]));
    raiz.add(b.malha(tipo + '_malha'));
    raiz.add(no('ponto_dentro', [], [0, 0.035, 0])); raiz.add(no('ponto_atras', [], [0, 0, -0.5]));
    raiz.userData = { tipo: 'balde', altura_borda_m: H, so_fred: true };
  }
}
function parapeito() {
  raiz.name = 'parapeito_posto';
  const b = new Balde(); const L = 4.0, H = 0.9;
  b.add(caixa(L, H - 0.06, 0.22), COR.marinho, M([0, (H - 0.06) / 2, 0]));
  b.add(caixa(L + 0.06, 0.06, 0.36, 0.02), COR.creme, M([0, H - 0.03, 0.04]));
  for (let i = 0; i < 5; i++) b.add(caixa(0.02, H - 0.2, 0.005), COR.marinho_claro, M([-L / 2 + 0.4 + i * (L - 0.8) / 4, (H - 0.06) / 2, 0.112]));
  raiz.add(b.malha('parapeito_malha'));
  raiz.userData = { altura_m: H };
}

// =====================================================================
// 12. CÂMARA DO PORTAL: portal de redemoinho, alavanca, Terra-cubo (Gabura Prime) e túnel
// =====================================================================
function texRedemoinho() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d');
  x.clearRect(0, 0, 512, 512);
  const cores = ['#7b4fd6', '#4fd6d0', '#c9b6ff', '#4fd6d0'];
  for (let k = 0; k < 4; k++) {
    x.beginPath();
    for (let i = 0; i <= 200; i++) { const u = i / 200, a = u * 2.6 * Math.PI * 2 + k * Math.PI / 2, r = 256 * (0.18 + 0.8 * u); const px = 256 + Math.cos(a) * r, py = 256 + Math.sin(a) * r; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.strokeStyle = cores[k]; x.lineWidth = k % 2 ? 22 : 34; x.lineCap = 'round'; x.stroke();
  }
  // miolo transparente: dá para ver Gabura Prime pelo meio do redemoinho
  const g = x.createRadialGradient(256, 256, 20, 256, 256, 90); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.beginPath(); x.arc(256, 256, 90, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function portal() {
  raiz.name = 'portal';
  const b = new Balde(); const Y = 2.0, R = 1.8;
  const anel = new THREE.Shape(); anel.absarc(0, 0, R + 0.18, 0, Math.PI * 2, false); const furo = new THREE.Path(); furo.absarc(0, 0, R - 0.05, 0, Math.PI * 2, true); anel.holes.push(furo);
  b.add(placa(anel, 0.3, 24), COR.creme, M([0, Y, 0]));
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; b.add(caixa(0.2, 0.12, 0.34), COR.marinho, M([Math.cos(a) * (R + 0.07), Y + Math.sin(a) * (R + 0.07), 0], [0, 0, a + Math.PI / 2])); }
  b.add(caixa(1.6, 0.25, 0.8, 0.04), COR.marinho, M([0, 0.125, 0]));
  b.add(caixa(0.9, 0.06, 0.6), COR.marinho_claro, M([0, 0.28, 0]));
  raiz.add(b.malha('portal_malha'));
  // 3 luzinhas das missões em cima
  [COR.aqua, COR.violeta, COR.amarelo].forEach((cor, i) => {
    const l = new Balde(); l.add(new THREE.SphereGeometry(0.1, 8, 6), cor, null, true); raiz.add(no('luz_' + i, [l.malha('luz_' + i + '_malha')], [(i - 1) * 0.4, Y + R + 0.32, 0]));
  });
  // redemoinho (disco com textura que gira) — começa pequeno e se expande com a alavanca
  const disco = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 32), new THREE.MeshBasicMaterial({ map: texRedemoinho(), transparent: true, side: THREE.DoubleSide, name: 'redemoinho' }));
  disco.name = 'redemoinho_disco';
  const rd = no('redemoinho', [disco], [0, Y, 0.02]); rd.scale.setScalar(0.25); raiz.add(rd);
  clipes.push(new THREE.AnimationClip('girar', 4, [trilhaRot('redemoinho', [0, 1, 2, 3, 4], [0, -90, -180, -270, -360].map((g) => [0, 0, g]))]));
  clipes.push(new THREE.AnimationClip('expandir', 2.5, [trilhaEsc('redemoinho', [0, 0.4, 1.6, 2.2, 2.5], [0.25, 0.22, 0.85, 1.04, 1])]));
  raiz.add(no('ponto_travessia', [], [0, 0, -0.4]));
}
function alavanca() {
  raiz.name = 'alavanca_portal';
  const b = new Balde();
  b.add(caixa(0.5, 0.95, 0.4, 0.04), COR.marinho, M([0, 0.475, 0]));
  b.add(caixa(0.4, 0.05, 0.3), COR.marinho_claro, M([0, 0.97, 0]));
  b.add(caixa(0.06, 0.02, 0.24), COR.petroleo, M([0, 0.995, 0]));
  raiz.add(b.malha('alavanca_malha'));
  // luzinhas das 3 missões no pedestal (acesas embaixo, capas em cima)
  const ac = new Balde();
  [COR.aqua, COR.violeta, COR.amarelo].forEach((cor, i) => {
    const x = (i - 1) * 0.1; ac.add(new THREE.CircleGeometry(0.03, 8), cor, M([x, 0.8, 0.201]), true);
    const c = new Balde(); c.add(new THREE.CircleGeometry(0.032, 8), '#2c4a58', M()); raiz.add(no(`luz_${i}_apagada`, [c.malha(`luz_${i}_apagada_malha`)], [x, 0.8, 0.203]));
  });
  raiz.add(ac.malha('luzes_acesas'));
  // braço com cabo Lima (gira em volta do eixo X na base)
  const br = new Balde(); br.add(cil(0.025, 0.55, 8), '#9aa5a8', M([0, 0.275, 0])); br.add(new THREE.SphereGeometry(0.07, 10, 6), COR.lima, M([0, 0.58, 0]));
  br.add(cil(0.05, 0.08, 10), '#5c6672', M([0, 0, 0], [0, 0, Math.PI / 2]));
  raiz.add(no('braco', [br.malha('braco_malha')], [0, 1.0, 0], [deg(-35), 0, 0]));
  // cadeado (some ao destravar)
  const cd = new Balde(); cd.add(caixa(0.12, 0.1, 0.05, 0.015), COR.amarelo, M([0, 0, 0])); cd.add(new THREE.TorusGeometry(0.04, 0.01, 4, 10, Math.PI), '#9aa5a8', M([0, 0.05, 0])); cd.add(cil(0.012, 0.01, 6), COR.preto, M([0, -0.005, 0.026], [Math.PI / 2, 0, 0]));
  raiz.add(no('cadeado', [cd.malha('cadeado_malha')], [0.14, 1.06, 0.1]));
  clipes.push(new THREE.AnimationClip('destravar', 1.2, [trilhaEsc('cadeado', [0, 0.3, 0.6], [1, 1.2, 0.0001]), ...[0, 1, 2].map((i) => trilhaEsc(`luz_${i}_apagada`, [0, 0.4 + i * 0.25, 0.42 + i * 0.25], [1, 1, 0.0001]))]));
  const [tp, vp] = suave(0, 0.9, [-35], [35], 8);
  clipes.push(new THREE.AnimationClip('puxar', 1.0, [trilhaRot('braco', [...tp, 1.0], [...vp.map((v) => [v[0], 0, 0]), [35, 0, 0]])]));
}
function texTerra() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  x.fillStyle = '#2f74b8'; x.fillRect(0, 0, 256, 256);
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 6; k++) { // continentes: manchas facetadas
    const cx = rnd() * 256, cy = rnd() * 256, r = 30 + rnd() * 40; x.fillStyle = k % 3 ? '#5aa64a' : '#7bbf5a'; x.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = r * (0.6 + rnd() * 0.5); i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fill();
  }
  x.fillStyle = 'rgba(246,243,234,0.85)'; for (let k = 0; k < 7; k++) { const cx = rnd() * 256, cy = rnd() * 256; x.fillRect(cx, cy, 30 + rnd() * 40, 8 + rnd() * 6); } // nuvens
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function terraCubo() {
  raiz.name = 'terra_cubo';
  const cubo = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial({ map: texTerra(), roughness: 0.8, name: 'terra' }));
  cubo.name = 'cubo'; cubo.rotation.set(deg(28), deg(40), 0); raiz.add(cubo);
  const anel = new Balde(); anel.add(new THREE.TorusGeometry(5.2, 0.22, 4, 32), COR.aqua, M([0, 0, 0], [deg(78), deg(10), 0], [1, 1, 0.4]), true);
  raiz.add(anel.malha('anel'));
  clipes.push(new THREE.AnimationClip('girar', 40, [trilhaRot('cubo', [0, 10, 20, 30, 40], [0, 90, 180, 270, 360].map((g) => [28, 40 + g, 0]))]));
}
function tunel() {
  raiz.name = 'tunel_hiperespaco';
  const L = 36, R = 3;
  const casca = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 16, 1, true).rotateX(Math.PI / 2).translate(0, 1.6, -L / 2), new THREE.MeshBasicMaterial({ color: '#0c1a24', side: THREE.BackSide, name: 'tunel_fundo' }));
  casca.name = 'casca'; raiz.add(casca);
  const r = new Balde(); let s = 5; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cores = [COR.aqua, COR.violeta, COR.lavanda, COR.branco];
  for (let i = 0; i < 160; i++) { const a = rnd() * Math.PI * 2, z = -rnd() * (L + 6), comp = 0.8 + rnd() * 2.2;
    r.add(caixa(0.04, 0.04, comp), cores[i % 4], M([Math.cos(a) * (R - 0.15), 1.6 + Math.sin(a) * (R - 0.15), z]), true); }
  raiz.add(no('riscos', [r.malha('riscos_malha')]));
  const ch = new Balde(); ch.add(caixa(1.2, 0.04, L, 0), COR.marinho_claro, M([0, 0.02, -L / 2])); ch.add(caixa(0.12, 0.045, L, 0), COR.aqua, M([0, 0.025, -L / 2]), true);
  raiz.add(ch.malha('caminho'));
  const fim = new Balde(); fim.add(new THREE.CircleGeometry(2.6, 24), COR.branco, M([0, 1.6, -L + 0.2]), true); raiz.add(fim.malha('luz_fim'));
  clipes.push(new THREE.AnimationClip('correr', 3, [trilhaPos('riscos', [0, 3], [[0, 0, 0], [0, 0, 6]])]));
  raiz.userData = { comprimento_m: L, velocidade_sugerida_m_s: 0.6 };
}


// ---------- Componentes revisados (20/10): fio contínuo (sem emendas) e perna longa visível ----------
// Caminho com cantos arredondados (o fio dobra como fio de verdade, sem pedaços separados)
function caminhoArred(pts, r = 0.014) {
  const P = pts.map((p) => new THREE.Vector3(...p)); const c = new THREE.CurvePath();
  let ini = P[0].clone();
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], m = P[i], d = P[i + 1];
    const rr = Math.min(r, a.distanceTo(m) / 2, m.distanceTo(d) / 2);
    const e = m.clone().addScaledVector(a.clone().sub(m).normalize(), rr), s = m.clone().addScaledVector(d.clone().sub(m).normalize(), rr);
    if (ini.distanceTo(e) > 1e-5) c.add(new THREE.LineCurve3(ini, e));
    c.add(new THREE.QuadraticBezierCurve3(e, m.clone(), s)); ini = s;
  }
  c.add(new THREE.LineCurve3(ini, P[P.length - 1]));
  return c;
}
const fioTubo = (curva, raio = 0.0045, seg = 16) => new THREE.TubeGeometry(curva, seg, raio, 5, false);
// sinal + e − pequenos, em placas (relevo de 3 mm), para ler de perto no VR
function sinal(b, mais, cor, m) {
  b.add(caixa(0.014, 0.0035, 0.003), cor, m.clone().multiply(M([0, 0, 0])));
  if (mais) b.add(caixa(0.0035, 0.014, 0.003), cor, m.clone().multiply(M([0, 0, 0])));
}
// estilo: 'curva' (perna longa com curva suave) ou 'reta' (cúpula mais alta e deslocada; pernas retas, a do + bem mais comprida)
function ledNovo(estilo, cores) {
  raiz.name = 'led';
  const meio = (PB.col(8) - PB.col(6)) / 2; // 0,1514 m: os pés continuam nos mesmos furos
  const b = new Balde();
  const cx = estilo === 'reta' ? 0.05 : 0, yb = estilo === 'reta' ? 0.165 : 0.175; // centro da cúpula e base dela
  let pMais, pMenos;
  if (estilo === 'reta') {
    pMais = caminhoArred([[cx - 0.012, yb + 0.012, 0], [cx - 0.012, yb - 0.006, 0], [-meio, 0.006, 0], [-meio, -0.004, 0]], 0.008);
    pMenos = caminhoArred([[cx + 0.012, yb + 0.012, 0], [cx + 0.012, yb - 0.006, 0], [meio, 0.006, 0], [meio, -0.004, 0]], 0.008);
  } else {
    // pernas paralelas saindo da cúpula, como num LED de verdade: a do + desce quase até a placa antes de dobrar;
    // a do − é curta e dobra lá em cima. Os pés continuam nos mesmos furos.
    pMais = caminhoArred([[-0.012, yb + 0.012, 0], [-0.012, 0.022, 0], [-meio, 0.022, 0], [-meio, -0.004, 0]], 0.012);
    pMenos = caminhoArred([[0.012, yb + 0.012, 0], [0.012, 0.09, 0], [meio, 0.09, 0], [meio, -0.004, 0]], 0.012);
  }
  b.add(fioTubo(pMais, 0.0045, 14), COR.metal_perna); b.add(fioTubo(pMenos, 0.0045, 14), COR.metal_perna);
  if (cores) {
    // capinhas coloridas perto dos furos: vermelha no +, preta no −
    const capa = (curva, cor) => { const t = 0.86, p = curva.getPointAt(t), d = curva.getTangentAt(t);
      const g = cil(0.0075, 0.03, 8); b.add(g, cor, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), new THREE.Vector3(1, 1, 1))); };
    capa(pMais, COR.vermelho); capa(pMenos, COR.preto);
  }
  raiz.add(b.malha('led_pernas'));
  // cúpula numa peça só (torneada): aba, parede e domo fechados, sem pedaços empilhados.
  // Lado chato de verdade na aba, do lado do − (+X). A apagada é a mesma forma 3,5% maior, por fora da acesa.
  const R = 0.038, RA = 0.05, yAba = yb + 0.006, yParede = yb + 0.046, centro = new THREE.Vector3(cx, yb + 0.04, 0);
  const formaCupula = (e) => { // e = recuo (m) de toda a superfície: a acesa fica 3 mm por dentro da apagada
    const r = R - e, ra = RA - e, y0 = yb - 0.006 + e, ya = yAba - e;
    const pts = [[0.0005, y0], [ra, y0], [ra, ya], [r, ya], [r, yParede]];
    for (let i = 1; i <= 5; i++) { const a = (i / 6) * Math.PI / 2; pts.push([r * Math.cos(a), yParede + r * Math.sin(a)]); }
    pts.push([0.0005, yParede + r]);
    const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 12);
    const pos = g.attributes.position, chato = RA - 0.009 - e;
    for (let i = 0; i < pos.count; i++) { if (pos.getY(i) <= ya + 1e-6 && pos.getX(i) > chato) pos.setX(i, chato); } // lado chato (−)
    g.translate(cx, 0, 0); g.computeVertexNormals();
    return g;
  };
  const acesa = new Balde(); acesa.add(formaCupula(0.003), COR.led_aceso, null, true);   // por dentro, com folga de ~3 mm
  raiz.add(acesa.malha('cupula_acesa'));
  const ap = new Balde(); ap.add(formaCupula(0), COR.led);
  // sinais em cima da aba (branco), 1,5 mm acima dela: + do lado da perna longa, − no lado chato
  const yS = yAba + 0.0015;
  const placaS = (w, d) => new THREE.BoxGeometry(w, 0.002, d);
  ap.add(placaS(0.009, 0.0024), COR.branco, M([cx - 0.044, yS, 0])); ap.add(placaS(0.0024, 0.009), COR.branco, M([cx - 0.0442, yS + 0.0004, 0]));
  ap.add(placaS(0.0024, 0.009), COR.branco, M([cx + 0.0395, yS, 0]));
  raiz.add(no('cupula_apagada', [ap.malha('cupula_apagada_malha')], [0, 0, 0]));
  clipes.push(new THREE.AnimationClip('acender', 0.6, [trilhaEsc('cupula_apagada', [0, 0.05, 0.07, 0.6], [1, 1, 0.0001, 0.0001])]));
  raiz.userData = { perna_positiva: 'x negativo (longa)', perna_negativa: 'x positivo (curta, lado chato)', estilo };
}
function resistorNovo(queimado = false) {
  raiz.name = queimado ? 'resistor_queimado' : 'resistor';
  const meio = (PB.col(6) - PB.col(3)) / 2; // 0,227 m: mesmos furos
  const b = new Balde(); const y = 0.05;
  // um fio só, de furo a furo, atravessando o corpo (dobras arredondadas)
  b.add(fioTubo(caminhoArred([[-meio, -0.004, 0], [-meio, y, 0], [meio, y, 0], [meio, -0.004, 0]], 0.014), 0.0045, 20), COR.metal_perna);
  const corpo = new THREE.CapsuleGeometry(0.03, 0.17, 2, 10); corpo.rotateZ(Math.PI / 2);
  b.add(corpo, queimado ? COR.queimado : COR.resistor, M([0, y, 0]));
  if (!queimado) {
    [[-0.06, COR.vermelho], [-0.03, COR.vermelho], [0, COR.marrom], [0.06, COR.dourado]].forEach(([x, cor]) => {
      const f = cil(0.0315, 0.014, 10); f.rotateZ(Math.PI / 2); b.add(f, cor, M([x, y, 0]));
    });
  } else {
    b.add(caixa(0.006, 0.062, 0.062), COR.preto, M([0.01, y, 0], [0, 0, 0.4]));
    const fu = new Balde();
    [[0, 0.05, 0.022], [0.012, 0.085, 0.016], [-0.006, 0.115, 0.012]].forEach(([x, yy, r]) => fu.add(new THREE.IcosahedronGeometry(r, 0).toNonIndexed(), COR.fumaca, M([x, yy, 0])));
    raiz.add(no('fumaca', [fu.malha('fumaca_malha')], [0, y, 0]));
    clipes.push(new THREE.AnimationClip('fumegar', 2, [trilhaPos('fumaca', [0, 1, 2], [[0, y, 0], [0.006, y + 0.02, 0], [0, y, 0]]), trilhaEsc('fumaca', [0, 1, 2], [0.9, 1.15, 0.9])]));
  }
  raiz.add(b.malha(raiz.name + '_malha'));
}

({ porta, janela, astros, mesa, pizza, caneca, cyberdeck, console: console_, arma, suporte, projetil, tubo,
  protoboard, led, resistor: () => resistor(false), resistor_queimado: () => resistor(true), jumper_vermelho: () => jumper('vermelho'),
  jumper_preto: () => jumper('preto'), jumper_curto: () => jumper('curto'),
  led_paralela: () => ledNovo('paralela', false), led_paralela_cor: () => ledNovo('paralela', true), led_reta: () => ledNovo('reta', false), led_reta_cor: () => ledNovo('reta', true),
  resistor_novo: () => resistorNovo(false), resistor_queimado_novo: () => resistorNovo(true), bandeja, plataforma, painel, comunicador, mirante, faixas, maquina, botao: botaoCuidado, esconderijo, parapeito, portal, alavanca, terra: terraCubo, tunel, motor, quadro, prateleira, bancada: bancadaSolda })[OBJ]();

// ---------- Exportar ----------
raiz.updateMatrixWorld(true);
let tris = 0, chamadas = 0;
raiz.traverse((o) => { if (o.isMesh) { tris += o.geometry.index.count / 3; chamadas += Array.isArray(o.material) ? o.material.length : 1; } });
const glb = await new GLTFExporter().parseAsync(raiz, { binary: true, animations: clipes });
const bytes = new Uint8Array(glb);
let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
window.resultado = { glb: btoa(bin), nome: raiz.name, tris, chamadas, clipes: clipes.map((c) => c.name), kb: Math.round(bytes.length / 1024) };
