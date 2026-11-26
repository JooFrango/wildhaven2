import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';
const lab=fileURLToPath(new URL('../',import.meta.url)),out=resolve(process.argv[2]??'../sites/wildhaven-hunter-codex/dist'),target=join(out,'labs/hunters');await mkdir(target,{recursive:true});
for(const p of ['hunter-lab.html','src','config','assets','viewer','docs'])await cp(join(lab,p),join(target,p),{recursive:true});
await cp(join(lab,'resultados/jogador'),join(target,'resultados/jogador'),{recursive:true,filter:p=>!p.endsWith('.log')});
await mkdir(join(out,'repo/labs/hunters'),{recursive:true});await cp(join(lab,'assets'),join(out,'repo/labs/hunters/assets'),{recursive:true});
const html=join(target,'hunter-lab.html');await writeFile(html,(await readFile(html,'utf8')).replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js','../hunters-codex/node_modules/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/','../hunters-codex/node_modules/three/examples/jsm/'));
console.log('Updated only static labs/hunters and its asset alias. Other lab packages preserved.');
