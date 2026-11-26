import test from "node:test";
import assert from "node:assert/strict";
import {Buffer} from "node:buffer";
import {tmpdir} from "node:os";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {spawnSync} from "node:child_process";
import {parseGlb} from "../compiler/glb.mjs";
import {compileTile,decodePhysicsChunk} from "../compiler/physics.mjs";
import {TreeObstacleOverlay} from "../src/dynamic-trees.mjs";
import {extractSidecarTrees} from "../compiler/vegetation.mjs";

// Small REAL GLB 2.0 binary produced in memory, not a fabricated JSON "GLB".
function makeFixture() {
  const views=[],accessors=[],parts=[];
  let size=0;
  const append=(bytes,target,componentType,accessorType,count)=>{
    const pad=(4-size%4)%4;
    if(pad){parts.push(Buffer.alloc(pad));size+=pad}
    const offset=size,b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    parts.push(b);size+=b.length;
    const viewIndex=views.push({buffer:0,byteOffset:offset,byteLength:b.length})-1;
    const accessorIndex=accessors.push({bufferView:viewIndex,componentType,count,type:accessorType})-1;
    return accessorIndex;
  };
  const quad=(x0,z0,x1,z1,y)=>{
    const positions=new Float32Array([x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1]);
    const indices=new Uint16Array([0,1,2,0,2,3]);
    const pos=append(positions,0,5126,"VEC3",4),idx=append(indices,0,5123,"SCALAR",6);
    return {primitives:[{attributes:{POSITION:pos},indices:idx}]};
  };
  const meshes=[
    quad(-4,-4,4,4,0),      // ground
    quad(-4,-4,-2,-2,1),    // water
    quad(0,0,2,2,3),        // immovable rock
    quad(-2,0,-1,1,2),      // permanent legacy trunk
    quad(0,0,1,1,1),        // one instanced, explicitly cuttable tree
  ];
  const translations=append(new Float32Array([2,0,2]),0,5126,"VEC3",1);
  const nodes=["terrain","water","boulders","trunks","Dossel_1"].map((name,mesh)=>({name,mesh}));
  nodes[4].extensions={EXT_mesh_gpu_instancing:{attributes:{TRANSLATION:translations}}};
  const raw=Buffer.concat(parts);
  const padded=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4)]);
  const json=Buffer.from(JSON.stringify({
    asset:{version:"2.0",generator:"wildhaven compiler fixture"},
    scene:0,scenes:[{nodes:[0,1,2,3,4]}],nodes,meshes,
    buffers:[{byteLength:raw.length}],bufferViews:views,accessors,
    extensionsUsed:["EXT_mesh_gpu_instancing"],extensionsRequired:["EXT_mesh_gpu_instancing"]
  }));
  const jp=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const out=Buffer.alloc(12+8+jp.length+8+padded.length);
  out.write("glTF",0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(jp.length,12);out.write("JSON",16);
  jp.copy(out,20);const bo=20+jp.length;
  out.writeUInt32LE(padded.length,bo);out.write("BIN\0",bo+4);padded.copy(out,bo+8);
  return out;
}
const opts={id:"SYNTHETIC",centerX:0,centerZ:0,res:1,chunkMeters:8,baseY:0,
  treeRules:{Dossel_1:{radius:1,cuttable:true}}};
const sha256=b=>createHash("sha256").update(b).digest("hex");
const blobSha=b=>createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
function sampleCell(c,x,z){
  const i=Math.floor((x-c.x0)/c.res),j=Math.floor((z-c.z0)/c.res);
  assert.ok(i>=0&&i<c.nx&&j>=0&&j<c.nz);
  return j*c.nx+i;
}
test("binary GLB geometry, water and permanent rocks become WHP1 chunks",()=>{
  const fixture=makeFixture(),g=parseGlb(fixture);
  assert.equal(g.json.nodes.length,5);
  const t=compileTile(fixture,opts);
  assert.ok(t.chunks.length>=4);
  assert.equal(t.trees.length,1);
  assert.equal(t.trees[0].id,"SYNTHETIC:4:0");
  assert.equal(t.report.unknownNodes.length,0);
  const c=decodePhysicsChunk(t.chunks.find(x=>x.info.ix===0&&x.info.iz===0).data);
  assert.equal(c.heights[sampleCell(c,2.5,2.5)],0);
  assert.equal(c.blocked[sampleCell(c,0.5,0.5)],1); // permanent rock
  assert.equal(c.blocked[sampleCell(c,2.5,2.5)],0); // individual tree NOT baked into static layer
  const w=decodePhysicsChunk(t.chunks.find(x=>x.info.ix===-1&&x.info.iz===-1).data);
  assert.equal(w.water[sampleCell(w,-3.5,-3.5)],1);
  assert.equal(w.blocked[sampleCell(w,-3.5,-3.5)],0);
  assert.ok(Number.isNaN(c.heights[sampleCell(c,6.5,6.5)])); // void is NOT a flat floor
  assert.equal(c.blocked[sampleCell(c,6.5,6.5)],1);
});
test("cut tree changes only dynamic overlay, preserves rock and persists save",()=>{
  const t=compileTile(makeFixture(),opts);
  const chunk=t.chunks.find(x=>x.info.ix===0&&x.info.iz===0).data;
  const parsed=decodePhysicsChunk(chunk),tree=t.trees[0];
  const d=new TreeObstacleOverlay(t.trees);
  assert.equal(d.blockedForChunk(chunk)[sampleCell(parsed,2.5,2.5)],1);
  d.update(tree.id,"removed");
  assert.equal(d.blockedForChunk(chunk)[sampleCell(parsed,2.5,2.5)],0);
  assert.equal(d.blockedForChunk(chunk)[sampleCell(parsed,0.5,0.5)],1);
  const save=d.save();
  const restored=new TreeObstacleOverlay(t.trees);
  restored.load(save);
  assert.equal(restored.status(tree.id),"removed");
  restored.update(tree.id,"fallen",{fallDirection:0,fallLength:3});
  assert.equal(restored.blockedForChunk(chunk)[sampleCell(parsed,4.5,2.5)],1);
});
test("unknown instanced geometry is reported; terrain is not silently certified",()=>{
  const t=compileTile(makeFixture(),{...opts,treeRules:{}});
  assert.equal(t.trees.length,0);
  assert.equal(t.report.unknownNodes[0].reason,"unclassified_gpu_instances");
  assert.equal(t.report.status,"generated-unverified");
});
test("WHP1 catches truncation, compressed GLB requires original uncompressed source",()=>{
  const t=compileTile(makeFixture(),opts);
  assert.throws(()=>decodePhysicsChunk(t.chunks[0].data.subarray(0,40)),/dimensions|length/);
  const bad=makeFixture();bad[0]=0;
  assert.throws(()=>parseGlb(bad),/glTF 2.0/);
});
test("CLI writes versioned gzip chunks, hashes, tree catalog without altering GLB",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"wh-phys-")),glb=join(dir,"sample.glb"),out=join(dir,"out");
  try{
    const b=makeFixture();await writeFile(glb,b);
    const data={tiles:[{id:"SYNTHETIC",x:0,z:0,source:{path:"sample.glb",bytes:b.length,
      gitBlobSha1:blobSha(b),sha256:sha256(b),repository:"carioca1111/wildhaven-new"}}]};
    const manifest=join(dir,"test-manifest.json"),rules=join(dir,"trees.json");
    await writeFile(manifest,JSON.stringify(data));
    await writeFile(rules,JSON.stringify({schema:"wildhaven.tree-rules.v1",
      byTile:{SYNTHETIC:{trees:{Dossel_1:{radius:1,cuttable:true}}}}}));
    const cmd=fileURLToPath(new URL("../compiler/cli.mjs",import.meta.url));
    const p=spawnSync(process.execPath,[cmd,"--tile","SYNTHETIC","--glb",glb,"--out",out,
      "--manifest",manifest,"--tree-rules",rules,"--res","1","--chunk","8","--baseY","0"],{encoding:"utf8"});
    assert.equal(p.status,0,p.stderr+"\n"+p.stdout);
    const tile=join(out,"SYNTHETIC-physics-v01");
    const index=JSON.parse(await readFile(join(tile,"index.json"),"utf8"));
    assert.equal(index.certified,false);
    assert.equal(index.report.unknownNodes.length,0);
    assert.ok(index.chunks.length>=4);
    const compressed=await readFile(join(tile,index.chunks[0].url));
    assert.equal(sha256(compressed),index.chunks[0].sha256);
    assert.equal(gunzipSync(compressed).length,index.chunks[0].uncompressedBytes);
    assert.equal((await readFile(glb)).equals(b),true);
    // Compiled exports are versioned — never overwrite existing approved result.
    const again=spawnSync(process.execPath,[cmd,"--tile","SYNTHETIC","--glb",glb,"--out",out,
      "--manifest",manifest,"--tree-rules",rules,"--res","1","--chunk","8","--baseY","0"],{encoding:"utf8"});
    assert.equal(again.status,1);
  }finally{await rm(dir,{recursive:true,force:true})}
});

test("vegetation sidecar yields stable instance IDs and demands approved collider radii",()=>{
  const b=makeFixture();
  const sidecar=extractSidecarTrees(b,{tileId:"SYNTHETIC",centerX:0,centerZ:0,
    treeRules:{Dossel_1:{radius:1,cuttable:true}}});
  assert.equal(sidecar.trees.length,1);
  assert.equal(sidecar.trees[0].id,"SYNTHETIC:vegetation:4:0");
  assert.equal(sidecar.missing.length,0);
  const omitted=extractSidecarTrees(b,{tileId:"SYNTHETIC",centerX:0,centerZ:0});
  assert.equal(omitted.missing.length,1);
  assert.equal(omitted.trees.length,0);
  assert.throws(()=>extractSidecarTrees(b,{tileId:"SYNTHETIC",centerX:0,centerZ:0,
    treeRules:{Dossel_1:{cuttable:true}}}),/radius/);
});

test("node-class patterns classify only explicitly matched names; unmatched stay reported",()=>{
  const glb=makeFixture();
  // Sem padrão: 'terrain' é reconhecido pelo NODE_CLASSES original.
  const base=compileTile(glb,{id:"T",centerX:0,centerZ:0,res:1,chunkMeters:8});
  assert.ok(base.report.categoryMeshes.terrain===1);
  // Padrão que reclassifica 'boulders' não pode sobrepor a tabela explícita (tabela vence).
  const pat=[{re:/^boul/u,cls:"water"}];
  const withPat=compileTile(glb,{id:"T",centerX:0,centerZ:0,res:1,chunkMeters:8,nodeClassPatterns:pat});
  assert.equal(withPat.report.categoryMeshes.rock,base.report.categoryMeshes.rock);
  // Instâncias GPU sem regra medida continuam reportadas, mesmo com padrões.
  const inst=compileTile(glb,{id:"T",centerX:0,centerZ:0,res:1,chunkMeters:8,nodeClassPatterns:[{re:/^Dossel/u,cls:"canopy"}]});
  assert.ok(inst.report.unknownNodes.some(n=>n.reason==="unclassified_gpu_instances"));
});

test("CLI --node-classes records version+SHA-256 of the classification in the report",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"wh-nc-"));
  try{
    const glb=makeFixture(),file=join(dir,"t.glb");await writeFile(file,glb);
    const blob=createHash("sha1").update("blob "+glb.length+"\0").update(glb).digest("hex");
    const manifest={tiles:[{id:"T",x:0,z:0,source:{bytes:glb.length,gitBlobSha1:blob}}]};
    await writeFile(join(dir,"m.json"),JSON.stringify(manifest));
    const nc={schema:"wildhaven.node-classes.v1",version:"t1",status:"teste",nodeClasses:{},nodeClassPatterns:[]};
    await writeFile(join(dir,"nc.json"),JSON.stringify(nc));
    const cli=fileURLToPath(new URL("../compiler/cli.mjs",import.meta.url));
    const r=spawnSync(process.execPath,[cli,"--tile","T","--glb",file,"--out",join(dir,"o"),"--manifest",join(dir,"m.json"),
      "--node-classes",join(dir,"nc.json"),"--res","1","--chunk","8"],{encoding:"utf8"});
    assert.equal(r.status,0,r.stderr);
    const idx=JSON.parse(await readFile(join(dir,"o","T-physics-v01","index.json"),"utf8"));
    assert.equal(idx.report.nodeClassification.version,"t1");
    assert.match(idx.report.nodeClassification.sha256,/^[0-9a-f]{64}$/);
    assert.equal(idx.certified,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
