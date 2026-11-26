// Independent GitHub checkout verification (not a claim from the build process).
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const root=new URL('../',import.meta.url);
const base=new URL('assets/hunter-pvp-v06/',root),out=new URL('resultados/pvp-v06/',root);
const m=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
const raw=await readFile(new URL(m.file,base));
if(raw.length!==m.bytes||sha(raw)!==m.sha256)throw Error('Remote GLB SHA256 or byte length mismatch');
if(raw.toString('ascii',0,4)!=='glTF'||raw.readUInt32LE(8)!==raw.length)throw Error('Invalid GLB remote');
const gifManifest=JSON.parse(await readFile(new URL('manifest.json',out),'utf8'));
if(gifManifest.count!==10||gifManifest.sourceGLBSha256!==m.sha256)throw Error('GIF manifest not linked to this GLB');
for(const item of gifManifest.gifs){
 const bytes=await readFile(new URL(item.file,out));
 if(bytes.length!==item.bytes||sha(bytes)!==item.sha256||bytes.toString('ascii',0,6)!=='GIF89a')throw Error('Remote GIF verification failed: '+item.file);
 console.log(item.file+' SHA-256 '+item.sha256+' OK ('+bytes.length+' bytes)');
}
console.log('REMOTE AUDIT PASS: GLB '+m.sha256+' ('+raw.length+' bytes), '+gifManifest.gifs.length+' real GIFs');
