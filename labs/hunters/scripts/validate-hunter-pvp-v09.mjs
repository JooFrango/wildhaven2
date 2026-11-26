/** Structural and contact-specific gate for the v09 (or --v10 finger rig, --v11 + reverse cut) Hunter PvP sword clips. */
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
// --pve1: GLB PvE v01 = v12 + clipes pve1_* do contrato hunter-pve-v01.
const PVE=process.argv.includes('--pve1');
const V12=process.argv.includes('--v12')||PVE,V11=process.argv.includes('--v11')||V12,V10=process.argv.includes('--v10')||V11,VER=V12?'v12':V11?'v11':V10?'v10':'v09',VN=VER.slice(1),JOINTS=V10?23:19;
const out=new URL(PVE?'../assets/hunter-pve-v01/':`../assets/hunter-pvp-${VER}/`,import.meta.url);
const man=JSON.parse(await readFile(new URL('manifest.json',out),'utf8'));
const raw=await readFile(new URL(man.file,out));
const source=await readFile(new URL('../assets/hunter-v05/hunter_combat_v05.glb',import.meta.url));
const parse=bytes=>{if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(8)!==bytes.length)throw Error('Bad GLB header');const jl=bytes.readUInt32LE(12);return{doc:JSON.parse(bytes.toString('utf8',20,20+jl)),binary:bytes.subarray(28+jl)}};
const a=parse(raw),b=parse(source),sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(raw)!==man.sha256||sha(source)!==man.sourceSha256)throw Error('Hash mismatch');
if(a.doc.skins.length!==1||a.doc.skins[0].joints.length!==JOINTS)throw Error('Hunter skin changed');
// v12: biblioteca nova de três clipes, nesta ordem (guarda primeiro: é a pose de onde os outros partem).
const PASSOS12=['pvp12_step_forward','pvp12_step_back','pvp12_step_left','pvp12_step_right'];
const ATAQUES12=['pvp12_sword_horizontal_cut','pvp12_sword_horizontal_reverse_cut','pvp12_sword_diagonal_down','pvp12_sword_thrust'];
const PASSOS_P=['forward','back','left','right'].map(d=>'pve1_b_sword_step_'+d),ATAQUES_P=['pve1_c_sword_light','pve1_c_sword_heavy'];
const PVE_NEW=['pve1_b_sword_guard',...PASSOS_P,'pve1_a_sword_run','pve1_b_sword_block','pve1_b_sword_dodge_left','pve1_b_sword_dodge_right',...ATAQUES_P,'pve1_b_sword_recover'];
const NEW=V12?['pvp12_guard','pvp12_sword_horizontal_cut','pvp12_sword_block',...PASSOS12,'pvp12_sword_horizontal_reverse_cut','pvp12_sword_diagonal_down','pvp12_sword_thrust',...(PVE?PVE_NEW:[])]
 :[`pvp${VN}_sword_horizontal_cut`,...(V11?[`pvp${VN}_sword_horizontal_reverse_cut`]:[])];
if(JSON.stringify(a.doc.animations.slice(b.doc.animations.length).map(c=>c.name))!==JSON.stringify(NEW))throw Error('Expected new clips '+NEW);
for(let i=0;i<b.doc.animations.length;i++)if(JSON.stringify(a.doc.animations[i])!==JSON.stringify(b.doc.animations[i]))throw Error('Original animation altered');
for(const field of V10?['images','textures']:['skins','images','textures'])if(JSON.stringify(a.doc[field])!==JSON.stringify(b.doc[field]))throw Error('Original '+field+' modified');
// v10 swaps only JOINTS_0/WEIGHTS_0 (finger re-weight); positions, normals, UVs and indices stay the v05 accessors.
for(let i=0;i<b.doc.meshes.length;i++){const m=structuredClone(a.doc.meshes[i]);if(V10&&i===0)for(const k of ['JOINTS_0','WEIGHTS_0'])m.primitives[0].attributes[k]=b.doc.meshes[0].primitives[0].attributes[k];if(JSON.stringify(m)!==JSON.stringify(b.doc.meshes[i]))throw Error('Character mesh overwritten');}
if(V10){const o=b.doc.skins[0].joints;if(JSON.stringify(a.doc.skins[0].joints.slice(0,o.length))!==JSON.stringify(o))throw Error('Original joint order changed');
 for(const n of ['RightFingers1','RightFingers2','LeftFingers1','LeftFingers2'])if(!a.doc.skins[0].joints.some(j=>a.doc.nodes[j].name===n))throw Error('Missing finger bone '+n);
 if(!(man.qa.oldClipSkinDeltaM<1e-5))throw Error('Finger rig changes old clips');}
for(let i=0;i<b.doc.materials.length;i++)if(JSON.stringify(a.doc.materials[i])!==JSON.stringify(b.doc.materials[i]))throw Error('Character material overwritten');
if(!a.binary.subarray(0,b.binary.length).equals(b.binary))throw Error('Original BIN prefix changed');
const hand=a.doc.nodes.findIndex(n=>n.name==='RightHand'),sock=a.doc.nodes.findIndex(n=>n.name===`WeaponSocket_Right_PvP${VN}`);
const sword=a.doc.nodes.findIndex(n=>n.name===`PvP${VN}_OneHanded_Sword`);
if(hand<0||sock<0||sword<0)throw Error('Missing attached sword chain');
if(!a.doc.nodes[hand].children?.includes(sock)||!a.doc.nodes[sock].children?.includes(sword))throw Error('Sword is NOT parented to RightHand');
if(typeof a.doc.nodes[sword].mesh!=='number')throw Error('Sword must be real GLB mesh, not viewer proxy');
// Cada clipe novo anima todo o esqueleto e declara o instante de contato que o laboratório usa para sincronizar.
// Ataques: o contato é CALCULADO pelo gerador (alcance máximo da lâmina); aqui só se exige que exista,
// caia dentro do clipe e bata com o manifesto.
const CONTACT=V12?{pvp12_guard:null,pvp12_sword_block:.30,...Object.fromEntries(ATAQUES12.map(n=>[n,'calculado'])),
 ...Object.fromEntries(PASSOS12.map(n=>[n,null])),
 ...(PVE?{pve1_b_sword_guard:null,pve1_a_sword_run:null,pve1_b_sword_block:.30,pve1_b_sword_dodge_left:null,pve1_b_sword_dodge_right:null,pve1_b_sword_recover:null,
  ...Object.fromEntries(PASSOS_P.map(n=>[n,null])),...Object.fromEntries(ATAQUES_P.map(n=>[n,'calculado']))}:{})}:null;
for(const clip of a.doc.animations.slice(b.doc.animations.length)){
 if(clip.channels.length<JOINTS)throw Error('Incomplete animation channels: '+clip.name);
 const want=CONTACT?CONTACT[clip.name]:0.84,dec=(man.newClips??[]).find(c=>c.name===clip.name);
 if(want==='calculado'){const c=clip.extras?.contact;if(!(c>0&&c<dec.duration&&c===dec.contact))throw Error('Contato calculado ausente ou fora do clipe em '+clip.name+': '+c);}
 else if((clip.extras?.contact??null)!==want)throw Error('Wrong contact event in '+clip.name+': '+clip.extras?.contact);
 if(PVE&&PVE_NEW.includes(clip.name))contratoPve(clip,man.newClips.find(c=>c.name===clip.name));
 if(V12&&[...PASSOS12,...PASSOS_P].includes(clip.name)){const e=clip.extras??{};
  if(!Array.isArray(e.vector)||e.vector.length!==2)throw Error('Passo sem vetor de direção: '+clip.name);
  if(!(e.stride>0))throw Error('Passo sem passada (stride): '+clip.name);
  if(!(e.stance>0&&e.stance<1))throw Error('Passo sem fração de apoio: '+clip.name);}}
for(const [k,v] of Object.entries(man.qaLimits))if(man.qa[k]>v)throw Error('QA '+k+' '+man.qa[k]);
if(man.qa.maxElbowDeg<140)throw Error('Arm never extends');
// Só os ataques precisam estender o braço: guarda e bloqueio mantêm o cotovelo fechado de propósito.
const EXTENDS=V12?new Set([...ATAQUES12,...ATAQUES_P]):new Set(Object.keys(man.perClipQa??{}));
for(const [n,q] of Object.entries(man.perClipQa??{})){
 if(EXTENDS.has(n)&&q.maxElbowDeg<140)throw Error('Arm never extends in '+n);
 if(!EXTENDS.has(n)&&q.maxElbowDeg>150)throw Error('Guarda/bloqueio com braço esticado em '+n+': '+q.maxElbowDeg);}
// Every rotation must be a unit quaternion and every channel must cover the full clip.
const bin=a.binary,read=(i)=>{const ac=a.doc.accessors[i],bv=a.doc.bufferViews[ac.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[ac.type];return new Float32Array(bin.buffer.slice(bin.byteOffset+bv.byteOffset,bin.byteOffset+bv.byteOffset+ac.count*n*4));};
const DUR=Object.fromEntries((man.newClips??[]).map(c=>[c.name,c.duration]));
for(const clip of a.doc.animations.slice(b.doc.animations.length))for(const c of clip.channels){const smp=clip.samplers[c.sampler],t=read(smp.input),v=read(smp.output);if(Math.abs(t.at(-1)-(DUR[clip.name]??1.9))>1e-4)throw Error('Channel does not span clip: '+clip.name);if(c.target.path==='rotation')for(let i=0;i<v.length;i+=4){const l=Math.hypot(v[i],v[i+1],v[i+2],v[i+3]);if(Math.abs(l-1)>1e-3)throw Error('Non-unit quaternion');}}
let seamMaxDeg=null,pveSeamMaxDeg=null,pveSeamPior=null;
if(V12){
 // A costura da biblioteca: no quadro 0 os três clipes têm de estar na mesma pose de guarda, osso por osso.
 const poseAt0=name=>{const clip=a.doc.animations.find(x=>x.name===name),out={};
  for(const c of clip.channels){if(c.target.path!=='rotation')continue;const v=read(clip.samplers[c.sampler].output);out[c.target.node]=[v[0],v[1],v[2],v[3]];}return out;};
 const base=poseAt0('pvp12_guard');seamMaxDeg=0;
 const perna=/UpLeg$|Leg$|Foot$/;
 for(const name of [...ATAQUES12,'pvp12_sword_block',...PASSOS12]){const p=poseAt0(name);
  const soTronco=PASSOS12.includes(name);
  for(const [node,q] of Object.entries(base)){const r=p[node];if(!r)throw Error('Osso sem canal em '+name);
   if(soTronco&&perna.test(a.doc.nodes[node].name??''))continue;
   const dot=Math.min(1,Math.abs(q[0]*r[0]+q[1]*r[1]+q[2]*r[2]+q[3]*r[3]));
   seamMaxDeg=Math.max(seamMaxDeg,2*Math.acos(dot)*180/Math.PI);}}
 if(seamMaxDeg>0.5)throw Error('Clipes nao partem da mesma guarda: '+seamMaxDeg.toFixed(2)+' graus');
 if(PVE){
  // PvE: todo clipe B/C começa E termina na guarda PvE (contrato, seção 9). Corrida e recuperação são laços de pose própria.
  const poseAt=(name,last)=>{const clip=a.doc.animations.find(x=>x.name===name),o={};for(const c of clip.channels){if(c.target.path!=='rotation')continue;const v=read(clip.samplers[c.sampler].output),i=last?v.length-4:0;o[c.target.node]=[v[i],v[i+1],v[i+2],v[i+3]];}return o;};
  const g=poseAt('pve1_b_sword_guard',false),perna=/UpLeg$|Leg$|Foot$/;pveSeamMaxDeg=0;
  for(const name of PVE_NEW.filter(n=>!['pve1_b_sword_guard','pve1_a_sword_run','pve1_b_sword_recover'].includes(n)))for(const last of [false,true]){const p=poseAt(name,last);
   for(const [node,q] of Object.entries(g)){const r=p[node];if(PASSOS_P.includes(name)&&perna.test(a.doc.nodes[node].name??''))continue;
    const dot=Math.min(1,Math.abs(q[0]*r[0]+q[1]*r[1]+q[2]*r[2]+q[3]*r[3]));{const g_=2*Math.acos(dot)*180/Math.PI;if(g_>pveSeamMaxDeg)pveSeamPior=name+(last?" (fim) ":" (inicio) ")+(a.doc.nodes[node].name??node);pveSeamMaxDeg=Math.max(pveSeamMaxDeg,g_);}}}
  if(pveSeamMaxDeg>0.5)throw Error('Clipes PvE nao partem/voltam da guarda PvE: '+pveSeamMaxDeg.toFixed(2)+' graus em '+pveSeamPior);}}
console.log(JSON.stringify({verified:true,...(V12?{seamMaxDeg}:{}),...(PVE?{pveSeamMaxDeg,contract:'hunter-pve-v01'}:{}),size:raw.length,sha256:sha(raw),characterTriangles:1000,joints:JOINTS,originalClips:b.doc.animations.length,newClips:NEW,integratedWeaponMesh:a.doc.nodes[sword].mesh,handSocketParent:hand,frames:man.newClips[0].frames,qa:man.qa},null,2));
// Contrato hunter-pve-v01, seção 5: campos obrigatórios por clipe, fases crescentes, janelas dentro do clipe.
function contratoPve(clip,dec){const e=clip.extras??{},T=dec.duration,erro=m=>{throw Error(clip.name+': '+m)};
 if(e.contract!=='hunter-pve-v01')erro('sem contract');if(!['a','b','c','d','e','f'].includes(e.module))erro('modulo '+e.module);
 if(e.weapon!=='sword')erro('arma '+e.weapon);if(e.fps!==60||Math.abs(e.duration-T)>1e-6)erro('fps/duracao');
 if(!Array.isArray(e.interrupts)||!e.interrupts.length)erro('sem janelas de interrupcao');
 for(const j of e.interrupts)if(!(j.from>=0&&j.to<=T+1e-9&&j.from<j.to&&j.into?.length))erro('janela invalida '+JSON.stringify(j));
 for(const lado of ['left','right'])if(!Array.isArray(e.footContacts?.[lado]))erro('sem footContacts '+lado);
 if(!e.rootMotion||!['none','curve'].includes(e.rootMotion.mode))erro('rootMotion');
 if(e.rootMotion.mode==='curve'&&e.rootMotion.curve?.length!==Math.round(T*60)+1)erro('curva de deslocamento incompleta');
 if(e.kind==='attack'){const p=dec.phases,ordem=['guard','anticipation','activeStart','contact','activeEnd','recovery','guardReturn'];
  for(let i=0;i<ordem.length;i++){if(typeof p[ordem[i]]!=='number')erro('fase ausente '+ordem[i]);if(i&&!(p[ordem[i]]>=p[ordem[i-1]]))erro('fases fora de ordem em '+ordem[i]);}
  if(Math.abs(p.contact-e.contact)>1e-9)erro('contato do manifesto difere do GLB');}}
