// Carregamento em Node. O navegador usa as mesmas funções de src/ com um leitor de JSON próprio.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { carregarConfigEcoNode } from '../../ia-criaturas/src/node/eco-node.js';

export const RAIZ_HUNTERS = dirname(dirname(fileURLToPath(import.meta.url)));
const lerJson = async (rel) => JSON.parse(await readFile(join(RAIZ_HUNTERS, rel), 'utf8'));

// Config do ecossistema + a espécie Hunter injetada. A ficha NÃO entra no índice de espécies do laboratório
// de criaturas: assim nenhum cenário, teste ou medição daquele laboratório muda por causa desta.
export async function carregarHunterLab() {
  const cfg = await carregarConfigEcoNode();
  const fichaHunter = await lerJson('config/hunter.json');
  const equipamentos = await lerJson('config/equipamento.json');
  return { cfg: { ...cfg, especies: { ...cfg.especies, hunter: fichaHunter } }, fichaHunter, equipamentos };
}
