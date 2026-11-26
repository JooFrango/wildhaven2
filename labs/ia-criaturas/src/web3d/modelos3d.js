// Carregamento dos GLBs originais (uma vez por espécie) e análise do rig das pernas para o IK.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { analisarPassadas, detectarCadeias } from './pernas.js';
import { mapearClipes } from '../eco/oficina.js';

// Onde ficam os GLBs: servidor do laboratório expõe o repositório em /repo/; a versão hospedada usa modelos/<arquivo>.
const BASE = window.WILDHAVEN_MODELOS ?? '/repo/';
export const SERVINDO_REPO = BASE.endsWith('/repo/');
export const urlGlb = (caminho) => (SERVINDO_REPO ? BASE + caminho : BASE + caminho.split('/').pop());
const loader = new GLTFLoader();
export const gltfs = new Map();
export const rigs = new Map();
export { clonarEsqueleto };

export async function carregarModelos(THREE, especies, aviso = () => {}, perfis = {}) {
  for (const e of especies) {
    if (gltfs.has(e.id)) {
      const nomes = gltfs.get(e.id).animations.map((c) => c.name);
      e.modelo.clipes = { ...mapearClipes(nomes), ...(e.modelo.clipes ?? {}) };
      continue;
    }
    aviso(`Carregando ${e.nome}…`);
    const url = urlGlb(e.modelo.glb);
    let g;
    if (BASE.endsWith('/repo/')) {
      g = await new Promise((ok, erro) => loader.load(url, ok, undefined, () => erro(new Error(`GLB de ${e.nome} indisponível: ${url}`))));
    } else {
      // Versão hospedada: o host não serve .glb; o mesmo arquivo vem em base64 (bytes idênticos) e é decodificado aqui.
      const r = await fetch(`${url}.b64.txt`);
      if (!r.ok) throw new Error(`GLB de ${e.nome} indisponível: ${url}.b64.txt`);
      const bin = atob((await r.text()).trim());
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      g = await new Promise((ok, erro) => loader.parse(bytes.buffer, '', ok, erro));
    }
    // GLBs recém-descobertos não constam nos perfis de cinco espécies do laboratório.
    // Mede dimensões no arquivo REAL e cria um perfil visual temporário; nunca grava no catálogo oficial.
    if (!perfis[e.id]) {
      const tam = new THREE.Vector3();
      new THREE.Box3().setFromObject(g.scene).getSize(tam);
      perfis[e.id] = {
        frente: e.modelo.frente ?? '+X',
        extensao: [Math.max(0.001, tam.x), Math.max(0.001, tam.y), Math.max(0.001, tam.z)],
        clipes: {}
      };
    }
    e.modelo.clipes ??= {};
    const disponiveis = new Set(g.animations.map((c) => c.name));
    for (const [k, v] of Object.entries(mapearClipes(g.animations.map((c) => c.name)))) {
      if (!disponiveis.has(e.modelo.clipes[k])) e.modelo.clipes[k] = v;
    }
    gltfs.set(e.id, g);
    const cadeias = detectarCadeias(g.scene);
    rigs.set(e.id, { cadeias, analise: cadeias.length ? analisarPassadas(THREE, clonarEsqueleto(g.scene), g.animations, cadeias, perfis[e.id]?.frente ?? e.modelo.frente) : null });
  }
}
