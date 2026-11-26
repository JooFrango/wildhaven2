#!/usr/bin/env node
const fs=require("node:fs");
function upgrade(input){
 const d=new DataView(input.buffer,input.byteOffset,input.byteLength),jl=d.getUint32(12,true);let st="";for(let i=20;i<20+jl;i+=8000)st+=String.fromCharCode(...input.subarray(i,Math.min(i+8000,20+jl)));const g=JSON.parse(st),bo=20+jl,bin=input.slice(bo+8,bo+8+d.getUint32(bo,true)),B=new DataView(bin.buffer);
 if(g.animations.length!==41||g.skins[0].joints.length!==27)throw Error("wrong input");
 const pr=g.meshes[0].primitives[0],A=g.accessors,V=g.bufferViews,base=i=>(V[A[i].bufferView].byteOffset||0)+(A[i].byteOffset||0),N=A[pr.attributes.POSITION].count;
 const xyz=Array.from({length:N},(_,i)=>[0,1,2].map(k=>B.getFloat32(base(pr.attributes.POSITION)+i*12+k*4,true))),oldUV=Array.from({length:N},(_,i)=>[0,1].map(k=>B.getFloat32(base(pr.attributes.TEXCOORD_0)+i*8+k*4,true)));
 const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,t)=>a.map(x=>x*t),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/Math.max(1e-12,norm(a))),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},ramp=(x,a,b)=>smooth((x-a)/(b-a));
 const reps=new Map(),rep=[],P=Array.from({length:N},(_,i)=>i);function f(i){while(P[i]!==i){P[i]=P[P[i]];i=P[i]}return i}function un(a,b){P[f(a)]=f(b)}
 xyz.forEach((x,i)=>{const k=x.map(y=>y.toFixed(5)).join(",");if(reps.has(k))un(i,reps.get(k));else reps.set(k,i);rep.push(reps.get(k))});
 const tris=Array.from({length:A[pr.indices].count/3},(_,i)=>[0,1,2].map(k=>B.getUint32(base(pr.indices)+i*12+k*4,true)));
 tris.forEach(([a,b,c])=>{un(a,b);un(a,c)});
 const map=new Map();for(const t of tris){const k=f(t[0]);if(!map.has(k))map.set(k,[]);map.get(k).push(t)}
 const groups=[...map.values()].sort((a,b)=>Math.min(...a[0])-Math.min(...b[0]));if(groups.length!==123)throw Error("group count "+groups.length);
 const ids=Object.fromEntries(g.skins[0].joints.map((j,i)=>[g.nodes[j].name.replace("Sirocauro_",""),i])),nodes=Object.fromEntries(g.skins[0].joints.map(j=>[g.nodes[j].name.replace("Sirocauro_",""),j]));
 const pair=(a,b,t)=>[[a,1-clamp(t)],[b,clamp(t)]],one=a=>[[a,1]];
 function axial(x){
  if(x<-3.45)return pair("Head","Neck",ramp(x,-3.9,-3.35));
  if(x<-2.45)return pair("Neck","Chest",ramp(x,-3.45,-2.45));
  if(x<-.4)return pair("Chest","Spine",ramp(x,-2.45,-.4));
  if(x<1.65)return pair("Spine","Pelvis",ramp(x,-.4,1.65));
  if(x<3.6)return pair("Pelvis","Tail01",ramp(x,2.45,3.6));
  if(x<4.75)return pair("Tail01","Tail02",ramp(x,3.6,4.75));
  if(x<6.2)return pair("Tail02","Tail03",ramp(x,4.75,6.2));
  return pair("Tail03","Tail04",ramp(x,6.2,7.6));
 }
 function weight(i,p,c){
  const [x,y,z]=p;
  if(i===0||i===1||i===90)return axial(x);
  if(i===4||i===5||(i>=10&&i<=14)||(i>=38&&i<=42)||(i>=16&&i<=32&&i%2===0)||(i>=44&&i<=60&&i%2===0))return one("Jaw");
  if(i<62)return one("Head");
  if(i<72){const s=i<67?"L":"R",k=(i-62)%5;if(k>=2)return one("Wrist_"+s);if(z>3.0)return pair("Shoulder_"+s,"Chest",ramp(z,3.0,3.55)*.85);if(z>2.45)return pair("Elbow_"+s,"Shoulder_"+s,ramp(z,2.45,3));return pair("Wrist_"+s,"Elbow_"+s,ramp(z,1.92,2.45));}
  if(i<90){const s=i<81?"L":"R",k=(i-72)%9;if(k>=3)return pair("Toe_"+s,"Foot_"+s,ramp(x,.10,.85));
   if(z>2.7)return pair("Hip_"+s,"Pelvis",ramp(z,2.7,3.43)*.92);
   if(z>1.55)return pair("Knee_"+s,"Hip_"+s,ramp(z,1.55,2.7));
   if(z>.4)return pair("Ankle_"+s,"Knee_"+s,ramp(z,.4,1.55));
   return pair("Foot_"+s,"Ankle_"+s,ramp(z,.15,.4));
  }
  if(i<93)return one("Tail04");
  if(i<110)return axial(c[0]);
  if(i<115)return one("Head");
  return axial(c[0]);
 }
 function tile(i){if(i===0||i===1||i===90)return 0;if(i===4)return 5;if(i===5)return 2;if([7,33,35,61].includes(i))return 4;if([8,36].includes(i))return 6;if(i===9||i===37||i>=110)return 7;if((i>=10&&i<=32)||(i>=38&&i<=60)||i===91||i===92||(i>=93&&i<110))return 3;if(i>=62&&i<72&&((i-62)%5)>=2)return 3;if(i>=72&&i<90&&((i-72)%9)>=4&&((i-72)%9)%2===0)return 3;return 1;}
 function shape(i,p,c){let[x,y,z]=p;if(i===0){const u=ramp(x,-2.7,-1.2)*(1-ramp(x,.1,2.6));z+=.13*u*(z-2.8);y*=1+.035*u;}
  if(i===1){y*=1.07;z+=.12*ramp(x,-2.6,-3.7);}
  if(i>=2&&i<62||i>=110&&i<115){const m=ramp(x,-3.2,-5.5);x-=.15*m;z+=.10*m;y*=1+.06*(1-m);}
  if(i===72||i===81){const t=1-ramp(z,2.1,3.45);x=c[0]+(x-c[0])*(1-.10*t);y=c[1]+(y-c[1])*(1-.07*t);z+=.03;}
  if(i>=72&&i<90&&((i-72)%9)>=2){z=Math.max(-.04,z);}
  return [x,y,z];}
 // Orient every connected face consistently; reject boundary and non-manifold edges.
 function orient(faces,pts){
  const edges=new Map();for(let i=0;i<faces.length;i++){const t=faces[i];for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=a<b?a+":"+b:b+":"+a;if(!edges.has(k))edges.set(k,[]);edges.get(k).push([i,a<b?1:-1]);}}
  const adj=Array.from({length:faces.length},()=>[]);for(const es of edges.values()){if(es.length!==2)throw Error("invalid edge count "+es.length);const[[i,a],[j,b]]=es;adj[i].push([j,a===b]);adj[j].push([i,a===b]);}
  const flips=Array(faces.length).fill(null);for(let s=0;s<faces.length;s++){if(flips[s]!==null)continue;flips[s]=false;const q=[s];for(let k=0;k<q.length;k++){const i=q[k];for(const[j,d]of adj[i]){const v=flips[i]!==d;if(flips[j]===null){flips[j]=v;q.push(j);}else if(flips[j]!==v)throw Error("nonorientable");}}}
  const out=faces.map((t,i)=>flips[i]?[t[0],t[2],t[1]]:t.slice());let volume=0;for(const [a,b,c]of out)volume+=dot(pts[a],cross(pts[b],pts[c]))/6;
  if(Math.abs(volume)<1e-8)throw Error("zero volume");if(volume<0)for(const t of out)[t[1],t[2]]=[t[2],t[1]];return out;
 }
 const pos=[],uv=[],normal=[],joint=[],weights=[],indices=[],shellStats=[];let corrected=0;
 for(let i=0;i<groups.length;i++){
  const ts=groups[i],oldIds=[...new Set(ts.flat())],unique=[...new Set(oldIds.map(k=>rep[k]))],coords=unique.map(k=>xyz[k]),lo=[0,1,2].map(k=>Math.min(...coords.map(p=>p[k]))),hi=[0,1,2].map(k=>Math.max(...coords.map(p=>p[k]))),c=mul(add(lo,hi),.5);
  let points,faces,uvs;
  if(i>=93){
   // Closed, swept, bevel-like armor slabs. Three cross sections, rooted in the body.
   const l=hi[0]-lo[0],h=hi[2]-lo[2],r=(hi[1]-lo[1])/2,cy=c[1],bottom=lo[2]-.09;
   const sections=[[lo[0],r*.88,bottom,bottom+h*.31],[lo[0]+l*.57,r*1.05,bottom+.015,bottom+h*.82],[hi[0],r*.62,bottom+.09,bottom+h*.98]];
   points=[];for(const[x,w,z,t]of sections)points.push([x,cy-w,z],[x,cy+w,z],[x,cy+w*.32,t],[x,cy-w*.32,t]);
   faces=[[0,2,1],[0,3,2],[8,9,10],[8,10,11]];for(let j=0;j<2;j++)for(let k=0;k<4;k++){const a=j*4+k,b=j*4+(k+1)%4,d=a+4,e=b+4;faces.push([a,b,d],[b,e,d]);}
   uvs=points.map(p=>[.015+.22*(p[0]-lo[0])/Math.max(l,.01),.025+.43*clamp((p[2]-bottom)/Math.max(h,.01))]);corrected++;
  }else{
   points=coords.map(p=>shape(i,p,c));const local=new Map(unique.map((v,j)=>[v,j]));faces=ts.map(t=>t.map(v=>local.get(rep[v])));
   uvs=unique.map(v=>oldUV[v]);
  }
  const oriented=orient(faces,points);shellStats.push({part:i,triangles:oriented.length,closed:true,positiveVolume:true});
  // Keep UV seams from original triangles where possible; select proper tile by anatomy.
  const tileId=tile(i),tx=(tileId%4)*.25,ty=Math.floor(tileId/4)*.5;
  for(const t of oriented){
   const n=unit(cross(sub(points[t[1]],points[t[0]]),sub(points[t[2]],points[t[0]])));
   for(const k of t){const p=points[k],ww=weight(i,p,c).filter(x=>x[1]>1e-6);pos.push(...p);normal.push(...n);let [u,v]=uvs[k];if(i===0||i===1||i===90){ // continuous belly mapping, independent of erroneous old atlas tile
     const centerZ=i===90?2.65:i===1?3.65:3.1,theta=Math.atan2(p[1],p[2]-centerZ);u=.012+.225*clamp((p[0]-lo[0])/Math.max(.01,hi[0]-lo[0]));v=.025+.445*((theta+2*Math.PI)%(2*Math.PI))/(2*Math.PI);
    }
    uv.push(clamp(u,.008,.242)+tx,clamp(v,.015,.485)+ty);
    const js=[0,0,0,0],ws=[0,0,0,0];let sum=0;for(let j=0;j<ww.length;j++){js[j]=ids[ww[j][0]];ws[j]=j===ww.length-1?255-sum:Math.round(ww[j][1]*255);sum+=ws[j];}if(sum!==255||js.some(x=>!Number.isInteger(x)))throw Error("weight");joint.push(...js);weights.push(...ws);indices.push(indices.length);
   }
  }
 }
 // Append actual buffers, retain original embedded texture and unchanged legacy clips.
 const chunks=[bin];let offset=bin.length;
 function acc(data,type,ct,count,extra={},target){const pad=(4-offset%4)%4;if(pad){chunks.push(new Uint8Array(pad));offset+=pad;}const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength),view={buffer:0,byteOffset:offset,byteLength:bytes.length};if(target)view.target=target;V.push(view);offset+=bytes.length;chunks.push(bytes);A.push({bufferView:V.length-1,componentType:ct,count,type,...extra});return A.length-1;}
 const nv=indices.length,mins=[0,1,2].map(k=>{let x=Infinity;for(let j=k;j<pos.length;j+=3)x=Math.min(x,pos[j]);return Math.fround(x)}),maxs=[0,1,2].map(k=>{let x=-Infinity;for(let j=k;j<pos.length;j+=3)x=Math.max(x,pos[j]);return Math.fround(x)});
 pr.indices=acc(new Uint32Array(indices),"SCALAR",5125,nv,{min:[0],max:[nv-1]},34963);
 pr.attributes={POSITION:acc(new Float32Array(pos),"VEC3",5126,nv,{min:mins,max:maxs},34962),NORMAL:acc(new Float32Array(normal),"VEC3",5126,nv,{},34962),TEXCOORD_0:acc(new Float32Array(uv),"VEC2",5126,nv,{},34962),JOINTS_0:acc(new Uint8Array(joint),"VEC4",5121,nv,{},34962),WEIGHTS_0:acc(new Uint8Array(weights),"VEC4",5121,nv,{normalized:true},34962)};
 g.materials[0].pbrMetallicRoughness.metallicFactor=0;g.materials[0].pbrMetallicRoughness.roughnessFactor=.93;g.materials[0].doubleSided=false;
 // Clip-specific key poses and sagittal two-bone foot IK baked to rotations.
 const durations={idle:4.0,walk:2.5,run:1.9,sprint:1.55,backstep:2.6,roar:3.0,threaten:2.7,bite:1.35,bite_heavy:2.05,claw_left:1.65,claw_right:1.65,stomp_left:1.8,stomp_right:1.8,tail_sweep_left:2.3,tail_sweep_right:2.3,body_slam:2.5,fire_inhale:2.4,fire_burst:2.2,storm_charge:3.2,storm_sustain:3.0,fall:2.3,death:3.2,get_up:3.2,rest:3.8,rest_rise:2.9};
 const loop=new Set(["idle","walk","run","sprint","backstep","storm_sustain","rest"]);
 const interp=(s,keys)=>{if(s<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(s<=keys[i][0]){const a=keys[i-1],b=keys[i],t=smooth((s-a[0])/(b[0]-a[0]));return a[1]+(b[1]-a[1])*t;}return keys[keys.length-1][1];};
 const wave=(s,p=0)=>Math.sin(2*Math.PI*(s+p)),rotY=(x,z,a)=>[Math.cos(a)*x+Math.sin(a)*z,-Math.sin(a)*x+Math.cos(a)*z],trackStats={};let maxIK=0;
 function solve(p,side,x,z,root){const a=g.nodes[nodes["Knee_"+side]].translation,b=g.nodes[nodes["Ankle_"+side]].translation,L=Math.hypot(a[0],a[2]),M=Math.hypot(b[0],b[2]),dx=1.48+x-(1+root[0]),dz=.36+z-(2.85+root[2]+.05),raw=Math.hypot(dx,dz),r=clamp(raw,Math.abs(L-M)+.001,L+M-.001);const dir=Math.atan2(dx,-dz),alpha=dir+Math.acos(clamp((L*L+r*r-M*M)/(2*L*r),-1,1)),bx=dx*r/raw-L*Math.sin(alpha),bz=dz*r/raw+L*Math.cos(alpha),beta=Math.atan2(bx,-bz);const h=Math.atan2(a[0],-a[2])-alpha,k=Math.atan2(b[0],-b[2])-beta-h;p["Hip_"+side]=[0,h,0];p["Knee_"+side]=[0,k,0];p["Ankle_"+side]=[0,-h-k,0];p["Foot_"+side]=[0,0,0];const u=rotY(a[0],a[2],h),v=rotY(b[0],b[2],h+k);maxIK=Math.max(maxIK,Math.hypot(u[0]+v[0]-dx,u[1]+v[1]-dz));}
 function pose(name,s){const p={},t=[0,0,0],set=(n,x=0,y=0,z=0)=>p[n]=[x,y,z],v=(keys)=>interp(s,keys),env=(a,b,c,d)=>v([[0,0],[a,0],[b,1],[c,1],[d,0],[1,0]]);
  if(["walk","run","sprint","backstep"].includes(name)){
   const step=name==="walk"?1.05:name==="run"?1.65:name==="sprint"?1.92:.78,stance=name==="walk"||name==="backstep"?.72:.63,lift=name==="walk"?.38:name==="run"?.58:name==="sprint"?.74:.31,dir=name==="backstep"?-1:1;
   t[2]=-.21-.045*Math.cos(s*4*Math.PI);
   for(const [side,phase]of [["L",0],["R",.5]]){const q=(s+phase)%1;let x,z;if(q<stance){x=dir*step*(q/stance-.5);z=0;}else{const r=(q-stance)/(1-stance);x=dir*step*(.5-smooth(r));z=lift*Math.sin(Math.PI*r)**1.3;}solve(p,side,x,z,t);set("Shoulder_"+side,0,.13*wave(s,phase+.1),.03*wave(s,phase));}
   set("Spine",0,.035*wave(s,.12),.035*wave(s));set("Chest",.025*wave(s),-.045*wave(s,.23),-.025*wave(s));set("Neck",0,.04*wave(s,.32),-.03*wave(s));set("Head",0,-.04*wave(s,.32),.025*wave(s));for(let k=1;k<=4;k++)set("Tail0"+k,0,.018*wave(s,k*.09),(.04+k*.025)*wave(s,-k*.11));return{p,t};
  }
  if(name==="idle"){set("Chest",0,.016*wave(s));set("Neck",0,.025*wave(s,.12));set("Head",0,-.021*wave(s,.2),.02*wave(s,.1));for(let k=1;k<=4;k++)set("Tail0"+k,0,0,(.015+k*.012)*wave(s,-k*.12));return{p,t};}
  if(name==="bite"||name==="bite_heavy"){const heavy=name==="bite_heavy",a=v([[0,0],[.15,-.16],[.35,-.26],[.46,.32],[.53,.36],[.67,.16],[1,0]]),j=v([[0,0],[.14,-.10],[.34,-.82],[.45,-.58],[.49,-.045],[.56,0],[1,0]]);set("Jaw",0,j);set("Chest",0,a*(heavy?.55:.3));set("Neck",0,a*.65);set("Head",0,a*.45);t[0]=v([[0,0],[.30,.18],[.49,heavy?-.42:-.24],[.65,-.18],[1,0]]);t[2]=-.10*env(.05,.34,.55,.95);set("Tail01",0,-a*.30);set("Tail02",0,-a*.25);}
  if(name==="roar"||name==="threaten"){const a=env(.08,.32,.65,.95);set("Chest",0,-.22*a);set("Neck",0,-.22*a);set("Head",0,-.12*a);set("Jaw",0,-.82*a);set("Shoulder_L",0,-.27*a,.15*a);set("Shoulder_R",0,-.27*a,-.15*a);set("Tail01",0,.13*a);t[2]=-.12*a;}
  if(name.startsWith("claw_")){const side=name.endsWith("left")?"L":"R",sign=side==="L"?1:-1,a=v([[0,0],[.28,-.68],[.47,.72],[.56,.43],[1,0]]);set("Shoulder_"+side,0,a,sign*.26*env(.05,.25,.55,.9));set("Elbow_"+side,0,-a*.55);set("Wrist_"+side,0,-a*.25);set("Chest",0,.10*env(.1,.4,.55,.9),sign*.18*env(.1,.3,.5,.9));}
  if(name.startsWith("stomp_")){const side=name.endsWith("left")?"L":"R",a=v([[0,0],[.15,0],[.43,.68],[.59,.63],[.66,0],[1,0]]);t[2]=-.17*env(.05,.32,.62,.95);for(const k of ["L","R"])solve(p,k,k===side?-.20*a:0,k===side?a:0,t);set("Chest",0,.13*env(.55,.66,.70,.95));set("Tail01",0,-.1*a);return{p,t};}
  if(name.startsWith("tail_sweep")){const sign=name.endsWith("left")?1:-1,a=v([[0,0],[.25,-.60],[.40,-.54],[.57,.85],[.66,.58],[1,0]]);for(let k=1;k<=4;k++){const q=clamp(s-(k-1)*.035);set("Tail0"+k,0,.025*Math.abs(a),sign*(.18+k*.14)*interp(q,[[0,0],[.25,-.65],[.4,-.5],[.57,1],[.66,.55],[.90,0],[1,0]]));}set("Chest",0,.05*Math.abs(a),-sign*.18*a);set("Spine",0,0,-sign*.09*a);t[2]=-.12*Math.abs(a);}
  if(name==="body_slam"){const a=v([[0,0],[.3,-.22],[.52,.42],[.64,.36],[1,0]]);set("Chest",0,a);set("Neck",0,a*.65);set("Head",0,-a*.3);set("Tail01",0,-a*.45);t[2]=-.35*env(.15,.52,.64,.95);}
  if(name==="fire_inhale"||name==="fire_burst"){const a=name==="fire_inhale"?v([[0,0],[.3,1],[.68,1],[1,.8]]):v([[0,.8],[.15,1],[.58,1],[.72,.45],[1,0]]);set("Chest",0,(name==="fire_inhale"?-.18:.13)*a);set("Neck",0,(name==="fire_inhale"?-.18:.18)*a);set("Head",0,(name==="fire_inhale"?-.08:.05)*a);set("Jaw",0,(name==="fire_inhale"?-.28:-.85)*a);set("Tail01",0,-.12*a);t[2]=-.14*a;}
  if(name==="storm_charge"||name==="storm_sustain"){const a=name==="storm_charge"?smooth(s):1;set("Chest",0,-.08*a,.012*wave(s*2));set("Head",0,.06*a,.035*wave(s*2));for(let k=1;k<=4;k++)set("Tail0"+k,0,.018*wave(s*2,-k*.12),a*(.04+k*.05)*wave(s*2,-k*.15));t[2]=-.16*a;}
  if(name==="fall"||name==="death"||name==="get_up"){const a=name==="get_up"?1-smooth(s):v([[0,0],[.18,.06],[.63,1],[.78,1.03],[1,1]]);set("Pelvis",1.34*a,0,0);set("Spine",.13*a,.13*a);set("Chest",.15*a,.06*a);set("Neck",.16*a,.13*a);set("Head",.14*a,.08*a);set("Hip_L",-.28*a,.35*a);set("Hip_R",.28*a,-.18*a);set("Knee_L",0,-.23*a);set("Knee_R",0,-.20*a);set("Tail01",0,.18*a);set("Jaw",0,-.14*a);t[2]=-1.24*a;return{p,t};}
  if(name==="rest"||name==="rest_rise"){const a=name==="rest"?1:1-smooth(s);set("Chest",0,.11*a);set("Neck",0,.15*a);set("Head",0,.09*a);t[2]=-.48*a;}
  for(const side of ["L","R"])solve(p,side,0,0,t);
  return{p,t};
 }
 function quat([x,y,z]){const cx=Math.cos(x/2),sx=Math.sin(x/2),cy=Math.cos(y/2),sy=Math.sin(y/2),cz=Math.cos(z/2),sz=Math.sin(z/2),q=[sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];return q.map(v=>v/Math.hypot(...q));}
 const revised=[];g.animations=g.animations.map(old=>{
  const name=old.name;if(!(name in durations))return old;revised.push(name);const duration=durations[name],n=Math.ceil(duration*24)+1,times=Array.from({length:n},(_,i)=>duration*i/(n-1)),ta=acc(new Float32Array(times),"SCALAR",5126,n,{min:[0],max:[Math.fround(duration)]});const poses=times.map((_,i)=>pose(name,i/(n-1)));if(loop.has(name))poses[n-1]=poses[0];const a={name,samplers:[],channels:[],extras:{wildhaven:{loop:loop.has(name),revision:"v04",bakedIK:["walk","run","sprint","backstep","stomp_left","stomp_right"].includes(name),damageAuthority:false}}};
  for(const [bone,node]of Object.entries(nodes)){const q=poses.flatMap(p=>quat(p.p[bone]||[0,0,0]));const dst=acc(new Float32Array(q),"VEC4",5126,n),s=a.samplers.length;a.samplers.push({input:ta,output:dst,interpolation:"LINEAR"});a.channels.push({sampler:s,target:{node,path:"rotation"}});}
  const dst=acc(new Float32Array(poses.flatMap(p=>p.t)),"VEC3",5126,n),k=a.samplers.length;a.samplers.push({input:ta,output:dst,interpolation:"LINEAR"});a.channels.push({sampler:k,target:{node:nodes.Root,path:"translation"}});trackStats[name]=n;return a;
 });
 const socket=g.nodes.length;g.nodes.push({name:"fire_mouth_socket",translation:[-1.48,0,-.25],extras:{forward:[-1,0,0],vfx:"fire"}});g.nodes[nodes.Head].children.push(socket);
 g.meshes[0].name="Sirocauro_v04";g.asset.generator="Wildhaven Sirocauro v04 closed-shell rebuild and baked IK";g.asset.extras={wildhaven:{version:"v04",base:"v03",revisedClips:revised,layer2:"baked sagittal IK; terrain IK pending",layer3:"not integrated",fireSocket:"fire_mouth_socket"}};
 // Drop all unused accessors and bufferViews to avoid duplicate old geometry/curves.
 const used=new Set([pr.indices,...Object.values(pr.attributes),g.skins[0].inverseBindMatrices]);for(const a of g.animations)for(const s of a.samplers){used.add(s.input);used.add(s.output);}
 const keepA=[...used].sort((a,b)=>a-b),remA=new Map(keepA.map((a,i)=>[a,i]));const keepV=[...new Set([...keepA.map(i=>A[i].bufferView),...g.images.map(i=>i.bufferView)])].sort((a,b)=>a-b),remV=new Map(keepV.map((v,i)=>[v,i]));
 const all=new Uint8Array(offset);let at=0;for(const c of chunks){all.set(c,at);at+=c.length;}let compactSize=0;const pieces=[];g.bufferViews=keepV.map(i=>{const v=V[i],pad=(4-compactSize%4)%4;if(pad){pieces.push(new Uint8Array(pad));compactSize+=pad;}const out={...v,byteOffset:compactSize};pieces.push(all.slice(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));compactSize+=v.byteLength;return out;});
 g.accessors=keepA.map(i=>({...A[i],bufferView:remV.get(A[i].bufferView)}));pr.indices=remA.get(pr.indices);for(const k of Object.keys(pr.attributes))pr.attributes[k]=remA.get(pr.attributes[k]);g.skins[0].inverseBindMatrices=remA.get(g.skins[0].inverseBindMatrices);for(const a of g.animations)for(const s of a.samplers){s.input=remA.get(s.input);s.output=remA.get(s.output);}for(const im of g.images)im.bufferView=remV.get(im.bufferView);
 g.buffers[0].byteLength=compactSize;const bdata=new Uint8Array(compactSize);at=0;for(const b of pieces){bdata.set(b,at);at+=b.length;}
 const jtext=JSON.stringify(g),jb=Uint8Array.from(jtext,c=>c.charCodeAt(0)),jp=(4-jb.length%4)%4,bp=(4-bdata.length%4)%4,total=28+jb.length+jp+bdata.length+bp,out=new Uint8Array(total),dv=new DataView(out.buffer);dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);dv.setUint32(12,jb.length+jp,true);dv.setUint32(16,0x4e4f534a,true);out.set(jb,20);out.fill(32,20+jb.length,20+jb.length+jp);const x=20+jb.length+jp;dv.setUint32(x,bdata.length+bp,true);dv.setUint32(x+4,0x004e4942,true);out.set(bdata,x+8);
 return{glb:out,stats:{triangles:nv/3,vertices:nv,closedComponents:shellStats.length,rebuiltArmor:corrected,allEdgesTwoFaces:true,windingConsistent:true,positiveVolume:true,uvAtlasTilesUsed:[0,1,2,3,4,5,6,7],joints:27,clips:g.animations.length,revisedClips:revised,retainedClips:g.animations.filter(x=>!revised.includes(x.name)).map(x=>x.name),keyframes:trackStats,maxIKResidualM:maxIK,bounds:[mins,maxs],bytes:total,visualQA:"pending",terrainIK:"pending",combatAI:"pending"}};
}
const r=upgrade(new Uint8Array(fs.readFileSync(process.argv[2])));fs.writeFileSync(process.argv[3],r.glb);console.log(JSON.stringify(r.stats,null,2));
