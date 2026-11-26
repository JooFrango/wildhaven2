import * as THREE from "three";

/**
 * Wildhaven Rocantraz v04 — original high-detail BIPEDAL apex predator.
 * True polygonal 3D mesh. +Z is forward, +Y is up; 1 unit = ~1 m.
 * Forest and desert are two ecological variants of the SAME species.
 * Fully independent from Wildhaven playable Alpha 0.1.
 */
export const VARIANTS=["forest","desert"];
export const ANIMATIONS=[
  "idle","walk","stalk","run","charge","bite","swipe",
  "roar","feed","defend","rest","die"
];
export const ECOLOGY={
 id:"rocantraz",category:"apex_carnivore",locomotion:"strictly_bipedal",
 rarity:"very_rare",social:"solitary",
 adultLengthMTarget:[8,12],adultHeightMTarget:[4,6],
 territoryKm2Target:[50,200],
 variants:{
   forest:{habitats:["tropical-forest","temperate-forest","mountains"],strategy:"woodland ambush"},
   desert:{habitats:["desert","rocky-desert","canyons"],strategy:"crepuscular rocky pursuit"}
 },
 integration:{gameplay:false,spawns:false,alphaTouched:false}
};
const P={
 forest:{
  hide:0x4a5c47,hideLight:0x637657,shoulder:0x768666,
  under:0x374c3f,shade:0x26362f,armor:0x78826a,
  armorLight:0xadb69a,armorDark:0x4b5b50,spines:0x8d9781,
  horn:0xc2b69a,hornBase:0x5b6155,fang:0xe3d6b9,
  crest:0x708462,lichen:0x82984d,eye:0xe9ac54,
 },
 desert:{
  hide:0x9b6046,hideLight:0xc18a61,shoulder:0xaf7554,
  under:0x6d493b,shade:0x48342c,armor:0xab805e,
  armorLight:0xe1b68a,armorDark:0x795842,spines:0xcb9a70,
  horn:0xe4cdab,hornBase:0x8c735d,fang:0xf2dec3,
  crest:0xb67b56,lichen:0xb78150,eye:0xf6bf6a,
 }
};
const MATERIALS=new Map();
function mat(color,vertexColors=false){
 const key=color+":"+vertexColors;
 if(!MATERIALS.has(key))MATERIALS.set(key,new THREE.MeshStandardMaterial({
  color,vertexColors,roughness:.90,metalness:.025,
  flatShading:false,side:THREE.DoubleSide
 }));
 return MATERIALS.get(key);
}
function mesh(parent,name,geo,color,vertexColors=false){
 const m=new THREE.Mesh(geo,mat(color,vertexColors));
 m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);
 return m;
}
function joint(parent,name,p){
 const o=new THREE.Group();o.name=name;o.position.set(...p);
 parent.add(o);return o;
}
function ball(parent,name,p,s,col,detail=2){
 const obj=mesh(parent,name,new THREE.IcosahedronGeometry(1,detail),col);
 obj.position.set(...p);obj.scale.set(...s);return obj;
}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
function catmull(a,b,c,d,t){
 return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+
   (-a+3*b-3*c+d)*t*t*t);
}
function ringsSmooth(points,n){
 const out=[];
 for(let k=0;k<=n;k++){
  const value=k/n*(points.length-1),i=Math.min(points.length-2,Math.floor(value)),
    t=Math.min(1,value-i);
  out.push(points[0].map((_,z)=>catmull(
    points[Math.max(0,i-1)][z],points[i][z],
    points[i+1][z],points[Math.min(points.length-1,i+2)][z],t)));
 }
 return out;
}
function surface(parent,name,control,axis,col,{segments=65,sides=36,gradient=null}={}){
 // axis Y: [y,centerX,centerZ,radiusX,radiusZ]
 // axis Z: [z,centerX,centerY,radiusX,radiusY]
 const rows=ringsSmooth(control,segments),v=[],ix=[],colors=[];
 const c1=new THREE.Color(gradient?.[0]??col),c2=new THREE.Color(gradient?.[1]??col);
 for(let i=0;i<rows.length;i++){
  const [coordinate,cx,co,rx,rOther]=rows[i],t=i/(rows.length-1);
  const tint=c1.clone().lerp(c2,t);
  for(let j=0;j<sides;j++){
   const a=2*Math.PI*j/sides,u=Math.cos(a),w=Math.sin(a);
   const swirl=1+.004*Math.sin(a*8+coordinate*6);
   if(axis==="y")v.push(cx+Math.max(.003,rx)*u*swirl,coordinate,
     co+Math.max(.003,rOther)*w*swirl);
   else v.push(cx+Math.max(.003,rx)*u*swirl,
     co+Math.max(.003,rOther)*w*swirl,coordinate);
   if(gradient)colors.push(tint.r,tint.g,tint.b);
  }
 }
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<sides;j++){
  const a=i*sides+j,b=i*sides+(j+1)%sides,
    c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;
  if(axis==="y")ix.push(a,c,b,b,c,d);
  else ix.push(a,b,c,b,d,c);
 }
 const st=v.length/3,first=rows[0],last=rows.at(-1);
 if(axis==="y")v.push(first[1],first[0],first[2],last[1],last[0],last[2]);
 else v.push(first[1],first[2],first[0],last[1],last[2],last[0]);
 if(gradient)colors.push(...c1.toArray(),...c2.toArray());
 for(let j=0;j<sides;j++){
  const k=(rows.length-1)*sides;
  ix.push(st,j,(j+1)%sides,st+1,k+(j+1)%sides,k+j);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
 if(gradient)g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 g.setIndex(ix);g.computeVertexNormals();
 return mesh(parent,name,g,gradient?0xffffff:col,!!gradient);
}
function tube(parent,name,points,radii,col,{steps=34,sides=14,gradient=null}={}){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const v=[],ix=[],colors=[];
 const from=new THREE.Color(gradient?.[0]??col),to=new THREE.Color(gradient?.[1]??col);
 for(let i=0;i<=steps;i++){
  const t=i/steps,p=curve.getPoint(t),
    tangent=curve.getTangent(t).normalize();
  const guide=Math.abs(tangent.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
  const u=new THREE.Vector3().crossVectors(tangent,guide).normalize();
  const w=new THREE.Vector3().crossVectors(tangent,u).normalize();
  const x=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(x));
  const r=Math.max(.003,mix(radii[k],radii[k+1],Math.min(1,x-k)));
  const color=from.clone().lerp(to,t);
  for(let j=0;j<sides;j++){
   const a=2*Math.PI*j/sides;
   const pt=p.clone().addScaledVector(u,Math.cos(a)*r)
     .addScaledVector(w,Math.sin(a)*r);
   v.push(...pt.toArray());
   if(gradient)colors.push(...color.toArray());
  }
 }
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){
  const a=i*sides+j,b=i*sides+(j+1)%sides,
    c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;
  ix.push(a,c,b,b,c,d);
 }
 const st=v.length/3;v.push(...points[0],...points.at(-1));
 if(gradient)colors.push(...from.toArray(),...to.toArray());
 for(let j=0;j<sides;j++){
  const k=steps*sides;
  ix.push(st,(j+1)%sides,j,st+1,k+j,k+(j+1)%sides);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
 if(gradient)g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 g.setIndex(ix);g.computeVertexNormals();
 return mesh(parent,name,g,gradient?0xffffff:col,!!gradient);
}
function scute(parent,name,pos,size,color,rot=[0,0,0]){
 // Convex shell shield, physically thick, beveled and colored.
 const sides=11,rings=[.48,1,.92,.12],heights=[-.063,-.016,size[1]*.28,size[1]];
 const verts=[],ids=[];
 for(let k=0;k<rings.length;k++)for(let j=0;j<sides;j++){
  const a=j*Math.PI*2/sides,und=1+.07*Math.sin(a*6+k*.18);
  verts.push(Math.cos(a)*size[0]*rings[k]*und,heights[k],
    Math.sin(a)*size[2]*rings[k]*und);
 }
 for(let k=0;k<rings.length-1;k++)for(let j=0;j<sides;j++){
  const a=k*sides+j,b=k*sides+(j+1)%sides,
    c=(k+1)*sides+j,d=(k+1)*sides+(j+1)%sides;
  ids.push(a,b,c,b,d,c);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
 g.setIndex(ids);g.computeVertexNormals();
 const o=mesh(parent,name,g,color);o.position.set(...pos);o.rotation.set(...rot);
 return o;
}
function buildBody(root,p){
 const body=joint(root,"Rocantraz04_Body",[0,0,0]);
 // Strictly upright biped. Broad chest stacked above narrowed waist/hips.
 surface(body,"Rocantraz04_ContinuousUprightTorso",[
  [2.11,0,-.37,.53,.47],[2.38,0,-.33,.88,.72],
  [2.72,0,-.23,1.05,.85],[3.10,0,-.13,1.03,.78],
  [3.46,0,-.06,1.22,.86],[3.84,0,.03,1.48,.94],
  [4.22,0,.13,1.54,.98],[4.56,0,.22,1.24,.80],
  [4.78,0,.33,.73,.59]
 ],"y",p.hide,{segments:96,sides:48,gradient:[p.under,p.shoulder]});
 // Ribs, distinct sternum, pectoral muscles, abdominal inset plates.
 surface(body,"Rocantraz04_FrontThoracicMuscle",[
  [2.46,0,.38,.35,.16],[2.85,0,.53,.61,.25],
  [3.35,0,.66,.79,.31],[3.85,0,.76,1.12,.35],
  [4.30,0,.73,1.12,.29],[4.53,0,.58,.65,.19]
 ],"y",p.shoulder,{segments:56,sides:36});
 for(const side of [-1,1]){
  ball(body,"Rocantraz04_Pectoral_"+side,
   [side*.75,3.89,.70],[.66,.40,.39],p.shoulder,3);
  ball(body,"Rocantraz04_AbdominalMuscle_"+side,
   [side*.44,2.98,.54],[.32,.52,.20],p.hideLight,3);
  ball(body,"Rocantraz04_Scapula_"+side,
   [side*1.19,4.09,-.25],[.45,.60,.54],p.hide,3);
  // Anatomical dorsal latissimus connects the moving shoulder to the ribcage.
  tube(body,"Rocantraz04_Latissimus_"+side,[
   [side*1.06,4.26,-.36],[side*1.22,3.86,-.48],
   [side*1.16,3.34,-.29],[side*.96,3.07,-.13]
  ],[.23,.31,.27,.09],p.hide,{steps:42,sides:19});
  // Interlocked side armor along rib cage, not floating pebbles.
  for(let row=0;row<5;row++){
   const y=4.25-row*.35;
   scute(body,"Rocantraz04_RibArmor_"+side+"_"+row,
    [side*(1.30-row*.058),y,.02-row*.040],
    [.32,.19,.47],row%3===0?p.armorLight:p.armor,
    [0,side*.08,side*.79]);
  }
  // Ventral rib armor does not overlap arms.
  for(let row=0;row<3;row++){
   scute(body,"Rocantraz04_ChestArmor_"+side+"_"+row,
    [side*(.43+row*.10),3.77-row*.31,1.00-row*.04],
    [.37,.16,.26],row%2?p.armor:p.armorLight,
    [-.9,side*.13,side*.08]);
  }
 }
 // Flexible abdominal/rib surface receives a small breathing deformation.
 const breath=joint(body,"Rocantraz04_Breath",[0,3.39,.60]);
 surface(breath,"Rocantraz04_IntercostalMembrane",[
  [-.41,0,.04,.31,.11],[-.25,0,.08,.50,.13],
  [0,0,.11,.67,.16],[.24,0,.08,.65,.12],
  [.39,0,.04,.33,.09]
 ],"y",p.under,{segments:48,sides:24});
 for(let i=0;i<5;i++){
  const y=3.25-i*.17;
  scute(body,"Rocantraz04_SternalShield_"+i,
   [0,y,.88-i*.07],[.27,.10,.24],
   i%2?p.armorDark:p.armor,[Math.PI*.50,0,0]);
 }
 const secondary=[];
 // Dorsal armor is a set of broad bone shields matched to torso curvature.
 for(let i=0;i<8;i++){
  const y=4.53-i*.29,z=-.47-i*.042;
  const anchor=joint(body,"Rocantraz04_BackPlateJoint_"+i,[0,y,z]);
  for(const lane of [-1,0,1]){
   scute(anchor,"Rocantraz04_DorsalScute_"+i+"_"+lane,
    [lane*(.48+.03*Math.sin(i)),0,0],
    [lane===0?.52:.45,.21,.36],i%3===0?p.armorLight:i%3===1?p.armor:p.armorDark,
    [Math.PI*.40,lane*.1,-lane*.22]);
  }
  // silhouette spines are tapered and arise from the same ossified ridge.
  tube(anchor,"Rocantraz04_Spine_"+i,[
   [0,.02,-.13],[0,.24,-.26],
   [0,.42+(i%3)*.075,-.51],[0,.46+(i%3)*.075,-.62]
  ],[.20,.16,.10,.004],p.spines,{steps:20,sides:11});
  secondary.push(anchor);
 }
 if(p.lichen){
  // Not grass painted on an image: small separate patch volumes.
  for(let i=0;i<24;i++){
   if(p!==P.forest)break;
   const side=i%2?-1:1,level=i%8;
   ball(body,"Rocantraz04_Lichen_"+i,
    [side*(1.11+.04*Math.sin(i*4)),3.98-level*.24,
     -.18+.12*Math.cos(i*2.4)],
    [.085,.038,.10],p.lichen,1);
  }
 }
 return {body,secondary,breath};
}
function buildLeg(body,side,p){
 const name=side<0?"Left":"Right";
 const hip=joint(body,"Rocantraz04_"+name+"Hip",
   [side*.83,2.53,-.30]);
 // Massive digitigrade thigh and heavy knee, proportionally correct for biped.
 surface(hip,"Rocantraz04_"+name+"MuscularThigh",[
  [.15,0,.01,.40,.42],[-.10,side*.02,.10,.56,.51],
  [-.40,side*.07,.26,.58,.53],[-.72,side*.11,.36,.46,.42],
  [-1.10,side*.10,.49,.33,.34],[-1.26,side*.09,.53,.24,.25]
 ],"y",p.hide,{segments:62,sides:34,
    gradient:[p.hideLight,p.hide]});
 ball(hip,"Rocantraz04_"+name+"Quadriceps",
  [side*.10,-.40,.24],[.43,.50,.37],p.shoulder,3);
 // Swept hamstring and gluteal tendon connect the pelvis to the knee.
 tube(hip,"Rocantraz04_"+name+"Hamstring",[
  [side*.17,.05,-.30],[side*.23,-.33,-.35],
  [side*.21,-.75,-.18],[side*.14,-1.13,.20]
 ],[.30,.34,.23,.13],p.hide,{steps:51,sides:19});
 ball(hip,"Rocantraz04_"+name+"Glute",
   [side*.24,-.07,-.30],[.45,.45,.43],p.hideLight,3);
 const knee=joint(hip,"Rocantraz04_"+name+"Knee",
   [side*.09,-1.22,.48]);
 // Soft round tissue sleeve hides the artificial hinge gap during flexion.
 surface(knee,"Rocantraz04_"+name+"PatellarSkinSleeve",[
  [.19,0,.03,.23,.24],[.08,0,.06,.32,.28],
  [-.07,0,.09,.35,.30],[-.22,0,.05,.28,.26]
 ],"y",p.hide,{segments:40,sides:26});
 ball(knee,"Rocantraz04_"+name+"KneePlate",
   [0,.005,.21],[.28,.21,.28],p.armor,3);
 tube(knee,"Rocantraz04_"+name+"PatellarTendon",[
   [0,.02,.35],[0,-.16,.34],[0,-.40,.25]
 ],[.12,.10,.05],p.hideLight,{steps:27,sides:13});
 surface(knee,"Rocantraz04_"+name+"CalfAndAchilles",[
  [.09,0,.00,.28,.27],[-.19,0,-.075,.37,.34],
  [-.46,0,-.22,.34,.32],[-.75,0,-.36,.26,.26],
  [-.98,0,-.29,.19,.21]
 ],"y",p.hide,{segments:50,sides:28});
 ball(knee,"Rocantraz04_"+name+"Calf",
   [0,-.34,-.17],[.30,.43,.27],p.hideLight,3);
 tube(knee,"Rocantraz04_"+name+"Achilles",[
   [0,-.25,-.37],[0,-.54,-.51],
   [0,-.80,-.47],[0,-.99,-.31]
 ],[.17,.14,.10,.06],p.hide,{steps:35,sides:15});
 for(let i=0;i<4;i++){
  scute(knee,"Rocantraz04_"+name+"ShinScute_"+i,
   [0,-.25-i*.19,.02-i*.042],
   [.19,.075,.20],i%2?p.armorDark:p.armor,
   [Math.PI*.46,0,0]);
 }
 const foot=joint(knee,"Rocantraz04_"+name+"Ankle",[0,-.97,-.28]);
 ball(foot,"Rocantraz04_"+name+"Heel",[0,.14,-.08],
  [.30,.22,.36],p.hide,3);
 // Wide metatarsal joint: the ankle rolls while toes stay mostly planted.
 surface(foot,"Rocantraz04_"+name+"MetatarsalBridge",[
  [-.27,0,.14,.21,.18],[-.10,0,.15,.29,.18],
  [.17,0,.12,.39,.16],[.43,0,.07,.43,.12]
 ],"z",p.hideLight,{segments:39,sides:24});
 surface(foot,"Rocantraz04_"+name+"BroadPlantarFoot",[
  [-.22,0,.14,.22,.16],[.01,0,.10,.33,.16],
  [.31,0,.085,.46,.16],[.63,0,.075,.47,.14],
  [.89,0,.05,.28,.11]
 ],"z",p.hide,{segments:53,sides:30});
 for(let t=0;t<4;t++){
  const x=(t-1.5)*.26;
  tube(foot,"Rocantraz04_"+name+"Toe_"+t,[
   [x*.63,.04,.58],[x,.025,.83],[x*1.12,-.03,1.09]
  ],[.145,.128,.080],p.hide,{steps:24,sides:11});
  tube(foot,"Rocantraz04_"+name+"Claw_"+t,[
   [x*1.12,-.025,1.00],[x*1.17,-.03,1.20],
   [x*1.19,-.18,1.48]
  ],[.10,.075,.004],p.fang,{steps:22,sides:9});
 }
 return {hip,knee,foot};
}
function buildArm(body,side,p){
 const name=side<0?"Left":"Right";
 const shoulder=joint(body,"Rocantraz04_"+name+"Shoulder",
   [side*1.33,4.16,.33]);
 // Separate shoulder, biceps, elbow, forearm, hand: arms are SMALLER than legs.
 surface(shoulder,"Rocantraz04_"+name+"Deltoid",[
  [.14,0,-.03,.35,.36],[-.14,side*.05,.06,.49,.45],
  [-.43,side*.15,.13,.46,.38],[-.75,side*.22,.23,.32,.30],
  [-.94,side*.23,.29,.22,.22]
 ],"y",p.hide,{segments:48,sides:30});
 ball(shoulder,"Rocantraz04_"+name+"Biceps",
   [side*.13,-.42,.23],[.35,.43,.33],p.shoulder,3);
 tube(shoulder,"Rocantraz04_"+name+"TricepsInsertion",[
   [side*.05,.13,-.27],[side*.17,-.30,-.34],
   [side*.26,-.67,-.21],[side*.23,-.90,.04]
 ],[.25,.30,.21,.08],p.hide,{steps:38,sides:16});
 scute(shoulder,"Rocantraz04_"+name+"ShoulderShield",
  [side*.14,.13,-.24],[.56,.21,.49],p.armorLight,
  [Math.PI*.22,0,side*.30]);
 const elbow=joint(shoulder,"Rocantraz04_"+name+"Elbow",
   [side*.23,-.91,.29]);
 ball(elbow,"Rocantraz04_"+name+"ElbowSkin",
   [0,-.01,.02],[.27,.26,.30],p.hide,3);
 surface(elbow,"Rocantraz04_"+name+"Forearm",[
  [.12,0,0,.21,.20],[-.13,side*.04,.06,.28,.25],
  [-.39,side*.11,.15,.30,.26],[-.63,side*.11,.23,.23,.21],
  [-.75,side*.10,.27,.16,.15]
 ],"y",p.hide,{segments:38,sides:25});
 for(let k=0;k<3;k++){
  scute(elbow,"Rocantraz04_"+name+"ForearmArmor_"+k,
   [side*.12,-.16-k*.17,.33+k*.01],
   [.19,.085,.18],k%2?p.armor:p.armorDark,
   [Math.PI*.40,0,side*.10]);
 }
 const wrist=joint(elbow,"Rocantraz04_"+name+"Wrist",
   [side*.10,-.73,.28]);
 ball(wrist,"Rocantraz04_"+name+"CarpalTissue",
   [0,.035,0],[.23,.20,.25],p.hideLight,3);
 ball(wrist,"Rocantraz04_"+name+"Palm",
   [0,-.065,.10],[.29,.24,.32],p.hide,2);
 for(let k=0;k<3;k++){
  const x=(k-1)*.21;
  tube(wrist,"Rocantraz04_"+name+"Finger_"+k,[
   [x*.7,-.08,.18],[x,-.22,.37],[x*1.16,-.26,.54]
  ],[.10,.078,.065],p.hide,{steps:22,sides:10});
  tube(wrist,"Rocantraz04_"+name+"HandClaw_"+k,[
   [x*1.16,-.23,.50],[x*1.20,-.28,.68],[x*1.27,-.50,.83]
  ],[.079,.052,.004],p.fang,{steps:20,sides:9});
 }
 return {shoulder,elbow,wrist};
}
function buildHead(neck,p,variant){
 // Monster is explicitly BIPED, with forward-facing predatory head atop torso.
 const head=joint(neck,"Rocantraz04_Head",[0,.47,.51]);
 head.scale.z=.91; // skull projection shortened; head remains a bipedal apex predator
 surface(head,"Rocantraz04_SolidCranium",[
  [-.58,0,.12,.41,.32],[-.30,0,.18,.62,.47],
  [.05,0,.20,.77,.54],[.35,0,.18,.82,.53],
  [.73,0,.09,.68,.44],[1.05,0,-.045,.58,.35],
  [1.38,0,-.11,.54,.26],[1.59,0,-.16,.47,.22],
  [1.73,0,-.18,.37,.16]
 ],"z",p.hide,{segments:91,sides:46,
   gradient:[p.hideLight,p.hide]});
 for(const side of [-1,1]){
  ball(head,"Rocantraz04_Masseter_"+side,
   [side*.50,-.10,.56],[.34,.41,.43],p.shoulder,3);
  // Wide zygomatic arch and temporal jaw muscle, not a cylindrical muzzle.
  tube(head,"Rocantraz04_ZygomaticArch_"+side,[
   [side*.53,.24,-.12],[side*.77,.12,.20],
   [side*.72,-.05,.60],[side*.49,-.22,.86]
  ],[.14,.15,.12,.065],p.hideLight,{steps:41,sides:14});
  ball(head,"Rocantraz04_OrbitalSocket_"+side,
   [side*.69,.24,.47],[.15,.14,.21],p.shade,2);
  ball(head,"Rocantraz04_Eye_"+side,
   [side*.795,.255,.48],[.058,.064,.091],p.eye,3);
  ball(head,"Rocantraz04_Pupil_"+side,
   [side*.83,.26,.49],[.026,.047,.052],p.shade,2);
  scute(head,"Rocantraz04_HeavyBrow_"+side,
   [side*.60,.45,.43],[.34,.11,.36],p.armor,
   [0,side*.28,-side*.39]);
  tube(head,"Rocantraz04_RamHorn_"+side,[
   [side*.58,.54,-.11],[side*.89,.72,-.30],
   [side*1.20,1.01,-.42],
   [side*(variant==="desert"?1.49:1.37),1.23,-.55],
   [side*(variant==="desert"?1.54:1.35),1.27,-.78]
  ],[.31,.28,.22,.12,.005],p.horn,{steps:56,sides:18,
    gradient:[p.hornBase,p.horn]});
  ball(head,"Rocantraz04_HornRoot_"+side,
   [side*.62,.54,-.12],[.29,.26,.29],p.hornBase,2);
  ball(head,"Rocantraz04_Nostril_"+side,
   [side*.35,-.12,1.63],[.078,.045,.036],p.shade,2);
 }
 // Forehead armored boss, frontal brow over snout.
 for(let k=0;k<3;k++){
  scute(head,"Rocantraz04_ForeheadPlate_"+k,
   [(k-1)*.30,.55,.19],[.27,.095,.27],
   k===1?p.armorLight:p.armor,[0,0,(k-1)*.10]);
 }
 const jaw=joint(head,"Rocantraz04_Jaw",[0,-.32,.23]);
 surface(jaw,"Rocantraz04_HeavyMandible",[
  [-.09,0,-.16,.34,.16],[.38,0,-.22,.48,.19],
  [.82,0,-.22,.46,.16],[1.19,0,-.20,.40,.12],
  [1.48,0,-.17,.30,.09]
 ],"z",p.under,{segments:61,sides:32});
 // Teeth fixed to upper skull and independently moving lower jaw.
 for(const side of [-1,1]){
  for(let i=0;i<9;i++){
   const z=.63+i*.125,w=.44-i*.015;
   tube(head,"Rocantraz04_UpperFang_"+side+"_"+i,[
    [side*w,-.25,z],[side*w,-.36,z+.035],
    [side*(w-.022),-.48-(i%3)*.035,z+.09]
   ],[.070,.060,.003],p.fang,{steps:11,sides:7});
  }
  for(let i=0;i<8;i++){
   const z=.40+i*.14,w=.40-i*.012;
   tube(jaw,"Rocantraz04_LowerFang_"+side+"_"+i,[
    [side*w,-.10,z],[side*w,-.005,z+.04],
    [side*(w-.020),.11+(i%3)*.025,z+.08]
   ],[.062,.055,.003],p.fang,{steps:11,sides:7});
  }
  tube(jaw,"Rocantraz04_OverbiteTusk_"+side,[
   [side*.43,-.15,.80],[side*.50,-.035,.95],
   [side*.48,.18,1.10]
  ],[.11,.075,.004],p.horn,{steps:22,sides:10});
 }
 // Flexible-looking gular skin around the jaw hinge, with real geometry.
 for(const side of [-1,1]){
   tube(head,"Rocantraz04_JawHingeTendon_"+side,[
    [side*.46,-.21,-.09],[side*.50,-.29,.10],
    [side*.43,-.42,.32]
   ],[.14,.15,.075],p.hide,{steps:24,sides:13});
 }
 return {head,jaw};
}
function buildTail(body,p){
 const segments=[];let parent=body;
 // Tail projects BACKWARD from hips: counterbalances broad head for true bipedal silhouette.
 for(let i=0;i<8;i++){
  const length=i<3?.77:.68;
  const root=joint(parent,"Rocantraz04_Tail"+i,
   [0,i===0?2.56:-.035,i===0?-.93:-.71]);
  const r=Math.max(.085,.76-i*.085);
  surface(root,"Rocantraz04_TailMuscle_"+i,[
   [-length-.10,0,-.055,r*.66,r*.59],
   [-length*.73,0,-.035,r*.88,r*.78],
   [-length*.39,0,.035,r,r*.87],
   [.07,0,.04,r*.85,r*.78]
  ],"z",p.hide,{segments:37,sides:24});
  if(i<6){
   scute(root,"Rocantraz04_TailOsteoderm_"+i,
    [0,r*.72,-length*.39],[r*.46,.10,r*.55],p.armor,
    [0,0,0]);
   tube(root,"Rocantraz04_TailSpine_"+i,[
    [0,r*.7,-length*.36],[0,r*.94,-length*.42],
    [0,r*1.55,-length*.58]
   ],[r*.20,r*.14,.005],p.spines,{steps:16,sides:9});
  }
  segments.push(root);parent=root;
 }
 tube(parent,"Rocantraz04_TailTerminalSpine",[
  [0,0,-.47],[0,.08,-.79],[0,.14,-1.08]
 ],[.13,.08,.004],p.horn,{steps:24,sides:11});
 return segments;
}
const rest=new WeakMap();
function memorize(root){
 root.traverse(o=>{
  if(o===root||!o.isGroup)return;
  rest.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});
 });
}
function reset(root){
 root.traverse(o=>{
  if(o===root||!o.isGroup)return;
  const orest=rest.get(o);
  if(orest){o.position.copy(orest.position);
   o.quaternion.copy(orest.quaternion);o.scale.copy(orest.scale);}
 });
}
export function createRocantraz(variant){
 if(!VARIANTS.includes(variant))throw Error("Invalid Rocantraz variant: "+variant);
 const p=P[variant];
 const root=new THREE.Group();root.name="Wildhaven_Rocantraz_Biped_v04_"+variant;
 const {body,secondary,breath}=buildBody(root,p);
 const neck=joint(body,"Rocantraz04_Neck",[0,4.37,.31]);
 surface(neck,"Rocantraz04_ThickNeck",[
  [-.20,0,.00,.56,.50],[.08,0,.14,.66,.60],
  [.36,0,.28,.58,.55],[.69,0,.43,.45,.43],
  [.91,0,.47,.32,.29]
 ],"y",p.hide,{segments:50,sides:34});
 for(const side of [-1,1])
  ball(neck,"Rocantraz04_NeckTendon_"+side,
   [side*.41,.21,.19],[.22,.44,.38],p.hideLight,2);
 const {head,jaw}=buildHead(neck,p,variant);
 const leftLeg=buildLeg(body,-1,p),rightLeg=buildLeg(body,1,p);
 const leftArm=buildArm(body,-1,p),rightArm=buildArm(body,1,p);
 const tail=buildTail(body,p);
 const rig={body,neck,head,jaw,breath,legs:{left:leftLeg,right:rightLeg},
  arms:{left:leftArm,right:rightArm},tail,secondary,variant};
 root.userData.rig=rig;root.userData.species="rocantraz";
 root.userData.variant=variant;
 memorize(root);
 return root;
}
const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
export const BIOMECHANICS_V04={
  species:"rocantraz",strictlyBipedal:true,
  kneeModel:"analytic planar 2-link IK with ground-height stance target",
  locomotion:"alternate weight shift, swing clearance, foot roll, tail inertia",
  softTissue:"modeled anatomical sleeves, connective tendons and breathing membrane",
  limitations:["in-place clips (no full root-motion ground locking)","no weight-painted SkinnedMesh","no uneven-terrain foot IK"]
};
/**
 * Sagittal-plane analytical IK for the actual Rocantraz thigh/calf dimensions.
 * Target ankle height is tied to the ground in world coordinates. The yaw
 * component stays on the sculpt's pelvis so no new legs/bones are invented.
 *
 * NOTE: clips are exported IN PLACE; this reduces vertical foot skating and
 * creates deliberate stance / clearance, not global locomotion root motion.
 */
function solvePlantedFoot(rig,side,targetY,targetZ,roll=0){
 const leg=rig.legs[side],sign=side==="left"?-1:1;
 // Geometry constants from knee/ankle pivot positions in buildLeg().
 const L1=Math.hypot(1.22,.48),L2=Math.hypot(.97,.28);
 const phi1=Math.atan2(.48,1.22);
 const phi2=Math.atan2(-.28,.97);
 leg.hip.rotation.set(0,0,0);leg.knee.rotation.set(0,0,0);
 // Convert a stationary virtual foot point into the moving pelvis reference.
 rig.body.updateWorldMatrix(true,true);
 leg.hip.updateWorldMatrix(true,false);
 const local=leg.hip.worldToLocal(new THREE.Vector3(
  sign*.92,targetY,targetZ));
 const radius=clamp(Math.hypot(local.y,local.z),
  Math.abs(L1-L2)+.035,L1+L2-.014);
 const cosine=clamp((radius*radius-L1*L1-L2*L2)/(2*L1*L2),-1,1);
 const bend=-Math.acos(cosine); // consistent anatomical knee direction
 const heading=Math.atan2(local.z,-local.y);
 const firstAngle=heading-Math.atan2(L2*Math.sin(bend),L1+L2*Math.cos(bend));
 const hipAngle=phi1-firstAngle;
 const kneeAngle=phi2-phi1-bend;
 leg.hip.rotation.x=clamp(hipAngle,-.90,1.06);
 leg.knee.rotation.x=clamp(kneeAngle,-.70,1.35);
 leg.foot.rotation.x=-leg.hip.rotation.x-leg.knee.rotation.x+roll;
 // Mild abducted stance, braced to distribute 6–12t target body mass.
 leg.hip.rotation.z=sign*.015;
}
function gait(rig,t,kind){
 const fast=kind==="run"||kind==="charge",sneak=kind==="stalk";
 const period=fast?.73:sneak?2.50:1.40;
 const phase=2*Math.PI*t/period;
 const stride={left:Math.sin(phase),right:Math.sin(phase+Math.PI)};
 // Pelvis side-shift over planted supporting leg; gentle fore-aft momentum.
 rig.body.position.x=(fast?.075:sneak?.038:.061)*Math.sin(phase);
 rig.body.position.z=(fast?.045:sneak?.018:.030)*Math.sin(phase-.34);
 rig.body.position.y=(fast?.034:sneak?.011:.023)*Math.cos(phase*2-.45)
  -(sneak?.15:0);
 rig.body.rotation.z=(fast?.030:sneak?.010:.020)*Math.sin(phase-.38);
 rig.body.rotation.x=fast?.073:sneak?.13:.015*Math.sin(phase-.47);
 rig.body.rotation.y=.013*Math.sin(phase-.2);
 // Foot trajectories are cyclical and C1-continuous, with elevated swing only.
 const tau=Math.PI*2;
 for(const side of ["left","right"]){
  const phaseSide=((phase+(side==="left"?0:Math.PI))%tau+tau)%tau;
  const swing=phaseSide<Math.PI;
  const progress=swing?phaseSide/Math.PI:(phaseSide-Math.PI)/Math.PI;
  const smooth=ease(progress);
  const front=swing?mix(-.23,.23,smooth):mix(.23,-.23,smooth);
  const clearance=swing?Math.sin(progress*Math.PI)*(fast?.27:sneak?.095:.17):0;
  const y=.30+clearance;
  const z=-.10+front;
  solvePlantedFoot(rig,side,y,z,
    swing?-.10*Math.sin(progress*Math.PI):.012*Math.sin(phaseSide));
 }
 // Inertia reaches neck, jaw and segmented balancing tail after main stride.
 rig.neck.rotation.x=-.025+.025*Math.sin(phase-.60);
 rig.head.rotation.x=.019*Math.sin(phase-.95);
 rig.jaw.rotation.x=.009*Math.sin(phase*1.15-1.1);
 rig.arms.left.shoulder.rotation.x=-stride.right*(fast?.30:.15)-.15;
 rig.arms.right.shoulder.rotation.x=-stride.left*(fast?.30:.15)-.15;
 rig.arms.left.elbow.rotation.x=.20+.09*Math.max(0,stride.left);
 rig.arms.right.elbow.rotation.x=.20+.09*Math.max(0,stride.right);
 rig.tail.forEach((joint,i)=>{
  joint.rotation.y=(fast?.115:.065)*Math.sin(phase*.60-i*.39);
  joint.rotation.x=.008+(fast?.031:.021)*Math.sin(phase*.57-i*.39);
  joint.rotation.z=.011*Math.sin(phase-i*.28);
 });
 // A real auxiliary rib/intercostal mesh breathes subtly, in addition to
 // the rigid armored shell remaining fixed to the torso.
 rig.breath.scale.set(1+.014*Math.sin(t*2.4),
  1,1+.016*Math.sin(t*2.4-.22));
 return phase;
}
export function poseRocantraz(root,action,t=0){
 if(!ANIMATIONS.includes(action))throw Error("Unknown animation: "+action);
 const r=root.userData.rig;if(!r)throw Error("Rocantraz rig missing");
 reset(root);t=Math.max(0,t);
 const moving=["walk","run","stalk","charge"].includes(action);
 const fast=["run","charge"].includes(action);
 if(moving)gait(r,t,action);
 if(action==="idle"){
  r.breath.scale.set(1+.017*Math.sin(t*1.4),
    1,1+.021*Math.sin(t*1.4-.3));
  r.body.position.y=.012*Math.sin(t*1.7);
  r.neck.rotation.x=.022*Math.sin(t*.82);
  r.head.rotation.y=.046*Math.sin(t*.64);
  r.jaw.rotation.x=.012*Math.sin(t*1.13);
  r.tail.forEach((seg,i)=>seg.rotation.y=.038*Math.sin(t*.8-i*.4));
 }
 if(action==="charge"){
  r.body.rotation.x+=.11;
  r.neck.rotation.x-=.18;
  r.head.rotation.x-=.18;
  r.arms.left.elbow.rotation.x=.23;
  r.arms.right.elbow.rotation.x=.23;
 }
 if(action==="bite"){
  const wind=ease(t/.32),strike=ease((t-.35)/.22)*(1-ease((t-.79)/.22));
  r.body.position.z=-.10*strike;
  r.body.position.x=.030*Math.sin(t*7)*strike;
  r.body.position.y=-.060*strike;
  r.body.rotation.x=.12*wind;
  r.neck.rotation.x=.20*strike;
  r.head.rotation.x=.13*strike;
  r.head.position.z+=.30*strike;
  r.jaw.rotation.x=.62*wind*(1-strike)+.05*strike;
  r.arms.left.shoulder.rotation.x=-.27*strike;
  r.arms.right.shoulder.rotation.x=-.27*strike;
 }
 if(action==="roar"){
  const k=ease(t/.45)*(1-ease((t-2.00)/.36));
  r.body.position.y=-.038*k;
  r.breath.scale.set(1+.045*k,1,1+.052*k);
  r.neck.rotation.x=-.24*k;
  r.head.rotation.x=-.26*k;
  r.jaw.rotation.x=.82*k;
  r.body.rotation.x=-.075*k;
  r.arms.left.shoulder.rotation.z=-.22*k;
  r.arms.right.shoulder.rotation.z=.22*k;
  r.neck.scale.setScalar(1+.018*k*Math.sin(t*9));
 }
 if(action==="swipe"){
  const k=ease(t/.30)*(1-ease((t-1.20)/.43));
  r.body.position.x=.08*Math.sin(t*7.5)*k;
  r.body.position.y=-.045*k;
  const side=Math.sin(t*7.5);
  r.body.rotation.y=.10*k*side;
  r.arms.left.shoulder.rotation.x=-.75*k;
  r.arms.right.shoulder.rotation.x=-.95*k;
  r.arms.left.shoulder.rotation.z=-.35*k;
  r.arms.right.shoulder.rotation.z=.35*k;
  r.arms.left.elbow.rotation.x=.42+.38*k*Math.max(0,side);
  r.arms.right.elbow.rotation.x=.42+.38*k*Math.max(0,-side);
  r.arms.left.wrist.rotation.x=-.21*k;
  r.arms.right.wrist.rotation.x=-.21*k;
  r.head.rotation.y=.08*k*side;
 }
 if(action==="feed"){
  const k=ease(t/.58)*(1-ease((t-2.35)/.40));
  r.neck.rotation.x=.34*k;
  r.head.rotation.x=.43*k;
  r.neck.position.y-=.12*k;
  r.neck.position.z+=.24*k;
  r.jaw.rotation.x=(.14+.10*Math.sin(t*11))*k;
  r.body.rotation.x=.07*k;
 }
 if(action==="defend"){
  const k=ease(t/.33);
  r.body.position.y=-.08*k;
  r.body.position.z=-.07*k;
  r.body.rotation.x=-.10*k;
  r.head.rotation.x=-.16*k;
  r.arms.left.shoulder.rotation.x=-.55*k;
  r.arms.right.shoulder.rotation.x=-.55*k;
  r.arms.left.shoulder.rotation.z=-.28*k;
  r.arms.right.shoulder.rotation.z=.28*k;
  r.arms.left.elbow.rotation.x=.41*k;
  r.arms.right.elbow.rotation.x=.41*k;
  r.tail.forEach((joint,i)=>joint.rotation.y=.075*Math.sin(t*2.1-i*.3));
 }
 if(action==="rest"){
  const k=ease(t/.8);
  r.body.position.y=-.48*k;
  r.body.rotation.x=.12*k;
  r.legs.left.hip.rotation.x=-.58*k;
  r.legs.right.hip.rotation.x=-.58*k;
  r.legs.left.knee.rotation.x=.85*k;
  r.legs.right.knee.rotation.x=.85*k;
  r.neck.rotation.x=.20*k;
  r.head.rotation.x=.16*k;
  r.arms.left.shoulder.rotation.x=.16*k;
  r.arms.right.shoulder.rotation.x=.16*k;
 }
 if(action==="die"){
  const k=ease(t/1.55);
  r.body.position.y=-.82*k;
  r.body.rotation.z=.92*k;
  r.body.rotation.x=.21*k;
  r.neck.rotation.x=.36*k;
  r.head.rotation.x=.28*k;
  r.head.rotation.y=.26*k;
  r.jaw.rotation.x=.14*k;
  r.legs.left.hip.rotation.x=-.54*k;
  r.legs.right.hip.rotation.x=.39*k;
  r.legs.left.knee.rotation.x=.66*k;
  r.legs.right.knee.rotation.x=.50*k;
  r.arms.left.shoulder.rotation.x=.48*k;
  r.arms.right.shoulder.rotation.x=.38*k;
  r.tail.forEach((joint,i)=>joint.rotation.x=.14*k*(1-i/10));
 }
 if(action==="stalk"){
  r.head.rotation.x=.08;
  r.arms.left.elbow.rotation.x=.34;
  r.arms.right.elbow.rotation.x=.34;
 }
 // In non-locomotive attacks both feet brace against a shared ground
 // plane instead of rising with the full upper-body animation.
 if(!moving&&action!=="rest"&&action!=="die"){
  solvePlantedFoot(r,"left",.30,-.10);
  solvePlantedFoot(r,"right",.30,-.10);
 }
 r.secondary.forEach((pivot,i)=>{
  pivot.rotation.x=moving?.012*Math.sin(t*(fast?10:4)-i*.25):0;
 });
}
export function bones(root){
 const arr=[];root.traverse(o=>{if(o!==root&&o.isGroup&&o.name)arr.push(o)});
 return arr;
}
const DUR={
 idle:2.4,walk:1.40,stalk:2.5,run:.73,charge:.73,bite:1.4,
 swipe:1.6,roar:2.36,feed:2.8,defend:2.0,rest:2.1,die:1.55
};
export function animationClips(root){
 const parts=bones(root),clips=[];
 for(const action of ANIMATIONS){
  const d=DUR[action],times=[],tracks=new Map();
  for(const o of parts)tracks.set(o.name,{pos:[],quat:[],scale:[]});
  const frames=53;
  for(let i=0;i<frames;i++){
   const t=d*i/(frames-1);times.push(t);
   poseRocantraz(root,action,t);
   for(const o of parts){
    const tr=tracks.get(o.name);
    tr.pos.push(...o.position.toArray());
    tr.quat.push(...o.quaternion.toArray());
    tr.scale.push(...o.scale.toArray());
   }
  }
  const ts=[];
  for(const o of parts){
   const tr=tracks.get(o.name);
   ts.push(new THREE.VectorKeyframeTrack(o.name+".position",times,tr.pos));
   ts.push(new THREE.QuaternionKeyframeTrack(o.name+".quaternion",times,tr.quat));
   ts.push(new THREE.VectorKeyframeTrack(o.name+".scale",times,tr.scale));
  }
  clips.push(new THREE.AnimationClip(action,d,ts));
 }
 poseRocantraz(root,"idle",0);
 return clips;
}
export function meshStats(root){
 let meshes=0,triangles=0,geos=new Set();
 root.traverse(o=>{
  if(!o.isMesh||!o.visible)return;
  meshes++;const g=o.geometry;geos.add(g);
  triangles+=(g.index?.count??g.attributes.position.count)/3;
 });
 return {meshes,triangles:Math.round(triangles),joints:bones(root).length};
}