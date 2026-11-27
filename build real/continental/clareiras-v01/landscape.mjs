import fs from 'node:fs';
import {readAccessor} from '../compiler/glb.mjs';
const full=JSON.parse(fs.readFileSync(new URL('../data/continent-272.manifest.json',import.meta.url)));
const ids=['FX_16','FX_19','FX_20'];
const tiles=full.tiles.filter(t=>ids.includes(t.id));
const edges=full.edges.filter(e=>e.every(id=>ids.includes(id)));
if(edges.length!==3)throw Error('Pilot topology changed');

const noise=(i,j,k)=>{const v=Math.sin(i*127.1+j*311.7+k*43.9)*43758.5453;return v-Math.floor(v)};
const byId=Object.fromEntries(tiles.map(t=>[t.id,t]));
const origin=[(byId.FX_19.x+byId.FX_20.x)/2,byId.FX_20.z];
const rimLines=[];
for(const tile of tiles){
 const near=full.edges.filter(e=>e.includes(tile.id)).map(e=>full.tiles.find(t=>t.id===e.find(s=>s!==tile.id)));
 for(let i=0;i<6;i++){
  const nx=Math.cos(i*Math.PI/3),nz=Math.sin(i*Math.PI/3),apothem=Math.sqrt(3)*1250;
  if(near.some(t=>ids.includes(t.id)&&Math.hypot(t.x-tile.x-2*apothem*nx,t.z-tile.z-2*apothem*nz)<1))continue;
  rimLines.push({tile,nx,nz,apothem});
 }
}
const spacing=676;
function clearing(x,z,y,tile){
 const X=x-origin[0],Z=z-origin[1],i=Math.round(X/spacing),j=Math.round(Z/spacing);
 let best=-1e4;
 for(let a=i-1;a<=i+1;a++)for(let b=j-1;b<=j+1;b++){
   const special=a===0&&b===0;
   const cx=a*spacing+(special?0:(noise(a,b,1)-.5)*360);
   const cz=b*spacing+(special?0:(noise(a,b,2)-.5)*360);
   const dx=X-cx,dz=Z-cz,angle=Math.atan2(dz,dx),r=221+52*noise(a,b,3);
   const boundary=r*(1+.13*Math.sin(3*angle+a)+.09*Math.cos(5*angle+b));
   const basin=Math.max(-38,Math.min(38,(910-y)*.55));
   best=Math.max(best,boundary+basin-Math.hypot(dx*.90,dz));
 }
 // Sinuous east-west passages leave alternate rows as isolated clearings.
 if(Math.abs(j%2)===0)best=Math.max(best,77-Math.abs(Z-j*spacing-60*Math.sin(X/170+j)-32*Math.sin(X/93)));
 const grove=180*Math.max(0,Math.sin(X/790+.7)*Math.cos(Z/690-.3)-.15);
  const rim=Math.min(...rimLines.filter(line=>line.tile===tile).map(({nx,nz,apothem})=>apothem-(x-tile.x)*nx-(z-tile.z)*nz));
 return Math.min(best-grove,rim*2-125);
}
function groundSampler(g){
 const p=g.json.meshes[g.json.nodes.find(n=>n.name==='terrain').mesh].primitives[0];
 const pts=Array.from({length:g.json.accessors[p.attributes.POSITION].count},(_,i)=>readAccessor(g,p.attributes.POSITION,i));
 const cells=new Map();
 for(let i=0;i<g.json.accessors[p.indices].count;i+=3){
  const tri=[0,1,2].map(k=>pts[readAccessor(g,p.indices,i+k)[0]]);
  const bounds=k=>tri.map(v=>Math.floor(v[k]/100));
  for(let x=Math.min(...bounds(0));x<=Math.max(...bounds(0));x++)for(let z=Math.min(...bounds(2));z<=Math.max(...bounds(2));z++){
   const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(tri);
  }
 }
 return (x,z)=>{
  for(const [a,b,c] of cells.get(Math.floor(x/100)+','+Math.floor(z/100))??[]){
   const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
   if(u>=0&&v>=0&&u+v<=1)return u*a[1]+v*b[1]+(1-u-v)*c[1];
  }
 };
}
export {full,tiles,edges,origin,clearing,groundSampler,noise};