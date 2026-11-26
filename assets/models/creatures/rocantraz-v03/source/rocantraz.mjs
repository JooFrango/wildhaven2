import * as THREE from "three";

/**
 * Wildhaven Rocantraz v03 — original high-detail BIPEDAL apex predator.
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
 const body=joint(root,"Rocantraz03_Body",[0,0,0]);
 // Strictly upright biped. Broad chest stacked above narrowed waist/hips.
 surface(body,"Rocantraz03_ContinuousUprightTorso",[
  [2.11,0,-.32,.50,.47],[2.38,0,-.30,.85,.72],
  [2.72,0,-.20,1.08,.85],[3.10,0,-.10,1.02,.77],
  [3.46,0,-.04,1.16,.82],[3.84,0,.04,1.39,.91],
  [4.22,0,.13,1.48,.94],[4.56,0,.21,1.17,.76],
  [4.78,0,.32,.67,.55]
 ],"y",p.hide,{segments:96,sides:48,gradient:[p.under,p.shoulder]});
 // Ribs, distinct sternum, pectoral muscles, abdominal inset plates.
 surface(body,"Rocantraz03_FrontThoracicMuscle",[
  [2.46,0,.38,.35,.16],[2.85,0,.53,.61,.25],
  [3.35,0,.66,.79,.31],[3.85,0,.76,1.12,.35],
  [4.30,0,.73,1.12,.29],[4.53,0,.58,.65,.19]
 ],"y",p.shoulder,{segments:56,sides:36});
 for(const side of [-1,1]){
  ball(body,"Rocantraz03_Pectoral_"+side,
   [side*.72,3.88,.78],[.63,.44,.47],p.shoulder,3);
  ball(body,"Rocantraz03_AbdominalMuscle_"+side,
   [side*.46,2.96,.64],[.36,.58,.25],p.hideLight,2);
  ball(body,"Rocantraz03_Scapula_"+side,
   [side*1.16,4.02,-.29],[.44,.53,.53],p.hide,2);
  // Interlocked side armor along rib cage, not floating pebbles.
  for(let row=0;row<5;row++){
   const y=4.25-row*.35;
   scute(body,"Rocantraz03_RibArmor_"+side+"_"+row,
    [side*(1.30-row*.058),y,.02-row*.040],
    [.32,.19,.47],row%3===0?p.armorLight:p.armor,
    [0,side*.08,side*.79]);
  }
  // Ventral rib armor does not overlap arms.
  for(let row=0;row<3;row++){
   scute(body,"Rocantraz03_ChestArmor_"+side+"_"+row,
    [side*(.43+row*.10),3.77-row*.31,1.00-row*.04],
    [.37,.16,.26],row%2?p.armor:p.armorLight,
    [-.9,side*.13,side*.08]);
  }
 }
 for(let i=0;i<5;i++){
  const y=3.25-i*.17;
  scute(body,"Rocantraz03_SternalShield_"+i,
   [0,y,.88-i*.07],[.27,.10,.24],
   i%2?p.armorDark:p.armor,[Math.PI*.50,0,0]);
 }
 const secondary=[];
 // Dorsal armor is a set of broad bone shields matched to torso curvature.
 for(let i=0;i<8;i++){
  const y=4.53-i*.29,z=-.47-i*.042;
  const anchor=joint(body,"Rocantraz03_BackPlateJoint_"+i,[0,y,z]);
  for(const lane of [-1,0,1]){
   scute(anchor,"Rocantraz03_DorsalScute_"+i+"_"+lane,
    [lane*(.48+.03*Math.sin(i)),0,0],
    [lane===0?.52:.45,.21,.36],i%3===0?p.armorLight:i%3===1?p.armor:p.armorDark,
    [Math.PI*.40,lane*.1,-lane*.22]);
  }
  // silhouette spines are tapered and arise from the same ossified ridge.
  tube(anchor,"Rocantraz03_Spine_"+i,[
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
   ball(body,"Rocantraz03_Lichen_"+i,
    [side*(1.11+.04*Math.sin(i*4)),3.98-level*.24,
     -.18+.12*Math.cos(i*2.4)],
    [.085,.038,.10],p.lichen,1);
  }
 }
 return {body,secondary};
}
function buildLeg(body,side,p){
 const name=side<0?"Left":"Right";
 const hip=joint(body,"Rocantraz03_"+name+"Hip",
   [side*.83,2.53,-.30]);
 // Massive digitigrade thigh and heavy knee, proportionally correct for biped.
 surface(hip,"Rocantraz03_"+name+"MuscularThigh",[
  [.15,0,.01,.40,.42],[-.10,side*.02,.10,.56,.51],
  [-.40,side*.07,.26,.58,.53],[-.72,side*.11,.36,.46,.42],
  [-1.10,side*.10,.49,.33,.34],[-1.26,side*.09,.53,.24,.25]
 ],"y",p.hide,{segments:62,sides:34,
    gradient:[p.hideLight,p.hide]});
 ball(hip,"Rocantraz03_"+name+"Quadriceps",
  [side*.10,-.40,.30],[.47,.43,.42],p.shoulder,2);
 const knee=joint(hip,"Rocantraz03_"+name+"Knee",
   [side*.09,-1.22,.48]);
 ball(knee,"Rocantraz03_"+name+"KneePlate",
   [0,-.025,.17],[.32,.27,.29],p.armor,2);
 surface(knee,"Rocantraz03_"+name+"CalfAndAchilles",[
  [.09,0,.00,.28,.27],[-.19,0,-.075,.37,.34],
  [-.46,0,-.22,.34,.32],[-.75,0,-.36,.26,.26],
  [-.98,0,-.29,.19,.21]
 ],"y",p.hide,{segments:50,sides:28});
 ball(knee,"Rocantraz03_"+name+"Calf",
   [0,-.30,-.18],[.31,.37,.26],p.hideLight,2);
 for(let i=0;i<4;i++){
  scute(knee,"Rocantraz03_"+name+"ShinScute_"+i,
   [0,-.25-i*.19,.02-i*.042],
   [.19,.075,.20],i%2?p.armorDark:p.armor,
   [Math.PI*.46,0,0]);
 }
 const foot=joint(knee,"Rocantraz03_"+name+"Ankle",[0,-.97,-.28]);
 ball(foot,"Rocantraz03_"+name+"Heel",[0,.14,-.08],
  [.27,.20,.32],p.hide,2);
 surface(foot,"Rocantraz03_"+name+"BroadPlantarFoot",[
  [-.22,0,.14,.22,.16],[.01,0,.10,.33,.16],
  [.31,0,.085,.46,.16],[.63,0,.075,.47,.14],
  [.89,0,.05,.28,.11]
 ],"z",p.hide,{segments:53,sides:30});
 for(let t=0;t<4;t++){
  const x=(t-1.5)*.26;
  tube(foot,"Rocantraz03_"+name+"Toe_"+t,[
   [x*.63,.04,.58],[x,.025,.83],[x*1.12,-.03,1.09]
  ],[.145,.128,.080],p.hide,{steps:24,sides:11});
  tube(foot,"Rocantraz03_"+name+"Claw_"+t,[
   [x*1.12,-.025,1.00],[x*1.17,-.03,1.20],
   [x*1.19,-.18,1.48]
  ],[.10,.075,.004],p.fang,{steps:22,sides:9});
 }
 return {hip,knee,foot};
}
function buildArm(body,side,p){
 const name=side<0?"Left":"Right";
 const shoulder=joint(body,"Rocantraz03_"+name+"Shoulder",
   [side*1.33,4.16,.33]);
 // Separate shoulder, biceps, elbow, forearm, hand: arms are SMALLER than legs.
 surface(shoulder,"Rocantraz03_"+name+"Deltoid",[
  [.14,0,-.03,.35,.36],[-.14,side*.05,.06,.49,.45],
  [-.43,side*.15,.13,.46,.38],[-.75,side*.22,.23,.32,.30],
  [-.94,side*.23,.29,.22,.22]
 ],"y",p.hide,{segments:48,sides:30});
 ball(shoulder,"Rocantraz03_"+name+"Biceps",
   [side*.12,-.42,.25],[.34,.39,.31],p.shoulder,2);
 scute(shoulder,"Rocantraz03_"+name+"ShoulderShield",
  [side*.14,.13,-.24],[.56,.21,.49],p.armorLight,
  [Math.PI*.22,0,side*.30]);
 const elbow=joint(shoulder,"Rocantraz03_"+name+"Elbow",
   [side*.23,-.91,.29]);
 surface(elbow,"Rocantraz03_"+name+"Forearm",[
  [.12,0,0,.21,.20],[-.13,side*.04,.06,.28,.25],
  [-.39,side*.11,.15,.30,.26],[-.63,side*.11,.23,.23,.21],
  [-.75,side*.10,.27,.16,.15]
 ],"y",p.hide,{segments:38,sides:25});
 for(let k=0;k<3;k++){
  scute(elbow,"Rocantraz03_"+name+"ForearmArmor_"+k,
   [side*.12,-.16-k*.17,.33+k*.01],
   [.19,.085,.18],k%2?p.armor:p.armorDark,
   [Math.PI*.40,0,side*.10]);
 }
 const wrist=joint(elbow,"Rocantraz03_"+name+"Wrist",
   [side*.10,-.73,.28]);
 ball(wrist,"Rocantraz03_"+name+"Palm",
   [0,-.065,.10],[.29,.24,.32],p.hide,2);
 for(let k=0;k<3;k++){
  const x=(k-1)*.21;
  tube(wrist,"Rocantraz03_"+name+"Finger_"+k,[
   [x*.7,-.08,.18],[x,-.22,.37],[x*1.16,-.26,.54]
  ],[.10,.078,.065],p.hide,{steps:22,sides:10});
  tube(wrist,"Rocantraz03_"+name+"HandClaw_"+k,[
   [x*1.16,-.23,.50],[x*1.20,-.28,.68],[x*1.27,-.50,.83]
  ],[.079,.052,.004],p.fang,{steps:20,sides:9});
 }
 return {shoulder,elbow,wrist};
}
function buildHead(neck,p,variant){
 // Monster is explicitly BIPED, with forward-facing predatory head atop torso.
 const head=joint(neck,"Rocantraz03_Head",[0,.47,.51]);
 surface(head,"Rocantraz03_SolidCranium",[
  [-.58,0,.12,.41,.32],[-.30,0,.18,.62,.47],
  [.05,0,.20,.77,.54],[.35,0,.18,.82,.53],
  [.73,0,.09,.68,.44],[1.05,0,-.045,.58,.35],
  [1.38,0,-.13,.50,.25],[1.62,0,-.18,.43,.20],
  [1.77,0,-.21,.33,.15]
 ],"z",p.hide,{segments:91,sides:46,
   gradient:[p.hideLight,p.hide]});
 for(const side of [-1,1]){
  ball(head,"Rocantraz03_Masseter_"+side,
   [side*.48,-.12,.62],[.28,.38,.46],p.shoulder,3);
  ball(head,"Rocantraz03_OrbitalSocket_"+side,
   [side*.69,.24,.47],[.15,.14,.21],p.shade,2);
  ball(head,"Rocantraz03_Eye_"+side,
   [side*.795,.255,.48],[.058,.064,.091],p.eye,3);
  ball(head,"Rocantraz03_Pupil_"+side,
   [side*.83,.26,.49],[.026,.047,.052],p.shade,2);
  scute(head,"Rocantraz03_HeavyBrow_"+side,
   [side*.60,.45,.43],[.34,.11,.36],p.armor,
   [0,side*.28,-side*.39]);
  tube(head,"Rocantraz03_RamHorn_"+side,[
   [side*.58,.54,-.11],[side*.89,.72,-.30],
   [side*1.20,1.01,-.42],
   [side*(variant==="desert"?1.49:1.37),1.23,-.55],
   [side*(variant==="desert"?1.54:1.35),1.27,-.78]
  ],[.31,.28,.22,.12,.005],p.horn,{steps:56,sides:18,
    gradient:[p.hornBase,p.horn]});
  ball(head,"Rocantraz03_HornRoot_"+side,
   [side*.62,.54,-.12],[.29,.26,.29],p.hornBase,2);
  ball(head,"Rocantraz03_Nostril_"+side,
   [side*.35,-.12,1.63],[.078,.045,.036],p.shade,2);
 }
 // Forehead armored boss, frontal brow over snout.
 for(let k=0;k<3;k++){
  scute(head,"Rocantraz03_ForeheadPlate_"+k,
   [(k-1)*.30,.55,.19],[.27,.095,.27],
   k===1?p.armorLight:p.armor,[0,0,(k-1)*.10]);
 }
 const jaw=joint(head,"Rocantraz03_Jaw",[0,-.32,.23]);
 surface(jaw,"Rocantraz03_HeavyMandible",[
  [-.09,0,-.16,.34,.16],[.38,0,-.22,.48,.19],
  [.82,0,-.22,.46,.16],[1.19,0,-.20,.40,.12],
  [1.48,0,-.17,.30,.09]
 ],"z",p.under,{segments:61,sides:32});
 // Teeth fixed to upper skull and independently moving lower jaw.
 for(const side of [-1,1]){
  for(let i=0;i<9;i++){
   const z=.63+i*.125,w=.44-i*.015;
   tube(head,"Rocantraz03_UpperFang_"+side+"_"+i,[
    [side*w,-.25,z],[side*w,-.36,z+.035],
    [side*(w-.022),-.48-(i%3)*.035,z+.09]
   ],[.070,.060,.003],p.fang,{steps:11,sides:7});
  }
  for(let i=0;i<8;i++){
   const z=.40+i*.14,w=.40-i*.012;
   tube(jaw,"Rocantraz03_LowerFang_"+side+"_"+i,[
    [side*w,-.10,z],[side*w,-.005,z+.04],
    [side*(w-.020),.11+(i%3)*.025,z+.08]
   ],[.062,.055,.003],p.fang,{steps:11,sides:7});
  }
  tube(jaw,"Rocantraz03_OverbiteTusk_"+side,[
   [side*.43,-.15,.80],[side*.50,-.035,.95],
   [side*.48,.18,1.10]
  ],[.11,.075,.004],p.horn,{steps:22,sides:10});
 }
 return {head,jaw};
}
function buildTail(body,p){
 const segments=[];let parent=body;
 // Tail projects BACKWARD from hips: counterbalances broad head for true bipedal silhouette.
 for(let i=0;i<8;i++){
  const length=i<3?.77:.68;
  const root=joint(parent,"Rocantraz03_Tail"+i,
   [0,i===0?2.56:-.035,i===0?-.93:-.71]);
  const r=Math.max(.085,.76-i*.085);
  surface(root,"Rocantraz03_TailMuscle_"+i,[
   [-length-.10,0,-.055,r*.66,r*.59],
   [-length*.73,0,-.035,r*.88,r*.78],
   [-length*.39,0,.035,r,r*.87],
   [.07,0,.04,r*.85,r*.78]
  ],"z",p.hide,{segments:37,sides:24});
  if(i<6){
   scute(root,"Rocantraz03_TailOsteoderm_"+i,
    [0,r*.72,-length*.39],[r*.46,.10,r*.55],p.armor,
    [0,0,0]);
   tube(root,"Rocantraz03_TailSpine_"+i,[
    [0,r*.7,-length*.36],[0,r*.94,-length*.42],
    [0,r*1.55,-length*.58]
   ],[r*.20,r*.14,.005],p.spines,{steps:16,sides:9});
  }
  segments.push(root);parent=root;
 }
 tube(parent,"Rocantraz03_TailTerminalSpine",[
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
 const root=new THREE.Group();root.name="Wildhaven_Rocantraz_Biped_v03_"+variant;
 const {body,secondary}=buildBody(root,p);
 const neck=joint(body,"Rocantraz03_Neck",[0,4.37,.31]);
 surface(neck,"Rocantraz03_ThickNeck",[
  [-.20,0,.00,.56,.50],[.08,0,.14,.66,.60],
  [.36,0,.28,.58,.55],[.69,0,.43,.45,.43],
  [.91,0,.47,.32,.29]
 ],"y",p.hide,{segments:50,sides:34});
 for(const side of [-1,1])
  ball(neck,"Rocantraz03_NeckTendon_"+side,
   [side*.41,.21,.19],[.22,.44,.38],p.hideLight,2);
 const {head,jaw}=buildHead(neck,p,variant);
 const leftLeg=buildLeg(body,-1,p),rightLeg=buildLeg(body,1,p);
 const leftArm=buildArm(body,-1,p),rightArm=buildArm(body,1,p);
 const tail=buildTail(body,p);
 const rig={body,neck,head,jaw,legs:{left:leftLeg,right:rightLeg},
  arms:{left:leftArm,right:rightArm},tail,secondary,variant};
 root.userData.rig=rig;root.userData.species="rocantraz";
 root.userData.variant=variant;
 memorize(root);
 return root;
}
const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
function gait(rig,t,kind){
 const fast=kind==="run"||kind==="charge",sneak=kind==="stalk";
 const period=fast?.73:sneak?2.50:1.40;
 const phase=2*Math.PI*t/period,amplitude=fast?.59:sneak?.15:.34;
 const stride={
  left:Math.sin(phase),right:Math.sin(phase+Math.PI)
 };
 for(const side of ["left","right"]){
  const l=rig.legs[side],sw=stride[side],lift=Math.max(0,sw);
  l.hip.rotation.x=amplitude*sw;
  l.hip.rotation.z=(side==="left"?-1:1)*.022*sw;
  l.knee.rotation.x=.08+(fast?.69:sneak?.24:.42)*lift*lift;
  l.foot.rotation.x=-l.hip.rotation.x*.42-l.knee.rotation.x*.58;
 }
 rig.body.position.y=(fast?.075:sneak?.018:.038)*Math.cos(phase*2-.45)-
   (sneak?.21:0);
 rig.body.rotation.z=(fast?.036:.018)*Math.sin(phase-.38);
 rig.body.rotation.x=fast?.12:sneak?.18:.025*Math.sin(phase-.47);
 rig.neck.rotation.x=-.04+.034*Math.sin(phase-.58);
 rig.head.rotation.x=.024*Math.sin(phase-.82);
 rig.arms.left.shoulder.rotation.x=-stride.right*(fast?.31:.16)-.14;
 rig.arms.right.shoulder.rotation.x=-stride.left*(fast?.31:.16)-.14;
 rig.tail.forEach((joint,i)=>{
  joint.rotation.y=(fast?.12:.065)*Math.sin(phase*.58-i*.36);
  joint.rotation.x=.014+.024*Math.sin(phase*.50-i*.4);
 });
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
  r.body.position.y=.017*Math.sin(t*1.7);
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