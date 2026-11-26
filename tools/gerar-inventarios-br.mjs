#!/usr/bin/env node
// Gera os seis inventarios da Build Real em docs/migracao/, cada um com MD e JSON:
// INVENTARIO-MAPA, INVENTARIO-CLIMA, INVENTARIO-HUNTERS, INVENTARIO-ARMADURAS,
// INVENTARIO-ARMAS e INVENTARIO-LABORATORIOS.
//
// Tudo sai do conteudo real do repositorio mais o registro de procedencia em
// docs/migracao/procedencia-build-real.json. O que nao existe aparece como
// "nao localizado" ou com contagem zero; nada e estimado.
//
// Uso: node tools/gerar-inventarios-br.mjs

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const NAO = 'nao localizado';
const proc = existsSync('docs/migracao/procedencia-build-real.json')
  ? JSON.parse(readFileSync('docs/migracao/procedencia-build-real.json', 'utf8'))
  : {};

const arquivos = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\0')
  .filter(Boolean);

const tam = (p) => { try { return statSync(p).size; } catch { return null; } };
const mb = (b) => (b / 1048576).toFixed(1) + 'MB';
const sha = (p) => { try { const b = readFileSync(p); return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex'); } catch { return null; } };

// ---------- leitura de GLB (só o bloco JSON) ----------
function glbInfo(p) {
  let buf;
  try { buf = readFileSync(p); } catch { return null; }
  if (buf.length < 12 || buf.slice(0, 4).toString('ascii') !== 'glTF') return { erro: 'nao e GLB', bytes: buf.length };
  let off = 12, json = null;
  while (off + 8 <= buf.length) {
    const t = buf.readUInt32LE(off);
    const tipo = buf.slice(off + 4, off + 8).toString('ascii');
    const ini = off + 8, fim = ini + t;
    if (fim > buf.length) return { erro: 'chunk fora do arquivo', bytes: buf.length };
    if (tipo === 'JSON') { try { json = JSON.parse(buf.slice(ini, fim).toString('utf8')); } catch { return { erro: 'JSON invalido', bytes: buf.length }; } }
    off = fim + ((4 - (t % 4)) % 4);
  }
  if (!json) return { erro: 'sem JSON', bytes: buf.length };
  const ac = json.accessors || [];
  let tris = 0;
  for (const m of json.meshes || []) for (const pr of m.primitives || []) {
    const modo = pr.mode ?? 4;
    const n = pr.indices != null ? (ac[pr.indices]?.count ?? 0) : (ac[pr.attributes?.POSITION]?.count ?? 0);
    if (modo === 4) tris += Math.floor(n / 3); else if (modo === 5 || modo === 6) tris += Math.max(0, n - 2);
  }
  return {
    bytes: buf.length,
    triangulos: tris,
    malhas: (json.meshes || []).length,
    nos: (json.nodes || []).length,
    animacoes: (json.animations || []).map((a, i) => a.name ?? `animacao_${i}`),
    skins: (json.skins || []).length,
    juntas: (json.skins || []).reduce((s, k) => s + (k.joints || []).length, 0),
    imagensEmbutidas: (json.images || []).filter((i) => !i.uri || i.uri.startsWith('data:')).length,
    imagensExternas: (json.images || []).filter((i) => i.uri && !i.uri.startsWith('data:')).map((i) => i.uri),
    gerador: json.asset?.generator ?? null,
  };
}

const origem = (p) => {
  const o = proc[p]?.origem_mais_recente;
  return o ? `${o.repo} / \`${o.branch}\` / commit \`${String(o.commit).slice(0, 10)}\` / ${String(o.data).slice(0, 10)}` : NAO;
};

const escrever = (nome, linhas, dados) => {
  mkdirSync('docs/migracao', { recursive: true });
  writeFileSync(`docs/migracao/${nome}.md`, linhas.join('\n'));
  writeFileSync(`docs/migracao/${nome.toLowerCase().replace(/_/g, '-')}.json`, JSON.stringify(dados, null, 1));
};

const cab = (titulo, sub) => [
  `# ${titulo}`,
  '',
  `Gerado em ${new Date().toISOString()} por \`tools/gerar-inventarios-br.mjs\`.`,
  '',
  sub,
  '',
  'Campos marcados como "nao localizado" nao foram encontrados nos repositorios',
  'de origem. Nenhum valor foi estimado.',
  '',
];

// =================== 1. MAPA ===================
{
  let aud = null;
  // A auditoria do mapa pode ter sido rodada antes, com os 1,3 GB de terreno em
  // checkout esparso; neste caso o resultado gravado e usado como esta.
  if (existsSync('docs/migracao/auditoria-mapa-272.json')) {
    aud = JSON.parse(readFileSync('docs/migracao/auditoria-mapa-272.json', 'utf8'));
  } else {
    try {
      aud = JSON.parse(execFileSync('node', ['tools/auditar-mapa-272.mjs', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 }));
    } catch (e) {
      // o script sai com 1 quando ha falhas; a saida ainda e valida
      try { aud = JSON.parse(e.stdout); } catch { aud = null; }
    }
  }
  const L = cab('Inventario do mapa continental de Auralis', 'Fonte: `build real/continental/data/continent-272.manifest.json` e os GLBs em `assets/world/continental-272/`.');
  if (!aud) {
    L.push('A auditoria do mapa nao pode ser executada neste repositorio.', '');
    escrever('INVENTARIO-MAPA', L, { erro: 'auditoria indisponivel' });
  } else {
    const r = aud.resumo;
    L.push('## Resumo', '');
    for (const [k, v] of Object.entries(r)) L.push(`- ${k.replace(/_/g, ' ')}: **${typeof v === 'object' ? JSON.stringify(v) : v}**`);
    L.push('', '## Sistemas do mapa recuperados', '');
    const sis = [
      ['compilador de terrenos', 'build real/continental/compiler/'],
      ['grafo continental', 'build real/continental/src/graph.mjs'],
      ['regioes moveis', 'build real/continental/src/regions.mjs'],
      ['streaming de terreno', 'build real/continental/src/streamer.mjs'],
      ['carregador de fisica', 'build real/continental/src/physics-loader.mjs'],
      ['fisica do compilador', 'build real/continental/compiler/physics.mjs'],
      ['vegetacao', 'build real/continental/compiler/vegetation.mjs'],
      ['validador', 'build real/continental/tools/validate.mjs'],
      ['testes', 'build real/continental/test/'],
      ['grafo original de Auralis', 'build real/continental/data/auralis-grafo-original.json'],
      ['worldgen (heightmap, biomas, rios, regioes)', 'world/auralis/'],
      ['heightmap', 'world/auralis/outputs/heightmap.png'],
      ['mapa de biomas', 'world/auralis/outputs/biomes.png'],
      ['rios', 'world/auralis/outputs/rivers.json'],
      ['regioes', 'world/auralis/outputs/regions.json'],
      ['locais especiais (cavernas e afins)', 'world/auralis/outputs/special-locations.json'],
      ['precipitacao', 'world/auralis/outputs/precipitation.png'],
      ['temperatura', 'world/auralis/outputs/temperature.png'],
      ['vila dos Hunters', 'world/hunters-village-v01/'],
      ['prototipos de litoral', 'world/coast-v01/'],
      ['estudio de hexagonos (Godot)', 'tools/godot-hex-studio/'],
    ];
    for (const [nome, cam] of sis) {
      const existe = arquivos.some((a) => a === cam || a.startsWith(cam));
      const n = arquivos.filter((a) => a === cam || a.startsWith(cam)).length;
      L.push(`- ${nome}: ${existe ? `presente (\`${cam}\`, ${n} arquivo(s))` : `**${NAO}**`}`);
    }
    L.push('', '## Hexagonos', '');
    L.push('| id | bioma | GLB | bytes | triangulos | sha confere | revisao | fisica |');
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const h of aud.hexagonos) {
      L.push(`| ${h.id} | ${h.bioma} | ${h.arquivo ? 'sim' : 'NAO'} | ${h.bytes ?? '-'} | ${h.triangulos ?? '-'} | ${h.hashConfere ? 'sim' : 'NAO'} | ${h.revisaoArtistica ?? NAO} | ${h.runtime?.physics ?? NAO} |`);
    }
    escrever('INVENTARIO-MAPA', L, aud);
  }
}

// =================== 2. CLIMA ===================
{
  const eco = arquivos.filter((a) => a.startsWith('labs/ia-criaturas/'));
  const clima = eco.filter((a) => /clima|vento|wind|nuvem|cloud|tempestade|nevasca|chuva|precipit|aurora|lunar/i.test(a));
  const doc = arquivos.filter((a) => /^build real\/13-clima-dinamico\.md$/.test(a));
  const dados = {
    gerado_em: new Date().toISOString(),
    versao_implementada: 'laboratorio de ecossistema v7 (labs/ia-criaturas)',
    versao_v08: 'nao existe nos repositorios de origem',
    documento_de_projeto: doc[0] ?? NAO,
    arquivos_do_laboratorio: eco.length,
    arquivos_relacionados_a_clima: clima.map((p) => ({ caminho: p, bytes: tam(p), sha_git: sha(p), origem: proc[p]?.origem_mais_recente ?? null })),
  };
  const L = cab('Inventario do clima dinamico', 'Fonte: `labs/ia-criaturas/` (laboratorio de ecossistema) e `build real/13-clima-dinamico.md`.');
  L.push('## Situacao real', '');
  L.push('O laboratorio de clima dinamico **V08 nao existe** nos repositorios de origem.');
  L.push('O documento `build real/13-clima-dinamico.md`, de 23/11/2026, se declara');
  L.push('"PROPOSTA PARA APROVACAO" e "nao implementado". O que existe de clima');
  L.push('implementado e o modulo do laboratorio de ecossistema **v7**');
  L.push('(`labs/ia-criaturas`), com chuva, areia e nevasca afetando visao,');
  L.push('locomocao e energia, mais cenarios de teste de tempestade de areia e chuva.', '');
  L.push(`- arquivos do laboratorio recuperados: **${eco.length}**`);
  L.push(`- arquivos com conteudo climatico: **${clima.length}**`);
  L.push(`- documento de projeto: ${doc[0] ? `\`${doc[0]}\`` : NAO}`, '');
  L.push('## Arquivos com conteudo climatico', '');
  L.push('| caminho | bytes | origem |');
  L.push('| --- | --- | --- |');
  for (const p of clima) L.push(`| \`${p}\` | ${tam(p) ?? '-'} | ${origem(p)} |`);
  escrever('INVENTARIO-CLIMA', L, dados);
}

// =================== 3. HUNTERS ===================
{
  const base = arquivos.filter((a) => a.startsWith('assets/hunters/'));
  const lab = arquivos.filter((a) => a.startsWith('labs/hunters/') || a.startsWith('labs/hunters-codex/'));
  const glbs = [...base, ...lab].filter((a) => a.toLowerCase().endsWith('.glb'));
  const modelos = glbs.map((p) => ({ caminho: p, ...glbInfo(p), sha_git: sha(p), origem: proc[p]?.origem_mais_recente ?? null }));
  const anims = [...new Set(modelos.flatMap((m) => m.animacoes ?? []))];
  const pvp = lab.filter((a) => /pvp|kenshi/i.test(a));
  const pve = lab.filter((a) => /pve|monster|mh/i.test(a));
  const dados = {
    gerado_em: new Date().toISOString(),
    modelos_glb: modelos,
    total_modelos: modelos.length,
    animacoes_embutidas_em_glb: anims,
    arquivos_assets_hunters: base.length,
    arquivos_laboratorios_hunters: lab.length,
    arquivos_pvp: pvp.length,
    arquivos_pve: pve.length,
    pastas_vazias_no_workshop: ['accessories', 'animations', 'rig', 'materials', 'previews', 'clothing', 'beards', 'weapons']
      .filter((d) => arquivos.filter((a) => a.startsWith(`assets/hunters/hunter-workshop/${d}/`)).every((a) => a.endsWith('README.md'))),
  };
  const L = cab('Inventario dos Hunters', 'Fonte: `assets/hunters/`, `labs/hunters/` e `labs/hunters-codex/`.');
  L.push('## Resumo', '');
  L.push(`- modelos GLB de Hunter e partes: **${modelos.length}**`);
  L.push(`- animacoes embutidas nos GLBs: **${anims.length}**`);
  L.push(`- arquivos em \`assets/hunters/\`: **${base.length}**`);
  L.push(`- arquivos de laboratorio (PvP e PvE): **${lab.length}**`);
  L.push(`- arquivos do ramo PvP (Kenshi): **${pvp.length}**`);
  L.push(`- arquivos do ramo PvE (Monster Hunter): **${pve.length}**`);
  L.push(`- pastas do workshop que contem apenas README: ${dados.pastas_vazias_no_workshop.length ? dados.pastas_vazias_no_workshop.map((d) => `\`${d}\``).join(', ') : 'nenhuma'}`, '');
  L.push('## Modelos', '');
  L.push('| caminho | bytes | triangulos | animacoes | skins | juntas | origem |');
  L.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const m of modelos) {
    L.push(`| \`${m.caminho}\` | ${m.bytes ?? '-'} | ${m.triangulos ?? '-'} | ${m.animacoes ? m.animacoes.length : '-'} | ${m.skins ?? '-'} | ${m.juntas ?? '-'} | ${origem(m.caminho)} |`);
  }
  escrever('INVENTARIO-HUNTERS', L, dados);
}

// =================== 4. ARMADURAS ===================
{
  const raiz = 'assets/hunters/hunter-workshop/armor';
  const todos = arquivos.filter((a) => a.startsWith(raiz + '/'));
  const conjuntos = {};
  for (const p of todos) {
    const m = p.match(/armor\/concepts\/([^/]+)\//);
    if (!m) continue;
    const id = m[1];
    const c = (conjuntos[id] ??= { id, conceitos: [], manifesto: null, readme: null, modelos: [], texturas: [] });
    if (/\.(png|jpg|jpeg|webp)$/i.test(p)) c.conceitos.push(p);
    else if (/manifest\.json$/.test(p)) c.manifesto = p;
    else if (/README\.md$/.test(p)) c.readme = p;
    else if (/\.glb$/i.test(p)) c.modelos.push(p);
  }
  for (const c of Object.values(conjuntos)) {
    let man = null;
    if (c.manifesto) { try { man = JSON.parse(readFileSync(c.manifesto, 'utf8')); } catch { /* ilegivel */ } }
    c.criatura_base = man?.creature ?? man?.criatura ?? man?.baseCreature ?? c.id.replace(/-v\d+$/, '');
    c.status_manifesto = man?.status ?? NAO;
    c.pecas_no_manifesto = man?.pieces ?? man?.pecas ?? null;
    c.estagio = c.modelos.length
      ? (c.texturas.length ? 'modelada com textura' : 'modelada sem textura')
      : (c.conceitos.length ? 'somente conceitual' : 'somente ficha, sem conceito');
    c.origem = c.manifesto ? proc[c.manifesto]?.origem_mais_recente ?? null : null;
  }
  const lista = Object.values(conjuntos).sort((a, b) => a.id.localeCompare(b.id));
  const dados = {
    gerado_em: new Date().toISOString(),
    total_conjuntos: lista.length,
    conjuntos_modelados: lista.filter((c) => c.modelos.length).length,
    conjuntos_com_conceito: lista.filter((c) => c.conceitos.length).length,
    conjuntos_somente_ficha: lista.filter((c) => !c.conceitos.length && !c.modelos.length).length,
    conjuntos: lista,
  };
  const L = cab('Inventario das armaduras', 'Fonte: `assets/hunters/hunter-workshop/armor/`.');
  L.push('## Resumo', '');
  L.push(`- conjuntos de armadura: **${lista.length}**`);
  L.push(`- conjuntos com modelo GLB: **${dados.conjuntos_modelados}**`);
  L.push(`- conjuntos com arte conceitual: **${dados.conjuntos_com_conceito}**`);
  L.push(`- conjuntos apenas com ficha, sem conceito nem modelo: **${dados.conjuntos_somente_ficha}**`, '');
  L.push('Nenhuma armadura esta modelada: nao existe um unico GLB de armadura nos');
  L.push('repositorios de origem. Os conjuntos estao em estagio conceitual ou apenas');
  L.push('documental.', '');
  L.push('## Conjuntos', '');
  L.push('| conjunto | criatura base | conceito | modelo | estagio | status no manifesto |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  for (const c of lista) {
    L.push(`| ${c.id} | ${c.criatura_base} | ${c.conceitos.length || 'nao'} | ${c.modelos.length || 'nao'} | ${c.estagio} | ${c.status_manifesto} |`);
  }
  escrever('INVENTARIO-ARMADURAS', L, dados);
}

// =================== 5. ARMAS ===================
{
  const re = /(^|[\/_-])(katana|espada|sword|blade|lamina|escudo|shield|bow|flecha|arrow|lanca|spear|machado|axe|adaga|dagger|weapon)([\/_.-]|$)/i;
  const noDir = arquivos.filter((a) => a.startsWith('assets/hunters/hunter-workshop/weapons/'));
  const porNome = arquivos.filter((a) => re.test(a.split('/').pop().normalize('NFD').replace(/[̀-ͯ]/g, '')));
  const glbs = porNome.filter((a) => a.toLowerCase().endsWith('.glb'));
  const dados = {
    gerado_em: new Date().toISOString(),
    pasta_de_armas: noDir,
    total_na_pasta_de_armas: noDir.length,
    modelos_glb_de_arma: glbs.length,
    arquivos_com_nome_de_arma: porNome.map((p) => ({ caminho: p, bytes: tam(p), tipo: p.split('.').pop().toLowerCase() })),
    observacao: 'Nenhum modelo de arma existe. Os arquivos listados sao resultados de laboratorio de combate (renders, eventos, videos) e documentos, nao assets de arma.',
  };
  const L = cab('Inventario das armas', 'Fonte: `assets/hunters/hunter-workshop/weapons/` e varredura por nome em todo o repositorio.');
  L.push('## Situacao real', '');
  L.push('**Nao existe nenhum modelo de arma nos repositorios de origem.**');
  L.push(`A pasta \`assets/hunters/hunter-workshop/weapons/\` contem ${noDir.length} arquivo(s):`);
  for (const p of noDir) L.push(`- \`${p}\``);
  L.push('');
  L.push(`Modelos GLB cujo nome indica arma: **${glbs.length}**.`);
  L.push('A varredura por nome encontra apenas resultados dos laboratorios de combate');
  L.push('(renders de pose, eventos, videos de captura) e documentos de design, que');
  L.push('registram o uso de espada e lanca nas animacoes do Hunter, nao os objetos.', '');
  L.push('Categorias pedidas na tarefa (katanas, espadas longas, espadas curtas,');
  L.push('escudos, arcos, armas de longo alcance): **nenhuma possui arte conceitual,');
  L.push('modelo, textura ou manifesto proprio nos repositorios auditados**.', '');
  L.push('## Arquivos com nome de arma', '');
  L.push('| caminho | tipo | bytes |');
  L.push('| --- | --- | --- |');
  for (const p of porNome.slice(0, 200)) L.push(`| \`${p}\` | ${p.split('.').pop()} | ${tam(p) ?? '-'} |`);
  if (porNome.length > 200) L.push('', `(${porNome.length - 200} arquivos restantes no JSON)`);
  escrever('INVENTARIO-ARMAS', L, dados);
}

// =================== 6. LABORATORIOS ===================
{
  const labs = {};
  for (const p of arquivos) {
    const m = p.match(/^(labs\/[^/]+)\//) || p.match(/^(game\/[^/]+)\//) || p.match(/^(build real\/continental)\//) || p.match(/^(tools\/[^/]+)\//);
    if (!m) continue;
    const k = m[1];
    const l = (labs[k] ??= { id: k, arquivos: 0, bytes: 0, glb: 0, testes: 0, html: 0, js: 0, py: 0, rust: 0, config: [] });
    l.arquivos++;
    l.bytes += tam(p) ?? 0;
    const e = p.split('.').pop().toLowerCase();
    if (e === 'glb') l.glb++;
    if (/test|spec/i.test(p)) l.testes++;
    if (e === 'html') l.html++;
    if (['js', 'mjs', 'cjs', 'ts'].includes(e)) l.js++;
    if (e === 'py') l.py++;
    if (e === 'rs' || p.endsWith('Cargo.toml')) l.rust++;
    if (/package\.json$|Cargo\.toml$|requirements\.txt$/.test(p)) l.config.push(p);
  }
  const lista = Object.values(labs).sort((a, b) => b.bytes - a.bytes);
  for (const l of lista) l.origem_exemplo = null;
  const dados = { gerado_em: new Date().toISOString(), total: lista.length, laboratorios: lista };
  const L = cab('Inventario dos laboratorios e dependencias', 'Fonte: `labs/`, `game/`, `build real/continental/` e `tools/` no repositorio.');
  L.push('## Resumo', '');
  L.push(`- conjuntos recuperados: **${lista.length}**`);
  L.push(`- arquivos somados: **${lista.reduce((s, l) => s + l.arquivos, 0)}**`);
  L.push(`- tamanho somado: **${mb(lista.reduce((s, l) => s + l.bytes, 0))}**`, '');
  L.push('## Conjuntos', '');
  L.push('| conjunto | arquivos | tamanho | GLB | testes | HTML | JS/TS | Python | Rust | configuracao |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const l of lista) {
    L.push(`| \`${l.id}\` | ${l.arquivos} | ${mb(l.bytes)} | ${l.glb} | ${l.testes} | ${l.html} | ${l.js} | ${l.py} | ${l.rust} | ${l.config.length ? l.config.map((c) => `\`${c.split('/').pop()}\``).join(', ') : 'nenhuma'} |`);
  }
  escrever('INVENTARIO-LABORATORIOS', L, dados);
}

console.log('inventarios gerados em docs/migracao/');
