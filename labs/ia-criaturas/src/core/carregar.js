// Carregamento único das configurações. Node e navegador passam apenas a função de leitura de JSON,
// garantindo que os dois modos montem exatamente a mesma configuração.
import { montarConfig } from './config.js';

export async function carregarConfig(lerJson) {
  const indice = await lerJson('config/indice.json');
  const especies = [];
  for (const arq of indice.especies) especies.push(await lerJson(`config/especies/${arq}`));
  const cenarios = [];
  for (const arq of indice.cenarios) cenarios.push(await lerJson(`config/cenarios/${arq}`));
  return montarConfig({ especies, cenarios });
}
