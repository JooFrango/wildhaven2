import {readAccessor} from '../compiler/glb.mjs';

function pieces(g, name) {
  const n=g.json.nodes.find(n=>n.name===name);
  const [p]=g.json.meshes[n.mesh].primitives;
  const idx=Array.from({length:g.json.accessors[p.indices].count},(_,i)=>readAccessor(g,p.indices,i)[0]);
  // Connected components, including validation that original batch vertex ranges remain intact.
  const pos=Array.from({length:g.json.accessors[p.attributes.POSITION].count},(_,i)=>readAccessor(g,p.attributes.POSITION,i));
  const parent=pos.map((_,i)=>i);
  function find(i){while(i!==parent[i])i=parent[i]=parent[parent[i]];return i;}
  for(let i=0;i<idx.length;i+=3){parent[find(idx[i])]=find(idx[i+1]);parent[find(idx[i])]=find(idx[i+2]);}
  const groups=new Map();
  pos.forEach((_,i)=>{const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i);});
  return {p,pos,idx,parts:[...groups.values()].map(v=>{
    if(v.at(-1)-v[0]+1!==v.length)throw Error('Noncontiguous '+name);
    return {start:v[0],length:v.length};
  })};
}
const mean=pts=>[0,1,2].map(k=>pts.reduce((s,p)=>s+p[k],0)/pts.length);
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function recover(g,id){
 const meshes=Object.fromEntries(['trunks','branches','conifer_canopy','broadleaf_canopy'].map(n=>[n,pieces(g,n)]));
 const {pos,parts}=meshes.trunks;
 const trees=parts.map((p,i)=>{
   const mid=p.start+p.length/2;
   if(![14,16].includes(p.length))throw Error('Unexpected stem topology');
   const root=mean(pos.slice(p.start,mid)),top=mean(pos.slice(mid,mid+p.length/2));
   p.owner=i;
   return {id:id+'-'+i,i,root,top,species:p.length===14?'conifer':'broadleaf',tips:[]};
 });
 const broad=trees.filter(t=>t.species==='broadleaf'),pine=trees.filter(t=>t.species==='conifer');
 const branch=meshes.branches;
 for(const p of branch.parts){
   const mid=p.start+p.length/2,base=mean(branch.pos.slice(p.start,mid));
   const t=broad.reduce((a,b)=>dist(a.top,base)<dist(b.top,base)?a:b);
   if(dist(t.top,base)>1)throw Error('Detached branch '+dist(t.top,base));
   p.owner=t.i;t.tips.push(mean(branch.pos.slice(mid,mid+p.length/2)));
 }
 const cone=meshes.conifer_canopy;
 for(const p of cone.parts){
   const apex=cone.pos[p.start],d=t=>Math.hypot(apex[0]-t.root[0],apex[2]-t.root[2]);
   const t=pine.reduce((a,b)=>d(a)<d(b)?a:b);
   if(d(t)>18)throw Error('Detached needle layer');
   p.owner=t.i;
 }
 const crown=meshes.broadleaf_canopy;
 let j=0;
 for(const t of broad){
   for(const target of [...t.tips,t.top]){
     const p=crown.parts[j++];if(!p)throw Error('Missing crown');
     const c=mean(crown.pos.slice(p.start,p.start+p.length));
     if(Math.hypot(c[0]-target[0],c[2]-target[2])>16)throw Error('Crown order '+id+' '+t.i+' '+JSON.stringify([c,target,j,t.tips.length]));
     p.owner=t.i;
   }
 }
 if(j!==crown.parts.length)throw Error('Unassigned crowns');
 return {meshes,trees};
}