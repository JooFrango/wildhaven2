import {full,tiles,edges,origin,clearing,groundSampler,noise} from './landscape.mjs';
import {addUnderstory} from './understory.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseGlb} from '../compiler/glb.mjs';
import {recover} from './trees.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
process.chdir(dir);
const hash=b=>createHash('sha256').update(b).digest('hex');
function pack(g,views){
 let size=0,parts=[];
 for(const [i,bytes] of views.entries()){
  const pad=(4-size%4)%4;parts.push(Buffer.alloc(pad),bytes);size+=pad;
  Object.assign(g.bufferViews[i],{byteOffset:size,byteLength:bytes.length});size+=bytes.length;
 }
 g.buffers[0].byteLength=size;
 const bin=Buffer.concat([...parts,Buffer.alloc((4-size%4)%4)]);
 const json=Buffer.from(JSON.stringify(g)),j=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const out=Buffer.alloc(28+j.length+bin.length);
 [0x46546c67,2,out.length,j.length,0x4e4f534a].forEach((v,i)=>out.writeUInt32LE(v,i*4));
 j.copy(out,20);out.writeUInt32LE(bin.length,20+j.length);out.writeUInt32LE(0x004e4942,24+j.length);bin.copy(out,28+j.length);return out;
}
const report=[],json=(f,v)=>fs.writeFileSync(f,JSON.stringify(v)+'\n');
fs.mkdirSync('models',{recursive:true});
for(const tile of tiles){
 const source='../../../assets/world/continental-272/'+tile.id+'/'+path.basename(tile.source.path);
 const bytes=fs.readFileSync(source);
 if(hash(bytes)!==tile.source.sha256)throw Error('Source mismatch');
 const glb=parseGlb(bytes),g=glb.json,{trees,meshes}=recover(glb,tile.id),height=groundSampler(glb);
 const views=g.bufferViews.map(v=>Buffer.from(glb.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)));
 const tri=()=>g.meshes.reduce((s,m)=>s+m.primitives.reduce((s,p)=>s+(p.indices===undefined?g.accessors[p.attributes.POSITION].count:g.accessors[p.indices].count/3),0),0);
 const before=tri();
 for(const t of trees){
  const [x,y,z]=t.root,ground=height(x,z);
  if(!Number.isFinite(ground))throw Error('Missing ground');
  t.keep=clearing(tile.x+x,tile.z+z,ground,tile)<(noise(t.i,19,8)-.5)*64;
  const stem=meshes.trunks.parts[t.i];t.radius=.5*Math.max(...meshes.trunks.pos.slice(stem.start,stem.start+stem.length/2).map(v=>Math.hypot(v[0]-x,v[2]-z)));
  t.pivot=[x,ground,z];t.spans={};
 }
 for(const [name,{p,pos,idx,parts}] of Object.entries(meshes)){
  const owners=new Int32Array(pos.length);
  for(const part of parts)owners.fill(part.owner,part.start,part.start+part.length);
  const remap=new Int32Array(pos.length).fill(-1),kept=[];
  owners.forEach((owner,i)=>{if(trees[owner].keep){remap[i]=kept.length;kept.push(i);}});
  for(const [attr,aid] of Object.entries(p.attributes)){
   const a=g.accessors[aid],v=g.bufferViews[a.bufferView],bytes=views[a.bufferView],stride=v.byteLength/a.count;
   if(a.byteOffset||v.byteStride||!Number.isInteger(stride))throw Error('Unexpected layout');
   const dst=Buffer.alloc(kept.length*stride),min=[],max=[];
   for(const [j,i] of kept.entries()){
    bytes.copy(dst,j*stride,i*stride,(i+1)*stride);
    if(attr==='POSITION')for(let k=0;k<3;k++){
     const pivot=trees[owners[i]].pivot[k],val=Math.fround(pivot+(pos[i][k]-pivot)*.5);
     dst.writeFloatLE(val,j*stride+4*k);min[k]=Math.min(min[k]??Infinity,val);max[k]=Math.max(max[k]??-Infinity,val);
    }
   }
   a.count=kept.length;if(attr==='POSITION')Object.assign(a,{min,max});else {delete a.min;delete a.max;}
   views[a.bufferView]=dst;
  }
  const indices=[];
  for(let i=0;i<idx.length;i+=3){
   const owner=owners[idx[i]],t=trees[owner];
   if(owner!==owners[idx[i+1]]||owner!==owners[idx[i+2]])throw Error('Split face');
   if(t.keep){
    const span=t.spans[name]??=[indices.length,0];
    if(span[0]+span[1]!==indices.length)throw Error('Noncontiguous owner '+name);
    span[1]+=3;indices.push(...idx.slice(i,i+3).map(k=>remap[k]));
   }
  }
  const a=g.accessors[p.indices];views[a.bufferView]=Buffer.from(Uint32Array.from(indices).buffer);
  Object.assign(a,{componentType:5125,count:indices.length,min:[0],max:[kept.length-1]});
 }
 const plants=[];
 for(let i=-120;i<=120;i++)for(let j=-126;j<=126;j++){
  const x=(i+noise(i,j,1))*20,z=(j+noise(i,j,2))*20,y=height(x,z);
  if(y!==undefined&&clearing(tile.x+x,tile.z+z,y,tile)>0)plants.push([+x.toFixed(2),+y.toFixed(3),+z.toFixed(2),noise(i,j,5)<.12?1:0]);
 }
 addUnderstory(g,views,plants);
 const model='models/'+tile.id+'.glb',derived=pack(g,views);fs.writeFileSync(model,derived);
 const kept=trees.filter(t=>t.keep);
 json('models/'+tile.id+'.json',{trees:kept.map(({id,pivot,species,spans,radius})=>({id,pivot,species,spans,radius})),plants});
 report.push({id:tile.id,treesBefore:trees.length,treesAfter:kept.length,trianglesBefore:before,trianglesAfter:tri(),bytesBefore:bytes.length,bytesAfter:derived.length,sha256:hash(derived),instancedTriangles:plants.length*16+plants.filter(p=>p[3]).length*6,plants:plants.length});
 tile.originalSource=tile.source;tile.source={repository:"JooFrango/wildhaven2",revision:"feat/clareiras-temperadas-v01",path:model,bytes:derived.length,sha256:hash(derived),gitBlobSha1:createHash('sha1').update('blob '+derived.length+'\0').update(derived).digest('hex'),triangles:tri()};
 console.log(report.at(-1));
}
json('pilot.json',{...full,tiles,edges,counts:{tiles:3,edges:3},scope:'clareiras-v01',origin});
json('metrics.json',report);
