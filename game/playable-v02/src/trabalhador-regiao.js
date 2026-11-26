// Web Worker: extrai os triângulos dos GLBs e monta as grades das regiões fora da thread de desenho
// (montar 1,2 km² custa ~0,3 s, dominado pela inclinação calculada pelo núcleo).
import { walkingHeight, blocked } from '../../../world/hunters-village-v01/runtime.mjs';
import { nucleoProvedor } from './fontes.js';

let nucleo = null;
const bytes = new Map();
onmessage = ({ data: d }) => {
  try {
    if (d.tipo === 'iniciar') nucleo = nucleoProvedor({ fontes: new Map(d.fontes), lerBytes: (p) => bytes.get(p), site: d.site, progressao: d.progressao, runtimeVila: { walkingHeight, blocked } });
    if (d.tipo === 'hex') { bytes.set(d.path, new Uint8Array(d.bytes)); const t0 = performance.now(); nucleo.hex(d.id); bytes.delete(d.path); postMessage({ tipo: 'hex', id: d.id, ms: performance.now() - t0 }); }
    if (d.tipo === 'montar') {
      const t0 = performance.now(), t = nucleo.montar(d.spec);
      const buffers = ['alturas', 'agua', 'cobertura', 'bloqueio', 'vegetacao', 'vegetacaoMax', 'cinzas', 'inclinacao'].map((k) => t[k].buffer);
      postMessage({ tipo: 'grade', pedido: d.pedido, t, ms: performance.now() - t0 }, buffers);
    }
    if (d.tipo === 'liberar') nucleo.liberar(new Set(d.manter));
  } catch (e) { postMessage({ tipo: 'erro', pedido: d.pedido, id: d.id, mensagem: String(e?.stack ?? e) }); }
};
