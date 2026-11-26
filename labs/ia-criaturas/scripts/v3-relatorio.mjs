#!/usr/bin/env node
// Monta resultados/v3/RELATORIO-V3.md a partir dos JSONs gerados pelos scripts v3-* (CLI) e pela bancada do
// Varrisco no navegador (lab-varrisco-*.json, desempenho-navegador.json). Não roda simulação: só agrega.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const P = 'resultados/v3';
const ler = async (f) => JSON.parse(await readFile(join(P, f), 'utf8').catch(() => 'null'));
const kv = (o) => Object.entries(o ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
const pct = (a, b) => (b ? `${(100 * (1 - a / b)).toFixed(1)}%` : '—');
const L = [];
const capt = (await readdir('resultados/capturas').catch(() => [])).filter((f) => f.startsWith('v3-')).sort();

L.push('# Relatório V3 — combate, socialização e testes com GLBs reais', '');
L.push('Gerado por `npm run v3:relatorio` a partir de `resultados/v3/*.json`. Simulações determinísticas (mesma semente → mesmo resultado no CLI e no navegador).', '');

// ---- Locomoção
const loc = await ler('locomocao-comparacao.json');
if (loc?.antes && loc?.depois) {
  L.push('## 1. Locomoção e colisões (mesmas sementes, antes × depois)', '');
  L.push(`Sementes ${loc.depois.sementes}, ${loc.depois.segundos} s por encontro. "Antes" = código da V2 com as mesmas métricas de observação.`, '');
  L.push('| Cenário | Métrica | Antes (V2) | Depois (V3) | Redução |', '|---|---|---|---|---|');
  for (const id of Object.keys(loc.depois.cenarios)) {
    const a = loc.antes.cenarios[id], d = loc.depois.cenarios[id];
    if (!a) continue;
    for (const [k, rot] of [['colisoes', 'bloqueios físicos (passo impedido)'], ['contatosObstaculo', 'contatos com obstáculo (inclui deslizes)'], ['presos', 'episódios de animal preso (5 s sem sair do lugar)'], ['sobreposicaoParesSeg', 'corpos sobrepostos (pares × s)']]) L.push(`| \`${id}\` | ${rot} | ${a[k]} | ${d[k]} | ${pct(d[k], a[k])} |`);
  }
  L.push('', 'Causas encontradas e corrigidas: segmento amostrado a cada 0,5 m "escapava" pela quina entre duas células bloqueadas na diagonal (agora DDA visita todas as células); A* sem margem corporal; animais que ficavam numa célula alagada pela chuva sem conseguir sair; filhote alternando a cada passo entre "seguir a mãe" e "ir beber"; nível 2 oscilando entre manchas de pasto (e morrendo de fome ao lado do capim); corpos que se atravessavam (sem separação).', '');
}

// ---- Bancada do Varrisco (GLB real)
const labs = {};
for (const f of (await readdir(P).catch(() => [])).filter((x) => x.startsWith('lab-varrisco-'))) labs[f.replace(/^lab-varrisco-|\.json$/g, '')] = await ler(f);
if (Object.keys(labs).length) {
  L.push('## 2. Bancada do Varrisco no navegador (GLB original)', '');
  L.push('Página `laboratorio-varrisco.html`. GLB `assets/models/creatures/varrisco/v02/varrisco-animated-v02-LOD0.glb` (sem modificação). Os comandos só escolhem destino/olhar/golpe; locomoção, IK, acertos, esquivas e quedas são do núcleo `src/eco`.', '');
  const cl = labs.clipes;
  if (cl) L.push(`**Clipes:** ${cl.total} clipes, ${cl.clipes.filter((c) => c.ok).length} movem ossos de fato: ${cl.clipes.map((c) => `${c.clipe} (${c.ossosMovidos})`).join(', ')}.`, '');
  L.push('| Teste | Passos | Frente × rumo méd/máx | v máx (m/s) | Colisões | Deslize do pé no apoio: só animação → com IK | Erro de altura do pé: só animação → com IK | Clipes usados |', '|---|---|---|---|---|---|---|---|');
  for (const [id, r] of Object.entries(labs)) {
    if (!r || id === 'clipes') continue;
    const p = r.pernas;
    L.push(`| ${r.nome} | ${r.passosOk}/${r.passosTotal} | ${r.desvioFrenteMedioGraus}° / ${r.desvioFrenteMaxGraus}° | ${r.velocidadeMax} | ${r.colisoes} | ${p ? `${p.deslizeApoioFK_ms} → ${p.deslizeApoioIK_ms} m/s` : '—'} | ${p ? `${(p.erroAlturaFK_m * 100).toFixed(1)} → ${(p.erroAlturaIK_m * 100).toFixed(1)} cm` : '—'} | ${r.clipes.join(', ')} |`);
  }
  const at = labs.ataques;
  if (at) L.push('', `**Sequência de combate (Velsari manequim, IA de combate real):** ${at.golpes.map((g) => `${g.t}s ${g.tipo}${g.ataque ? ` ${g.ataque}` : ''}${g.regiao ? ` (${g.regiao})` : ''}${g.motivo ? ` [${g.motivo}]` : ''}`).join(' → ')}.`);
  L.push('');
}

// ---- Combate
for (const [f, rot] of [['combate-bebedouros.json', 'bebedouros'], ['combate-savana-viva.json', 'Savana Viva']]) {
  const c = await ler(f);
  if (!c) continue;
  L.push(`## 3. Combate (${rot}, sementes ${c.sementes}, ${c.segundos} s)`, '');
  L.push('| Cenário | Golpes iniciados | Acertos | Esquivas | Erros (membro não alcança) | Contra-ataques | Empurrão / desequilíbrio / queda | Agarrões (escapes) | Regiões atingidas | Fraturas | Disputas: fase final | Predações | Mortes em combate |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [id, r] of Object.entries(c.cenarios)) L.push(`| \`${id}\` | ${r.golpesIniciados} (${kv(r.porAtaque)}) | ${r.acertos} | ${r.esquivas} | ${r.erros} | ${r.contraAtaques} | ${r.empurroes} / ${r.desequilibrios} / ${r.quedas} | ${r.agarroes} (${r.escapesDeAgarrao}) | ${kv(r.regioes)} | ${r.fraturas} | ${kv(r.conflitosPorFaseFinal)} | ${r.predacoes} | ${r.mortesCombate} |`);
  L.push('');
}

// ---- Fugas
for (const [f, rot] of [['fugas-disputa-cenarios.json', 'cenários de disputa pela presa'], ['fugas-disputa-bebedouro-savana.json', 'bebedouro real e Savana Viva']]) {
  const c = await ler(f);
  if (!c) continue;
  L.push(`## 4. Fugas durante disputas entre carnívoros (${rot}, sementes ${c.sementes})`, '');
  L.push('| Cenário | Sementes com disputa (pela presa) | Disputas: fase final | Oportunidades percebidas | Tentativas (modo) | Fugas efetivas | Recapturas | Predações |', '|---|---|---|---|---|---|---|---|');
  for (const [id, x] of Object.entries(c.cenarios)) { const r = x.resumo; L.push(`| \`${id}\` | ${r.comDisputa} (${r.comDisputaPelaPresa}) | ${kv(r.fasesFinais)} | ${r.oportunidades} | ${r.tentativas} (${kv(r.tentativasPorTipo)}) | ${r.fugasEfetivas} | ${r.recapturas} | ${r.predacoes} |`); }
  L.push('');
}
L.push('Fuga efetiva = a presa sai da vista dos dois predadores por 10 s e continua viva; recaptura = um deles a fere ou mata depois da tentativa. Nada é forçado: a presa só tenta quando vê um predador ocupado com o rival (encarando, exibindo ou lutando, olhando para o rival e sem se aproximar), e escolhe entre acelerar para longe dos dois, correr para cobertura ou esconder-se.', '');

// ---- Social
const so = await ler('social.json');
if (so) {
  L.push(`## 5. Socialização (sementes ${so.sementes}, ${so.segundos} s)`, '');
  const tipos = Object.keys(Object.values(so.cenarios)[0].eventos);
  L.push(`| Evento | ${Object.keys(so.cenarios).map((k) => `\`${k}\``).join(' | ')} |`, `|---|${Object.keys(so.cenarios).map(() => '---').join('|')}|`);
  for (const t of tipos) L.push(`| ${t} | ${Object.values(so.cenarios).map((c) => c.eventos[t]).join(' | ')} |`);
  L.push(`| olhadas de vigilância compartilhada | ${Object.values(so.cenarios).map((c) => c.olhadasVigilancia).join(' | ')} |`);
  L.push(`| relações individuais memorizadas | ${Object.values(so.cenarios).map((c) => `${c.relacoesMemorizadas} (${kv(c.relacoesPorTipo)})`).join(' | ')} |`, '');
}

// ---- Desempenho
const dn = await ler('desempenho-navegador.json');
if (dn) {
  L.push('## 6. Desempenho', '');
  L.push(`Navegador (${dn.cenario}, ${dn.comIK.animais} animais, ${dn.resolucao}, quadros a passo fixo): com IK ${dn.comIK.msTotal} ms/quadro (sim ${dn.comIK.msSim} · animação+IK ${dn.comIK.msAnimacaoIK} · render ${dn.comIK.msRender}) ≈ ${dn.comIK.fpsEstimado} fps; sem IK ${dn.semIK.msTotal} ms ≈ ${dn.semIK.fpsEstimado} fps. ${dn.nota}`, '');
  L.push(`Orientação medida no navegador: desvio máximo frente × rumo ${Math.max(...dn.orientacao)}° entre ${dn.orientacao.length} animais.`, '');
}

if (capt.length) {
  L.push('## 7. Evidências visuais (renderizador real dos GLBs)', '');
  for (const f of capt) L.push(`- [${f}](../capturas/${f})`);
  L.push('');
}
await writeFile(join(P, 'RELATORIO-V3.md'), L.join('\n'));
console.log(`resultados/v3/RELATORIO-V3.md (${L.length} linhas)`);
