// Standalone glTF 2.0 GLB decoder (CPU/offline; never edits assets).
const CC = { 5120: [1, "getInt8"], 5121: [1, "getUint8"], 5122: [2, "getInt16"],
  5123: [2, "getUint16"], 5125: [4, "getUint32"], 5126: [4, "getFloat32"] };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const IDENT = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function multiplyMatrix(a,b) {
  const o = Array(16).fill(0);
  for (let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) o[c*4+r] += a[k*4+r]*b[c*4+k];
  return o;
}
export function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const [x,y,z,w] = node.rotation ?? [0,0,0,1], [sx,sy,sz] = node.scale ?? [1,1,1],
    [tx,ty,tz] = node.translation ?? [0,0,0];
  return [
    (1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,
    2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,
    2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,
    tx,ty,tz,1
  ];
}
export function transform(m,x,y,z) {
  return [m[0]*x+m[4]*y+m[8]*z+m[12],
    m[1]*x+m[5]*y+m[9]*z+m[13],
    m[2]*x+m[6]*y+m[10]*z+m[14]];
}
function decodeUtf8(bytes) {
  if(typeof TextDecoder !== "undefined") return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  // ASCII-only fallback is solely for runtimes without TextDecoder.
  let s=""; for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
  return s;
}
export function parseGlb(data) {
  const u=data instanceof Uint8Array?data:new Uint8Array(data);
  if(u.byteLength<20)throw Error("GLB too short");
  const dv=new DataView(u.buffer,u.byteOffset,u.byteLength);
  if(dv.getUint32(0,true)!==0x46546c67 || dv.getUint32(4,true)!==2)throw Error("Requires glTF 2.0 GLB");
  if(dv.getUint32(8,true)!==u.byteLength)throw Error("GLB file size mismatch");
  let offset=12,json=null,bin=null;
  while(offset<u.length){
    if(offset+8>u.length)throw Error("Truncated GLB chunk");
    const len=dv.getUint32(offset,true),typ=dv.getUint32(offset+4,true);offset+=8;
    if(offset+len>u.length)throw Error("GLB chunk exceeds file");
    const chunk=u.subarray(offset,offset+len);
    if(typ===0x4e4f534a){if(json)throw Error("Duplicate JSON");json=JSON.parse(decodeUtf8(chunk));}
    if(typ===0x004e4942){if(bin)throw Error("Duplicate binary chunk");bin=chunk;}
    offset+=len;
  }
  if(!json||!bin)throw Error("GLB needs JSON and BIN chunks");
  if(json.buffers?.length!==1||json.buffers[0].byteLength>bin.length)throw Error("External or truncated buffer unsupported");
  const forbidden=["KHR_draco_mesh_compression","EXT_meshopt_compression"];
  for(const ext of json.extensionsUsed??[])if(forbidden.includes(ext))throw Error("Compressed mesh input unsupported: "+ext+"; compile original uncompressed GLB");
  return {json,bin};
}
export function readAccessor(glb,id,index) {
  const a=glb.json.accessors?.[id];
  if(!a||a.sparse||a.bufferView===undefined)throw Error("Missing/sparse accessor "+id);
  const view=glb.json.bufferViews[a.bufferView],spec=CC[a.componentType],nc=COMPONENTS[a.type];
  if(!view||!spec||!nc)throw Error("Unsupported accessor "+id);
  if(index<0||index>=a.count)throw Error("Accessor index out of bounds "+id+":"+index);
  const [width,method]=spec,stride=view.byteStride??nc*width,offset=(view.byteOffset??0)+(a.byteOffset??0)+index*stride;
  if(stride<nc*width||offset<0||offset+nc*width>glb.bin.byteLength)throw Error("Invalid GLB bufferView bounds");
  const dv=new DataView(glb.bin.buffer,glb.bin.byteOffset,glb.bin.byteLength);
  const out=[];
  for(let c=0;c<nc;c++)out.push(dv[method](offset+c*width,true));
  if(a.normalized){
    const den={5120:127,5121:255,5122:32767,5123:65535}[a.componentType];
    if(!den)throw Error("Cannot normalize accessor component "+a.componentType);
    return out.map(x=>a.componentType===5120||a.componentType===5122?Math.max(-1,x/den):x/den);
  }
  return out;
}
export function traverseMeshes(glb,callback) {
  const g=glb.json,root=g.scenes?.[g.scene??0];
  if(!root)throw Error("No active scene");
  const path=new Set();
  function visit(index,parent){
    if(path.has(index))throw Error("Cyclic glTF node graph");
    const n=g.nodes?.[index];if(!n)throw Error("Invalid node "+index);
    path.add(index);
    const world=multiplyMatrix(parent,nodeMatrix(n));
    if(n.mesh!==undefined){
      const mesh=g.meshes?.[n.mesh];if(!mesh)throw Error("Invalid mesh "+n.mesh);
      callback({node:n,nodeIndex:index,mesh,world,glb});
    }
    for(const child of n.children??[])visit(child,world);
    path.delete(index);
  }
  for(const i of root.nodes??[])visit(i,IDENT);
}
export function forEachTriangle(glb,mesh,world,visit) {
  for(const p of mesh.primitives??[]){
    if((p.mode??4)!==4)throw Error("Only triangle primitive mode 4 is supported");
    if(p.extensions?.KHR_draco_mesh_compression)throw Error("Draco primitive unsupported");
    const idx=p.indices!==undefined?glb.json.accessors[p.indices]:null;
    const pos=p.attributes?.POSITION,accessor=glb.json.accessors?.[pos];
    if(!accessor||accessor.type!=="VEC3")throw Error("Missing POSITION VEC3");
    const count=idx?idx.count:accessor.count;
    if(count%3!==0)throw Error("Triangle indices not divisible by 3");
    for(let i=0;i<count;i+=3){
      const v=j=>{const vertex=idx?readAccessor(glb,p.indices,j)[0]:j;
        const [x,y,z]=readAccessor(glb,pos,vertex);return transform(world,x,y,z)};
      visit([v(i),v(i+1),v(i+2)]);
    }
  }
}
export function instanceCenters(glb,node,world) {
  const attrs=node.extensions?.EXT_mesh_gpu_instancing?.attributes;
  if(!attrs)return null;
  const ids=Object.values(attrs), counts=ids.map(i=>glb.json.accessors[i]?.count);
  if(counts.some(n=>!Number.isInteger(n))||new Set(counts).size!==1)throw Error("Broken GPU instancing attributes");
  const centers=[];
  for(let i=0;i<counts[0];i++){
    const p=attrs.TRANSLATION!==undefined?readAccessor(glb,attrs.TRANSLATION,i):[0,0,0];
    const rotation=attrs.ROTATION!==undefined?readAccessor(glb,attrs.ROTATION,i):[0,0,0,1];
    const scale=attrs.SCALE!==undefined?readAccessor(glb,attrs.SCALE,i):[1,1,1];
    const m=nodeMatrix({translation:p,rotation,scale});
    const w=multiplyMatrix(world,m);
    centers.push({position:transform(w,0,0,0),scale});
  }
  return centers;
}
