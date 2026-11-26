import * as THREE from "three";
import {createArumbarV02,poseArumbarV02} from "./arumbar-highpoly-v02.mjs";
import {ANIMATIONS,DESIGN} from "./arumbar.mjs";

/**
 * Wildhaven Arumbar v03 — actual polygonal re-sculpt and keyframe rig.
 * Approved direction: armored bison, massive shoulders, lowered rump, short
 * bovine muzzle, integrated natural osteoderms, large hoofed limbs, dense mane.
 * Not a still image, billboard, texture replacement, or playable-game change.
 */
export {ANIMATIONS};
export const DESIGN_V03={
  ...DESIGN, version:"0.3.0", habitat:["savanna"],rarity:"rare",
  social:"predominantly solitary",gameIntegrated:false,
  targets:["shoulder-heavy body","short bovine skull","integrated armor",
    "anatomical limb joints","soft layered mane","graduated materials",
    "inertial locomotion and feeding motion"],
};
const COLORS={
  hide:0x844a33,sienna:0x98583c,rust:0xa45d3e,light:0xb37550,
  underside:0x593c31,shadow:0x3b2c28,hair:0x78372c,
  hairDark:0x542b29,hairLight:0xa44d34,black:0x211c1a,
  armor:0x8a7b68,armorLight:0xb3a18a,armorDark:0x62584d,
  hornBase:0x74685a,horn:0xcbb690,hornTip:0xe7d7b5,
  hoof:0x35302c,hoofBand:0x796b5b,eye:0xca9a50,
};
const materials=new Map();
function mat(color,vertexColors=false){
  const k=color+":"+vertexColors;
  if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({
    color,vertexColors,roughness:.92,metalness:0,flatShading:false,
    side:THREE.DoubleSide,
  }));
  return materials.get(k);
}
function createMesh(parent,name,geo,color=COLORS.hide,vertexColors=false){
  const m=new THREE.Mesh(geo,mat(color,vertexColors));
  m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function joint(parent,name,p){
  const o=new THREE.Group();o.name=name;o.position.set(...p);
  parent.add(o);return o;
}
function ellipsoid(parent,name,p,s,color,subdivision=2){
  const m=createMesh(parent,name,
    new THREE.IcosahedronGeometry(1,subdivision),color);
  m.position.set(...p);m.scale.set(...s);return m;
}
const mix=(a,b,t)=>a+(b-a)*t,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function catmull(a,b,c,d,t){
  return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
}
function sampled(control,steps){
  const samples=[];
  for(let q=0;q<=steps;q++){
    const idx=Math.min(control.length-2,Math.floor(q/steps*(control.length-1)));
    const t=Math.min(1,q/steps*(control.length-1)-idx);
    samples.push(control[0].map((_,j)=>catmull(
      control[Math.max(0,idx-1)][j],control[idx][j],
      control[idx+1][j],control[Math.min(control.length-1,idx+2)][j],t)));
  }
  return samples;
}
/**
 * Continuous anatomical skin loft along front-to-rear Z, with smooth normals,
 * genuine side, top and belly volume, and per-vertex color across body regions.
 */
function skinLoftZ(parent,name,control,opts={}){
  const ringCount=opts.rings??82,radial=opts.radial??44;
  const rows=sampled(control,ringCount),v=[],indices=[],colors=[];
  const cLight=new THREE.Color(COLORS.light),cMid=new THREE.Color(COLORS.hide);
  const cLower=new THREE.Color(COLORS.underside),
    cShoulder=new THREE.Color(COLORS.sienna);
  const colored=opts.colors!==false;
  for(let i=0;i<rows.length;i++){
    const [z,cy,rx,ry,cx=0]=rows[i];
    for(let j=0;j<radial;j++){
      const theta=j*Math.PI*2/radial;
      const co=Math.cos(theta),si=Math.sin(theta);
      // subtle true low-frequency shape irregularity (no sharp spikes)
      const undulation=1+.006*Math.sin(theta*7+i*.1)+.004*Math.cos(theta*13-i*.17);
      const x=cx+Math.max(.005,rx)*co*undulation;
      const y=cy+Math.max(.005,ry)*si*undulation;
      v.push(x,y,z);
      if(colored){
        const lower=clamp((.18-si)/1.2),front=clamp((z+.5)/2.6);
        const shoulder=clamp((z+.2)/1.3)*clamp((y-1.5)/1.8);
        const pigment=cMid.clone().lerp(cShoulder,shoulder*.44)
          .lerp(cLight,(1-lower)*.10+(Math.sin(theta*5+z*4)+1)*.015)
          .lerp(cLower,lower*.53);
        if(opts.head) pigment.lerp(cShoulder,.28);
        colors.push(pigment.r,pigment.g,pigment.b);
      }
    }
  }
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<radial;j++){
    const a=i*radial+j,b=i*radial+(j+1)%radial,c=(i+1)*radial+j,d=(i+1)*radial+(j+1)%radial;
    indices.push(a,c,b,b,c,d);
  }
  const n=v.length/3,front=rows[0],rear=rows.at(-1);
  v.push(front[4]??0,front[1],front[0],rear[4]??0,rear[1],rear[0]);
  if(colored){for(let k=0;k<2;k++)colors.push(cMid.r,cMid.g,cMid.b);}
  for(let j=0;j<radial;j++){
    const end=(rows.length-1)*radial;
    indices.push(n,j,(j+1)%radial,n+1,end+(j+1)%radial,end+j);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
  if(colored)g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices);g.computeVertexNormals();
  const out=createMesh(parent,name,g,colored?0xffffff:(opts.color??COLORS.hide),colored);
  return out;
}
function skinLoftY(parent,name,control,color,sideCount=26,steps=48){
  const rows=sampled(control,steps),v=[],idx=[];
  for(const [y,cx,cz,rx,rz] of rows){
    for(let k=0;k<sideCount;k++){
      const a=k*2*Math.PI/sideCount;
      v.push(cx+Math.max(.003,rx)*Math.cos(a),y,
        cz+Math.max(.003,rz)*Math.sin(a));
    }
  }
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<sideCount;j++){
    const a=i*sideCount+j,b=i*sideCount+(j+1)%sideCount,
      c=(i+1)*sideCount+j,d=(i+1)*sideCount+(j+1)%sideCount;
    idx.push(a,c,b,b,c,d);
  }
  const n=v.length/3,st=rows[0],en=rows.at(-1);
  v.push(st[1],st[0],st[2],en[1],en[0],en[2]);
  for(let j=0;j<sideCount;j++){
    const end=(rows.length-1)*sideCount;
    idx.push(n,(j+1)%sideCount,j,n+1,end+j,end+(j+1)%sideCount);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
  g.setIndex(idx);g.computeVertexNormals();
  return createMesh(parent,name,g,color);
}
function pathTube(parent,name,points,radii,color,segments=42,radial=12,gradient=null){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const v=[],ind=[],col=[];
  const from=new THREE.Color(gradient?.[0]??color),to=new THREE.Color(gradient?.[1]??color);
  for(let i=0;i<=segments;i++){
    const t=i/segments,p=curve.getPoint(t),
      tangent=curve.getTangent(t).normalize();
    const guide=Math.abs(tangent.y)<.9?
      new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
    const u=new THREE.Vector3().crossVectors(tangent,guide).normalize(),
      w=new THREE.Vector3().crossVectors(tangent,u).normalize();
    const ix=t*(radii.length-1),r=Math.min(radii.length-2,Math.floor(ix)),
      radius=mix(radii[r],radii[r+1],Math.min(1,ix-r));
    const pc=from.clone().lerp(to,t);
    for(let k=0;k<radial;k++){
      const a=k*2*Math.PI/radial;
      const pp=p.clone().addScaledVector(u,Math.cos(a)*radius)
        .addScaledVector(w,Math.sin(a)*radius);
      v.push(...pp.toArray());
      if(gradient)col.push(pc.r,pc.g,pc.b);
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<radial;j++){
    const a=i*radial+j,b=i*radial+(j+1)%radial,
      c=(i+1)*radial+j,d=(i+1)*radial+(j+1)%radial;
    ind.push(a,c,b,b,c,d);
  }
  const first=v.length/3;v.push(...points[0],...points.at(-1));
  if(gradient){for(let i=0;i<2;i++)col.push(from.r,from.g,from.b);}
  for(let k=0;k<radial;k++){
    const end=segments*radial;
    ind.push(first,(k+1)%radial,k,first+1,end+k,end+(k+1)%radial);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
  if(gradient)g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.setIndex(ind);g.computeVertexNormals();
  return createMesh(parent,name,g,gradient?0xffffff:color,!!gradient);
}
/** Flattened, closed and convex 3D scute; no detached outline or wire rim. */
function scute(parent,name,p,w,l,height,color,rotation=[0,0,0]){
  const segments=14,v=[],idx=[];
  const scales=[.57,1,.95,.16],levels=[-.07,-.02,height*.55,height];
  for(let layer=0;layer<scales.length;layer++){
    for(let j=0;j<segments;j++){
      const a=2*Math.PI*j/segments;
      const ripple=1+.045*Math.sin(a*5.5+layer*.25);
      v.push(Math.cos(a)*w*scales[layer]*ripple,
        levels[layer]+.012*Math.cos(3*a),
        Math.sin(a)*l*scales[layer]*ripple);
    }
  }
  for(let layer=0;layer<scales.length-1;layer++)
    for(let i=0;i<segments;i++){
      const a=layer*segments+i,b=layer*segments+(i+1)%segments,
        c=(layer+1)*segments+i,d=(layer+1)*segments+(i+1)%segments;
      idx.push(a,b,c,b,d,c);
    }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
  g.setIndex(idx);g.computeVertexNormals();
  const m=createMesh(parent,name,g,color);
  m.position.set(...p);m.rotation.set(...rotation);return m;
}
function removeOldAppearance(root){
  let n=0;
  root.traverse(o=>{
    if(o.isMesh){o.visible=false;n++;}
  });
  return n;
}
function profileAt(z){
  const rows=[
    [-2.16,1.74,.55,.54],[-1.84,1.78,.86,.75],
    [-1.30,1.83,1.00,.91],[-.70,1.93,1.10,1.01],
    [-.12,2.07,1.22,1.15],[.42,2.14,1.33,1.33],
    [.83,2.18,1.37,1.42],[1.23,2.19,1.20,1.24],
    [1.59,2.14,.80,.87],[1.85,2.07,.30,.34]
  ];
  for(let i=0;i<rows.length-1;i++){
    if(z<=rows[i+1][0]) {
      const t=clamp((z-rows[i][0])/(rows[i+1][0]-rows[i][0]));
      return [mix(rows[i][1],rows[i+1][1],t),
        mix(rows[i][2],rows[i+1][2],t),
        mix(rows[i][3],rows[i+1][3],t)];
    }
  }
  return rows.at(-1).slice(1);
}
function bodySculpt(rig,ext){
  const b=rig.body;
  const rows=[
    [-2.16,1.74,.55,.54],[-1.84,1.78,.86,.75],
    [-1.30,1.83,1.00,.91],[-.70,1.93,1.10,1.01],
    [-.12,2.07,1.22,1.15],[.42,2.14,1.33,1.33],
    [.83,2.18,1.37,1.42],[1.23,2.19,1.20,1.24],
    [1.59,2.14,.80,.87],[1.85,2.07,.30,.34]
  ];
  skinLoftZ(b,"ArumbarV03_OrganicShoulderHeavyTorso",rows,{rings:104,radial:54});
  // Trapezius and shoulder attachments have large masses, hips narrower/lower.
  for(const side of [-1,1]){
    ellipsoid(b,"ArumbarV03_Deltoid_"+side,
      [side*1.02,2.23,.81],[.43,.75,.70],COLORS.sienna,3);
    ellipsoid(b,"ArumbarV03_HipMuscle_"+side,
      [side*.76,1.81,-1.30],[.38,.60,.53],COLORS.hide,3);
    ellipsoid(b,"ArumbarV03_Pectoral_"+side,
      [side*.69,1.67,1.21],[.43,.49,.52],COLORS.sienna,2);
  }
  // Underside natural soft gradation; not floating belly spheres.
  skinLoftZ(b,"ArumbarV03_LowerRibcage",[
    [-1.36,1.44,.30,.18],[-.9,1.47,.58,.25],
    [-.4,1.45,.72,.28],[.32,1.48,.73,.30],
    [.88,1.54,.52,.21],[1.32,1.62,.23,.12]
  ],{rings:55,radial:30,color:COLORS.underside,colors:false});
  // Shield plates are conformal: curvature follows the cross-section of skin.
  // Five rows at the muscular shoulder, tapering to smaller caudal scales.
  let count=0;
  for(let iz=0;iz<9;iz++){
    const z=1.31-iz*.35,[cy,rx,ry]=profileAt(z);
    const factor=1-.060*Math.max(0,iz-3);
    for(const lane of [-1,0,1]){
      const x=lane*(rx*.47);
      const normalized=clamp(Math.abs(x)/rx,0,.95);
      const surfaceY=cy+ry*Math.sqrt(1-normalized*normalized);
      const y=surfaceY-.095;
      const w=(lane===0?.54:.47)*factor*(.92+.11*Math.sin(iz*1.7+lane));
      const l=(.355+.037*Math.sin(iz+lane*1.3))*factor;
      const angleZ=-Math.asin(Math.min(.94,x/rx))*.72;
      const hinge=joint(b,"ArumbarV03_ScuteHinge_"+(count++),[x,y,z]);
      const palette=(iz*2+lane+9)%6;
      scute(hinge,"ArumbarV03_IntegratedDorsalScute_"+iz+"_"+lane,
        [0,0,0],w,l,.093,
        palette===0?COLORS.armorLight:palette===1||palette===4?COLORS.armorDark:COLORS.armor,
        [0,.05*Math.sin(iz+lane),angleZ]);
      ext.scutes.push(hinge);
    }
  }
  // Large shield plates over the scapular mass, tapering toward the ribs.
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const z=1.05-i*.44;
    scute(b,"ArumbarV03_ShoulderShield_"+side+"_"+i,
      [side*(1.13-.045*i),2.84-.07*i,z],
      .45-.03*i,.47-.04*i,.11,
      i===0?COLORS.armorLight:COLORS.armor,
      [0,side*.13,-side*.85]);
  }
  // Lateral scale patches physically inset into the hide, no dangling chain.
  for(const side of [-1,1])for(let k=0;k<21;k++){
    const zz=1.27-Math.floor(k/3)*.39;
    const row=k%3;
    const [cy,rx,ry]=profileAt(zz);
    const x=side*rx*(.73+.05*row);
    const y=cy+ry*(.54-.12*row);
    const p=scute(b,"ArumbarV03_EmbeddedFlankScale_"+side+"_"+k,
      [x,y,zz+.045*row],.14+.03*(k%2),.18+.025*(k%3),.04,
      k%4?COLORS.armor:COLORS.armorDark,
      [0,side*.13,-side*.95]);
    p.scale.set(.93,.72,.95);
  }
}
function headSculpt(rig,ext){
  const neck=rig.neck,head=rig.head;
  // Integrated trapezius neck replaces disconnected primitive collar.
  skinLoftZ(neck,"ArumbarV03_DeepMuscularNeck",[
    [-.38,.04,.68,.60],[-.22,.07,.75,.72],
    [.12,.10,.71,.66],[.43,.09,.59,.55],
    [.76,.04,.47,.43],[1.05,.01,.29,.30]
  ],{rings:69,radial:42,colors:true});
  for(const side of [-1,1]){
    ellipsoid(neck,"ArumbarV03_NeckTendon_"+side,
      [side*.51,-.08,.30],[.24,.40,.52],COLORS.hide,2);
  }
  skinLoftZ(head,"ArumbarV03_BroadBisonSkull",[
    [-.48,.06,.39,.36],[-.25,.10,.53,.46],
    [.04,.09,.65,.49],[.30,.06,.69,.51],
    [.52,.005,.63,.46],[.73,-.07,.55,.37],
    [.94,-.14,.55,.32],[1.14,-.18,.57,.26],
    [1.29,-.20,.53,.19],[1.34,-.21,.38,.13]
  ],{rings:81,radial:48,head:true});
  // Wide blunt front is a continuous muzzle, not stacked round cylinders.
  skinLoftZ(head,"ArumbarV03_BovineNoseAndLips",[
    [.90,-.16,.43,.21],[1.03,-.19,.51,.21],
    [1.15,-.22,.55,.20],[1.27,-.25,.47,.14],
    [1.34,-.26,.32,.085]
  ],{rings:41,radial:40,colors:false,color:COLORS.sienna});
  for(const side of [-1,1]){
    ellipsoid(head,"ArumbarV03_JawMuscle_"+side,
      [side*.41,-.14,.49],[.26,.34,.37],COLORS.sienna,3);
    ellipsoid(head,"ArumbarV03_EyeRidge_"+side,
      [side*.61,.22,.26],[.13,.14,.21],COLORS.hide,3);
    ellipsoid(head,"ArumbarV03_Socket_"+side,
      [side*.69,.14,.38],[.095,.096,.10],COLORS.shadow,2);
    ellipsoid(head,"ArumbarV03_AmberEye_"+side,
      [side*.77,.14,.39],[.046,.05,.061],COLORS.eye,3);
    ellipsoid(head,"ArumbarV03_Pupil_"+side,
      [side*.797,.14,.40],[.023,.034,.029],COLORS.black,2);
    ellipsoid(head,"ArumbarV03_Nostril_"+side,
      [side*.40,-.19,1.28],[.115,.066,.036],COLORS.black,3);
    ellipsoid(head,"ArumbarV03_NostrilRim_"+side,
      [side*.40,-.13,1.255],[.14,.039,.069],COLORS.underside,2);
    const ear=joint(head,"ArumbarV03_EarJoint_"+side,[side*.64,.15,-.27]);
    ellipsoid(ear,"ArumbarV03_EarOuter_"+side,
      [side*.19,.03,-.02],[.25,.13,.24],COLORS.hide,3);
    ellipsoid(ear,"ArumbarV03_EarInner_"+side,
      [side*.22,.067,-.005],[.19,.042,.15],COLORS.hairDark,2);
    ext.ears.push(ear);
    pathTube(head,"ArumbarV03_SingleOrganicHorn_"+side,[
      [side*.50,.45,-.13],[side*.78,.55,-.17],
      [side*1.05,.69,-.20],[side*1.32,.89,-.12],
      [side*1.52,1.00,.04],[side*1.57,1.03,.24],
      [side*1.47,.99,.48],[side*1.30,.98,.63],
      [side*1.23,1.08,.79]
    ],[.29,.33,.29,.23,.17,.11,.061,.029,.004],
    COLORS.horn,72,18,[COLORS.hornBase,COLORS.hornTip]);
    ellipsoid(head,"ArumbarV03_HornBoss_"+side,
      [side*.59,.45,-.14],[.34,.23,.31],COLORS.hornBase,2);
    for(let i=0;i<4;i++){
      const z=-.07+i*.16;
      scute(head,"ArumbarV03_BrowArmoredRidge_"+side+"_"+i,
        [side*(.34+i*.065),.45-i*.012,z],.13,.16,.06,
        i%2?COLORS.armorLight:COLORS.armor,
        [0,side*.05,-side*.28]);
    }
  }
  const jaw=rig.jaw;
  skinLoftZ(jaw,"ArumbarV03_ContinuousLowerJaw",[
    [-.12,-.09,.28,.11],[.26,-.14,.39,.15],
    [.66,-.14,.43,.14],[1.05,-.17,.44,.11],
    [1.28,-.17,.36,.075]
  ],{rings:42,radial:32,color:COLORS.underside,colors:false});
  // Low beard fused by masses of hair, not sharp bristles.
  ellipsoid(jaw,"ArumbarV03_ChinFurMass",
    [0,-.21,.61],[.31,.15,.34],COLORS.hairDark,2);
}
function maneSculpt(rig,ext){
  const neck=rig.neck,body=rig.body;
  const hairColors=[COLORS.hair,COLORS.hairDark,COLORS.hairLight];
  for(const side of [-1,1]){
    const ruff=joint(neck,"ArumbarV03_ManeRuff_"+side,[side*.42,.04,.04]);
    ext.ruffs.push(ruff);
    ellipsoid(ruff,"ArumbarV03_RuffRoot_"+side,
      [side*.31,-.06,.20],[.44,.55,.66],COLORS.hairDark,3);
    // Asymmetric swept hair masses: broad, long, overlapping tapered locks.
    for(let row=0;row<5;row++)for(let col=0;col<7;col++){
      const v=col/6,stagger=(row%2)*.055;
      const z=-.34+row*.255+stagger;
      const x=side*(.17+.57*v);
      const y=.35-.125*row+.12*Math.sin(v*Math.PI);
      const length=.38+.12*((row+col*3)%4)/3;
      pathTube(ruff,"ArumbarV03_RuffTuft_"+side+"_"+row+"_"+col,
        [[x,y,z],[x+side*.085,y-.13,z+.09],
        [x+side*.13,y-.27,z+.18+length*.17],
        [x+side*.15,y-.39,z+.27+length*.34]],
        [.155,.185,.135,.018],hairColors[(row+2*col)%3],18,9);
    }
  }
  // Massive beard/chest ruff extends under chin to chest, follows breathing body.
  ellipsoid(body,"ArumbarV03_FrontManeMass",
    [0,1.77,1.52],[.67,.61,.46],COLORS.hair,3);
  for(let i=0;i<32;i++){
    const side=i%2?-1:1,ring=Math.floor(i/8),col=i%8;
    const x=side*(.10+.11*col),y=2.15-ring*.17,z=1.36+ring*.065;
    pathTube(body,"ArumbarV03_ChestMane_"+i,[
      [x,y,z],[x+side*.05,y-.17,z+.10],
      [x+side*.075,y-.34,z+.23]
    ],[.13,.16,.017],i%5?COLORS.hairDark:COLORS.hairLight,15,9);
  }
}
function legsSculpt(rig){
  for(const [name,leg] of Object.entries(rig.legs)){
    const hind=name.startsWith("back"),side=name.endsWith("L")?-1:1;
    const {upper,knee,ankle}=leg;
    const frontWidth=hind?.41:.51;
    // Massive shoulder and thigh bulges; narrowing mid-metapodial.
    skinLoftY(upper,"ArumbarV03_"+name+"_ShoulderThigh",[
      [.21,0,-.01,frontWidth*.6,.36],[.01,0,-.02,frontWidth,.45],
      [-.25,side*.04,-.045,frontWidth*1.03,.52],
      [-.48,side*.06,hind?-.18:.05,frontWidth*.85,.36],
      [-.72,side*.06,hind?-.16:.12,frontWidth*.57,.28],
      [-.92,side*.06,hind?-.10:.12,frontWidth*.45,.23]
    ],COLORS.hide,34,61);
    ellipsoid(upper,"ArumbarV03_"+name+"_Muscle",
      [side*.06,-.33,hind?-.12:0],
      [frontWidth*.82,.44,.42],hind?COLORS.sienna:COLORS.rust,3);
    // Defined but not exaggerated knee/hock, regular natural tendon.
    skinLoftY(knee,"ArumbarV03_"+name+"_HockShin",[
      [.16,0,-.04,.25,.26],[-.06,0,0,.28,.29],
      [-.27,0,hind?-.075:.07,.24,.23],
      [-.53,0,hind?.06:.12,.19,.18],
      [-.82,0,.16,.16,.17]
    ],COLORS.hide,30,52);
    ellipsoid(knee,"ArumbarV03_"+name+"_KneeCap",
      [0,-.03,.16],[.19,.16,.16],COLORS.sienna,2);
    skinLoftY(ankle,"ArumbarV03_"+name+"_Fetlock",[
      [.18,0,0,.16,.14],[.075,0,.08,.21,.19],
      [-.03,0,.15,.26,.22],[-.16,0,.22,.29,.26]
    ],COLORS.underside,26,32);
    // Real cloven hoof, thick keratin rim + two forward toe segments.
    for(const t of [-1,1]){
      skinLoftZ(ankle,"ArumbarV03_"+name+"_Hoof_"+t,[
        [-.07,-.07,.13,.08,t*.16],
        [.14,-.08,.18,.105,t*.16],
        [.33,-.09,.185,.115,t*.16],
        [.53,-.12,.16,.095,t*.16],
        [.67,-.13,.08,.05,t*.16]
      ],{rings:35,radial:20,colors:false,color:COLORS.hoof});
      ellipsoid(ankle,"ArumbarV03_"+name+"_KeratinBand_"+t,
        [t*.17,-.085,.42],[.15,.038,.16],COLORS.hoofBand,2);
    }
  }
}
function tailSculpt(rig){
  for(let i=0;i<rig.tail.length;i++){
    const pivot=rig.tail[i];
    pathTube(pivot,"ArumbarV03_TailMuscle_"+i,
      [[0,.04,.08],[0,-.04,-.15],[0,-.08,-.40]],
      [.23-i*.029,.17-i*.023,.095-i*.01],
      COLORS.hide,22,12);
  }
  const tassel=rig.tassel;
  ellipsoid(tassel,"ArumbarV03_TailTuftCore",
    [0,-.02,-.27],[.15,.15,.30],COLORS.hairDark,2);
  for(let i=0;i<20;i++){
    const a=i*2.39996,rad=.07+.08*(i%5)/4,
      x=Math.sin(a)*rad,y=Math.cos(a)*rad;
    pathTube(tassel,"ArumbarV03_TailTuft_"+i,
      [[x,y,-.18],[x*1.14,y-.04,-.41],[x*1.10,y-.07,-.65]],
      [.046,.06,.006],i%4?COLORS.hairDark:COLORS.hair,10,7);
  }
}
const cache=new WeakMap();
function visibleStats(root){
  let meshes=0,triangles=0;
  root.traverse(o=>{
    if(!o.isMesh||!o.visible)return;
    meshes++;
    triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
  });
  return {visibleMeshes:meshes,triangles:Math.round(triangles)};
}
export function createArumbarV03(){
  const root=createArumbarV02(),rig=root.userData.rig;
  const hidden=removeOldAppearance(root),ext={scutes:[],ruffs:[],ears:[]};
  bodySculpt(rig,ext);headSculpt(rig,ext);maneSculpt(rig,ext);
  legsSculpt(rig);tailSculpt(rig);
  root.name="Arumbar_Anatomy_v03";
  root.userData.geometryRevision="v03 organic biomechanical sculpt";
  cache.set(root,{rig,ext,hidden,geometry:visibleStats(root)});
  return root;
}
/**
 * Reset v02 pose first and then apply mass-inertial gait. New scute, mane
 * and ear joints are animated separately; each clip is baked into the GLB.
 */
export function poseArumbarV03(root,action,time){
  const data=cache.get(root);if(!data)throw Error("No Arumbar v03 rig");
  if(!ANIMATIONS.includes(action))throw Error("Unknown clip "+action);
  const r=data.rig,t=Math.max(0,time);
  poseArumbarV02(root,action,t);
  // Four-beat walk, diagonal suspension run, and delayed body mass.
  if(action==="walk"||action==="run"||action==="charge"){
    const run=action!=="walk",period=run?.85:1.75,
      ph=2*Math.PI*t/period;
    const phases=run?{frontL:0,frontR:Math.PI,backL:Math.PI,backR:0}:
      {frontL:0,frontR:Math.PI,backL:Math.PI*1.5,backR:Math.PI*.5};
    for(const [label,leg] of Object.entries(r.legs)){
      const a=ph+phases[label],swing=Math.sin(a),lift=Math.max(0,Math.sin(a+.15));
      leg.upper.rotation.x=(run?.44:.27)*swing;
      leg.knee.rotation.x=.08+(run?.42:.24)*lift*lift;
      leg.ankle.rotation.x=-leg.upper.rotation.x*.45-leg.knee.rotation.x*.38;
      leg.upper.rotation.z=(label.endsWith("L")?-1:1)*.012*Math.sin(a);
    }
    r.body.position.y=(run?.061:.024)*Math.cos(ph*2-.20);
    r.body.rotation.z=(run?.029:.017)*Math.sin(ph-.48);
    r.body.rotation.x=(run?.041:.019)*Math.cos(ph-.38);
    r.neck.rotation.x+=(run?-.055:-.015)+.024*Math.sin(ph-.64);
    r.head.rotation.x+=.033*Math.sin(ph-.90);
    r.tail.forEach((joint,i)=>joint.rotation.y=.10*Math.sin(ph*.67-.43-i*.24));
    if(action==="charge"){r.neck.rotation.x-=.11;r.head.rotation.x-=.14;}
  }
  if(action==="idle"){
    r.body.position.y=.011*Math.sin(t*1.35);
    r.neck.rotation.x+=.014*Math.sin(t*.8-.34);
    r.head.rotation.y+=.028*Math.sin(t*.52);
    r.jaw.rotation.x=.008*Math.sin(t*1.3);
  }
  // A closed-looking, heavy resting jaw; chewing still opens the hinge.
  r.jaw.position.y+=.12;
  if(action==="graze"||action==="drink"){
    const k=clamp(t/.78)*clamp((3.1-t)/.63);
    // Shift neck forward and lower the skull before pitching: the muzzle
    // reaches the actual grass/water rather than rotating into the chest.
    r.neck.position.z+=.31*k;
    r.neck.position.y-=.30*k;
    r.head.position.z+=.14*k;
    r.head.position.y-=.08*k;
    r.neck.rotation.x+=(action==="graze"?.11:.15)*k;
    r.head.rotation.x+=(action==="graze"?.16:.19)*k;
    r.legs.frontL.upper.rotation.x=-.075*k;
    r.legs.frontR.upper.rotation.x=-.075*k;
    r.jaw.rotation.x+=(action==="graze"?.055*Math.sin(t*8.2):
      .020*Math.sin(t*5.2))*k;
    r.body.rotation.x=-.022*k;
  }
  if(action==="alert"){
    r.neck.rotation.x-=.08*clamp(t/.4);
    r.head.rotation.y+=.075*Math.sin(t*.91);
  }
  if(action==="death"){
    const f=clamp(t/1.65);
    r.neck.rotation.x+=.10*f;
    r.body.rotation.z+=.08*f;
  }
  for(let i=0;i<data.ext.scutes.length;i++){
    const x=data.ext.scutes[i];
    x.rotation.set(action==="charge"?.013*Math.sin(t*13-i*.17):0,
      0,action==="run"?.012*Math.sin(t*8.3-i*.24):0);
  }
  for(let i=0;i<data.ext.ruffs.length;i++){
    const x=data.ext.ruffs[i];
    x.rotation.set((action==="run"||action==="charge"?.045:.017)*
      Math.sin(t*(action==="run"?7.3:1.5)-i*.4),0,
      .014*Math.sin(t*1.3+i));
  }
  for(let i=0;i<data.ext.ears.length;i++){
    const e=data.ext.ears[i];
    e.rotation.set(0,(action==="alert"?.18:.045)*Math.sin(t*1.2+i),0);
  }
}
export function arumbarV03Bones(root){
  const names=[];
  root.traverse(o=>{if(o!==root&&o instanceof THREE.Group&&o.name)names.push(o);});
  return names;
}
export function arumbarV03Clips(root){
  const bones=arumbarV03Bones(root),result=[];
  const durations={idle:2.45,walk:1.75,run:.85,graze:3.1,
    drink:3.0,alert:2.3,charge:.85,death:1.65};
  for(const name of ANIMATIONS){
    const duration=durations[name],times=[],data=new Map();
    for(const node of bones)data.set(node.name,{pos:[],quat:[],scale:[]});
    for(let i=0;i<=64;i++){
      const t=duration*i/64;times.push(t);
      poseArumbarV03(root,name,t);
      for(const node of bones){
        const d=data.get(node.name);
        d.pos.push(...node.position.toArray());
        d.quat.push(...node.quaternion.toArray());
        d.scale.push(...node.scale.toArray());
      }
    }
    const tracks=[];
    for(const node of bones){
      const d=data.get(node.name);
      tracks.push(new THREE.VectorKeyframeTrack(node.name+".position",times,d.pos));
      tracks.push(new THREE.QuaternionKeyframeTrack(node.name+".quaternion",times,d.quat));
      tracks.push(new THREE.VectorKeyframeTrack(node.name+".scale",times,d.scale));
    }
    result.push(new THREE.AnimationClip(name,duration,tracks));
  }
  poseArumbarV03(root,"idle",0);
  return result;
}
export function arumbarV03Stats(root){
  const c=cache.get(root);
  if(!c)throw Error("Not an Arumbar v03");
  return {geometry:visibleStats(root),hiddenEarlierMeshInstances:c.hidden,
    jointCount:arumbarV03Bones(root).length,
    secondaryJointCount:c.ext.scutes.length+c.ext.ruffs.length+c.ext.ears.length,
    details:{armorScutes:c.ext.scutes.length,ruffJoints:c.ext.ruffs.length,
      independentlyAnimatedEars:c.ext.ears.length}};
}