#!/usr/bin/env node
// Build using: node build_v02.cjs <v01.glb> <v02.glb>
const fs=require("node:fs");
function build(input) {
 const dv0=new DataView(input.buffer,input.byteOffset,input.byteLength);
 if(dv0.getUint32(0,true)!==0x46546c67||dv0.getUint32(4,true)!==2)throw Error("GLB header");
 let jl=dv0.getUint32(12,true),txt="";
 for(let i=20;i<20+jl;i+=8000)txt+=String.fromCharCode(...input.subarray(i,Math.min(i+8000,20+jl)));
 const g=JSON.parse(txt.trim()),bc=20+jl,old=input.slice(bc+8,bc+8+dv0.getUint32(bc,true));
 if(g.skins||g.animations||g.meshes.length!==1)throw Error("source GLB changed");
 const prim=g.meshes[0].primitives[0],pa=g.accessors[prim.attributes.POSITION],pv=g.bufferViews[pa.bufferView];
 const vd=new DataView(old.buffer,old.byteOffset,old.length),off=(pv.byteOffset||0)+(pa.byteOffset||0),N=pa.count;
 const names=[
 ["Root",null,0,0,0],["Pelvis","Root",1,0,2.85],["Spine","Pelvis",-.4,0,3.1],["Chest","Spine",-1.9,0,3.35],["Neck","Chest",-3.12,0,3.65],["Head","Neck",-3.7,0,4.02],["Jaw","Head",-3.62,0,3.22],
 ["Tail01","Pelvis",2.75,0,2.85],["Tail02","Tail01",4.25,0,2.42],["Tail03","Tail02",5.8,0,2.22],["Tail04","Tail03",7.3,0,2.38],
 ["Shoulder_L","Chest",-2.34,-1,3.22],["Elbow_L","Shoulder_L",-2.83,-1.36,2.45],["Wrist_L","Elbow_L",-3.17,-1.34,2],
 ["Shoulder_R","Chest",-2.34,1,3.22],["Elbow_R","Shoulder_R",-2.83,1.36,2.45],["Wrist_R","Elbow_R",-3.17,1.34,2],
 ["Hip_L","Pelvis",1,-1.2,2.9],["Knee_L","Hip_L",1.62,-1.28,1.54],["Ankle_L","Knee_L",1.48,-1.3,.36],["Foot_L","Ankle_L",1,-1.33,.17],["Toe_L","Foot_L",.28,-1.33,.12],
 ["Hip_R","Pelvis",1,1.2,2.9],["Knee_R","Hip_R",1.62,1.28,1.54],["Ankle_R","Knee_R",1.48,1.3,.36],["Foot_R","Ankle_R",1,1.33,.17],["Toe_R","Foot_R",.28,1.33,.12]];
 const id={},jid={},P={};names.forEach(([n,parent,x,y,z],i)=>{
  jid[n]=i;id[n]=g.nodes.length;P[n]=[x,y,z];
  const pp=parent?P[parent]:[0,0,0];
  g.nodes.push({name:"Sirocauro_"+n,translation:[x-pp[0],y-pp[1],z-pp[2]],children:[]});
  if(parent)g.nodes[id[parent]].children.push(id[n]);else g.nodes[0].children.push(id[n]);
 });
 const joints=new Uint8Array(N*4),weights=new Uint8Array(N*4);
 const pair=(a,v,b)=>[[a,v],[b,1-v]];
 function classify(x,y,z){
  const s=y<0?"L":"R",ay=Math.abs(y);
  if(x>2.72){
   if(x<4.25)return pair("Tail01",Math.max(0,1-(x-2.72)/1.53),"Tail02");
   if(x<5.80)return pair("Tail02",1-(x-4.25)/1.55,"Tail03");
   if(x<7.30)return pair("Tail03",1-(x-5.8)/1.5,"Tail04");
   return [["Tail04",1]];
  }
  if(x>-.95&&x<2.4&&ay>.6&&z<3.08){
   if(z<.32)return x<.82?pair("Toe_"+s,.85,"Foot_"+s):pair("Foot_"+s,.85,"Ankle_"+s);
   if(z<.70)return pair("Ankle_"+s,.57,"Foot_"+s);
   if(z<1.50)return pair("Knee_"+s,.6,"Ankle_"+s);
   if(z<2.2)return pair("Knee_"+s,.53,"Hip_"+s);
   return pair("Hip_"+s,.78,"Pelvis");
  }
  if(x< -2.33&&x> -3.68&&ay>1.09&&z<3.32){
   if(z<2.13)return [["Wrist_"+s,1]];
   if(z<2.61)return pair("Elbow_"+s,.78,"Wrist_"+s);
   return pair("Shoulder_"+s,.8,"Elbow_"+s);
  }
  if(x< -3.32){
   if(z<3.38&&z>2.65)return pair("Jaw",.88,"Head");
   return pair("Head",.92,"Neck");
  }
  if(x< -2.55)return pair("Neck",.72,"Chest");
  if(x< -1.65)return pair("Chest",.86,"Spine");
  if(x<.25)return pair("Spine",.65,"Chest");
  if(x<1.55)return pair("Pelvis",.82,"Spine");
  return pair("Pelvis",.87,"Tail01");
 }
 for(let i=0;i<N;i++){
  const x=vd.getFloat32(off+i*12,true),y=vd.getFloat32(off+i*12+4,true),z=vd.getFloat32(off+i*12+8,true);
  if(!Number.isFinite(x+y+z))throw Error("nonfinite vertex");
  const ps=classify(x,y,z).filter(t=>t[1]>1e-6);let used=0;
  for(let k=0;k<ps.length;k++){joints[i*4+k]=jid[ps[k][0]];weights[i*4+k]=k===ps.length-1?255-used:Math.round(ps[k][1]*255);used+=weights[i*4+k];}
  if(used!==255)throw Error("skin weights sum");
 }
 const slices=[old];let size=old.length;
 function put(bytes,target){
  const pad=(4-size%4)%4;if(pad){slices.push(new Uint8Array(pad));size+=pad;}
  const o=size;slices.push(bytes);size+=bytes.length;
  const b={buffer:0,byteOffset:o,byteLength:bytes.length};if(target)b.target=target;
  g.bufferViews.push(b);return g.bufferViews.length-1;
 }
 function acc(bytes,type,ctype,count,extra={}){
  g.accessors.push({bufferView:put(bytes,ctype===5121?34962:undefined),componentType:ctype,count,type,...extra});
  return g.accessors.length-1;
 }
 function f32(nums){const u=new Uint8Array(nums.length*4),v=new DataView(u.buffer);for(let i=0;i<nums.length;i++)v.setFloat32(i*4,nums[i],true);return u;}
 prim.attributes.JOINTS_0=acc(joints,"VEC4",5121,N);
 prim.attributes.WEIGHTS_0=acc(weights,"VEC4",5121,N,{normalized:true});
 const ibm=new Float32Array(names.length*16);
 names.forEach(([n],i)=>{const p=P[n],k=i*16;ibm[k]=1;ibm[k+5]=1;ibm[k+10]=1;ibm[k+15]=1;ibm[k+12]=-p[0];ibm[k+13]=-p[1];ibm[k+14]=-p[2];});
 const ibacc=acc(f32(Array.from(ibm)),"MAT4",5126,names.length);
 g.skins=[{name:"Sirocauro_v02_skin",skeleton:id.Root,joints:names.map(v=>id[v[0]]),inverseBindMatrices:ibacc}];g.nodes[1].skin=0;
 const clips=["idle","walk","run","sprint","backstep","strafe_left","strafe_right","turn_left","turn_right","alert","roar","threaten","rest","rest_rise","eat","bite","bite_heavy","claw_left","claw_right","stomp_left","stomp_right","tail_sweep_left","tail_sweep_right","body_slam","feint","dodge_left","dodge_right","grab_start","grab_hold","grab_release","hurt_head","hurt_leg","stagger","fall","get_up","exhausted","death","storm_charge","storm_sustain","fire_inhale","fire_burst"];
 const loops=new Set(["idle","walk","run","sprint","backstep","strafe_left","strafe_right","turn_left","turn_right","alert","rest","eat","grab_hold","exhausted","storm_sustain"]);
 const dur={idle:3.2,walk:2.1,run:1.4,sprint:1,roar:2.1,threaten:2.3,rest:3.3,rest_rise:2.5,bite:.86,bite_heavy:1.24,feint:.78,dodge_left:.9,dodge_right:.9,grab_hold:2.3,fall:1.45,get_up:2.5,death:2.6,storm_charge:2.9,storm_sustain:2.6,fire_inhale:2,fire_burst:1.3,exhausted:2.4};
 const w=(s,ph=0,f=1)=>Math.sin(2*Math.PI*(s*f+ph)),pulse=(s,c,r)=>Math.exp(-2.5*((s-c)/r)**2),ramp=(s,a,b)=>Math.max(0,Math.min(1,(s-a)/(b-a)));
 function pose(n,s){
  const p={},t={};const set=(k,a=0,b=0,c=0)=>p[k]=[a,b,c],add=(k,a=0,b=0,c=0)=>{const v=p[k]||[0,0,0];set(k,v[0]+a,v[1]+b,v[2]+c);};
  if(["walk","run","sprint","backstep","strafe_left","strafe_right","turn_left","turn_right"].includes(n)){
   const amp=n==="walk"?.25:n==="run"?.44:n==="sprint"?.58:.22,back=n==="backstep"?-1:1,l=w(s),r=w(s,.5);
   set("Hip_L",0,amp*l*back);set("Hip_R",0,amp*r*back);set("Knee_L",0,-amp*.83*Math.max(0,-l));set("Knee_R",0,-amp*.83*Math.max(0,-r));
   set("Ankle_L",0,amp*.36*Math.max(0,-l));set("Ankle_R",0,amp*.36*Math.max(0,-r));
   set("Foot_L",0,-amp*.35*l);set("Foot_R",0,-amp*.35*r);
   set("Shoulder_L",0,-amp*.48*l);set("Shoulder_R",0,-amp*.48*r);
   set("Tail01",0,0,.05*w(s,.13));set("Tail02",0,0,.09*w(s,.29));set("Tail03",0,0,.12*w(s,.43));set("Tail04",0,0,.14*w(s,.57));
   set("Chest",0,.03*w(s,.25),.035*w(s));const h=n==="sprint"?.105:n==="run"?.074:.032;t.Root=[0,0,h*(1-Math.cos(4*Math.PI*s))];
   if(n.startsWith("strafe")){const a=n==="strafe_left"?-1:1;t.Root[1]=a*.07*w(s);add("Pelvis",0,0,a*.12);}
   if(n.startsWith("turn"))add("Pelvis",0,0,(n==="turn_left"?1:-1)*(.10+.05*w(s)));
   if(n==="backstep")add("Chest",0,-.12);
  }
  if(n==="idle"){set("Chest",.012*w(s),.024*w(s,.2));set("Neck",0,.02*w(s,.3));set("Head",0,.015*w(s,.52),.01*w(s,.24));for(let i=1;i<=4;i++)set("Tail0"+i,0,0,(.022+i*.007)*w(s,i*.11));t.Root=[0,0,.011*w(s)];}
  if(n==="alert"){set("Neck",0,-.12+.02*w(s));set("Head",0,-.13,.12*w(s));set("Tail02",0,0,-.07*w(s));}
  if(n==="roar"||n==="threaten"){const v=pulse(s,.48,.3);set("Head",0,-.2*v);set("Jaw",0,-.76*v);set("Chest",0,.13*v);set("Neck",0,.18*v);set("Tail01",0,0,.13*v);t.Root=[0,0,.045*v];if(n==="threaten"){set("Shoulder_L",0,-.22*v);set("Shoulder_R",0,-.22*v);set("Pelvis",0,0,.1*v);}}
  if(n==="rest"){set("Pelvis",0,.05*w(s));set("Chest",0,.08+.025*w(s));set("Head",0,.09+.03*w(s));t.Root=[0,0,-.18];}
  if(n==="rest_rise"){const v=1-ramp(s,.15,.85);set("Chest",0,.08*v);set("Hip_L",0,-.13*v);set("Hip_R",0,-.13*v);t.Root=[0,0,-.18*v];}
  if(n==="eat"){const v=pulse(s,.43,.43);set("Neck",0,.12*v);set("Head",0,.23*v);set("Jaw",0,-.26*(.5+.5*w(s,0,3)));}
  if(["bite","bite_heavy","feint","grab_start","grab_hold","grab_release","fire_inhale","fire_burst"].includes(n)){
   const charge=pulse(s,.33,.27),hit=pulse(s,.62,.18);let jaw=0,lean=0;
   if(n==="bite"||n==="bite_heavy"){jaw=-.65*charge+.4*hit;lean=(n==="bite_heavy"?.35:.2)*hit;set("Head",0,.3*hit);}
   if(n==="feint"){jaw=-.2*charge;lean=.13*charge;set("Head",0,.13*charge,.1*charge);}
   if(n==="grab_start"){jaw=-.65*charge;lean=.28*hit;set("Head",0,.2*hit);}
   if(n==="grab_hold"){jaw=-.22-.035*w(s,0,3);lean=.11;set("Head",0,-.07*w(s));}
   if(n==="grab_release"){jaw=-.45*pulse(s,.4,.22);lean=-.13*hit;}
   if(n==="fire_inhale"){jaw=-.24*charge;lean=-.18*charge;set("Neck",0,-.18*charge);set("Chest",0,-.15*charge);}
   if(n==="fire_burst"){jaw=-.83*pulse(s,.5,.31);lean=.30*hit;set("Neck",0,.20*hit);}
   set("Jaw",0,jaw);add("Chest",0,lean);set("Tail01",0,-lean*.22);set("Tail02",0,0,-lean*.12);t.Root=[-lean*.13,0,.028*charge];
  }
  if(n==="claw_left"||n==="claw_right"){const z=n==="claw_left"?"L":"R",v=pulse(s,.53,.2),a=pulse(s,.29,.2);set("Shoulder_"+z,0,-.5*a+.6*v,(z==="L"?1:-1)*.2*v);set("Elbow_"+z,0,-.43*a+.65*v);set("Wrist_"+z,0,-.26*v);set("Chest",0,.16*v);set("Head",0,.08*v);}
  if(n==="stomp_left"||n==="stomp_right"){const z=n==="stomp_left"?"L":"R",lift=pulse(s,.34,.2),hit=pulse(s,.66,.1);set("Hip_"+z,0,-.43*lift);set("Knee_"+z,0,.48*lift);set("Foot_"+z,0,-.22*lift);set("Chest",0,.13*hit);t.Root=[0,0,.06*lift-.08*hit];}
  if(n.startsWith("tail_sweep")){const z=n.endsWith("left")?1:-1,v=pulse(s,.58,.26);set("Tail01",0,0,z*.24*v);set("Tail02",0,0,z*.56*v);set("Tail03",0,0,z*.67*v);set("Tail04",0,0,z*.8*v);set("Pelvis",0,0,-z*.12*v);set("Chest",0,0,-z*.15*v);}
  if(n==="body_slam"){const v=pulse(s,.55,.2);set("Chest",0,.44*v);set("Pelvis",0,.17*v);set("Head",0,-.24*v);t.Root=[-.14*v,0,-.11*v];}
  if(n.startsWith("dodge")){const z=n.endsWith("left")?-1:1,v=pulse(s,.55,.24);set("Pelvis",z*.12*v,0,z*.23*v);set("Chest",z*.22*v);set("Tail01",0,0,-z*.26*v);t.Root=[0,z*.65*v,-.13*v];}
  if(n==="hurt_head"){const v=pulse(s,.39,.19);set("Head",-.27*v,.22*v,.2*v);set("Neck",0,.13*v);set("Chest",0,-.13*v);}
  if(n==="hurt_leg"){const v=pulse(s,.48,.28);set("Hip_L",.11*v,-.25*v,.12*v);set("Knee_L",0,-.36*v);set("Chest",.14*v,.22*v);t.Root=[0,0,-.12*v];}
  if(n==="stagger"){const v=pulse(s,.42,.28);set("Pelvis",.13*v,.2*v,.14*v);set("Chest",-.25*v,-.19*v);set("Head",0,-.22*v);t.Root=[.1*v,0,-.1*v];}
  if(n==="fall"||n==="death"){const v=ramp(s,.2,.9);set("Pelvis",1.18*v,.17*v);set("Chest",.3*v,-.1*v);set("Neck",.14*v);set("Tail01",0,.28*v);set("Hip_L",-.28*v,.3*v);set("Hip_R",.26*v,-.29*v);set("Jaw",0,-.18*v);t.Root=[0,0,-1.1*v];}
  if(n==="get_up"){const v=1-ramp(s,.12,.85);set("Pelvis",1.18*v,.17*v);set("Chest",.3*v,-.1*v);set("Hip_L",-.28*v,.3*v);set("Hip_R",.26*v,-.29*v);t.Root=[0,0,-1.1*v];}
  if(n==="exhausted"){set("Chest",0,.09+.045*w(s));set("Neck",0,.22+.025*w(s));set("Jaw",0,-.16-.07*w(s,0,2));t.Root=[0,0,-.08];}
  if(n==="storm_charge"||n==="storm_sustain"){const v=n==="storm_charge"?ramp(s,.1,.9):1;set("Chest",0,-.13*v,.03*w(s,0,3));set("Head",0,.16*v,.09*w(s,0,2));for(let i=1;i<=4;i++)set("Tail0"+i,0,0,(.07+i*.06)*w(s,i*.14,3)*v);set("Hip_L",0,.08*w(s,0,3)*v);set("Hip_R",0,-.08*w(s,0,3)*v);t.Root=[0,0,-.07*v];}
  return {p,t};
 }
 function quat([x,y,z]){const cx=Math.cos(x/2),sx=Math.sin(x/2),cy=Math.cos(y/2),sy=Math.sin(y/2),cz=Math.cos(z/2),sz=Math.sin(z/2);const q=[sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];return q.map(v=>v/Math.hypot(...q));}
 g.animations=[];let channels=0;
 for(const n of clips){
  const duration=dur[n]||1.5,loop=loops.has(n),samples=loop?17:13;
  const ts=Array.from({length:samples},(_,i)=>duration*i/(samples-1)),ta=acc(f32(ts),"SCALAR",5126,samples,{min:[0],max:[Math.fround(duration)]});
  const poses=ts.map((_,i)=>pose(n,i/(samples-1)));
  const a={name:n,samplers:[],channels:[],extras:{wildhaven:{layer:1,loop,requiresRuntimeIK:["walk","run","sprint","backstep","stomp_left","stomp_right"].includes(n),damageAuthority:false}}};
  for(const [joint] of names){
   const e=poses.map(v=>v.p[joint]||[0,0,0]);
   if(!e.some(v=>v.some(x=>Math.abs(x)>1e-4)))continue;
   const out=acc(f32(e.flatMap(quat)),"VEC4",5126,samples),s=a.samplers.length;
   a.samplers.push({input:ta,output:out,interpolation:"LINEAR"});a.channels.push({sampler:s,target:{node:id[joint],path:"rotation"}});
  }
  const t=poses.map(v=>v.t.Root||[0,0,0]);
  if(t.some(v=>v.some(x=>Math.abs(x)>1e-4))){const output=acc(f32(t.flat()),"VEC3",5126,samples),s=a.samplers.length;a.samplers.push({input:ta,output,interpolation:"LINEAR"});a.channels.push({sampler:s,target:{node:id.Root,path:"translation"}});}
  if(!a.channels.length)throw Error("No animation curves "+n);
  channels+=a.channels.length;g.animations.push(a);
 }
 g.asset.generator="Wildhaven Sirocauro 41-motions skeletal GLB v02";
 g.asset.extras={wildhaven:{layer1:"embedded_skeletal_clips",layer2:"runtime_IK_not_integrated",layer3:"tactical_AI_not_integrated",version:"v02"}};
 g.buffers[0].byteLength=size;
 const bin=new Uint8Array(size);let k=0;for(const x of slices){bin.set(x,k);k+=x.length;}
 const str=JSON.stringify(g),json=new Uint8Array(str.length);for(let i=0;i<str.length;i++){if(str.charCodeAt(i)>127)throw Error("Non-ASCII glTF JSON");json[i]=str.charCodeAt(i);}
 const p1=(4-json.length%4)%4,p2=(4-bin.length%4)%4,total=12+8+json.length+p1+8+bin.length+p2;
 const out=new Uint8Array(total),od=new DataView(out.buffer);od.setUint32(0,0x46546c67,true);od.setUint32(4,2,true);od.setUint32(8,total,true);od.setUint32(12,json.length+p1,true);od.setUint32(16,0x4e4f534a,true);out.set(json,20);out.fill(32,20+json.length,20+json.length+p1);const b=20+json.length+p1;od.setUint32(b,bin.length+p2,true);od.setUint32(b+4,0x004e4942,true);out.set(bin,b+8);
 if(g.animations.length!==41||g.skins[0].joints.length!==27||N!==18714||g.accessors[prim.indices].count/3!==6238||total!==out.length)throw Error("GLB invariant failed");
 return {glb:out,stats:{vertices:N,triangles:6238,skins:1,joints:names.length,clips:clips.length,channels,size:total,clip_names:clips,geometry_uv_texture_bytes_original:old.length,layer2:"pending",layer3:"pending",qa:"pending"}};
}
const src=process.argv[2],dst=process.argv[3];if(!src||!dst)throw Error("Usage: node build_v02.cjs source.glb output.glb");
const result=build(new Uint8Array(fs.readFileSync(src)));fs.writeFileSync(dst,Buffer.from(result.glb));console.log(JSON.stringify(result.stats,null,2));
