import * as THREE from "three";

/**
 * WILDHAVEN — Velsari / Redesenhado Tarruco (v0.1).
 * Genuine 3D surfaces, geometry, named rig pivots, no sprites.
 * +Z face-forward, Y is vertical, units nominally meters.
 * Assets isolated: never import game/alpha01.
 */
export const SPECIES={
 velsari:{
   name:"Velsari — Corredor Dourado",biome:["savanna"],category:"small_herbivore",
   weightKg:22,shoulderHeightM:.65,bodyLengthM:1.0,
   social:"small groups 4–10",abundance:"relatively common",
   diet:["grass","new shoots"],maxSpeedKmhTarget:50,
   clips:["idle","walk","run","leap","graze","alert","call","flee","rest","death"],
 },
 tarruco:{
   name:"Tarruco — Raizeiro das Savanas",biome:["savanna"],category:"small_herbivore",
   weightKg:12,shoulderHeightM:.38,bodyLengthM:.75,
   social:"mostly solitary",abundance:"moderately common",
   diet:["roots","sprouts","fallen fruit"],maxSpeedKmhTarget:24,
   anatomy:"NEW DESIGN: short muzzle, large ears, bony forehead crest, powerful digging forelegs, furred back. No armadillo carapace or tapir trunk.",
   clips:["idle","walk","trot","dig","forage","alert","flee","sniff","rest","death"],
 }
};
const hex={
 velsari:{
  hide:0xa76438,rust:0x8c492e,light:0xd6a06b,cream:0xe6d0a9,
  white:0xf2e4c5,stripe:0xf4d6a4,shadow:0x58382d,
  mane:0x75442e,maneLight:0xb77b4e,black:0x292423,eye:0x4b3226,
  horn:0x4b3730,hornTip:0x806955,hoof:0x373231,
 },
 tarruco:{
  hide:0x9b6a49,rust:0x7e4f38,cream:0xdac39c,
  pale:0xe3c7a1,back:0x9b774b,mane:0xb88751,
  crest:0xc9a97a,crestDark:0x77634b,ear:0x583b35,
  black:0x292723,eye:0x4a2f23,hoof:0x4a4037,
 }
};
const mats=new Map();
function mat(color){
 if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({
   color,roughness:.96,metalness:0,flatShading:false,side:THREE.DoubleSide,
 }));
 return mats.get(color);
}
function mesh(parent,name,geometry,color){
 const obj=new THREE.Mesh(geometry,mat(color));
 obj.name=name;obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);
 return obj;
}
function group(parent,name,pos=[0,0,0]){
 const g=new THREE.Group();g.name=name;g.position.set(...pos);parent.add(g);return g;
}
function ell(parent,name,pos,scale,color,detail=2){
 const o=mesh(parent,name,new THREE.IcosahedronGeometry(1,detail),color);
 o.position.set(...pos);o.scale.set(...scale);return o;
}
function lerp(a,b,t){return a+(b-a)*t}
function catmull(a,b,c,d,t){
 return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+
   (-a+3*b-3*c+d)*t*t*t)
}
function interpolate(points,steps){
 const out=[];
 for(let i=0;i<=steps;i++){
   const f=i/steps*(points.length-1),k=Math.min(points.length-2,Math.floor(f));
   const t=Math.min(1,f-k);
   out.push(points[0].map((_,c)=>catmull(
     points[Math.max(0,k-1)][c],points[k][c],
     points[k+1][c],points[Math.min(points.length-1,k+2)][c],t)));
 }
 return out;
}
// Smooth, continuous, closed 3D surface along +Z. Rings: z,x,y,rx,ry.
function loftZ(parent,name,rings,color,steps=54,sides=24){
 const rows=interpolate(rings,steps),v=[],ix=[];
 for(const [z,cx,cy,rx,ry] of rows)
  for(let j=0;j<sides;j++){
   const a=j*2*Math.PI/sides;
   v.push(cx+Math.cos(a)*Math.max(rx,.003),cy+Math.sin(a)*Math.max(ry,.003),z);
  }
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){
  const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;
  ix.push(a,b,c,b,d,c);
 }
 const n=v.length/3,lo=rows[0],hi=rows.at(-1);
 v.push(lo[1],lo[2],lo[0],hi[1],hi[2],hi[0]);
 for(let j=0;j<sides;j++){
  const k=steps*sides;ix.push(n,j,(j+1)%sides,n+1,k+(j+1)%sides,k+j);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
 g.setIndex(ix);g.computeVertexNormals();
 return mesh(parent,name,g,color);
}
// Smooth, curved, closed taper for horns, tail, fur, limbs. Radius per control point.
/** Painted pigment on real mesh vertices, rather than floating strip geometry.
 * No image textures or billboards; glTF includes interpolated vertex colors.
 */
function coatPigment(meshObj,id,c){
 const pos=meshObj.geometry.attributes.position;
 const colors=new Float32Array(pos.count*3);
 const skin=new THREE.Color(c.hide),light=new THREE.Color(c.cream??c.pale),
   darker=new THREE.Color(c.rust),golden=new THREE.Color(c.light??c.back);
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  const result=skin.clone();
  if(id==="velsari"){
   const flank=Math.abs(x)>.125&&y>.69&&y<.91;
   const ribbon=flank&&z>-.49&&z<.32?
     Math.max(0,Math.sin(z*29+y*8 + Math.abs(x)*4)):0;
   const fade=Math.max(0,Math.min(1,(ribbon-.46)*2.7));
   result.lerp(light,fade*.83);
   if(y<.58)result.lerp(light,.64);
   if(z<-.38&&y>.81)result.lerp(darker,.18);
  }else{
   const top=Math.max(0,Math.min(1,(y-.47)/.21));
   const shade=.06+.17*Math.max(0,Math.sin(z*9+x*8));
   result.lerp(golden,top*shade);
   if(y<.29)result.lerp(light,.21);
   if(z<-.25)result.lerp(darker,.15);
  }
  colors[i*3]=result.r;colors[i*3+1]=result.g;colors[i*3+2]=result.b;
 }
 meshObj.geometry.setAttribute("color",
   new THREE.Float32BufferAttribute(colors,3));
 meshObj.material=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.96,metalness:0,side:THREE.DoubleSide
 });
}
function tube(parent,name,points,radii,color,segments=35,sides=12){
 const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const v=[],ix=[];
 for(let i=0;i<=segments;i++){
   const t=i/segments,center=path.getPoint(t),tangent=path.getTangent(t).normalize();
   const up=Math.abs(tangent.y)<.90?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
   const a=new THREE.Vector3().crossVectors(tangent,up).normalize(),
     b=new THREE.Vector3().crossVectors(tangent,a).normalize();
   const r=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(r));
   const radius=lerp(radii[k],radii[k+1],Math.min(1,r-k));
   for(let j=0;j<sides;j++){
     const angle=j*2*Math.PI/sides;
     const p=center.clone().addScaledVector(a,Math.cos(angle)*radius)
       .addScaledVector(b,Math.sin(angle)*radius);
     v.push(...p.toArray());
   }
 }
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
   const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;
   ix.push(a,c,b,b,c,d);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
 g.setIndex(ix);g.computeVertexNormals();
 return mesh(parent,name,g,color);
}
function pointedEar(parent,name,side,base,height,depth,outer,inner){
 const ear=group(parent,name,base);
 const shape=[
  new THREE.Vector3(0,0,-.025),
  new THREE.Vector3(side*.16,height*.29,-depth*.15),
  new THREE.Vector3(side*.09,height*.81,-depth*.10),
  new THREE.Vector3(side*.02,height,0),
  new THREE.Vector3(-side*.09,height*.45,.07),
 ];
 const outline=new THREE.Shape();
 outline.moveTo(0,0);outline.bezierCurveTo(side*.13,height*.27,side*.20,height*.60,0,height);
 outline.bezierCurveTo(-side*.07,height*.71,-side*.11,height*.17,0,0);
 const g=new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:true,
   bevelSegments:3,steps:1,bevelThickness:depth*.24,bevelSize:depth*.28,
   curveSegments:12});
 const shell=mesh(ear,name+"_Outer",g,outer);
 shell.position.z=-depth*.53;
 const core=ell(ear,name+"_Interior",[side*.021,height*.43,depth*.58],
   [.077,height*.34,.009],inner,2);
 core.rotation.z=-side*.10;
 return ear;
}
function velsariLeg(body,key,side,front){
 const pos=[side*(front?.23:.27),front?.69:.68,front?.39:-.39];
 const thigh=group(body,key+"_HipOrShoulder",pos);
 const thighLength=front?.29:.26;
 tube(thigh,key+"_Thigh",
   [[0,.04,0],[side*.015,-.13,front?.01:-.075],
     [side*.012,-thighLength,front?.01:-.095]],
   [front?.11:.135,front?.085:.124,front?.064:.087],
   front?hex.velsari.hide:hex.velsari.rust,26,12);
 const knee=group(thigh,key+"_Knee",[side*.012,-thighLength,front?.01:-.095]);
 ell(knee,key+"_KneeCap",[0,0,0],[.07,.065,.08],hex.velsari.light,2);
 const shinLength=front?.28:.31;
 tube(knee,key+"_Shin",
   [[0,.04,0],[0,-shinLength*.55,front?.03:.06],[0,-shinLength,front?.045:.12]],
   [.066,.049,.035],hex.velsari.hide,24,10);
 const ankle=group(knee,key+"_Ankle",[0,-shinLength,front?.045:.12]);
 for(const toe of [-1,1]){
  loftZ(ankle,key+"_ClovenHoof_"+toe,[
   [0,toe*.042,-.019,.033,.04],
   [.055,toe*.042,-.021,.047,.043],
   [.12,toe*.044,-.03,.046,.033],
   [.15,toe*.044,-.03,.018,.019]
  ],hex.velsari.hoof,17,12);
 }
 return {upper:thigh,knee,ankle};
}
function tarrucoLeg(body,key,side,front){
 const pivot=group(body,key+"_ShoulderHip",
   [side*(front?.29:.28),front?.38:.37,front?.26:-.30]);
 const length=front?.185:.18;
 tube(pivot,key+"_StrongUpper",
   [[0,.06,0],[side*.01,-.06,.007],[side*.02,-length,front?.025:-.035]],
   [front?.135:.127,front?.155:.12,front?.113:.092],
   hex.tarruco.hide,26,14);
 ell(pivot,key+"_Brawn",[side*.015,-.06,.03],
   [front?.145:.12,.155,front?.155:.123],hex.tarruco.rust,2);
 const elbow=group(pivot,key+"_Elbow",[side*.02,-length,front?.025:-.035]);
 tube(elbow,key+"_LowerLeg",[[0,.03,0],[0,-.075,.023],[0,-.145,.07]],
   [front?.115:.093,front?.100:.077,front?.085:.063],hex.tarruco.hide,22,12);
 const paw=group(elbow,key+"_Paw",[0,-.145,.07]);
 ell(paw,key+"_PawPalm",[0,-.035,.10],
   [front?.13:.108,.07,front?.14:.13],hex.tarruco.rust,2);
 for(let k=-1;k<=2;k++){
  const xx=(k-.5)*(front?.059:.044);
  tube(paw,key+"_Claw_"+k,
    [[xx,-.028,.15],[xx*1.07,-.045,.25],[xx*1.05,-.080,.315]],
    [front?.031:.022,front?.026:.021,.002],
    hex.tarruco.hoof,17,9);
 }
 return {upper:pivot,knee:elbow,ankle:paw};
}
function buildVelsari(){
 const c=hex.velsari,root=new THREE.Group();root.name="Wildhaven_Velsari_v01";
 const body=group(root,"Velsari_Body");
 const velsariTorso=loftZ(body,"Velsari_OrganicBody",[
  [-.67,0,.72,.15,.16],[-.49,0,.70,.23,.22],[-.15,0,.75,.25,.25],
  [.17,0,.78,.23,.29],[.44,0,.79,.19,.24],[.59,0,.77,.085,.13]
 ],c.hide,68,34);
 coatPigment(velsariTorso,"velsari",c);
 ell(body,"Velsari_Belly",[0,.61,.03],[.18,.10,.37],c.cream,3);
 for(const side of [-1,1]){
  // Torso pigments are interpolated directly on 3D skin vertices.
  ell(body,"Velsari_HaunchMuscle_"+side,
     [side*.20,.66,-.42],[.14,.20,.18],c.rust,2);
 }
 const neck=group(body,"Velsari_Neck",[0,.88,.42]);
 tube(neck,"Velsari_NeckTaper",[
  [0,-.08,-.09],[0,.05,.06],[0,.23,.18],[0,.36,.23]
 ],[.155,.14,.105,.085],c.hide,36,16);
 ell(neck,"Velsari_CreamThroat",[0,.12,.12],[.072,.18,.093],c.cream,2);
 const head=group(neck,"Velsari_Head",[0,.34,.23]);
 loftZ(head,"Velsari_MuzzleAndSkull",[
  [-.20,0,.05,.09,.12],[-.10,0,.04,.15,.16],
  [.04,0,.04,.17,.16],[.15,0,-.015,.135,.108],
  [.26,0,-.045,.090,.065],[.34,0,-.05,.050,.035]
 ],c.hide,44,28);
 ell(head,"Velsari_Cheek",[0,-.045,.13],[.135,.085,.16],c.light,2);
 ell(head,"Velsari_Nose",[0,-.068,.33],[.046,.032,.045],c.black,2);
 for(const side of [-1,1]){
  const ear=pointedEar(head,"Velsari_Ear_"+side,side,
    [side*.13,.105,-.09],.34,.035,c.light,c.rust);
  ear.rotation.z=-side*.19;
  ell(head,"Velsari_Eye_"+side,[side*.16,.082,.11],
    [.027,.033,.034],c.eye,2);
  ell(head,"Velsari_EyeGlint_"+side,[side*.179,.087,.13],
    [.008,.010,.011],c.cream,1);
  // delicate distinct swept pair of short black horns
  tube(head,"Velsari_Horn_"+side,[
    [side*.085,.18,-.075],[side*.112,.29,-.065],
    [side*.124,.39,-.11],[side*.103,.46,-.15]
  ],[.052,.042,.028,.003],c.horn,31,12);
 }
 for(let i=0;i<22;i++){
  const side=i%2?-1:1,z=-.12+(i%11)*.036;
  tube(neck,"Velsari_ManeLock_"+i,[
   [side*.07,.15,z],[side*.08,.19,z-.035],[side*.10,.22,z-.075]
  ],[.037,.032,.002],i%3?c.mane:c.maneLight,10,7);
 }
 const jaw=group(head,"Velsari_Jaw",[0,-.083,.01]);
 jaw.scale.z=.87;
 loftZ(jaw,"Velsari_LowerJaw",[
  [-.03,0,-.02,.100,.042],[.14,0,-.04,.091,.037],[.24,0,-.04,.044,.022]
 ],c.hide,22,16);
 const legs={
  frontL:velsariLeg(body,"Velsari_FrontLeft",-1,true),
  frontR:velsariLeg(body,"Velsari_FrontRight",1,true),
  backL:velsariLeg(body,"Velsari_BackLeft",-1,false),
  backR:velsariLeg(body,"Velsari_BackRight",1,false),
 };
 const tail=group(body,"Velsari_Tail",[0,.78,-.63]);
 tube(tail,"Velsari_TailStem",[[0,0,.03],[0,-.015,-.12],[0,-.03,-.20]],
    [.047,.040,.028],c.hide,17,9);
 ell(tail,"Velsari_FluffyTailTip",[0,-.035,-.245],[.085,.08,.135],c.cream,2);
 const rig={body,neck,head,jaw,legs,tail,ears:head.children.filter(x=>x.name?.startsWith("Velsari_Ear_"))};
 root.userData.rig=rig;root.userData.species="velsari";
 return root;
}
function buildTarruco(){
 const c=hex.tarruco,root=new THREE.Group();root.name="Wildhaven_Tarruco_Redesigned_v01";
 const body=group(root,"Tarruco_Body");
 // The entire back is furred; NO ARMADILLO SHELL OR SEQUENTIAL SCALES.
 const tarrucoTorso=loftZ(body,"Tarruco_FurredCompactBody",[
  [-.45,0,.41,.13,.13],[-.36,0,.43,.25,.21],
  [-.15,0,.45,.34,.25],[.12,0,.44,.34,.255],
  [.31,0,.45,.29,.25],[.47,0,.43,.13,.16]
 ],c.hide,68,36);
 coatPigment(tarrucoTorso,"tarruco",c);
 loftZ(body,"Tarruco_PaleBelly",[
  [-.35,0,.285,.12,.07],[-.12,0,.28,.22,.09],
  [.17,0,.29,.24,.075],[.36,0,.30,.13,.05]
 ],c.cream,34,24);
 for(const side of [-1,1]){
  ell(body,"Tarruco_ShoulderMuscle_"+side,
    [side*.30,.365,.27],[.15,.19,.20],c.rust,3);
  ell(body,"Tarruco_Haunch_"+side,
    [side*.28,.37,-.28],[.17,.18,.18],c.hide,2);
 }
 // Short loose shoulder ruff only; the rest of the back is smoothly furred.
 // This avoids any impression of an armadillo carapace or tiled shell.
 for(let k=0;k<12;k++){
  const side=k%2?-1:1,row=Math.floor(k/2);
  const x=side*(.12+.07*(row%3)),z=.17+(row%4)*.052;
  tube(body,"Tarruco_ShortShoulderFur_"+k,[
   [x,.63,z],[x*1.05,.65,z+.02],[x*1.1,.68,z-.015]
  ],[.027,.032,.002],k%4?c.hide:c.mane,9,7);
 }
 const neck=group(body,"Tarruco_Neck",[0,.43,.31]);
 tube(neck,"Tarruco_Neck",[
  [0,0,-.11],[0,.045,.03],[0,.055,.22]
 ],[.23,.24,.18],c.hide,28,18);
 const head=group(neck,"Tarruco_Head",[0,.045,.15]);
 head.scale.z=.83; // proportionally short, blunt face, not a tapir snout
 loftZ(head,"Tarruco_ShortWideSkull",[
  [-.17,0,.04,.18,.18],[-.07,0,.07,.235,.22],
  [.06,0,.06,.245,.21],[.15,0,.025,.22,.17],
  [.23,0,-.035,.17,.12],[.29,0,-.06,.11,.075]
 ],c.hide,55,32);
 for(const side of [-1,1]){
  // broad facial masks in cream, no proboscis
  ell(head,"Tarruco_CheekMask_"+side,
    [side*.17,-.025,.12],[.059,.074,.091],c.pale,2);
  const ear=pointedEar(head,"Tarruco_Ear_"+side,side,
    [side*.17,.16,-.065],.26,.048,c.rust,c.ear);
  ear.rotation.z=side*.14;
  ell(head,"Tarruco_EyeSocket_"+side,
    [side*.21,.09,.09],[.038,.040,.047],c.ear,2);
  ell(head,"Tarruco_Eye_"+side,
    [side*.233,.095,.10],[.020,.024,.028],c.eye,3);
  ell(head,"Tarruco_Nostril_"+side,
    [side*.078,-.092,.275],[.030,.023,.022],c.black,2);
 }
 // short ornamental forehead crest on skin: 3 small organic bony nubs,
 // NOT a back-spanning shell.
 const crest=group(head,"Tarruco_ForeheadCrest",[0,.18,-.085]);
 for(let i=0;i<3;i++){
  ell(crest,"Tarruco_CrestBump_"+i,[(i-1)*.096,.025+(i===1?.04:0),0],
    [.059,.064+(i===1?.025:0),.068],
    i===1?c.crest:c.crestDark,2);
 }
 const jaw=group(head,"Tarruco_Jaw",[0,-.15,.04]);
 loftZ(jaw,"Tarruco_ShortJaw",[
  [-.01,0,-.01,.13,.052],[.13,0,-.032,.14,.063],
  [.235,0,-.042,.085,.040]
 ],c.rust,22,18);
 const legs={
  frontL:tarrucoLeg(body,"Tarruco_FrontLeft",-1,true),
  frontR:tarrucoLeg(body,"Tarruco_FrontRight",1,true),
  backL:tarrucoLeg(body,"Tarruco_BackLeft",-1,false),
  backR:tarrucoLeg(body,"Tarruco_BackRight",1,false),
 };
 const tail=group(body,"Tarruco_Tail",[0,.43,-.44]);
 tube(tail,"Tarruco_TailRoot",[
  [0,0,.02],[0,-.04,-.10],[0,-.07,-.18]
 ],[.09,.07,.025],c.hide,19,10);
 ell(tail,"Tarruco_TailFur",
   [0,-.08,-.19],[.085,.08,.10],c.mane,2);
 const rig={body,neck,head,jaw,legs,tail,crest,
   ears:head.children.filter(x=>x.name?.startsWith("Tarruco_Ear_"))};
 root.userData.rig=rig;root.userData.species="tarruco";
 return root;
}
const REST=new WeakMap();
function record(root){
 root.traverse(o=>{
  if(o===root||!o.isGroup)return;
  REST.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});
 });
}
function reset(root){
 root.traverse(o=>{
  if(o===root||!o.isGroup)return;
  const rest=REST.get(o);
  if(rest){
   o.position.copy(rest.p);o.quaternion.copy(rest.q);o.scale.copy(rest.s);
  }
 });
}
export function create(species){
 const root=species==="velsari"?buildVelsari():
   species==="tarruco"?buildTarruco():null;
 if(!root)throw Error("Unknown savanna species: "+species);
 record(root);return root;
}
function clamp(v,a=0,b=1){return Math.min(b,Math.max(a,v))}
function smooth(v){v=clamp(v);return v*v*(3-2*v)}
function stride(rig,t,period,amp,knee,run=false){
 const cycle=2*Math.PI*t/period,phases=
  run?{frontL:0,frontR:Math.PI,backL:Math.PI,backR:0}:
  {frontL:0,frontR:Math.PI,backL:Math.PI*1.5,backR:Math.PI*.5};
 for(const [name,leg] of Object.entries(rig.legs)){
  const p=cycle+phases[name],s=Math.sin(p),lift=Math.max(0,s);
  leg.upper.rotation.x=amp*s;
  leg.knee.rotation.x=knee*lift*lift;
  leg.ankle.rotation.x=-leg.upper.rotation.x*.45-leg.knee.rotation.x*.35;
 }
 rig.body.position.y=(run?.024:.009)*Math.cos(cycle*2);
 rig.body.rotation.z=(run?.045:.013)*Math.sin(cycle-.5);
 rig.neck.rotation.x=.024*Math.sin(cycle-.7);
 rig.head.rotation.x=.03*Math.sin(cycle-1);
 rig.tail.rotation.y=.10*Math.sin(cycle*.7-.4);
 return cycle;
}
export function pose(root,action,t=0){
 const id=root.userData.species,r=root.userData.rig,def=SPECIES[id];
 if(!def?.clips.includes(action))throw Error("Unknown clip "+id+"/"+action);
 reset(root);
 const time=Math.max(0,t);
 if(id==="velsari"){
  const moving=["walk","run","flee"].includes(action);
  if(moving){
   const fast=action!=="walk";
   stride(r,time,fast?.59:1.32,fast?.62:.35,fast?.71:.41,fast);
   if(fast){
    r.neck.rotation.x=-.10+.045*Math.sin(time*9);
    r.body.rotation.x=.085+.03*Math.sin(time*10);
    r.tail.rotation.x=.17;
   }
  }
  if(action==="leap"){
   const p=Math.max(0,Math.sin(Math.PI*Math.min(1,time/1.07)));
   r.body.position.y=.41*p;
   r.body.rotation.x=-.08*p;
   for(const [name,leg] of Object.entries(r.legs)){
    leg.upper.rotation.x=name.startsWith("front")?.55*p:-.40*p;
    leg.knee.rotation.x=.42*p;
    leg.ankle.rotation.x=-.10*p;
   }
   r.tail.rotation.x=.23*p;
  }
  if(action==="graze"){
   const k=smooth(time/.55)*(1-smooth((time-2.0)/.60));
   r.neck.rotation.x=.66*k;
   r.head.rotation.x=.73*k;
   r.neck.position.y-=.13*k;
   r.neck.position.z+=.12*k;
   r.head.rotation.y=.08*Math.sin(time*2)*k;
   r.jaw.rotation.x=.14*k*(.5+.5*Math.sin(time*11));
  }
  if(action==="alert"){
   const k=smooth(time/.25);
   r.neck.rotation.x=-.29*k;r.head.rotation.x=-.12*k;
   r.head.rotation.y=.18*Math.sin(time*1.8)*k;
   r.ears.forEach((e,i)=>e.rotation.z=(i?1:-1)*-.18*k);
  }
  if(action==="call"){
   r.neck.rotation.x=-.17;r.jaw.rotation.x=.22+.13*Math.sin(time*12);
   r.head.rotation.x=.06*Math.sin(time*7);
   r.body.position.y=.015*Math.sin(time*5);
  }
  if(action==="rest"){
   const k=smooth(time/.6);
   r.body.position.y=-.17*k;
   for(const leg of Object.values(r.legs)){
    leg.upper.rotation.x=.62*k;leg.knee.rotation.x=-.51*k;
   }
   r.neck.rotation.x=.20*k;
  }
  if(action==="idle"){
   r.body.position.y=.007*Math.sin(time*2.0);
   r.head.rotation.y=.08*Math.sin(time*.85);
   r.ears.forEach((e,i)=>e.rotation.y=.08*Math.sin(time*.75+i));
   r.tail.rotation.y=.13*Math.sin(time*1.1);
  }
 }else{
  const moving=["walk","trot","flee"].includes(action);
  if(moving) {
   const fast=action!=="walk";
   stride(r,time,fast?.67:1.28,fast?.40:.20,fast?.53:.31,fast);
   r.body.rotation.x=(fast?.055:.018)*Math.sin(time*10);
   r.ears.forEach((e,i)=>e.rotation.x=(fast?.10:.04)*Math.sin(time*8+i));
  }
  if(action==="dig"){
   const k=smooth(time/.4);
   r.body.rotation.x=.10*k;r.neck.rotation.x=.29*k;
   r.head.rotation.x=.26*k;
   const cycle=time*12;
   r.legs.frontL.upper.rotation.x=-.53*k+.43*Math.sin(cycle)*k;
   r.legs.frontR.upper.rotation.x=-.53*k-.43*Math.sin(cycle)*k;
   r.legs.frontL.knee.rotation.x=.37*k;
   r.legs.frontR.knee.rotation.x=.37*k;
   r.tail.rotation.x=-.14*k;
  }
  if(action==="forage"){
   const k=smooth(time/.5)*(1-smooth((time-2.1)/.7));
   r.neck.rotation.x=.34*k;r.head.rotation.x=.51*k;
   r.head.position.z+=.035*k;
   r.jaw.rotation.x=.10*k*(.5+.5*Math.sin(time*8));
   r.head.rotation.y=.055*Math.sin(time*1.4)*k;
  }
  if(action==="sniff"){
   r.head.rotation.x=.15+.05*Math.sin(time*3);
   r.head.rotation.y=.16*Math.sin(time*.9);
   r.neck.rotation.y=.05*Math.sin(time*.6);
  }
  if(action==="alert"){
   const k=smooth(time/.3);
   r.head.rotation.x=-.19*k;r.neck.rotation.x=-.14*k;
   r.crest.rotation.x=-.11*k;
   r.ears.forEach((e,i)=>e.rotation.y=(i?1:-1)*.23*k);
  }
  if(action==="rest"){
   const k=smooth(time/.7);
   r.body.position.y=-.15*k;
   r.legs.frontL.upper.rotation.x=.50*k;
   r.legs.frontR.upper.rotation.x=.50*k;
   r.legs.backL.upper.rotation.x=-.35*k;
   r.legs.backR.upper.rotation.x=-.35*k;
   r.neck.rotation.x=.19*k;
  }
  if(action==="idle"){
   r.body.position.y=.007*Math.sin(time*1.8);
   r.head.rotation.y=.045*Math.sin(time*.7);
   r.ears.forEach((e,i)=>e.rotation.y=.07*Math.sin(time*.9+i));
   r.tail.rotation.y=.09*Math.sin(time*.6);
  }
 }
 if(action==="death"){
  const k=smooth(time/1.45);
  r.body.position.y-=(id==="velsari"?.38:.24)*k;
  r.body.rotation.z=.86*k;
  r.neck.rotation.x=.45*k;r.head.rotation.x=.27*k;
  r.jaw.rotation.x=.12*k;
  for(const leg of Object.values(r.legs)){
   leg.upper.rotation.x=.30*k;leg.knee.rotation.x=.52*k;
  }
  r.tail.rotation.y=.18*k;
 }
}
export function bones(root){
 const joints=[];
 root.traverse(o=>{if(o!==root&&o.isGroup&&o.name)joints.push(o);});
 return joints;
}
const DURATION={idle:2.4,walk:1.45,run:.68,leap:1.07,graze:2.65,
  alert:1.9,call:1.5,flee:.65,rest:1.6,death:1.45,
  trot:.73,dig:1.45,forage:2.85,sniff:1.7};
export function animationClips(root){
 const joints=bones(root),output=[];
 for(const action of SPECIES[root.userData.species].clips){
  const length=DURATION[action],times=[],frames=new Map();
  for(const node of joints)frames.set(node.name,{pos:[],quat:[],scale:[]});
  for(let i=0;i<=48;i++){
   const t=i*length/48;times.push(t);pose(root,action,t);
   for(const node of joints){
    const o=frames.get(node.name);
    o.pos.push(...node.position.toArray());
    o.quat.push(...node.quaternion.toArray());
    o.scale.push(...node.scale.toArray());
   }
  }
  const tracks=[];
  for(const node of joints){
   const k=frames.get(node.name);
   tracks.push(new THREE.VectorKeyframeTrack(node.name+".position",times,k.pos));
   tracks.push(new THREE.QuaternionKeyframeTrack(node.name+".quaternion",times,k.quat));
   tracks.push(new THREE.VectorKeyframeTrack(node.name+".scale",times,k.scale));
  }
  output.push(new THREE.AnimationClip(action,length,tracks));
 }
 pose(root,"idle",0);
 return output;
}
export function meshStats(root){
 let n=0,triangles=0;
 root.traverse(o=>{
  if(!o.isMesh||!o.visible)return;
  n++;const g=o.geometry;
  triangles+=(g.index?.count??g.attributes.position.count)/3;
 });
 return {meshInstances:n,triangles:Math.round(triangles),joints:bones(root).length};
}
