// Provedor síncrono para os testes em Node: lê os GLBs do disco e monta a grade na hora.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { walkingHeight, blocked } from '../../../world/hunters-village-v01/runtime.mjs';
import { fontesHex, nucleoProvedor } from '../src/fontes.js';

const raiz = fileURLToPath(new URL('../../../', import.meta.url));
const json = (p) => JSON.parse(readFileSync(raiz + p, 'utf8'));
export function provedorNode() {
  const site = json('world/hunters-village-v01/site.json');
  const n = nucleoProvedor({ fontes: fontesHex(json('world/playable-eastern-range-v01/play/region.json'), site), lerBytes: (p) => readFileSync(raiz + p), site,
    progressao: json('world/hunters-village-v01/progression.json'), runtimeVila: { walkingHeight, blocked } });
  return { ...n, montar: (spec, pronto) => { const t = n.montar(spec); if (pronto) pronto(t); return t; } };
}
