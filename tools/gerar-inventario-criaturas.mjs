#!/usr/bin/env node
// Gera docs/migracao/INVENTARIO-CRIATURAS.md e docs/migracao/inventario-criaturas.json
// a partir do que existe de fato no repositorio.
//
// Nenhum campo e inventado: o que nao foi localizado aparece como
// "nao localizado". Biomas, porte e notas saem das fichas em
// creatures/species/*.json. Triangulos, animacoes e rig saem da leitura
// do proprio GLB. Procedencia sai de docs/migracao/procedencia.json.
//
// Uso: node tools/gerar-inventario-criaturas.mjs

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const NAO = 'nao localizado';

const listar = (dir, saida = []) => {
  let ent;
  try { ent = readdirSync(dir, { withFileTypes: true }); } catch { return saida; }
  for (const e of ent) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listar(p, saida); else saida.push(p.split(sep).join('/'));
  }
  return saida;
};

const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\s]+/g, '-');

const procedencia = existsSync('docs/migracao/procedencia.json')
  ? JSON.parse(readFileSync('docs/migracao/procedencia.json', 'utf8'))
  : {};

// Auditoria tecnica dos GLBs, reaproveitando o script de auditoria.
const auditoria = JSON.parse(
  execFileSync('node', ['tools/auditar-criaturas.mjs', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 }),
).resultados;
const porArquivo = new Map(auditoria.map((r) => [r.arquivo, r]));

// Fichas
const fichas = {};
for (const f of listar('creatures/species')) {
  const m = f.match(/creatures\/species\/([^/]+)\.(json|md)$/);
  if (!m) continue;
  const id = norm(m[1]);
  fichas[id] ??= { json: null, md: null, dados: null };
  if (m[2] === 'json') {
    fichas[id].json = f;
    try { fichas[id].dados = JSON.parse(readFileSync(f, 'utf8')); } catch { /* ficha ilegivel */ }
  } else fichas[id].md = f;
}

// Pastas de criaturas com assets
const todos = [...listar('assets/models/creatures'), ...listar('assets/concepts'), ...listar('docs/migracao/variantes')];
const criaturas = {};
const nomeDe = (p) => {
  let m = p.match(/^assets\/models\/creatures\/([^/]+)\//);
  if (m) return norm(m[1]);
  m = p.match(/^assets\/concepts\/creatures\/([^/]+)\//);
  if (m) return norm(m[1]);
  m = p.match(/^docs\/migracao\/variantes\/[^/]+\/[^/]+\/assets\/models\/creatures\/([^/]+)\//);
  if (m) return norm(m[1]);
  m = p.match(/^docs\/migracao\/variantes\/[^/]+\/[^/]+\/creatures\/species\/([^/.]+)\./);
  if (m) return norm(m[1]);
  return null;
};

for (const p of todos) {
  const id = nomeDe(p);
  if (!id) continue;
  const c = (criaturas[id] ??= {
    id, modelos: [], texturas: [], conceitos: [], previews: [], fichas: [], outros: [], variantes: [],
  });
  const ext = p.split('.').pop().toLowerCase();
  const lp = norm(p);
  if (p.startsWith('docs/migracao/variantes/')) c.variantes.push(p);
  if (ext === 'glb' || ext === 'gltf') c.modelos.push(p);
  else if (/\/textures?\//.test(p) || /(albedo|normal|roughness|atlas|_uv|-uv)/.test(lp)) c.texturas.push(p);
  else if (/(conceito|conceitual|concept|referencia)/.test(lp) && /\.(png|jpg|jpeg|webp)$/.test(lp)) c.conceitos.push(p);
  else if (/\/previews?\//.test(p) || /(real-3d|real-glb|real_glb|prancha)/.test(lp)) c.previews.push(p);
  else if (ext === 'md') c.fichas.push(p);
  else c.outros.push(p);
}

// Junta fichas em creatures/species
for (const [id, f] of Object.entries(fichas)) {
  const c = (criaturas[id] ??= { id, modelos: [], texturas: [], conceitos: [], previews: [], fichas: [], outros: [], variantes: [] });
  if (f.json) c.fichas.push(f.json);
  if (f.md) c.fichas.push(f.md);
  c.ficha_dados = f.dados;
}

// Versao: token vNN no caminho
const versaoDe = (p) => {
  const m = norm(p).match(/v(\d{2,3})/g);
  return m ? m.map((x) => x.replace('v', '')).sort().pop() : null;
};

const linhasInv = [];
const jsonInv = { gerado_em: new Date().toISOString(), criaturas: {} };

for (const id of Object.keys(criaturas).sort()) {
  const c = criaturas[id];
  const d = c.ficha_dados;
  const aud = c.modelos.map((m) => porArquivo.get(m)).filter(Boolean);
  const tris = aud.map((a) => a.triangulos).filter((x) => x != null);
  const anims = [...new Set(aud.flatMap((a) => a.animacoes ?? []))];
  const lods = [...new Set(aud.map((a) => a.lod).filter(Boolean))].sort();
  const comRig = aud.filter((a) => a.skins > 0);
  const versoes = [...new Set(c.modelos.map(versaoDe).filter(Boolean))].sort();

  // versao aprovada: so se o caminho ou a ficha disserem isso
  const aprovados = c.modelos.filter((p) => /aprovad|approved/.test(norm(p)));
  const statusFicha = d?.status ?? null;

  const origens = c.modelos
    .map((p) => procedencia[p]?.origem_mais_recente)
    .filter(Boolean);
  const origemPrincipal = origens.sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0] ?? null;

  const pend = [];
  if (!c.modelos.length) pend.push('nenhum GLB no destino');
  if (!c.conceitos.length) pend.push('arte conceitual original nao localizada nos repositorios de origem');
  if (!c.fichas.length) pend.push('ficha nao localizada');
  if (c.modelos.length && !comRig.length) pend.push('nenhum GLB com rig (skins=0)');
  if (c.modelos.length && !anims.length) pend.push('nenhuma animacao embutida nos GLBs');
  if (!aprovados.length) pend.push('versao aprovada nao identificavel pelos arquivos; usar a ficha/PR como referencia');
  const falhas = aud.filter((a) => !a.ok);
  if (falhas.length) pend.push(`${falhas.length} GLB falhou na validacao`);

  const reg = {
    id,
    nome: d?.name ?? id,
    apelido: d?.nickname ?? NAO,
    bioma: d?.habitats?.length ? d.habitats.join(', ') : NAO,
    clima: d?.climate?.length ? d.climate.join(', ') : NAO,
    categoria: d?.category ?? NAO,
    porte: d?.body
      ? `comprimento ${d.body.bodyLengthTargetM ?? '?'}m, altura de ombro ${d.body.shoulderHeightTargetM ?? '?'}m, massa ${d.body.adultMassTargetKg ?? '?'}kg`
      : NAO,
    alimentacao: d?.diet?.length ? d.diet.join(', ') : NAO,
    anatomia: d?.body?.anatomy ?? NAO,
    temperamento: d?.behavior?.temperament ?? NAO,
    status_ficha: statusFicha ?? NAO,
    repositorio_origem: origemPrincipal?.repo ?? NAO,
    branch_origem: origemPrincipal?.branch ?? NAO,
    commit_origem: origemPrincipal?.commit ?? NAO,
    data_origem: origemPrincipal?.data ?? NAO,
    versoes_encontradas: versoes.length ? versoes : [NAO],
    ultima_versao_encontrada: versoes.length ? versoes[versoes.length - 1] : NAO,
    versao_aprovada: aprovados.length ? aprovados : [NAO],
    glbs: c.modelos,
    texturas: c.texturas,
    artes_conceituais: c.conceitos.length ? c.conceitos : [],
    previews_do_modelo: c.previews,
    fichas: c.fichas,
    variantes_preservadas: c.variantes,
    animacoes: anims,
    triangulos: tris.length ? { min: Math.min(...tris), max: Math.max(...tris) } : NAO,
    lods: lods.length ? lods : [NAO],
    glbs_com_rig: comRig.length,
    hashes: Object.fromEntries(c.modelos.map((p) => [p, procedencia[p]?.sha_git ?? porArquivo.get(p)?.sha_git ?? NAO])),
    status_recuperacao:
      c.modelos.length && !falhas.length
        ? c.conceitos.length && c.fichas.length
          ? 'completo'
          : 'parcial'
        : c.modelos.length
          ? 'com falhas'
          : 'sem modelo',
    pendencias: pend,
  };
  jsonInv.criaturas[id] = reg;
}

const regs = Object.values(jsonInv.criaturas);
const porStatus = (s) => regs.filter((r) => r.status_recuperacao === s).length;
const totalGlb = regs.reduce((s, r) => s + r.glbs.length, 0);
const totalConc = regs.reduce((s, r) => s + r.artes_conceituais.length, 0);
const totalFichas = regs.reduce((s, r) => s + r.fichas.length, 0);

linhasInv.push('# Inventario de criaturas — migracao para wildhaven2', '');
linhasInv.push(`Gerado em ${jsonInv.gerado_em} por \`tools/gerar-inventario-criaturas.mjs\`.`, '');
linhasInv.push('Este arquivo e gerado a partir do conteudo real do repositorio: fichas em');
linhasInv.push('`creatures/species/`, leitura direta dos GLBs e o registro de procedencia em');
linhasInv.push('`docs/migracao/procedencia.json`. Campos marcados como "nao localizado" nao');
linhasInv.push('foram encontrados nos repositorios de origem e nao foram preenchidos por estimativa.', '');
linhasInv.push('## Resumo', '');
linhasInv.push(`- Criaturas no inventario: **${regs.length}**`);
linhasInv.push(`- GLBs: **${totalGlb}**`);
linhasInv.push(`- Artes conceituais originais localizadas: **${totalConc}**`);
linhasInv.push(`- Fichas e documentos: **${totalFichas}**`);
linhasInv.push(`- Status completo: ${porStatus('completo')} | parcial: ${porStatus('parcial')} | com falhas: ${porStatus('com falhas')} | sem modelo: ${porStatus('sem modelo')}`, '');
linhasInv.push('## Tabela', '');
linhasInv.push('| Criatura | Bioma | GLBs | Anim. | LODs | Conceito | Ficha | Status |');
linhasInv.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of regs) {
  linhasInv.push(
    `| ${r.nome} | ${r.bioma} | ${r.glbs.length} | ${r.animacoes.length} | ${r.lods.join('/')} | ${r.artes_conceituais.length || 'nao'} | ${r.fichas.length || 'nao'} | ${r.status_recuperacao} |`,
  );
}
linhasInv.push('', '## Detalhe por criatura', '');
for (const r of regs) {
  linhasInv.push(`### ${r.nome}`, '');
  linhasInv.push(`- Identificador: \`${r.id}\``);
  linhasInv.push(`- Apelido: ${r.apelido}`);
  linhasInv.push(`- Bioma: ${r.bioma}`);
  linhasInv.push(`- Clima: ${r.clima}`);
  linhasInv.push(`- Categoria: ${r.categoria}`);
  linhasInv.push(`- Porte: ${r.porte}`);
  linhasInv.push(`- Alimentacao: ${r.alimentacao}`);
  linhasInv.push(`- Anatomia: ${r.anatomia}`);
  linhasInv.push(`- Temperamento: ${r.temperamento}`);
  linhasInv.push(`- Status na ficha de origem: ${r.status_ficha}`);
  linhasInv.push(`- Origem mais recente: ${r.repositorio_origem} / \`${r.branch_origem}\` / commit \`${String(r.commit_origem).slice(0, 10)}\` / ${r.data_origem}`);
  linhasInv.push(`- Versoes encontradas: ${r.versoes_encontradas.join(', ')}`);
  linhasInv.push(`- Versao aprovada: ${r.versao_aprovada.join(', ')}`);
  linhasInv.push(`- Triangulos: ${typeof r.triangulos === 'string' ? r.triangulos : `${r.triangulos.min} a ${r.triangulos.max}`}`);
  linhasInv.push(`- LODs: ${r.lods.join(', ')}`);
  linhasInv.push(`- GLBs com rig: ${r.glbs_com_rig} de ${r.glbs.length}`);
  linhasInv.push(`- Animacoes: ${r.animacoes.length ? r.animacoes.join(', ') : NAO}`);
  if (r.glbs.length) linhasInv.push(`- Modelos:\n${r.glbs.map((p) => `  - \`${p}\` (${r.hashes[p]})`).join('\n')}`);
  if (r.texturas.length) linhasInv.push(`- Texturas: ${r.texturas.length} arquivos, por exemplo \`${r.texturas[0]}\``);
  linhasInv.push(`- Artes conceituais: ${r.artes_conceituais.length ? r.artes_conceituais.map((p) => `\`${p}\``).join(', ') : NAO}`);
  linhasInv.push(`- Fichas: ${r.fichas.length ? r.fichas.map((p) => `\`${p}\``).join(', ') : NAO}`);
  if (r.variantes_preservadas.length) linhasInv.push(`- Variantes preservadas: ${r.variantes_preservadas.length} arquivos sob \`docs/migracao/variantes/\``);
  linhasInv.push(`- Status de recuperacao: **${r.status_recuperacao}**`);
  linhasInv.push(`- Pendencias: ${r.pendencias.length ? r.pendencias.join('; ') : 'nenhuma'}`, '');
}

mkdirSync('docs/migracao', { recursive: true });
writeFileSync('docs/migracao/INVENTARIO-CRIATURAS.md', linhasInv.join('\n'));
writeFileSync('docs/migracao/inventario-criaturas.json', JSON.stringify(jsonInv, null, 1));
console.log('criaturas', regs.length, 'glbs', totalGlb, 'conceitos', totalConc, 'fichas', totalFichas);
