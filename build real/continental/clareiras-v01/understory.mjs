// Shared grass and flower meshes with per-chunk translations in the delivered GLB.
export function addUnderstory(g,views,plants){
 function accessor(values,type,width){
  const view=views.length;views.push(Buffer.from(Float32Array.from(values).buffer));
  g.bufferViews.push({buffer:0,target:34962});
  const min=Array(width).fill(Infinity),max=Array(width).fill(-Infinity);
  values.forEach((v,i)=>{const k=i%width;min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
  return g.accessors.push({bufferView:view,componentType:5126,count:values.length/width,type,min,max})-1;
 }
 function mesh(name,positions,color){
  const material=g.materials.push({name,doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[...color,1],metallicFactor:0,roughnessFactor:1}})-1;
  return g.meshes.push({name,primitives:[{attributes:{POSITION:accessor(positions,'VEC3',3)},material}]})-1;
 }
 const grass=[],flower=[];
 for(let i=0;i<16;i++){
  const a=i*2.39996,d=Math.sqrt(i)*.8,x=Math.cos(a)*d,z=Math.sin(a)*d;
  grass.push(x-.12,0,z-.09,x+.12,0,z+.09,x+.32*Math.cos(a),.55+.3*Math.sin(i),z+.32*Math.sin(a));
 }
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3,b=a+.65;
  flower.push(0,.72,0,.32*Math.cos(a),.8,.32*Math.sin(a),.32*Math.cos(b),.8,.32*Math.sin(b));
 }
 const geometry=[mesh('graminea',grass,[.18,.31,.074]),mesh('flor',flower,[.92,.68,.28])];
 const buckets=new Map();
 for(const [x,y,z,type] of plants){
  const key=Math.floor(x/450)+','+Math.floor(z/450);
  if(!buckets.has(key))buckets.set(key,[[],[]]);
  const sets=buckets.get(key);sets[0].push(x,y,z);if(type)sets[1].push(x,y,z);
 }
 for(const [chunk,sets] of buckets)for(const [i,values] of sets.entries())if(values.length){
  const node={name:i?'clareira_flores':'clareira_capim',mesh:geometry[i],extras:{chunk,decorative:true},extensions:{EXT_mesh_gpu_instancing:{attributes:{TRANSLATION:accessor(values,'VEC3',3)}}}};
  g.scenes[g.scene??0].nodes.push(g.nodes.push(node)-1);
 }
 g.extensionsUsed=[...new Set([...(g.extensionsUsed??[]),'EXT_mesh_gpu_instancing'])];
 g.extensionsRequired=[...new Set([...(g.extensionsRequired??[]),'EXT_mesh_gpu_instancing'])];
}