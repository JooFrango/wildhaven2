#!/usr/bin/env node
// Sirocauro v03: repair shell windings and component-level skin weights; retain all 41 GLB clips.
// node repair-v03.cjs v02.glb v03.glb
const fs=require("node:fs");
function repairGLB(bytes){
 const hd=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(hd.getUint32(0,true)!==0x46546c67||hd.getUint32(4,true)!==2||hd.getUint32(8,true)!==bytes.length)throw Error("Not GLB 2");
 const jlen=hd.getUint32(12,true),binHead=20+jlen;
 if(hd.getUint32(16,true)!==0x4e4f534a||hd.getUint32(binHead+4,true)!==0x004e4942)throw Error("GLB chunk format");
 let txt="";for(let i=20;i<20+jlen;i+=8192)txt+=String.fromCharCode(...bytes.subarray(i,Math.min(i+8192,20+jlen)));
 const g=JSON.parse(txt.trim());
 const binary=bytes.slice(binHead+8,binHead+8+hd.getUint32(binHead,true)),bv=new DataView(binary.buffer);
 if(g.meshes.length!==1||g.skins.length!==1||g.animations.length!==41)throw Error("Unsupported GLB version");
 const prim=g.meshes[0].primitives[0],access=g.accessors;
 const pAcc=access[prim.attributes.POSITION],iAcc=access[prim.indices],jointAcc=access[prim.attributes.JOINTS_0],weightAcc=access[prim.attributes.WEIGHTS_0];
 const pBase=g.bufferViews[pAcc.bufferView].byteOffset+(pAcc.byteOffset||0),iBase=g.bufferViews[iAcc.bufferView].byteOffset+(iAcc.byteOffset||0),jBase=g.bufferViews[jointAcc.bufferView].byteOffset+(jointAcc.byteOffset||0),wBase=g.bufferViews[weightAcc.bufferView].byteOffset+(weightAcc.byteOffset||0);
 const N=pAcc.count,T=iAcc.count/3;
 if(N!==18714||T!==6238||iAcc.componentType!==5125||jointAcc.componentType!==5121||weightAcc.componentType!==5121)throw Error("GLB structure changed");
 const parent=new Int32Array(N);for(let i=0;i<N;i++)parent[i]=i;
 function find(i){let y=i;while(parent[y]!==y)y=parent[y];while(parent[i]!==y){let k=parent[i];parent[i]=y;i=k;}return y;}
 function union(a,b){a=find(a);b=find(b);if(a!==b)parent[a]=b;}
 const pos=(i,k)=>bv.getFloat32(pBase+12*i+4*k,true);
 const vertexMap=new Map();
 for(let i=0;i<N;i++){
  const xyz=[pos(i,0),pos(i,1),pos(i,2)];
  const key=xyz.map(x=>x.toFixed(5)).join(',');
  if(vertexMap.has(key))union(i,vertexMap.get(key));else vertexMap.set(key,i);
 }
 const tris=[];
 for(let i=0;i<T;i++){
  const ids=[bv.getUint32(iBase+i*12,true),bv.getUint32(iBase+i*12+4,true),bv.getUint32(iBase+i*12+8,true)];
  if(ids.some(v=>v>=N))throw Error("Index out of range");
  union(ids[0],ids[1]);union(ids[1],ids[2]);tris.push(ids);
 }
 const groups=new Map();
 for(let t=0;t<T;t++){
  const v=tris[t];const root=find(v[0]);
  let x=groups.get(root);if(!x){x={triangles:[],first:Math.min(...v),volume:0};groups.set(root,x);}
  x.triangles.push(t);x.first=Math.min(x.first,...v);
  const [a,b,c]=v.map(i=>[pos(i,0),pos(i,1),pos(i,2)]);
  x.volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 }
 const components=[...groups.values()].sort((a,b)=>a.first-b.first);
 if(components.length!==123)throw Error("Expected exactly 123 authored components but found "+components.length);
 const negative=components.map((c,i)=>c.volume < -1e-4?i:null).filter(i=>i!==null);
 if(negative.length!==12)throw Error("Expected 12 reversed components, found "+negative.length);
 for(const i of negative){
  for(const t of components[i].triangles){
   const off=iBase+t*12,b=bv.getUint32(off+4,true),c=bv.getUint32(off+8,true);
   bv.setUint32(off+4,c,true);bv.setUint32(off+8,b,true);
  }
 }
 const byPart=new Int16Array(N);byPart.fill(-1);
 for(let i=0;i<components.length;i++)for(const t of components[i].triangles)for(const vertex of tris[t])byPart[vertex]=i;
 if(byPart.some(v=>v===-1))throw Error("Unclassified vertices");
 const jointIds=Object.fromEntries(g.skins[0].joints.map((node,i)=>[g.nodes[node].name.replace(/^Sirocauro_/,""),i]));
 const clamp=x=>Math.max(0,Math.min(1,x)),fade=(x,a,b)=>clamp((x-a)/(b-a));
 const blended=(a,b,t)=>[[a,1-clamp(t)],[b,clamp(t)]];
 function classify(i){
  const group=byPart[i],x=pos(i,0),z=pos(i,2);
  if(group===0){
   if(x< -1.85)return [["Chest",1]];
   if(x<-.4)return blended("Chest","Spine",fade(x,-1.85,-.4));
   if(x<1.35)return blended("Spine","Pelvis",fade(x,-.4,1.35));
   return [["Pelvis",1]];
  }
  if(group===1)return blended("Neck","Chest",fade(x,-3.75,-2.53));
  if(group===5)return [["Jaw",1]];
  if(group>=2&&group<=4)return [["Head",1]];
  if(group>=6&&group<=61){
   const local=(group<=33)?group-6:group-34;
   if(local>=4&&local<=8)return [["Jaw",1]];
   if(local>=9&&local<=26)return [[((local-9)%2)===0?"Head":"Jaw",1]];
   return [["Head",1]];
  }
  if(group>=62&&group<=71){
   const side=group<=66?"L":"R",local=group<=66?group-62:group-67;
   if(local===0)return blended("Elbow_"+side,"Shoulder_"+side,fade(z,2.45,3.25));
   if(local===1)return blended("Wrist_"+side,"Elbow_"+side,fade(z,2.0,2.54));
   return [["Wrist_"+side,1]];
  }
  if(group>=72&&group<=89){
   const side=group<=80?"L":"R",local=group<=80?group-72:group-81;
   if(local===0)return blended("Knee_"+side,"Hip_"+side,fade(z,1.56,3.38));
   if(local===1)return blended("Ankle_"+side,"Knee_"+side,fade(z,.26,1.56));
   if(local===2)return blended("Foot_"+side,"Ankle_"+side,fade(z,.11,.48));
   return [[local%2===1?"Toe_"+side:"Toe_"+side,1]];
  }
  function tail(x){
   if(x<=2.75)return [["Tail01",1]];
   if(x<4.25)return blended("Tail01","Tail02",fade(x,2.75,4.25));
   if(x<5.8)return blended("Tail02","Tail03",fade(x,4.25,5.8));
   if(x<7.3)return blended("Tail03","Tail04",fade(x,5.8,7.3));
   return [["Tail04",1]];
  }
  if(group===90)return tail(x);
  if(group===91||group===92)return [["Tail04",1]];
  if(group>=93&&group<=109){
    if(x< -1.6)return [["Chest",1]];
    if(x< -.2)return [["Spine",1]];
    if(x<2.74)return [["Pelvis",1]];
    return tail(x);
  }
  if(group>=110&&group<=114)return [[group<=112?"Head":"Neck",1]];
  if(group>=115&&group<=122){
   if(x< -2.5)return [["Neck",1]];
   if(x< -1.15)return [["Chest",1]];
   return [["Spine",1]];
  }
  throw Error("Unhandled component "+group);
 }
 const boneCount=Object.keys(jointIds).length;
 let changed=0,misweights=0;
 const countByPart=new Int32Array(123);
 for(let i=0;i<N;i++){
  const weights=classify(i).filter(([n,w])=>w>0.00000001);
  let sum=0;const newJ=[0,0,0,0],newW=[0,0,0,0];
  for(let k=0;k<weights.length;k++){
   const [name,value]=weights[k],id=jointIds[name];
   if(!Number.isInteger(id)||id<0||id>=boneCount)throw Error("Missing rig bone "+name);
   newJ[k]=id;newW[k]=k===weights.length-1?255-sum:Math.round(value*255);sum+=newW[k];
  }
  if(newW.reduce((a,b)=>a+b,0)!==255)misweights++;
  for(let k=0;k<4;k++){
   if(bv.getUint8(jBase+i*4+k)!==newJ[k] || bv.getUint8(wBase+i*4+k)!==newW[k])changed++;
   bv.setUint8(jBase+i*4+k,newJ[k]);bv.setUint8(wBase+i*4+k,newW[k]);
  }
  countByPart[byPart[i]]++;
 }
 if(misweights)throw Error("Unnormalized weights "+misweights);
 g.meshes[0].name="Sirocauro_v03_correcao_topologia_rig";
 g.asset.generator="Wildhaven Sirocauro v03 back-face orientation repair and component-safe skin";
 g.asset.extras={wildhaven:{stage:"v03_repaired_mesh_and_skin",basis:"v02_41clips",negativeComponentsReoriented:negative,componentCount:123,correctedSkinning:true,originalV01Preserved:true,alphaUnchanged:true,qa:"pending"}};
 g.materials?.forEach(m=>{m.doubleSided=false;});
 const jsonText=JSON.stringify(g),json=new Uint8Array(jsonText.length);
 for(let i=0;i<json.length;i++){const c=jsonText.charCodeAt(i);if(c>127)throw Error("GLTF JSON non ASCII");json[i]=c;}
 const jp=(4-json.length%4)%4,bp=(4-binary.length%4)%4,total=12+8+json.length+jp+8+binary.length+bp;
 const output=new Uint8Array(total),ov=new DataView(output.buffer);
 ov.setUint32(0,0x46546c67,true);ov.setUint32(4,2,true);ov.setUint32(8,total,true);
 ov.setUint32(12,json.length+jp,true);ov.setUint32(16,0x4e4f534a,true);
 output.set(json,20);output.fill(32,20+json.length,20+json.length+jp);
 const begin=20+json.length+jp;ov.setUint32(begin,binary.length+bp,true);ov.setUint32(begin+4,0x004e4942,true);output.set(binary,begin+8);
 return{glb:output,stats:{baseBytes:bytes.length,bytes:output.length,components:123,flippedComponents:negative,triangleCount:T,vertexCount:N,joints:boneCount,animations:g.animations.length,changedJointWeightBytes:changed,nonNormalizedWeights:misweights,textureUnmodified:true,animationCurvesUnmodified:true,originalGeometryPositionsUnmodified:true}};
}
const src=process.argv[2],dest=process.argv[3];if(!src||!dest)throw Error("Expected source and destination GLB paths");
const output=repairGLB(new Uint8Array(fs.readFileSync(src)));
fs.writeFileSync(dest,Buffer.from(output.glb));
console.log(JSON.stringify(output.stats,null,2));
