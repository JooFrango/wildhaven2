// Chão da cena feito com as PEÇAS OFICIAIS do mundo (GLBs dos hexágonos), nas posições da composição.
// O terreno que a IA consulta (grade derivada) saiu dos mesmos GLBs com o mesmo deslocamento, então os dois
// coincidem: a altura sob a pata é a altura da malha que aparece na tela.
//
// Posição de cada peça na cena: a simulação usa x = X − x0 e y = Z − z0 (metros do mundo); a cena desenha
// (x − largura/2, altura, y − profundidade/2) e a altura é relativa a `alturaBase`. Daí o deslocamento abaixo.
//
// Vizinhança: `atualizar(x, y)` carrega as peças cuja borda esteja a menos de `raio` metros do animal seguido,
// da mais próxima para a mais distante — a peça vizinha fica pronta antes de a criatura chegar na divisa.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SERVINDO_REPO, urlGlb } from './modelos3d.js';

// Peças da composição são retângulos de 4330,127 × 5000 m (escala 5 km entre lados opostos do hexágono).
const MEIA_LARGURA = 2165.0635094610966, MEIA_PROFUNDIDADE = 2500;
// Saia lateral da peça: parede vertical na borda, só serve para tapar o vazio embaixo. Fora da cena do laboratório,
// senão aparece uma emenda escura entre peças vizinhas.
const OCULTAR = new Set(['hex_side_cut']);

export class HexesReais {
  // `origem` = terreno.origem do corredor derivado; `terreno` = terreno da simulação (para centralizar a cena).
  constructor(THREE, origem, terreno, { raio = 350, aviso = () => {} } = {}) {
    this.THREE = THREE; this.origem = origem; this.raio = raio; this.aviso = aviso;
    this.grupo = new THREE.Group();
    this.loader = new GLTFLoader();
    this.meiaLargura = terreno.largura / 2; this.meiaProfundidade = terreno.profundidade / 2;
    this.pecas = (origem.hexes ?? []).map((h) => ({
      ...h,
      // Retângulo da peça em coordenadas da simulação (metros do terreno derivado).
      x0: h.center_x - origem.x0 - MEIA_LARGURA, x1: h.center_x - origem.x0 + MEIA_LARGURA,
      y0: h.center_z - origem.z0 - MEIA_PROFUNDIDADE, y1: h.center_z - origem.z0 + MEIA_PROFUNDIDADE,
      estado: 'ausente', no: null,
    }));
  }

  get carregadas() { return this.pecas.filter((p) => p.estado === 'pronta').map((p) => p.id); }
  get pendentes() { return this.pecas.filter((p) => p.estado !== 'pronta').map((p) => p.id); }

  // Peça sob um ponto do terreno (metros da simulação), e distância até a divisa do corredor.
  pecaEm(x, y) { return this.pecas.find((p) => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) ?? null; }
  distanciaDaDivisa(x, y) {
    const d = this.origem.divisa;
    return d ? (d.eixo === 'x' ? x - d.local : y - d.local) : null;
  }

  // Distância do ponto (metros do terreno) até o retângulo da peça; 0 quando está sobre ela.
  distancia(p, x, y) {
    const dx = Math.max(p.x0 - x, 0, x - p.x1), dy = Math.max(p.y0 - y, 0, y - p.y1);
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Carrega o que estiver perto. `await` espera as peças desta chamada; sem await, segue carregando em segundo plano.
  // Pode ser chamada a cada quadro: uma carga por vez, e cada peça só entra na fila uma vez.
  async atualizar(x, y, raio = this.raio) {
    if (this.ocupado) return 0;
    const perto = this.pecas
      .filter((p) => p.estado === 'ausente' && this.distancia(p, x, y) <= raio)
      .sort((a, b) => this.distancia(a, x, y) - this.distancia(b, x, y));
    if (!perto.length) return 0;
    this.ocupado = true;
    try { for (const p of perto) await this.carregar(p); } finally { this.ocupado = false; }
    return perto.length;
  }

  async carregar(p) {
    if (p.estado !== 'ausente') return p.estado === 'pronta';
    p.estado = 'carregando';
    const url = urlGlb(p.glb);
    try {
      const g = SERVINDO_REPO
        ? await new Promise((ok, erro) => this.loader.load(url, ok, undefined, () => erro(new Error(`peça ${p.id} indisponível: ${url}`))))
        // Versão hospedada: o host não serve .glb; a peça vem em base64 (bytes idênticos), como os GLBs das criaturas.
        : await this.carregarBase64(p, url);
      const no = g.scene;
      no.traverse((o) => {
        if (!o.isMesh) return;
        if (OCULTAR.has(o.name) || OCULTAR.has(o.parent?.name)) { o.visible = false; return; }
        o.receiveShadow = true;
        o.userData.hexId = p.id;
        // Os GLBs oficiais saem com metalness 1. Metal sem mapa de ambiente fica preto: rochas, troncos e coníferas
        // viravam silhuetas pretas. A cor das peças está nas cores de vértice; aqui elas só precisam de difusa.
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (m && m.metalness !== undefined && m.metalness > 0) { m.metalness = 0; m.needsUpdate = true; }
        }
      });
      // Deslocamento da peça: centro da peça em coordenadas da cena; altura relativa ao piso do corredor.
      no.position.set(p.center_x - this.origem.x0 - this.meiaLargura, -this.origem.alturaBase, p.center_z - this.origem.z0 - this.meiaProfundidade);
      no.name = `hex-${p.id}`;
      this.grupo.add(no);
      p.no = no; p.estado = 'pronta';
      this.aviso(`peça ${p.id} (${p.label}) carregada`);
      return true;
    } catch (e) {
      // 'falhou' e não 'ausente': o laço chama atualizar() a cada 500 ms e tentaria de novo para sempre.
      p.estado = 'falhou'; p.erro = e.message;
      this.aviso(e.message, true);
      return false;
    }
  }

  async carregarBase64(p, url) {
    const r = await fetch(`${url}.b64.txt`);
    if (!r.ok) throw new Error(`peça ${p.id} indisponível: ${url}.b64.txt`);
    const bin = atob((await r.text()).trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Promise((ok, erro) => this.loader.parse(bytes.buffer, '', ok, erro));
  }

  descartar() {
    for (const p of this.pecas) {
      if (!p.no) continue;
      p.no.traverse((o) => { if (o.isMesh) { o.geometry?.dispose(); const m = o.material; for (const x of Array.isArray(m) ? m : [m]) x?.dispose(); } });
      this.grupo.remove(p.no); p.no = null; p.estado = 'ausente';
    }
  }
}
