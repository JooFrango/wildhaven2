/** Audit the checked-out, published v08 binary GLB and two actual Chromium GIFs. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const asset=new URL('../assets/hunter-pvp-v08/',import.meta.url);
const renders=new URL('../resultados/pvp-v08/',import.meta.url);
const a=JSON.parse(await readFile(new URL('manifest.json',asset),'utf8'));
const m=JSON.parse(await readFile(new URL('manifest.json',renders),'utf8'));
const glb=await readFile(new URL(a.file,asset));
if(glb.toString('ascii',0,4)!=='glTF'||glb.length!==a.bytes||glb.readUInt32LE(8)!==glb.length||sha(glb)!==a.sha256)throw Error('Remote v08 GLB invalid');
if(m.glbSha256!==a.sha256||m.previews.length!==2)throw Error('Wrong GIF manifest source GLB');
for(const x of m.previews){
 const p=await readFile(new URL(x.file,renders));
 const frames=(p.toString('latin1').match(/\x21\xF9\x04/g)||[]).length;
 if(p.toString('ascii',0,6)!=='GIF89a'||p.length!==x.bytes||sha(p)!==x.sha256||frames!==x.frames)throw Error('Remote GIF failed: '+x.file);
 console.log(x.file+' verified '+x.frames+' frames SHA '+x.sha256);
}
console.log('REMOTE CHECK PASS',a.file,a.bytes,a.sha256,a.newClips.map(x=>x.name));