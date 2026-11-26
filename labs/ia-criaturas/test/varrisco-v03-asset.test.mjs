import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
function parse(data){
  assert.equal(data.toString('ascii',0,4),'glTF');
  assert.equal(data.readUInt32LE(4),2);
  assert.equal(data.readUInt32LE(8),data.length);
  const n=data.readUInt32LE(12),metadata=JSON.parse(data.subarray(20,20+n).toString('utf8'));
  const off=20+n;
  assert.equal(data.toString('ascii',off+4,off+7),'BIN');
  return {g:metadata,bin:data.subarray(off+8,off+8+data.readUInt32LE(off))};
}
const v02='assets/models/creatures/varrisco/v02/varrisco-animated-v02-LOD0.glb';
const v03='assets/models/creatures/varrisco/v03/varrisco-animated-v03-LOD0.glb';
const manifest=JSON.parse(read('assets/models/creatures/varrisco/v03/manifest.json'));
test('GLB v03: binario real, SHA-256, rig e malha v02 intacta',()=>{
  const raw02=read(v02),raw03=read(v03),a=parse(raw02),b=parse(raw03);
  assert.equal(createHash('sha256').update(raw03).digest('hex'),manifest.glb.sha256);
  assert.equal(raw03.length,manifest.glb.bytes);
  assert.equal(b.g.skins.length,1);
  assert.equal(b.g.skins[0].joints.length,22);
  assert.deepEqual(b.bin.subarray(0,a.bin.length),a.bin);
  assert.equal(b.g.animations.length,29);
  const names=b.g.animations.map(a=>a.name);
  assert.equal(new Set(names).size,29);
  for(const n of [...manifest.added,...manifest.refined])assert.ok(names.includes(n),n);
});
test('Canais com juntas validas, keyframes finitos e interpolacao coerente',()=>{
 const {g,bin}=parse(read(v03));
 for(const animation of g.animations){
   assert.ok(animation.samplers.length>0&&animation.channels.length>0,animation.name);
   const seen=new Set();
   for(const c of animation.channels){
     assert.ok(c.target.node<g.nodes.length);
     assert.ok(c.sampler<animation.samplers.length);
     const k=c.target.node+':'+c.target.path;
     assert.ok(!seen.has(k),animation.name+' '+k);
     seen.add(k);
   }
   for(const s of animation.samplers){
     const t=g.accessors[s.input],v=g.accessors[s.output];
     assert.ok(t.count>1&&t.count===v.count,animation.name);
     for(const acc of [t,v]){
       const view=g.bufferViews[acc.bufferView];
       const n=acc.type==='VEC4'?4:acc.type==='VEC3'?3:acc.type==='MAT4'?16:1;
       const offset=(view.byteOffset??0)+(acc.byteOffset??0);
       assert.ok(offset+acc.count*n*4<=bin.length,animation.name);
       if(acc.componentType===5126)
         for(let i=0;i<acc.count*n;i++)assert.ok(Number.isFinite(bin.readFloatLE(offset+i*4)),animation.name);
     }
   }
 }
});
