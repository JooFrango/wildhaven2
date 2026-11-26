import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('../../../', import.meta.url);
const read = path => readFileSync(new URL(path,root));
const v03 = 'assets/models/creatures/varrisco/v03/varrisco-animated-v03-LOD0.glb';
const v04 = 'assets/models/creatures/varrisco/v04/varrisco-animated-v04-LOD0.glb';
const manifest = JSON.parse(read('assets/models/creatures/varrisco/v04/manifest.json'));

function parse(buffer){
 assert.equal(buffer.toString('ascii',0,4),'glTF','GLB magic');
 assert.equal(buffer.readUInt32LE(4),2,'version');
 assert.equal(buffer.readUInt32LE(8),buffer.length,'file length');
 const length=buffer.readUInt32LE(12),type=buffer.toString('ascii',16,20);
 assert.equal(type,'JSON');
 const gltf=JSON.parse(buffer.subarray(20,20+length).toString('utf8'));
 const start=20+length;
 assert.equal(buffer.toString('ascii',start+4,start+7),'BIN');
 const byteLength=buffer.readUInt32LE(start);
 return {gltf,bin:buffer.subarray(start+8,start+8+byteLength)};
}
function values({gltf,bin},accessorIndex){
 const a=gltf.accessors[accessorIndex],view=gltf.bufferViews[a.bufferView];
 assert.equal(a.componentType,5126,'float32 accessors');
 const width={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[a.type];
 assert.ok(width,'type '+a.type);
 const start=(view.byteOffset||0)+(a.byteOffset||0);
 const stride=view.byteStride||width*4;
 const out=[];
 for(let i=0;i<a.count;i++){
  for(let j=0;j<width;j++){
   const p=start+i*stride+j*4;
   assert.ok(p>=0&&p+4<=bin.length,'accessor within BIN');
   const v=bin.readFloatLE(p);
   assert.ok(Number.isFinite(v),'accessor float finite');
   out.push(v);
  }
 }
 return {out, width, count:a.count};
}
test('41 clipes: 12 novos, 29 anteriores, sem alterar rig, skin ou BIN preexistente',()=>{
 const a=parse(read(v03)),b=parse(read(v04)),raw=read(v04);
 assert.equal(raw.length,manifest.glb.bytes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.glb.sha256);
 assert.equal(createHash('sha256').update(read(v03)).digest('hex'),manifest.source_v03_sha256);
 assert.equal(b.gltf.skins.length,1);
 assert.deepEqual(b.gltf.skins,a.gltf.skins);
 assert.deepEqual(b.gltf.meshes,a.gltf.meshes);
 assert.equal(b.gltf.skins[0].joints.length,22);
 assert.deepEqual(b.bin.subarray(0,a.bin.length),a.bin);
 assert.deepEqual(b.gltf.animations.slice(0,29),a.gltf.animations);
 const names=b.gltf.animations.map(x=>x.name);
 assert.equal(names.length,41);
 assert.equal(new Set(names).size,41);
 assert.equal(manifest.added.length,12);
 for(const x of manifest.added) assert.ok(names.includes(x.name),x.name);
 assert.equal(manifest.glb.triangles,2754);
});
test('12 novos clipes: todos movem ossos, sao finitos e keyframes ordenados',()=>{
 const parsed=parse(read(v04));
 const g=parsed.gltf;
 for(const {name,loop,contactFraction} of manifest.added){
  const anim=g.animations.find(a=>a.name===name);
  assert.ok(anim&&anim.channels.length>=5,name);
  assert.equal(anim.extras.loop,loop,name);
  assert.equal(anim.extras.physicalAuthority,'ecology_kernel');
  assert.equal(anim.extras.rootMotion,'in_place');
  assert.equal(anim.extras.contactFraction,contactFraction);
  const tracks=new Set();
  let moved=0;
  for(const ch of anim.channels){
   const s=anim.samplers[ch.sampler];
   assert.ok(s&&s.interpolation==='LINEAR');
   assert.ok(ch.target.node<g.nodes.length);
   assert.ok(['rotation','translation'].includes(ch.target.path));
   const track=ch.target.node+':'+ch.target.path;
   assert.ok(!tracks.has(track),name+' duplicate '+track);tracks.add(track);
  }
  for(const sampler of anim.samplers){
   const inp=values(parsed,sampler.input),out=values(parsed,sampler.output);
   assert.equal(inp.count,out.count,name);
   assert.ok(inp.count>=10,name);
   const ts=inp.out;
   assert.ok(ts[0]>=0);
   assert.ok(ts[ts.length-1]>0);
   for(let i=1;i<ts.length;i++)assert.ok(ts[i]>ts[i-1],name+' times monotonic');
   let distinct=false;
   for(let i=out.width;i<out.out.length;i++){
    if(Math.abs(out.out[i]-out.out[i%out.width])>1e-4){distinct=true;break}
   }
   if(distinct)moved++;
  }
  assert.ok(moved>=3,name+' lacks skeletal motion');
  for(const ch of anim.channels.filter(c=>c.target.path==='rotation')){
    const q=values(parsed,anim.samplers[ch.sampler].output).out;
    for(let i=0;i<q.length;i+=4){
      const sum=Math.hypot(q[i],q[i+1],q[i+2],q[i+3]);
      assert.ok(Math.abs(sum-1)<0.00005,name+' quaternion norm='+sum);
    }
  }
 }
});
test('ciclos de comportamento/segurar mantem juntas continuidade entre inicio e fim',()=>{
 const parsed=parse(read(v04)),g=parsed.gltf;
 for(const name of ['grab_hold','exhausted','guard_carcass','search_lost_prey']){
  const animation=g.animations.find(a=>a.name===name);
  assert.equal(animation.extras.loop,true);
  for(const ch of animation.channels){
   const data=values(parsed,animation.samplers[ch.sampler].output);
   for(let j=0;j<data.width;j++){
    const first=data.out[j],last=data.out[data.out.length-data.width+j];
    assert.ok(Math.abs(first-last)<1e-5,name+' loop seam '+g.nodes[ch.target.node].name);
   }
  }
 }
});
