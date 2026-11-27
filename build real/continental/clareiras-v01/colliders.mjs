import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodePhysicsChunk,HEADER_BYTES} from '../compiler/physics.mjs';

const manifest=JSON.parse(fs.readFileSync('pilot.json'));
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,obj)=>fs.writeFileSync(p,JSON.stringify(obj,null,2)+'\n');
const sum=b=>createHash('sha256').update(b).digest('hex');
const report=read('packages/compile-report.json');
for(const tile of manifest.tiles){
 const folder='packages/'+tile.id+'-physics-v01/',idx=read(folder+'index.json');
 const {trees}=read(tile.source.path.replace('.glb','.json'));
 const snap=idx.report?.centerSnap;
 const x0=snap?.exactX??tile.x,z0=snap?.exactZ??tile.z;
 const records=trees.map(t=>({id:t.id,species:t.species,worldX:t.pivot[0]+x0,worldY:t.pivot[1],worldZ:t.pivot[2]+z0,radius:t.radius,cuttable:false,state:'standing'}));
 for(const meta of idx.chunks){
  const matches=records.filter(t=>t.worldX+t.radius>=meta.x0&&t.worldX-t.radius<meta.x0+meta.nx*meta.res&&t.worldZ+t.radius>=meta.z0&&t.worldZ-t.radius<meta.z0+meta.nz*meta.res);
  if(!matches.length)continue;
  const file=folder+meta.url,packed=fs.readFileSync(file);
  if(sum(packed)!==meta.sha256)throw Error('WHP1 checksum');
  const raw=gunzipSync(packed),ch=decodePhysicsChunk(raw),n=ch.nx*ch.nz;
  for(const t of matches){
   const cx=(t.worldX-ch.x0)/ch.res,cz=(t.worldZ-ch.z0)/ch.res,rad=t.radius/ch.res;
   for(let j=Math.max(0,Math.floor(cz-rad));j<Math.min(ch.nz,Math.ceil(cz+rad));j++)
    for(let i=Math.max(0,Math.floor(cx-rad));i<Math.min(ch.nx,Math.ceil(cx+rad));i++){
     if(Math.hypot(i+.5-cx,j+.5-cz)>rad)continue;
     const k=j*ch.nx+i;
     if(!ch.blocked[k]){meta.blockedCells++;ch.blocked[k]=1;raw[HEADER_BYTES+8*n+k]=1;}
    }
  }
  const result=gzipSync(raw,{level:7});fs.writeFileSync(file,result);
  Object.assign(meta,{sha256:sum(result),rawSha256:sum(raw),bytes:result.length});
 }
 write(folder+'index.json',idx);
 write(folder+'trees.json',{schema:'wildhaven.trees.catalog.v1',tileId:tile.id,trees:records,requiresMappingReview:false});
 const item=report.items.find(i=>i.id===tile.id);
 Object.assign(item,{output:folder,treeInstances:records.length,packedBytes:idx.chunks.reduce((s,c)=>s+c.bytes,0)});
}
write('packages/compile-report.json',report);