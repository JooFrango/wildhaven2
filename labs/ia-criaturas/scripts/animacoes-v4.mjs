// Wildhaven - autor procedural de clipes complementares para rigs GLB reais.
// Gerador deterministico: nao toca nas malhas, texturas, skins nem clipes originais.
const TAU = Math.PI * 2;
const SPEC = {
  bipede:["combat_idle","strafe_left","strafe_right","backstep","bite_front","bite_left","bite_right","claw_combo","dodge_left","dodge_right","hit_front","hit_left","hit_right","stagger","knockdown","get_up","grab_hold","shake_prey","grab_release","limp_walk","injured_idle","social_greet"],
  quadrupede:["defensive_idle","dodge_left","dodge_right","backstep","tail_defense","hit_front","hit_left","hit_right","stagger","limp_walk","injured_idle","social_sniff","social_greet"],
  ave:["defensive_idle","sidestep_left","sidestep_right","dodge_hop","wing_guard","peck_defense","hit_front","stagger","limp_walk","injured_idle","social_greet","wing_display"],
  aracnideo:["defensive_idle","strafe_left","strafe_right","backstep","chelicera_strike","pedipalp_guard","hit_front","stagger","limp_walk","injured_idle","vibration_sense","social_distance"]
};
const DURATION = {combat_idle:2.4,defensive_idle:2.4,injured_idle:2.8,limp_walk:1.4,grab_hold:1.6,shake_prey:1.1,knockdown:1.3,get_up:1.2,stagger:1.1,claw_combo:1.2,social_greet:1.7,social_sniff:1.8,vibration_sense:1.6,wing_display:1.8};
function inferirRig(j) {
 const names=j.nodes.map(x=>(x.name||"").toLowerCase()), has=s=>names.some(x=>x.includes(s));
 if (has("chelicera")&&has("leg_l")) return "aracnideo";
 if ((has("wing_left")&&has("wing_right"))||(has("wing_l")&&has("wing_r"))||(has("wing_l_upper")&&has("wing_r_upper"))) return "ave";
 if (has("thighl")&&has("thighr")) return "bipede";
 if ((has("leg0_hip")&&has("leg3_hip"))||(has("fore_l_upper")&&has("hind_r_upper"))||(has("foreupper_l")&&has("hindupper_r"))||(has("frontupper_l")&&has("hindupper_r"))||(has("front_l_upper")&&has("back_r_upper"))) return "quadrupede";
 return null;
}
function decodeUtf8(a){let s="";for(let i=0;i<a.length;i++){let x=a[i];if(x<128)s+=String.fromCharCode(x);else if(x<224){s+=String.fromCharCode((x&31)<<6|(a[++i]&63));}else if(x<240){s+=String.fromCharCode((x&15)<<12|(a[++i]&63)<<6|(a[++i]&63));}else{let n=(x&7)<<18|(a[++i]&63)<<12|(a[++i]&63)<<6|(a[++i]&63);n-=65536;s+=String.fromCharCode(0xd800+(n>>>10),0xdc00+(n&1023));}}return s}
function encodeUtf8(s){const a=[];for(let i=0;i<s.length;i++){let n=s.codePointAt(i);if(n>65535)i++;if(n<128)a.push(n);else if(n<2048)a.push(192|(n>>6),128|(n&63));else if(n<65536)a.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else a.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}return Uint8Array.from(a)}
function u32(a,i){return(a[i]|a[i+1]<<8|a[i+2]<<16|a[i+3]<<24)>>>0}
function w32(a,i,n){a[i]=n&255;a[i+1]=n>>>8&255;a[i+2]=n>>>16&255;a[i+3]=n>>>24&255}
function align4(n){return(n+3)&~3}
function mulQ(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]}
function eulerQ(x=0,y=0,z=0){const qx=[Math.sin(x/2),0,0,Math.cos(x/2)],qy=[0,Math.sin(y/2),0,Math.cos(y/2)],qz=[0,0,Math.sin(z/2),Math.cos(z/2)];return mulQ(mulQ(qx,qy),qz)}
const gauss=(u,c,w)=>Math.exp(-Math.pow((u-c)/w,2));
function pose(rig,id,u){
 const p={};const set=(n,x=0,y=0,z=0)=>p[n]=[x,y,z];const a=Math.sin(TAU*u),b=Math.sin(2*TAU*u),e=Math.sin(Math.PI*u)**2,s=id.includes("left")?1:-1;
 const lateral=id.endsWith("left")?1:-1;
 if(rig==="bipede"){
  if(id==="combat_idle"||id==="injured_idle"){set("pelvis",0,0,-0.065+(id==="injured_idle"?-0.08:0)+0.015*a);set("thorax",0,0,0.04+0.025*a);set("neck",0,0,0.03+0.035*a);set("head",0,0,-0.025+0.025*a);set("tailA",0,0,0.06*b);set("shoulderL",0,0,0.08+0.018*a);set("shoulderR",0,0,-0.06+0.018*a)}
  else if(id.startsWith("strafe")||id==="backstep"||id==="limp_walk"){let v=id==="backstep"?-0.25:0.30;set("pelvis",0,id==="backstep"?0:0.08*lateral,0.04*a);set("thighL",0,0,v*a);set("thighR",0,0,-v*a);set("shinL",0,0,0.22*Math.max(0,-a));set("shinR",0,0,0.22*Math.max(0,a));set("thorax",0,0,id==="limp_walk"?-0.1:0);set("tailA",0,-0.08*a,0.08*a)}
  else if(id.startsWith("bite")){let y=id==="bite_left"?0.33:id==="bite_right"?-0.33:0;let hit=gauss(u,.52,.13),open=gauss(u,.32,.18)+0.55*gauss(u,.66,.18);set("neck",0,y*e,-0.15*e-0.23*hit);set("head",0,y*e*0.45,-0.09*e-0.28*hit);set("jaw",0,0,-0.48*Math.min(1,open));set("thorax",0,0,-0.10*hit)}
  else if(id==="claw_combo"){let l=gauss(u,.31,.11),r=gauss(u,.73,.12);set("shoulderL",0,0,-0.95*l);set("forearmL",0,0,-0.42*l);set("shoulderR",0,0,-0.95*r);set("forearmR",0,0,-0.42*r);set("thorax",0,0,0.16*(l-r));set("tailA",0,0,-0.1*(l-r))}
  else if(id.startsWith("dodge")){set("pelvis",0,0.16*s*e,-0.2*e);set("thorax",0,0.18*s*e,0.08*e);set("thighL",0,0,0.42*e);set("thighR",0,0,-0.3*e);set("tailA",0,-0.2*s*e,0.06*e)}
  else if(id.startsWith("hit")||id==="stagger"){let y=id==="hit_left"?.25:id==="hit_right"?-.25:0;let h=gauss(u,.23,.12);set("pelvis",0,y*h,-0.14*h);set("thorax",0,y*1.5*h,0.32*h);set("neck",0,0,0.20*h);set("head",0,0,0.22*h);set("tailA",0,0,-0.25*h);set("thighL",0,0,0.15*h);set("thighR",0,0,-0.12*h)}
  else if(id==="knockdown"||id==="get_up"){let k=id==="knockdown"?Math.min(1,u*2):1-Math.max(0,Math.min(1,(u-.1)*1.7));set("pelvis",0,0,0.55*k);set("thorax",0,0,0.35*k);set("neck",0,0,-0.2*k);set("thighL",0,0,-0.45*k);set("thighR",0,0,0.35*k)}
  else if(id==="grab_hold"||id==="shake_prey"||id==="grab_release"){let q=id==="shake_prey"?0.29*a:0;set("neck",0,q,-0.18);set("head",0,q*0.8,-0.14);set("jaw",0,0,id==="grab_release"?-0.55*e:-0.07);set("thorax",0,-q*0.25,-0.05)}
  else if(id==="social_greet"){set("neck",0,0,-0.14*e);set("head",0,0,-0.17*e);set("tailA",0,0,0.12*a);set("jaw",0,0,-0.08*e)}
 }else if(rig==="quadrupede"){
  if(id==="defensive_idle"||id==="injured_idle"){set("body",0,0,0.04*a);set("head",0,0,0.04*a);set("tail0",0,0,0.08*a);set("neck",0,0,id==="injured_idle"?-0.12:0)}
  else if(id.startsWith("dodge")||id==="backstep"||id==="limp_walk"){let sign=id.endsWith("left")?1:-1;set("body",0,0.15*e*sign,0.06*a);for(let j=0;j<4;j++){set("leg"+j+"_hip",0,0,(j%2===0?1:-1)*0.25*a);set("leg"+j+"_knee",0,0,0.14*Math.max(0,(j%2===0?1:-1)*a));}set("tail0",0,-0.1*sign*e,0)}
  else if(id==="tail_defense"){set("body",0,0.20*e,0);set("tail0",0,0.6*e,0);set("tail1",0,0.4*a,0);set("head",0,-0.16*e,0)}
  else if(id.startsWith("hit")||id==="stagger"){let sign=id==="hit_left"?1:id==="hit_right"?-1:0;let k=gauss(u,.28,.16);set("body",0,sign*0.25*k,0.21*k);set("neck",0,0,0.1*k);set("head",0,0,0.24*k)}
  else if(id==="social_sniff"||id==="social_greet"){set("neck",0,0,-0.15*e);set("head",0,0,0.10*b);set("tail0",0,0,0.14*a)}
 }else if(rig==="ave"){
  if(id==="defensive_idle"||id==="injured_idle"){set("body",0,0,0.04*a);set("wing_left",0,0,0.06*a);set("wing_right",0,0,-0.06*a);set("head",0,0,0.04*b)}
  else if(id.includes("left")||id.includes("right")||id==="dodge_hop"||id==="limp_walk"){let z=id.includes("left")?1:-1;set("body",0,0,0.1*z*e);set("wing_left",0,0,0.35*e);set("wing_right",0,0,-0.35*e);set("leg0_hip",0,0,0.3*a);set("leg1_hip",0,0,-0.3*a)}
  else if(id==="wing_guard"||id==="wing_display"){set("wing_left",0,0,0.7*e);set("wing_right",0,0,-0.7*e);set("head",0,0,0.18*e)}
  else if(id==="peck_defense"||id==="social_greet"){set("neck",0,0,-0.32*gauss(u,.56,.16));set("head",0,0,-0.22*gauss(u,.56,.16));set("wing_left",0,0,0.09*e);set("wing_right",0,0,-0.09*e)}
  else if(id.startsWith("hit")||id==="stagger"){let k=gauss(u,.3,.18);set("body",0,0,0.22*k);set("head",0,0,0.2*k);set("wing_left",0,0,0.38*k);set("wing_right",0,0,-0.38*k)}
 }else if(rig==="aracnideo"){
  if(id==="defensive_idle"||id==="injured_idle"||id==="vibration_sense"||id==="social_distance"){set("Cephalothorax",0,0,0.05*a);set("Abdomen",0,0,-0.055*a);set("Pedipalp_L",0,0,0.18*a);set("Pedipalp_R",0,0,-0.18*a)}
  else if(id==="chelicera_strike"){const k=gauss(u,.47,.12);set("Chelicera_L",0,0,0.9*k);set("Chelicera_R",0,0,-0.9*k);set("Cephalothorax",0,0,-0.12*k)}
  else if(id==="pedipalp_guard"){set("Pedipalp_L",0,0,0.65*e);set("Pedipalp_R",0,0,-0.65*e);set("Cephalothorax",0,0,0.13*e)}
  else if(id.startsWith("strafe")||id==="backstep"||id==="limp_walk"){for(let side of ["L","R"])for(let k=1;k<=4;k++)set("Leg_"+side+k+"_Hip",0,0,((k%2?1:-1)*(side==="L"?1:-1))*0.24*a);set("Cephalothorax",0,0,0.04*a)}
  else if(id==="hit_front"||id==="stagger"){let k=gauss(u,.3,.18);set("Cephalothorax",0,0,0.24*k);set("Abdomen",0,0,-0.3*k);set("Pedipalp_L",0,0,0.2*k);set("Pedipalp_R",0,0,-0.2*k)}
 }
 return p;
}
function produzirAnimacoesV4(bytes){
 const source=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(u32(source,0)!==0x46546c67||u32(source,4)!==2)throw Error("GLB 2.0 invalido");
 let len=u32(source,12);if(u32(source,16)!==0x4e4f534a)throw Error("GLB sem JSON");
 let gltf=JSON.parse(decodeUtf8(source.subarray(20,20+len)));
 let binHdr=20+len;
 if(u32(source,binHdr+4)!==0x004e4942)throw Error("GLB sem BIN");
 const binLen=u32(source,binHdr),baseBin=source.subarray(binHdr+8,binHdr+8+binLen);
 if(!gltf.buffers||gltf.buffers.length!==1)throw Error("GLB multi buffer nao suportado");
 const rig=inferirRig(gltf);
 if(!rig)return {skip:"rig desconhecido",nodes:gltf.nodes.map(n=>n.name)};
 const map=new Map(gltf.nodes.map((n,i)=>[(n.name||"").toLowerCase(),i]));
 const aliases={
  body:["thorax","spine","chest"],neck:["neck"],head:["head"],jaw:["jaw"],
  wing_left:["wing_l","wing_l_upper"],wing_right:["wing_r","wing_r_upper"],
  tail0:["tail","taila","tail_base","tail_01","tail1"],tail1:["tailb","tail_tip","tail_mid","tail_02","tail2"],
  leg0_hip:["fore_l_upper","foreupper_l","frontupper_l","thigh_l","front_l_upper","back_l_upper"],
  leg1_hip:["fore_r_upper","foreupper_r","frontupper_r","thigh_r","front_r_upper","back_r_upper"],
  leg2_hip:["hind_l_upper","hindupper_l","back_l_upper"],
  leg3_hip:["hind_r_upper","hindupper_r","back_r_upper"],
  leg0_knee:["fore_l_lower","forelower_l","frontlower_l","shank_l","front_l_lower","back_l_lower"],
  leg1_knee:["fore_r_lower","forelower_r","frontlower_r","shank_r","front_r_lower","back_r_lower"],
  leg2_knee:["hind_l_lower","hindlower_l","back_l_lower"],
  leg3_knee:["hind_r_lower","hindlower_r","back_r_lower"],
  leg0_foot:["fore_l_fetlock","frontfoot_l","forepaw_l","forehoof_l","front_l_foot","back_l_foot"],
  leg1_foot:["fore_r_fetlock","frontfoot_r","forepaw_r","forehoof_r","front_r_foot","back_r_foot"],
  leg2_foot:["hind_l_fetlock","hindfoot_l","hindpaw_l","hindhoof_l","back_l_foot"],
  leg3_foot:["hind_r_fetlock","hindfoot_r","hindpaw_r","hindhoof_r","back_r_foot"]
 };
 const nodeIndex=(role)=>{
  for(const key of [role,...(aliases[role]??[])]){
   const needle=key.toLowerCase(),direct=map.get(needle);if(direct!==undefined)return direct;
   const suf="_"+needle;
   for(let i=0;i<gltf.nodes.length;i++)if((gltf.nodes[i].name||"").toLowerCase().endsWith(suf))return i;
  }
  return undefined;
 };
 const extras=[],clips=[],original=new Set((gltf.animations||[]).map(a=>a.name));let offset=align4(baseBin.length);
 gltf.bufferViews??=[];gltf.accessors??=[];gltf.animations??=[];
 function floats(arr,type,withLimits=false){
   const data=new Uint8Array(arr.length*4), view=new DataView(data.buffer);
   for(let i=0;i<arr.length;i++)view.setFloat32(i*4,arr[i],true);
   const at=align4(offset);if(at>offset)extras.push({offset,data:new Uint8Array(at-offset)});offset=at;
   const bi=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length});
   const ai=gltf.accessors.length;const n=type==="SCALAR"?1:4;const accessor={bufferView:bi,componentType:5126,count:arr.length/n,type};
   if(withLimits){accessor.min=[Math.min(...arr)];accessor.max=[Math.max(...arr)];}
   gltf.accessors.push(accessor);extras.push({offset,data});offset+=data.length;
   return ai;
 }
 for(const id of SPEC[rig]){
  const name=id+"_v4";
  if(original.has(name))continue;
  const duration=DURATION[id]??1.0,steps=26,keys=Array.from({length:steps+1},(_,k)=>duration*k/steps);
  const positions=keys.map(t=>pose(rig,id,t/duration));
  const roles=Object.keys(positions[Math.floor(steps/2)]);
  const tracks=roles.filter(r=>nodeIndex(r)!==undefined);
  if(!tracks.length)continue;
  const input=floats(keys,"SCALAR",true),anim={name,samplers:[],channels:[],extras:{source:"Wildhaven animation workshop V4",rig,procedural:true,loop:["combat_idle","defensive_idle","injured_idle","limp_walk","social_distance","vibration_sense"].includes(id),rootMotion:"in_place",durationSeconds:duration}};
  for(const role of tracks){
   const index=nodeIndex(role),node=gltf.nodes[index];
   const rest=node.rotation??[0,0,0,1],arr=[];
   for(const poseObj of positions){
      const angle=poseObj[role]??[0,0,0];
      const q=mulQ(rest,eulerQ(...angle));const inv=1/Math.hypot(...q);
      for(const component of q)arr.push(component*inv);
   }
   const output=floats(arr,"VEC4");
   const sampler=anim.samplers.length;anim.samplers.push({input,output,interpolation:"LINEAR"});anim.channels.push({sampler,target:{node:index,path:"rotation"}});
  }
  if(anim.channels.length){gltf.animations.push(anim);clips.push({name,channels:anim.channels.length,duration});}
 }
 if(!clips.length)return {skip:"sem clipes aplicaveis",rig};
 gltf.buffers[0].byteLength=offset;
 const txt=encodeUtf8(JSON.stringify(gltf)),jsonSize=align4(txt.length),binSize=align4(offset),final=new Uint8Array(12+8+jsonSize+8+binSize);
 w32(final,0,0x46546c67);w32(final,4,2);w32(final,8,final.length);
 w32(final,12,jsonSize);w32(final,16,0x4e4f534a);final.fill(32,20,20+jsonSize);final.set(txt,20);
 let binOffset=20+jsonSize;w32(final,binOffset,binSize);w32(final,binOffset+4,0x004e4942);binOffset+=8;
 final.set(baseBin,binOffset);
 for(const e of extras)final.set(e.data,binOffset+e.offset);
 // Validacao estrutural do arquivo gerado.
 if(u32(final,8)!==final.length||gltf.animations.length!==original.size+clips.length)throw Error("Integridade GLB falhou");
 for(const clip of gltf.animations.slice(-clips.length)){
  for(const chan of clip.channels){if(!gltf.nodes[chan.target.node]||!clip.samplers[chan.sampler])throw Error("Canal invalido");}
 }
 return {bytes:final,clips,rig,originalClips:original.size,nodeCount:gltf.nodes.length};
}

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT=fileURLToPath(new URL("../../../",import.meta.url));
const LAB=fileURLToPath(new URL("../",import.meta.url));
async function arquivos(p){let out=[];for(const item of await readdir(p,{withFileTypes:true}).catch(()=>[])){const x=join(p,item.name);if(item.isDirectory())out.push(...await arquivos(x));else if(item.isFile()&&(/LOD0\.glb$/i.test(item.name)||/rig.anim.*\.glb$/i.test(item.name))&&!/blockout/i.test(item.name))out.push(x);}return out;}
async function executar(){
 const args=process.argv.slice(2),all=args.includes("--todos"),paths=all?await arquivos(join(ROOT,"assets/models/creatures")):args.filter(a=>a.endsWith(".glb"));
 if(!paths.length){console.log("Uso: node scripts/animacoes-v4.mjs <arquivo.glb> ou --todos");return;}
 const report=[];
 for(const path of paths){
  try {
   const bytes=new Uint8Array(await readFile(path)),r=produzirAnimacoesV4(bytes);
   if(r.skip){report.push({arquivo:relative(ROOT,path),status:"pendente",motivo:r.skip});continue;}
   const rel=relative(join(ROOT,"assets/models/creatures"),path);
   const out=join(LAB,"animacoes/v4",rel.replace(/\.glb$/i,"-anim-v4.glb"));
   await mkdir(dirname(out),{recursive:true});await writeFile(out,r.bytes);
   report.push({arquivo:relative(ROOT,path),saida:relative(ROOT,out),rig:r.rig,clipes:r.clips.map(x=>x.name),status:"gerado"});
   console.log("Gerado:",relative(ROOT,out),r.clips.length,"clipes");
  }catch(e){report.push({arquivo:relative(ROOT,path),status:"erro",motivo:String(e.message??e)});console.log("ERRO",path,e.message);}
 }
 await mkdir(join(LAB,"animacoes/v4"),{recursive:true});await writeFile(join(LAB,"animacoes/v4/RELATORIO.json"),JSON.stringify({quantidade:report.length,gerados:report.filter(x=>x.status==="gerado").length,pendentes:report.filter(x=>x.status!=="gerado").length,arquivos:report},null,2));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL("file://"+process.argv[1])))executar().catch(e=>{console.error(e);process.exitCode=1});
