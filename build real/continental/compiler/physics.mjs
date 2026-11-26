import {parseGlb, traverseMeshes, forEachTriangle, instanceCenters} from "./glb.mjs";

/**
 * Offline physics baking. Works with the original uncompressed GLB (not Three.js).
 * Never reuses a visual GLB as a runtime collider and never alters the source file.
 * Cells are globally aligned: adjacent hexes sample the SAME world grid.
 * Output is a DERIVED, uncertified physical asset until border/biome QA.
 */
export const MAGIC = "WHP1";
export const HEADER_BYTES = 36;
export const NODE_CLASSES = {
  terrain:"terrain", dry_streambed:"terrain", HV_01_Terreno:"terrain",
  river_water:"water",oasis_water:"water",sea_water:"water",water:"water",
  boulders:"rock",rock_escarpments:"rock",loose_rocks:"rock",sandstone_cliffs:"rock",
  sandstone_mesas:"rock",angular_escarpments:"rock",stratified_cliff_faces:"rock",
  erosion_spires:"rock",rock_arches:"rock",natural_stone_arch:"rock",
  "Formações costeiras":"rock",
  trunks:"trunk",palm_trunks:"trunk",biome_blend_trunks:"trunk",ecotone_broadleaf_trunks:"trunk",
  shrubs:"brush",low_scrub:"brush",cacti:"brush",
  broadleaf_canopy:"canopy",conifers:"canopy",palm_fronds:"canopy",
  biome_blend_conifers:"canopy",ecotone_broadleaf_canopy:"canopy",conifer_canopy:"canopy",
  hex_side_cut:"ignore"
};
export function decodePhysicsChunk(data) {
  const b=data instanceof Uint8Array?data:new Uint8Array(data),dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(b.byteLength<HEADER_BYTES||String.fromCharCode(...b.subarray(0,4))!==MAGIC)throw Error("Invalid WHP1 magic");
  const version=dv.getUint16(4,true),res=dv.getUint16(6,true),nx=dv.getUint16(8,true),nz=dv.getUint16(10,true);
  if(version!==1||res<1||nx<1||nz<1||b.byteLength!==HEADER_BYTES+nx*nz*10)throw Error("Invalid WHP1 dimensions/length");
  const x0=dv.getFloat64(12,true),z0=dv.getFloat64(20,true),baseY=dv.getFloat64(28,true),n=nx*nz;
  const heights=new Float32Array(n),water=new Float32Array(n),blocked=new Uint8Array(n),cover=new Uint8Array(n);
  let o=HEADER_BYTES;
  for(let i=0;i<n;i++,o+=4)heights[i]=dv.getFloat32(o,true);
  for(let i=0;i<n;i++,o+=4)water[i]=dv.getFloat32(o,true);
  blocked.set(b.subarray(o,o+n));o+=n;
  cover.set(b.subarray(o,o+n));
  return {version,res,nx,nz,x0,z0,baseY,heights,water,blocked,cover};
}
function encodePhysicsChunk({x0,z0,res,baseY,height,water,blocked,cover,nx,nz}){
  const n=nx*nz,b=new Uint8Array(HEADER_BYTES+n*10),dv=new DataView(b.buffer);
  for(let i=0;i<4;i++)b[i]=MAGIC.charCodeAt(i);
  dv.setUint16(4,1,true);dv.setUint16(6,res,true);dv.setUint16(8,nx,true);dv.setUint16(10,nz,true);
  dv.setFloat64(12,x0,true);dv.setFloat64(20,z0,true);dv.setFloat64(28,baseY,true);
  let o=HEADER_BYTES;for(let i=0;i<n;i++,o+=4)dv.setFloat32(o,height[i],true);
  for(let i=0;i<n;i++,o+=4)dv.setFloat32(o,water[i],true);
  b.set(blocked,o);o+=n;b.set(cover,o);
  return b;
}
function rasterTri(tri,x0,z0,nx,nz,res,out){
  const [a,b,c]=tri,[ax,ay,az]=a,[bx,by,bz]=b,[cx,cy,cz]=c;
  const minX=Math.min(ax,bx,cx),maxX=Math.max(ax,bx,cx),
    minZ=Math.min(az,bz,cz),maxZ=Math.max(az,bz,cz);
  if(maxX<x0||minX>x0+nx*res||maxZ<z0||minZ>z0+nz*res)return;
  const i0=Math.max(0,Math.floor((minX-x0)/res-0.5)),i1=Math.min(nx-1,Math.ceil((maxX-x0)/res-0.5)),
    j0=Math.max(0,Math.floor((minZ-z0)/res-0.5)),j1=Math.min(nz-1,Math.ceil((maxZ-z0)/res-0.5));
  const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
  if(Math.abs(den)<1e-12)return;
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const px=x0+(i+0.5)*res,pz=z0+(j+0.5)*res;
    const l1=((bz-cz)*(px-cx)+(cx-bx)*(pz-cz))/den,
      l2=((cz-az)*(px-cx)+(ax-cx)*(pz-cz))/den,l3=1-l1-l2;
    if(l1< -1e-6||l2< -1e-6||l3< -1e-6)continue;
    const y=l1*ay+l2*by+l3*cy,k=j*nx+i;
    if(!Number.isFinite(out[k])||y>out[k])out[k]=y;
  }
}
export function compileTile(bytes,{id,centerX,centerZ,res=2,chunkMeters=256,baseY=0,nodeClasses={},treeRules={}}={}) {
  if(typeof id!=="string"||!id||!Number.isFinite(centerX)||!Number.isFinite(centerZ))throw Error("tile ID and world center required");
  if(!Number.isInteger(res)||!Number.isInteger(chunkMeters)||res<=0||chunkMeters<=0||chunkMeters%res!==0
    ||chunkMeters/res>65535||!Number.isFinite(baseY))throw Error("Invalid global grid resolution/chunk settings");
  const g=parseGlb(bytes),bins=new Map(),unknown=[],trees=[],names=new Set(),counts={};
  const cats={...NODE_CLASSES,...nodeClasses};
  const valid=new Set(["terrain","water","rock","trunk","brush","canopy","ignore"]);
  const perChunk=chunkMeters/res;
  const key=(ix,iz)=>ix+":"+iz;
  const add=(tri,category)=>{
    const xs=tri.map(v=>v[0]),zs=tri.map(v=>v[2]);
    const xMin=Math.floor(Math.min(...xs)/chunkMeters),xMax=Math.floor(Math.max(...xs)/chunkMeters);
    const zMin=Math.floor(Math.min(...zs)/chunkMeters),zMax=Math.floor(Math.max(...zs)/chunkMeters);
    for(let ix=xMin;ix<=xMax;ix++)for(let iz=zMin;iz<=zMax;iz++){
      const k=key(ix,iz);if(!bins.has(k))bins.set(k,{ix,iz,tris:[]});
      bins.get(k).tris.push({tri,category});
    }
  };
  traverseMeshes(g,({node,nodeIndex,mesh,world,glb})=>{
    const name=node.name??"node#"+nodeIndex;
    names.add(name);
    // Explicit per-species tree mapping: only instanced nodes may be turned
    // into individually cuttable trees. Geometry without one-to-one IDs remains static.
    const treeRule=treeRules[name];
    const inst=instanceCenters(glb,node,world);
    if(treeRule){
      if(!inst)throw Error("Cuttable tree rule requires per-instance transforms: "+name);
      if(!(treeRule.radius>0&&Number.isFinite(treeRule.radius)))throw Error("Tree rule requires measured radius: "+name);
      for(let i=0;i<inst.length;i++){
        const e=inst[i],radius=treeRule.radius*Math.max(Math.abs(e.scale[0]),Math.abs(e.scale[2]));
        trees.push({id:id+":"+nodeIndex+":"+i,node:name,worldX:e.position[0]+centerX,worldY:e.position[1],
          worldZ:e.position[2]+centerZ,radius,cuttable:treeRule.cuttable===true,state:"standing"});
      }
      counts.dynamicTreeInstances=(counts.dynamicTreeInstances??0)+inst.length;
      return;
    }
    const cat=cats[name]??(name===id?"terrain":null);
    if(cat!==null&&!valid.has(cat))throw Error("Invalid node category "+cat+" for "+name);
    if(inst){
      // GPU instances are never silently omitted from PHYSICAL certification:
      // unresolved trees/rocks must be handled by a reviewed rule.
      unknown.push({name,nodeIndex,reason:"unclassified_gpu_instances",instances:inst.length});
      return;
    }
    if(!cat){
      unknown.push({name,nodeIndex,reason:"unclassified_mesh"});
      return;
    }
    if(cat==="ignore")return;
    counts[cat]=(counts[cat]??0)+1;
    forEachTriangle(glb,mesh,world,tri=>{
      const t=tri.map(v=>[v[0]+centerX,v[1],v[2]+centerZ]);
      add(t,cat);
    });
  });
  if(!(counts.terrain>0))throw Error("No terrain surface categorized for tile "+id);
  const out=[];
  for(const bin of [...bins.values()].sort((a,b)=>a.iz-b.iz||a.ix-b.ix)){
    const nx=perChunk,nz=perChunk,n=nx*nz,x0=bin.ix*chunkMeters,z0=bin.iz*chunkMeters;
    const categories=["terrain","water","rock","trunk","brush","canopy"];
    const surfaces=Object.fromEntries(categories.map(x=>[x,new Float32Array(n).fill(NaN)]));
    for(const entry of bin.tris)rasterTri(entry.tri,x0,z0,nx,nz,res,surfaces[entry.category]);
    const height=new Float32Array(n).fill(NaN),water=new Float32Array(n).fill(NaN),
      blocked=new Uint8Array(n),cover=new Uint8Array(n);
    let groundCells=0,waterCells=0,blockedCells=0;
    for(let k=0;k<n;k++){
      const h=surfaces.terrain[k],w=surfaces.water[k],rock=surfaces.rock[k];
      if(Number.isFinite(h)){
        height[k]=h-baseY;groundCells++;
        if(Number.isFinite(rock)&&rock>h+1.2){blocked[k]=1;blockedCells++;}
      }else{blocked[k]=1;blockedCells++;}
      if(Number.isFinite(w)&&(!Number.isFinite(h)||w>h+0.02)){water[k]=w-baseY;waterCells++;}
      if(Number.isFinite(surfaces.trunk[k])&&blocked[k]===0){blocked[k]=1;blockedCells++;}
      cover[k]=Number.isFinite(surfaces.brush[k])?65:Number.isFinite(surfaces.canopy[k])?15:0;
    }
    if(!groundCells&&!waterCells)continue;
    const data=encodePhysicsChunk({x0,z0,nx,nz,res,baseY,height,water,blocked,cover});
    out.push({name:"chunk_"+bin.ix+"_"+bin.iz+".whp",data,
      info:{ix:bin.ix,iz:bin.iz,x0,z0,res,nx,nz,groundCells,waterCells,blockedCells,bytes:data.byteLength}});
  }
  return {
    id,
    chunks:out,
    trees,
    report:{tileId:id,sourceMeshNames:[...names],categoryMeshes:counts,
      unknownNodes:unknown,physicalChunks:out.length,groundCells:out.reduce((s,c)=>s+c.info.groundCells,0),
      waterCells:out.reduce((s,c)=>s+c.info.waterCells,0),
      dynamicTreeCount:trees.length,
      // Explicitly NOT certified: portals, hydrology and biome coverage remain to be tested.
      status:"generated-unverified",warnings:unknown.length?["Unclassified geometry or instancing: review missing obstacles before gameplay"]:[]}
  };
}
