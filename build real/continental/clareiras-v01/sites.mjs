import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseGlb} from '../compiler/glb.mjs';
import {tiles,origin,clearing,groundSampler} from './landscape.mjs';
const ground=new Map(tiles.map(t=>[t,groundSampler(parseGlb(fs.readFileSync('../../../assets/world/continental-272/'+t.id+'/'+path.basename(t.source.path))))]));
function sample(x,z){
 for(const t of tiles){const h=ground.get(t)(x-t.x,z-t.z);if(h!==undefined)return {id:t.id,value:clearing(x,z,h,t)};}
}
const [x,z]=origin;
const cross=[-130,-65,-1,1,65,130].map(dx=>sample(x+dx,z));
assert(cross.every(p=>p.value>0));assert.equal(new Set(cross.map(p=>p.id)).size,2);
function closed(cx,cz){
 const q=[[cx,cz]],visited=new Set([cx+','+cz]),owners=new Set();
 let xmin=cx,xmax=cx,zmin=cz,zmax=cz;
 for(let i=0;i<q.length;i++){
  const [a,b]=q[i],p=sample(a,b);if(!p)return;
  if(p.value<=0)continue;
  owners.add(p.id);if(owners.size>1||Math.hypot(cx-a,cz-b)>800)return;
  xmin=Math.min(xmin,a);xmax=Math.max(xmax,a);zmin=Math.min(zmin,b);zmax=Math.max(zmax,b);
  for(const [dx,dz] of [[10,0],[-10,0],[0,10],[0,-10]]){
   const u=a+dx,v=b+dz,k=u+','+v;if(!visited.has(k)){visited.add(k);q.push([u,v]);}
  }
 }
 if(xmax-xmin<200||zmax-zmin<200)return;
 return {tile:[...owners][0],x:cx,z:cz,width:xmax-xmin,depth:zmax-zmin,gridMeters:10};
}
let isolated;
for(const [dx,dz] of [[676,676],[676,-676],[-676,676],[1352,676],[-676,-676]]){
 isolated=closed(Math.round(x+dx),Math.round(z+dz));if(isolated)break;
}
assert(isolated);const result={crossing:{x,z,fieldSamples:cross},isolated};fs.writeFileSync('sites.json',JSON.stringify(result,null,1));console.log(result);