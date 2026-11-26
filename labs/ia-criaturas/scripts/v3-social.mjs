#!/usr/bin/env node
// Evidências de socialização V3 em N sementes: atos sociais por tipo, alarmes de outras espécies, tolerância a
// predador saciado, olhadas de vigilância, submissões e disputas ritualizadas, e o estado das memórias sociais.
// Uso: node scripts/v3-social.mjs [--cenarios bebedouro,bebedouro-real] [--sementes 1-20] [--segundos 300]
import { mkdir, writeFile } from 'node:fs/promises';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { rodarCenario } from '../src/eco/analise.js';
import { interpretarSementes } from '../src/core/simulacao.js';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const sementes = interpretarSementes(String(args.sementes ?? '1-20'));
const segundos = Number(args.segundos ?? 300);
const cenarios = String(args.cenarios ?? 'bebedouro,bebedouro-real').split(',');
const cfg = await carregarConfigEcoNode();
const TIPOS = ['cumprimento', 'limpeza_mutua', 'brincadeira', 'curiosidade', 'disputa_social', 'disputa_social_fim', 'submissao', 'alarme', 'alarme_ouvido', 'alarme_outra_especie', 'tolera_predador', 'protege_filhote', 'sentinela', 'novo_lider'];
const out = { sementes: String(args.sementes ?? '1-20'), segundos, cenarios: {} };
for (const id of cenarios) {
  const tot = Object.fromEntries(TIPOS.map((k) => [k, 0]));
  let olhadas = 0, relacoes = 0, porTipoRel = {}, exemplos = [];
  for (const s of sementes) {
    const { mundo } = rodarCenario(cfg, id, s, { segundos });
    for (const e of mundo.eventos) if (e.tipo in tot) tot[e.tipo]++;
    olhadas += mundo.metricas.olhadasVigilancia ?? 0;
    for (const a of mundo.animais) for (const r of a.relacoes?.values() ?? []) { relacoes++; porTipoRel[r.tipo] = (porTipoRel[r.tipo] ?? 0) + 1; }
    if (exemplos.length < 6) exemplos.push(...mundo.eventos.filter((e) => ['cumprimento', 'limpeza_mutua', 'brincadeira', 'curiosidade', 'disputa_social', 'submissao', 'tolera_predador', 'alarme_outra_especie'].includes(e.tipo)).slice(0, 2).map((e) => ({ semente: s, t: e.t, tipo: e.tipo, id: e.id, com: e.com ?? e.para ?? e.predador ?? e.de ?? null })));
  }
  out.cenarios[id] = { eventos: tot, olhadasVigilancia: olhadas, relacoesMemorizadas: relacoes, relacoesPorTipo: porTipoRel, exemplos: exemplos.slice(0, 8) };
  console.log(id, JSON.stringify(out.cenarios[id]));
}
await mkdir('resultados/v3', { recursive: true });
await writeFile('resultados/v3/social.json', JSON.stringify(out, null, 1));
