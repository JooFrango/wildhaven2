import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const lab=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(lab,'../..'),out=resolve(process.argv[2]??join(lab,'dist'));
await mkdir(out,{recursive:true});const target=join(out,'labs/hunters-codex');await mkdir(target,{recursive:true});
for(const p of ['hunter-lab.html','style.css','src','assets'])await cp(join(lab,p),join(target,p),{recursive:true});
for(const p of ['src','config'])await cp(join(repo,'labs/ia-criaturas',p),join(out,'labs/ia-criaturas',p),{recursive:true,filter:src=>!src.replaceAll('\\','/').includes('/config/eco/terrenos/')||src.endsWith('hex52-savana-acacia-5km.json')});
for(const p of ['hunter-lab.html','src','config'])await cp(join(repo,'labs/hunters',p),join(out,'labs/hunters',p),{recursive:true});
for(const p of ['index.html','evidencias.html','src','resultados','README.md','docs'])await cp(join(repo,'labs/combate-tatico',p),join(out,'labs/combate-tatico',p),{recursive:true,filter:src=>!src.endsWith('.log')&&!src.endsWith('.tap')&&!src.endsWith('-replay.json')});
const three=join(lab,'node_modules/three');for(const p of ['build','examples/jsm'])await cp(join(three,p),join(target,'node_modules/three',p),{recursive:true});
const models=['assets/models/creatures/varrisco/v02/varrisco-animated-v02-LOD0.glb','assets/models/creatures/velsari/velsari-savanna-optimized-v02-LOD0.glb','assets/models/creatures/folhisco/folhisco-optimized-v02-LOD0.glb','assets/models/characters/hunter/combat-v03'];
for(const p of models)for(const prefix of ['', 'repo/']){await mkdir(resolve(out,prefix+p,'..'),{recursive:true});await cp(join(repo,p),join(out,prefix+p),{recursive:true});}
const html=join(out,'labs/hunters/hunter-lab.html');await writeFile(html,(await readFile(html,'utf8')).replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js','../hunters-codex/node_modules/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/','../hunters-codex/node_modules/three/examples/jsm/'));
await writeFile(join(out,'index.html'),'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/labs/combate-tatico/index.html"><title>Wildhaven · Combate orgânico</title><a href="/labs/combate-tatico/index.html">Abrir laboratório de combate</a></html>');
await writeFile(join(out,'SOURCES.md'),'Wildhaven combate tático. Base Claude PR21 e snapshot isolado Codex PR22. Rig e geometria Hunter PR81 preservados; clipes v03 experimentais. Hex52: recorte derivado sem alteração do original. Three.js 0.181.0 MIT. Nenhum código Alpha. Auditoria e limites: labs/combate-tatico/docs.');
console.log('Static package ready: '+out);
