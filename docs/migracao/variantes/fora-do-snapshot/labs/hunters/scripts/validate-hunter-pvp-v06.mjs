// Offline structural validator for the separate PvP v06 review GLB.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const path=new URL('../assets/hunter-pvp-v06/hunter_pvp_v06.glb',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('../assets/hunter-pvp-v06/manifest.json',import.meta.url),'utf8'));
const raw=await readFile(path);
if(raw.toString('ascii',0,4)!=='glTF'||raw.readUInt32LE(4)!==2)throw Error('GLB header/version invalid');
if(raw.readUInt32LE(8)!==raw.length)throw Error('GLB declared size differs from bytes');
const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.toString('utf8',20,20+jl));
const bo=20+jl; if(raw.readUInt32LE(16)!==0x4e4f534a||raw.readUInt32LE(bo+4)!==0x004e4942)throw Error('GLB chunk type invalid');
if(raw.readUInt32LE(bo)!==raw.length-bo-8)throw Error('BIN chunk length invalid');
const sha=createHash('sha256').update(raw).digest('hex');
if(sha!==manifest.sha256||raw.length!==manifest.bytes)throw Error('Manifest hash/bytes mismatch');
if(doc.skins?.[0]?.joints?.length!==19||doc.meshes?.[0]?.primitives?.[0]?.indices===undefined)throw Error('Mesh/rig contract missing');
const names=doc.animations.map(a=>a.name);if(new Set(names).size!==names.length)throw Error('Duplicate animation names');
for(const meta of manifest.newClips){
 const anim=doc.animations.find(a=>a.name===meta.name);if(!anim)throw Error('Missing '+meta.name);
 if(anim.channels.length!==20)throw Error(meta.name+' has '+anim.channels.length+' channels (expected 19 rotations + hips translation)');
 for(const channel of anim.channels){
  const s=anim.samplers[channel.sampler],ia=doc.accessors[s.input],oa=doc.accessors[s.output];
  if(!ia||!oa||ia.count!==oa.count||ia.count<2)throw Error('Invalid sampled channel '+meta.name);
  if(channel.target.path!=='rotation'&&channel.target.path!=='translation')throw Error('Unsupported channel '+meta.name);
 }
}
if(manifest.originalContractsUnchanged!==true||manifest.originalBinaryPrefixUnchanged!==true)throw Error('Original GLB contract changed');
console.log(JSON.stringify({ok:true,bytes:raw.length,sha256:sha,triangles:1000,joints:19,originalClips:manifest.originalClips,newClips:manifest.newClips.length,names:manifest.newClips.map(x=>x.name)},null,2));