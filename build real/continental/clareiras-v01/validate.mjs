import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseGlb} from '../compiler/glb.mjs';
import {decodePhysicsChunk} from '../compiler/physics.mjs';
import {recover} from './trees.mjs';

const read=p=>JSON.parse(fs.readFileSync(p)),manifest=read('pilot.json'),cells=new Map(),summary=[];
const sum=b=>createHash('sha256').update(b).digest('hex');
for(const tile of manifest.tiles){
 const folder='packages/'+tile.id+'-physics-v01/',idx=read(folder+'index.json');
 const records=read(folder+'trees.json').trees;
 for(const meta of idx.chunks){
  const b=fs.readFileSync(folder+meta.url);assert.equal(sum(b),meta.sha256);
  const raw=gunzipSync(b);assert.equal(sum(raw),meta.rawSha256);
  cells.set(tile.id+':'+meta.ix+':'+meta.iz,decodePhysicsChunk(raw));
 }
 const b=fs.readFileSync(tile.source.path);assert.equal(sum(b),tile.source.sha256);
 const original=fs.readFileSync('../../../assets/world/continental-272/'+tile.id+'/'+path.basename(tile.originalSource.path));assert.equal(sum(original),tile.originalSource.sha256);
 const old=parseGlb(original),fresh=parseGlb(b);
 for(const name of ['terrain','boulders','shrubs']){
  const buffers=g=>{
   const node=g.json.nodes.find(n=>n.name===name),p=g.json.meshes[node.mesh].primitives[0];
   return [p.indices,...Object.values(p.attributes)].map(i=>{const a=g.json.accessors[i],v=g.json.bufferViews[a.bufferView];return sum(g.bin.subarray(v.byteOffset,v.byteOffset+v.byteLength));});
  };
  assert.deepEqual(buffers(old),buffers(fresh));
 }
 const kept=new Map(records.map(r=>[r.id,r]));
 const originalTrees=recover(old,tile.id).trees;
 let removed=0,occupied=0;
 for(const t of originalTrees){
  const record=kept.get(t.id);
  if(record){assert.ok(at(tile.id,record.worldX,record.worldZ)?.blocked);continue;}
  removed++;
  if(at(tile.id,t.root[0]+tile.x,t.root[2]+tile.z)?.blocked)occupied++;
 }
 summary.push({id:tile.id,solidTrunks:records.length,removed,removedCentersStillBlockedByScene:occupied,chunks:idx.chunks.length});
}
function at(id,x,z){
 const c=cells.get(id+':'+Math.floor(x/256)+':'+Math.floor(z/256));if(!c)return;
 const k=Math.floor((z-c.z0)/c.res)*c.nx+Math.floor((x-c.x0)/c.res);
 if(!Number.isFinite(c.heights[k]))return;
 return {blocked:c.blocked[k]||Number.isFinite(c.water[k]),height:c.baseY+c.heights[k]};
}
const [ox,oz]=manifest.origin;
function traverse(radius){
 // Search an 800 m strip around the sinuous passage. Sweep a circular body
 // through each 4 m cardinal step at 1 m intervals and check grade.
 const memo=new Map();
 function free(x,z){
  const k=x+','+z;if(memo.has(k))return memo.get(k);
  const wx=ox+x,wz=oz+z;
  let ground;
  for(const [dx,dz] of [[0,0],...Array.from({length:12},(_,i)=>[radius*Math.cos(i*Math.PI/6),radius*Math.sin(i*Math.PI/6)])]){
   const gx=wx+dx,gz=wz+dz,id=(Math.floor(gx/2)*2+1)<ox?'FX_19':'FX_20';
   const cell=at(id,gx,gz);if(!cell||cell.blocked){ground=undefined;break;}
   ground??=cell.height;
  }
  memo.set(k,ground);return ground;
 }
 const key=(x,z)=>x+','+z,q=[[-400,0]],parents=new Map([['-400,0',null]]);
 for(let i=0;i<q.length;i++){
  const [x,z]=q[i];if(x===400){
   const points=[];let k=key(x,z);while(k){points.push(k.split(',').map(Number));k=parents.get(k);}
   return {radiusMeters:radius,lengthMeters:(points.length-1)*4,points:points.reverse()};
  }
  for(const [dx,dz] of [[1,0],[0,1],[0,-1],[-1,0]]){
   const nx=x+dx*4,nz=z+dz*4,nk=key(nx,nz);if(nx< -400||nx>400||Math.abs(nz)>140||parents.has(nk))continue;
   let h=free(x,z),ok=h!==undefined;
   for(let j=1;j<=4&&ok;j++){const next=free(x+dx*j,z+dz*j);ok=next!==undefined&&Math.abs(h-next)<=Math.tan(35*Math.PI/180);h=next;}
   if(ok){parents.set(nk,key(x,z));q.push([nx,nz]);}
  }
 }
 throw Error('No cross-border route for radius '+radius+' start='+free(-400,0)+' reach='+q.reduce((m,p)=>Math.max(m,p[0]),-400));
}
const routes=[traverse(.55),traverse(2)];
fs.writeFileSync('navigation.json',JSON.stringify({summary,origin:manifest.origin,routes},null,1));console.log(summary,routes.map(r=>r.lengthMeters));