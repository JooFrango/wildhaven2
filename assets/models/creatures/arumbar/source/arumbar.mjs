import * as THREE from "three";

/** Wildhaven — Arumbar v0.1. Original physically present mid-poly geometry.
 * Solitary savanna megaherbivore. +Z forward, Y up, meters, ground at Y=0.
 * The model is independently exportable; nothing from game/alpha01 is imported.
 */
export const ANIMATIONS=["idle","walk","run","graze","drink","alert","charge","death"];
export const DESIGN={
  id:"arumbar",name:"Arumbar — Titã das Savanas",habitat:["savanna"],
  rarity:"rare",social:"predominantly solitary",
  adultLengthM:5.2,shoulderHeightM:2.8,massKgTarget:3500,
  capPopulationPerSuitable5kmHex:2,habitatHexOccupancyTarget:[0.15,0.25],
  chanceSolitaryAdult:0.85,
  note:"Targets for future ecological balancing; no live spawn has been implemented.",
};
const baseGeometry={
  ico:new THREE.IcosahedronGeometry(1,2),
  low:new THREE.IcosahedronGeometry(1,1),
  shard:new THREE.ConeGeometry(1,1,7),
  dodeca:new THREE.DodecahedronGeometry(1),
};
const materialCache=new Map();
function mat(hex,roughness=.93){
  const key=hex+":"+roughness;
  if(!materialCache.has(key))materialCache.set(key,
    new THREE.MeshStandardMaterial({
      color:hex,flatShading:true,roughness,metalness:.015,side:THREE.DoubleSide,
    }));
  return materialCache.get(key);
}
function part(parent,type,color,p,s,rotation=[0,0,0]){
  const m=new THREE.Mesh(baseGeometry[type],mat(color));
  m.position.set(...p);m.scale.set(...s);m.rotation.set(...rotation);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function joint(parent,name,at){
  const o=new THREE.Group();o.name=name;o.position.set(...at);parent.add(o);return o;
}
function spike(parent,color,a,b,width){
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b);
  const d=vb.clone().sub(va),length=d.length();
  const m=part(parent,"shard",color,va.clone().addScaledVector(d,.5).toArray(),[width,length,width*.78]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  return m;
}
/** Polygonal curved organic solids; each ring has its own radius, no picture/billboard. */
function sculptTube(parent,name,control,radii,color,sides=12){
  if(control.length!==radii.length)throw Error("tube rings mismatch: "+name);
  const points=control.map(p=>new THREE.Vector3(...p));
  const vertices=[],indices=[];
  for(let i=0;i<points.length;i++){
    const dir=points[Math.min(i+1,points.length-1)].clone()
      .sub(points[Math.max(0,i-1)]).normalize();
    const axis=Math.abs(dir.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
    const v=new THREE.Vector3().crossVectors(dir,axis).normalize();
    const w=new THREE.Vector3().crossVectors(dir,v).normalize();
    for(let j=0;j<sides;j++){
      const ang=2*Math.PI*j/sides;
      const p=points[i].clone().addScaledVector(v,Math.cos(ang)*radii[i])
        .addScaledVector(w,Math.sin(ang)*radii[i]);
      vertices.push(p.x,p.y,p.z);
    }
  }
  for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,b=i*sides+(j+1)%sides,
      c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;
    indices.push(a,b,c,b,d,c);
  }
  const start=vertices.length/3;
  vertices.push(...control[0],...control[control.length-1]);
  for(let j=0;j<sides;j++){
    indices.push(start,(j+1)%sides,j);
    const k=(points.length-1)*sides;
    indices.push(start+1,k+j,k+(j+1)%sides);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat(color));
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
  parent.add(mesh);return mesh;
}
function loftZ(parent,name,rings,color,sides=16){
  const v=[],ind=[];
  for(const [z,cx,cy,rx,ry] of rings){
    for(let j=0;j<sides;j++){
      const a=j*Math.PI*2/sides;
      v.push(cx+rx*Math.cos(a),cy+ry*Math.sin(a),z);
    }
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,b=i*sides+(j+1)%sides,
      c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;
    ind.push(a,c,b,b,c,d);
  }
  const first=v.length/3,last=first+1;
  v.push(rings[0][1],rings[0][2],rings[0][0]);
  const r=rings[rings.length-1];v.push(r[1],r[2],r[0]);
  for(let j=0;j<sides;j++){
    ind.push(first,j,(j+1)%sides);
    const k=(rings.length-1)*sides;
    ind.push(last,k+(j+1)%sides,k+j);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
  geo.setIndex(ind);geo.computeVertexNormals();
  const o=new THREE.Mesh(geo,mat(color));
  o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o;
}
// Palette matches the approved ochre, deep russet, stone armor and red mane.
const C={
  hide:0x884e33,hideLight:0xae6d46,muscle:0x96593a,
  belly:0x65402e,shadow:0x402d26,bone:0xc7ad87,
  hoof:0x3b3330,hoofLight:0x756356,armor:0x8d7865,
  armorDark:0x63574f,armorLight:0xb4a08a,
  mane:0x8d3826,maneBright:0xc65d34,maneDeep:0x572a24,
  marking:0xd9c7a7,horn:0xd1bd93,hornShadow:0x82735e,
  eye:0xedb95e,black:0x231f1b,tail:0x5b332b,
};
function makeLeg(body,label,side,isFront){
  // All rig joints have true local rotation pivots; hooves may compensate stride.
  const x=side*(isFront?.91:.77);
  const z=isFront?.96:-1.18;
  const upperY=isFront?1.83:1.78;
  const upper=joint(body,label+"_ShoulderOrHip",[x,upperY,z]);
  const thick=isFront?.43:.49;
  sculptTube(upper,label+"_Upper",[[0,.14,0],[side*.05,-.30,.00],
    [side*.06,-.70,isFront?.07:-.13],
    [side*.07,-.91,isFront?.13:.06]],
    [thick*.78,thick,thick*.79,thick*.59],C.muscle,10);
  part(upper,"ico",C.hideLight,[side*.12,-.34,-.04],
    [thick*.90,thick*1.08,thick*.84],[0,0,side*.10]);
  part(upper,"low",C.hide,[side*.14,-.73,.10],[thick*.68,thick*.68,thick*.65]);
  const knee=joint(upper,label+"_Knee",[side*.07,-.91,isFront?.13:.06]);
  part(knee,"ico",C.hideLight,[0,-.05,.05],[thick*.70,thick*.67,thick*.73]);
  sculptTube(knee,label+"_Shin",[[0,.03,0],[0,-.20,.04],
    [0,-.50,.12],[0,-.78,.16]],
    [thick*.57,thick*.58,thick*.46,thick*.32],C.hide,10);
  part(knee,"low",C.armorDark,[0,-.29,.27],[thick*.40,thick*.24,thick*.20]);
  // First joint at foot contact changes pitch, not leg length.
  const ankle=joint(knee,label+"_Ankle",[0,-.82,.17]);
  part(ankle,"ico",C.hide,[0,.08,.14],[thick*.70,.22,thick*.85]);
  // Two toes and a visible central notch, rhino/bison style.
  for(const toe of [-1,1]){
    const px=toe*.195;
    loftZ(ankle,label+"_Hoof_"+toe,[
      [.04,px,.06,.19,.145],
      [.30,px,.045,.205,.135],
      [.53,px,-.035,.19,.10],
      [.67,px,-.045,.15,.09],
    ],C.hoof,10);
    part(ankle,"low",C.hoofLight,[px,.07,.43],[.13,.04,.18]);
  }
  part(ankle,"low",C.shadow,[0,-.045,.45],[.05,.06,.27]);
  for(let i=0;i<3;i++){
    part(upper,"low",i===0?C.hideLight:C.hide,
      [side*.16,-.35-i*.16,.31+i*.01],[.11,.10,.10]);
  }
  return {upper,knee,ankle};
}
function makeHorn(head,side){
  // Curved ram-like horns arch outward, upward, slightly forward.
  // Tapered solid polygon tube with 3D rims, not a rotated cone.
  const points=[
    [side*.44,.40,.05],
    [side*.68,.52,.00],
    [side*.96,.70,-.07],
    [side*1.27,.99,-.09],
    [side*1.53,1.17,.02],
    [side*1.72,1.19,.22],
    [side*1.79,1.09,.41],
    [side*1.75,1.01,.58],
    [side*1.68,1.03,.76],
    [side*1.65,1.14,.92],
  ];
  sculptTube(head,"Arumbar_ArchHorn_"+side,points,
    [.275,.31,.31,.26,.205,.15,.11,.075,.044,.008],C.horn,11);
  // Raised segmented growth rings at the base.
  for(let i=0;i<4;i++){
    const p=points[i];
    part(head,"low",i%2?C.hornShadow:C.horn,
      [p[0],p[1],p[2]],[.23-i*.016,.07,.19-i*.015],
      [0,0,side*(.25+i*.22)]);
  }
  part(head,"ico",C.armorDark,[side*.51,.44,-.12],[.34,.19,.33]);
}
function buildHead(neck){
  const head=joint(neck,"Arumbar_Head",[0,.15,.49]);
  // Approved concept: stocky bison muzzle, broad cheeks and short forehead.
  head.scale.set(1.12,1.03,.77);
  // Large wedge skull with armored eyebrow and protruding muscular nose.
  loftZ(head,"Arumbar_Skull",[
    [-.40,0,0,.49,.43],
    [-.18,0,.04,.59,.54],
    [.16,0,.07,.65,.51],
    [.48,0,.015,.53,.40],
    [.83,0,-.10,.44,.29],
    [1.22,0,-.19,.46,.28],
    [1.47,0,-.22,.50,.24],
    [1.62,0,-.23,.49,.18],
  ],C.hide,15);
  // Face mask: irregular stone-looking osteoderms.
  const plates=[
    [-.28,.47,-.24,.23,.13,.29], [.02,.53,-.21,.28,.15,.25],
    [.32,.45,-.22,.22,.13,.27],[-.36,.34,.24,.17,.11,.27],
    [.34,.34,.23,.17,.10,.27],[0,.30,.49,.33,.12,.28],
  ];
  for(let i=0;i<plates.length;i++){
    const [x,y,z,rx,ry,rz]=plates[i];
    part(head,"low",i%2?C.armor:C.armorLight,[x,y,z],
      [rx,ry,rz],[.04,.07*(i%3),.05*(i-2)]);
  }
  for(const side of [-1,1]){
    // Deep sockets under the brow, amber eyes with dark central pupil.
    part(head,"low",C.shadow,[side*.56,.085,.41],[.14,.16,.23]);
    part(head,"ico",C.eye,[side*.650,.13,.43],[.047,.053,.068]);
    part(head,"low",C.black,[side*.702,.12,.46],[.020,.031,.037]);
    part(head,"low",C.armor,[side*.57,.30,.33],[.20,.095,.32]);
    // Thick ear attached behind base of each horn.
    part(head,"ico",C.hide,[side*.66,.20,-.22],[.21,.13,.35],
      [0,side*.26,side*.15]);
    part(head,"low",C.belly,[side*.76,.23,-.23],[.11,.042,.19]);
    part(head,"low",C.shadow,[side*.32,-.18,1.49],[.10,.052,.079]);
    makeHorn(head,side);
  }
  const jaw=joint(head,"Arumbar_Jaw",[0,-.36,.34]);
  loftZ(jaw,"Arumbar_LowerJaw",[
    [-.04,0,-.09,.39,.15],[.40,0,-.19,.42,.16],
    [.88,0,-.15,.41,.12],[1.24,0,-.13,.43,.11],
  ],C.belly,12);
  // Bristles and tuft on chin.
  for(let i=0;i<15;i++){
    const a=(i-7)/7;
    spike(jaw,i%3?C.maneDeep:C.mane,[a*.20,-.17,.62+(i%4)*.08],
      [a*.28,-.39-(i%3)*.09,.68+(i%4)*.14],.056);
  }
  // Tiny nose grooves and lip corners.
  for(const side of [-1,1]){
    part(head,"low",C.shadow,[side*.45,-.35,1.29],[.042,.06,.14]);
  }
  return {head,jaw};
}
function armor(body){
  // Overlapping mid-poly slabs along shoulders and back, visually articulate.
  for(let row=0;row<9;row++){
    const z=1.12-row*.34;
    const shoulder=row<4;
    const y=(shoulder?3.01:2.83)-.06*Math.max(0,row-3);
    const spread=shoulder?1.00-(row*.018):.91-(row-4)*.04;
    const center=part(body,"low",row%2?C.armor:C.armorLight,
      [0,y+.05,z],[.71-(row*.029),.15,.29],[.02,0,(row%2?.03:-.02)]);
    for(const side of [-1,1]){
      part(body,"low",row%3?C.armor:C.armorDark,
        [side*spread,y-.18,z-.035],
        [.46-(row*.009),.245,.385],
        [side*.08,side*.12,side*.28]);
      // Lighter chipped plate edges represent actual geometry, not textures.
      part(body,"low",C.armorLight,
        [side*(spread+.12),y-.135,z-.18],[.24,.062,.20]);
    }
    if(row%2===0)part(body,"low",C.armorDark,[0,y+.11,z-.09],
      [.17,.034,.14]);
  }
}
function mane(body){
  // Neck ruff built with dark base mass and many directional pointed clumps.
  const colors=[C.mane,C.maneBright,C.maneDeep,C.hideLight];
  for(const side of [-1,1]){
    part(body,"ico",C.mane,[side*.95,2.47,.84],[.38,.58,.72]);
    for(let i=0;i<28;i++){
      const row=Math.floor(i/7),col=i%7;
      const z=1.47-row*.23+col*.028;
      const y=2.91-row*.20+(col%3)*.08;
      const x=side*(.45+(col/6)*.78);
      spike(body,colors[(i+row)%colors.length],[x,y,z],
        [x+side*(.12+(.08*(col%2))),y-(.22+.09*(i%3)),z+.14],.10+(i%3)*.018);
    }
  }
  // Tall uneven ridge across top of hump.
  for(let i=0;i<29;i++){
    const side=i%2?-1:1,ang=i*2.399;
    const z=1.55-(i%15)*.17, x=side*(.15+(i%4)*.11);
    const y=3.26-(i%8)*.034;
    spike(body,colors[i%4],[x,y,z],
      [x+Math.sin(ang)*.12,y+.18+(i%5)*.075,z-.06],.085);
  }
  for(let i=0;i<16;i++){
    const z=1.27-(i%8)*.16, side=i%2?-1:1;
    part(body,"low",C.marking,[side*1.16,2.43+(i%4)*.12,z],
      [.035,.13,.11],[0,0,side*.35]);
  }
}
function makeBody(){
  const root=new THREE.Group();root.name="Wildhaven_Arumbar_v01";
  const body=joint(root,"Arumbar_Body",[0,0,0]);
  // Continuous silhouette from compact rear into massive high shoulder hump.
  loftZ(body,"Arumbar_Torso",[
    [-2.01,0,1.78,.52,.54],
    [-1.82,0,1.80,.83,.79],
    [-1.43,0,1.87,1.07,.91],
    [-.92,0,1.93,1.15,1.01],
    [-.35,0,1.99,1.23,1.09],
    [.20,0,2.10,1.31,1.20],
    [.66,0,2.24,1.35,1.29],
    [1.07,0,2.27,1.23,1.21],
    [1.45,0,2.22,.92,.90],
    [1.66,0,2.18,.55,.61],
  ],C.hide,20);
  part(body,"ico",C.belly,[0,1.35,.40],[.92,.31,1.19]);
  // Huge high muscular shoulder barrel.
  part(body,"ico",C.hideLight,[0,2.35,.76],[1.24,1.02,1.06]);
  part(body,"ico",C.muscle,[0,2.77,.45],[1.04,.54,.91]);
  part(body,"ico",C.hide,[0,2.18,-.88],[1.06,.77,.79]);
  for(const side of [-1,1]){
    // Signature pale savanna chevron on flanks.
    for(let i=0;i<4;i++){
      const z=-.95+i*.17;
      part(body,"low",C.marking,[side*(1.04+i*.045),2.10-i*.065,z],
        [.045,.085,.15],[0,0,side*(-.25+i*.1)]);
    }
    part(body,"ico",C.hideLight,[side*.96,1.88,.72],[.42,.52,.80]);
  }
  armor(body);mane(body);
  const neck=joint(body,"Arumbar_Neck",[0,2.31,1.42]);
  sculptTube(neck,"Arumbar_NeckMuscle",
    [[0,-.06,-.24],[0,.12,.17],[0,.19,.57],[0,.16,.92]],
    [.78,.71,.59,.50],C.hide,14);
  part(neck,"low",C.armorDark,[0,.52,.16],[.56,.27,.51]);
  // Armor down both neck sides.
  for(const side of [-1,1])for(let i=0;i<4;i++){
    part(neck,"low",i%2?C.armor:C.armorLight,
      [side*(.55-i*.05),.27-i*.06,-.02+i*.24],
      [.22,.19,.24],[0,side*.15,side*.18]);
  }
  const {head,jaw}=buildHead(neck);
  const legs={
    frontL:makeLeg(body,"Arumbar_FrontLeft",-1,true),
    frontR:makeLeg(body,"Arumbar_FrontRight",1,true),
    backL:makeLeg(body,"Arumbar_BackLeft",-1,false),
    backR:makeLeg(body,"Arumbar_BackRight",1,false),
  };
  const tail=[];
  let parent=body;
  for(let i=0;i<5;i++){
    const t=joint(parent,"Arumbar_Tail"+i,
      [0,i===0?1.87:-.02,i===0?-1.91:-.42]);
    const radius=.23-i*.036;
    sculptTube(t,"Arumbar_TailMesh"+i,
      [[0,0,.08],[0,-.05,-.19],[0,-.09,-.47]],
      [radius,radius*.90,Math.max(.045,radius*.62)],i%2?C.hide:C.tail,10);
    tail.push(t);parent=t;
  }
  const tassel=joint(parent,"Arumbar_Tassel",[0,-.07,-.39]);
  part(tassel,"ico",C.maneDeep,[0,-.02,-.23],[.23,.19,.41]);
  for(let i=0;i<12;i++){
    const a=2*Math.PI*i/12,xx=Math.cos(a)*.12,yy=Math.sin(a)*.12;
    spike(tassel,i%3?C.maneDeep:C.mane,[xx,yy,-.32],
      [xx*1.65,yy*1.2-.11,-.70-(i%3)*.08],.052);
  }
  const rig={body,neck,head,jaw,legs,tail,tassel};
  root.userData.assetId="arumbar";
  root.userData.rig=rig;
  root.userData.selectedAnimation="idle";
  return root;
}
const rests=new WeakMap();
function recordRest(root){
  root.traverse(o=>{
    if(o!==root&&o instanceof THREE.Group)rests.set(o,{
      position:o.position.clone(),rotation:o.rotation.clone(),
      quaternion:o.quaternion.clone(),scale:o.scale.clone(),
    });
  });
}
function reset(root){
  root.traverse(o=>{
    if(o===root||!(o instanceof THREE.Group))return;
    const p=rests.get(o);
    if(p){o.position.copy(p.position);o.quaternion.copy(p.quaternion);o.scale.copy(p.scale);}
  });
}
export function createArumbar(){
  const m=makeBody();recordRest(m);return m;
}
const clipDurations={
 idle:2.4,walk:1.72,run:.84,graze:3.1,
 drink:3.0,alert:2.3,charge:.82,death:1.65,
};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
/** Joints are sampled into real glTF transform animation channels. */
export function poseArumbar(root,animation,t){
  const rig=root.userData.rig;
  if(!rig)throw Error("Arumbar rig missing");
  if(!ANIMATIONS.includes(animation))throw Error("Unknown Arumbar animation "+animation);
  reset(root);
  const {body,neck,head,jaw,legs,tail,tassel}=rig;
  const run=animation==="run"||animation==="charge";
  const walk=animation==="walk",moving=run||walk;
  const strideTime=run?.84:1.72;
  const phase=2*Math.PI*t/strideTime;
  const angle=run?.52:.34;
  const limbNames=["frontL","backR","frontR","backL"];
  if(moving){
    // Trot with diagonally opposed pairs, planted hoof compensation,
    // deliberate upper-body mass lag and delayed tail swing.
    for(let i=0;i<limbNames.length;i++){
      const l=legs[limbNames[i]],p=phase+(i<2?0:Math.PI);
      const swing=Math.sin(p),lift=Math.max(0,swing);
      l.upper.rotation.x=angle*swing;
      l.knee.rotation.x=.11+(run?.73:.47)*lift*lift;
      l.ankle.rotation.x=-l.upper.rotation.x*.38-l.knee.rotation.x*.52;
      l.upper.rotation.z=(i%2?-.02:.02)*Math.sin(p);
    }
    const bob=(run?.085:.045)*Math.cos(phase*2);
    body.position.y=bob;
    body.rotation.x=run?.075:.024*Math.cos(phase);
    body.rotation.z=(run?.045:.020)*Math.sin(phase);
    neck.rotation.x=run?-.12:-.035*Math.sin(phase);
    head.rotation.x=(run?-.065:-.028)*Math.sin(phase+.3);
    head.rotation.y=.019*Math.sin(phase);
    tail.forEach((seg,i)=>{seg.rotation.y=(run?.14:.072)*Math.sin(phase*.67-i*.35);});
  }
  if(animation==="idle"){
    const breath=Math.sin(t*2.1);
    body.position.y=.013*breath;
    neck.rotation.x=.018*Math.sin(t*1.18);
    head.rotation.y=.06*Math.sin(t*.72);
    jaw.rotation.x=.017*Math.sin(t*1.1);
    tail.forEach((seg,i)=>seg.rotation.y=.027*Math.sin(t*.8-i*.35));
  }
  if(animation==="graze"||animation==="drink"){
    // Whole neck and skull bend to the ground; front knee adds stability.
    const lower=smooth(t/.65);
    const lift=1-smooth((t-2.45)/.55);
    const blend=lower*lift;
    neck.rotation.x=(animation==="graze"?.66:.86)*blend;
    head.rotation.x=(animation==="graze"?.72:.98)*blend;
    head.rotation.z=.027*Math.sin(t*2)*blend;
    legs.frontL.knee.rotation.x=.15*blend;
    legs.frontR.knee.rotation.x=.15*blend;
    jaw.rotation.x=animation==="graze"?.13+.13*Math.sin(t*12)*blend:
      .07+.11*Math.sin(t*4.6)*blend;
    body.position.y=-.065*blend;
    tail.forEach((seg,i)=>seg.rotation.y=.035*Math.sin(t*.74-i*.4));
  }
  if(animation==="alert"){
    const lift=smooth(t/.35)*(.98-.13*smooth((t-1.9)/.35));
    neck.rotation.x=-.22*lift;
    head.rotation.x=-.16*lift;
    head.rotation.y=.18*Math.sin(t*1.2)*lift;
    body.rotation.y=.02*Math.sin(t*.9);
    jaw.rotation.x=.024*lift;
  }
  if(animation==="charge"){
    neck.rotation.x=-.22+.055*Math.sin(phase);
    head.rotation.x=-.19;
    body.rotation.x=.095+.048*Math.sin(phase);
  }
  if(animation==="death"){
    const fall=smooth(t/1.65);
    const slow=smooth((t-.12)/1.1);
    body.position.y=-.92*fall;
    body.rotation.z=.83*fall;
    body.rotation.x=.17*fall;
    neck.rotation.x=.48*slow;
    head.rotation.x=.36*slow;
    head.rotation.y=-.28*fall;
    jaw.rotation.x=.17*slow;
    legs.frontL.upper.rotation.x=-.65*fall;
    legs.frontR.upper.rotation.x=-.23*fall;
    legs.backL.upper.rotation.x=.57*fall;
    legs.backR.upper.rotation.x=.33*fall;
    for(const l of Object.values(legs)){
      l.knee.rotation.x=.48*fall;
      l.ankle.rotation.x=-.22*fall;
    }
    tail.forEach((seg,i)=>{seg.rotation.y=(i%2?-.16:.14)*fall;seg.rotation.x=.09*fall;});
  }
  if(!moving&&animation!=="death")tail.forEach((seg,i)=>{
    seg.rotation.y+=.014*Math.sin(t*.7-i*.48);
  });
  tassel.rotation.y=.08*Math.sin(t*.9-1.3);
}
export function arumbarBones(root){
  const nodes=[];
  root.traverse(o=>{if(o!==root&&o instanceof THREE.Group&&o.name)nodes.push(o);});
  return nodes;
}
export function arumbarClips(root){
  const bones=arumbarBones(root),output=[];
  for(const action of ANIMATIONS){
    const duration=clipDurations[action],frames=49;
    const times=[],data=new Map();
    bones.forEach(b=>data.set(b.name,{pos:[],quat:[],scale:[]}));
    for(let i=0;i<frames;i++){
      const t=duration*i/(frames-1);times.push(t);poseArumbar(root,action,t);
      for(const b of bones){
        const item=data.get(b.name);
        item.pos.push(...b.position.toArray());
        item.quat.push(...b.quaternion.toArray());
        item.scale.push(...b.scale.toArray());
      }
    }
    const tracks=[];
    for(const b of bones){
      const d=data.get(b.name);
      tracks.push(new THREE.VectorKeyframeTrack(b.name+".position",times,d.pos));
      tracks.push(new THREE.QuaternionKeyframeTrack(b.name+".quaternion",times,d.quat));
      tracks.push(new THREE.VectorKeyframeTrack(b.name+".scale",times,d.scale));
    }
    output.push(new THREE.AnimationClip(action,duration,tracks));
  }
  poseArumbar(root,"idle",0);
  return output;
}
