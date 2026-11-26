import * as THREE from "three";
import {createArumbar,poseArumbar,ANIMATIONS,DESIGN} from "./arumbar.mjs";
export {ANIMATIONS};

/**
 * Arumbar v02 — resculpt of the approved armored savanna-bison.
 * 100% real 3D geometry, not a texture, image plane or a render illusion.
 * Uses the proven 22-bone quadruped rig; replaces every visible v01 primitive
 * with continuous organic surface lofts, broad scutes, muscles, horns and fur.
 * New joints add overlapping armor and flowing mane motion.
 * No dependencies on game/alpha01.
 */
export const DESIGN_V02={
  ...DESIGN,version:"0.2",habitat:["savanna"],social:"predominantly solitary",
  renderProfile:"high-poly stylized 3D; selectively tessellated curves",
  purpose:"asset review only; never spawn or alter the playable Alpha",
};
const C={
  ochre:0x95593e,sienna:0xa96947,terracotta:0xb36c46,
  chestnut:0x754635,amber:0xbc8558,
  underbelly:0x513b31,shadow:0x392d29,
  plate:0x8c7b68,plateLight:0xb0a18b,plateDark:0x5b544c,
  plateEdge:0xd0bca0,scar:0xc9ab87,
  mane:0x76362c,maneBright:0x9e4932,maneDark:0x4d2928,
  hoof:0x393634,hoofEdge:0x756859,
  horn:0xd6c29d,hornBase:0x887967,hornTip:0xe6d8b7,
  eye:0xc6a05c,pupil:0x221d1b,nostril:0x211c1b,
};
const smoothMat=new Map();
function material(hex,rough=.91){
  const k=hex+":"+rough;
  if(!smoothMat.has(k))smoothMat.set(k,new THREE.MeshStandardMaterial({
    color:hex,roughness:rough,metalness:0,flatShading:false,
    side:THREE.DoubleSide,
  }));
  return smoothMat.get(k);
}
function add(parent,geo,hex,name){
  const o=new THREE.Mesh(geo,material(hex));o.name=name;
  o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function ball(parent,name,xyz,radii,hex,sub=3){
  const o=add(parent,new THREE.IcosahedronGeometry(1,sub),hex,name);
  o.position.set(...xyz);o.scale.set(...radii);return o;
}
function j(parent,name,xyz){
  const node=new THREE.Group();node.name=name;node.position.set(...xyz);
  parent.add(node);return node;
}
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
function hermite(a,b,c,d,u){
  return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u);
}
function smoothedRows(rows,steps=80){
  const data=[];
  const segments=rows.length-1;
  for(let q=0;q<=steps;q++){
    const t=q/steps*segments;
    const i=Math.min(segments-1,Math.floor(t)),u=Math.min(1,t-i);
    data.push(rows[0].map((_,k)=>hermite(
      rows[Math.max(0,i-1)][k],rows[i][k],rows[i+1][k],
      rows[Math.min(rows.length-1,i+2)][k],u)));
  }
  return data;
}
function loftZ(parent,name,rings,color,sides=40,steps=82,noise=0){
  const samples=smoothedRows(rings,steps),verts=[],idx=[];
  for(let i=0;i<samples.length;i++){
    const [z,cx,cy,rx,ry]=samples[i];
    for(let k=0;k<sides;k++){
      const ang=k*2*Math.PI/sides;
      const irregular=1+noise*(.53*Math.sin(ang*9+i*.12)+.22*Math.sin(ang*17-i*.10));
      verts.push(cx+Math.cos(ang)*Math.max(.001,rx)*irregular,
        cy+Math.sin(ang)*Math.max(.001,ry)*irregular,z);
    }
  }
  for(let i=0;i<samples.length-1;i++)for(let k=0;k<sides;k++){
    const a=i*sides+k,b=i*sides+(k+1)%sides,c=(i+1)*sides+k,d=(i+1)*sides+(k+1)%sides;
    idx.push(a,b,c,b,d,c);
  }
  // Polygon caps prevent open slices and shading leaks.
  const n=verts.length/3;
  verts.push(...[samples[0][1],samples[0][2],samples[0][0]],
    ...[samples.at(-1)[1],samples.at(-1)[2],samples.at(-1)[0]]);
  for(let k=0;k<sides;k++){
    const last=(samples.length-1)*sides;
    idx.push(n,k,(k+1)%sides,n+1,last+(k+1)%sides,last+k);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(idx);geo.computeVertexNormals();
  return add(parent,geo,color,name);
}
function loftY(parent,name,rings,color,sides=28,steps=32){
  const samples=smoothedRows(rings,steps),verts=[],idx=[];
  for(const [y,cx,cz,rx,rz] of samples){
    for(let k=0;k<sides;k++){
      const a=k*Math.PI*2/sides;
      verts.push(cx+Math.cos(a)*Math.max(.01,rx),y,
        cz+Math.sin(a)*Math.max(.01,rz));
    }
  }
  for(let i=0;i<samples.length-1;i++)for(let k=0;k<sides;k++){
    const a=i*sides+k,b=i*sides+(k+1)%sides,
      c=(i+1)*sides+k,d=(i+1)*sides+(k+1)%sides;
    idx.push(a,c,b,b,c,d);
  }
  const end=verts.length/3;
  verts.push(samples[0][1],samples[0][0],samples[0][2]);
  const q=samples.at(-1);verts.push(q[1],q[0],q[2]);
  for(let k=0;k<sides;k++){
    const last=(samples.length-1)*sides;
    idx.push(end,(k+1)%sides,k,end+1,last+k,last+(k+1)%sides);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(idx);geo.computeVertexNormals();
  return add(parent,geo,color,name);
}
function tube(parent,name,points,radii,hex,steps=54,sides=18){
  const curves=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const verts=[],idx=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps,p=curves.getPoint(t),tan=curves.getTangent(t).normalize();
    const up=Math.abs(tan.y)<.93?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
    const u=new THREE.Vector3().crossVectors(tan,up).normalize();
    const v=new THREE.Vector3().crossVectors(tan,u).normalize();
    const z=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(z));
    const r=lerp(radii[k],radii[k+1],Math.min(1,z-k));
    for(let j=0;j<sides;j++){
      const a=j*2*Math.PI/sides;
      const n=p.clone().addScaledVector(u,Math.cos(a)*r)
        .addScaledVector(v,Math.sin(a)*r);
      verts.push(...n.toArray());
    }
  }
  for(let i=0;i<steps;i++)for(let k=0;k<sides;k++){
    const a=i*sides+k,b=i*sides+(k+1)%sides,
      c=(i+1)*sides+k,d=(i+1)*sides+(k+1)%sides;
    idx.push(a,c,b,b,c,d);
  }
  const n=verts.length/3;
  verts.push(...points[0],...points.at(-1));
  for(let k=0;k<sides;k++){
    const m=steps*sides;
    idx.push(n,(k+1)%sides,k,n+1,m+k,m+(k+1)%sides);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  g.setIndex(idx);g.computeVertexNormals();
  return add(parent,g,hex,name);
}
function plate(parent,name,xyz,w,l,h,hex,rot=[0,0,0]){
  // Broad convex osteoderm with bevel, thickness, and central ridge.
  const sides=12,vertices=[],idx=[];
  const ringRadii=[.71,1,.93,.10];
  const heights=[-.055,-.018,h*.44,h];
  for(let ring=0;ring<ringRadii.length;ring++){
    const factor=ringRadii[ring];
    for(let i=0;i<sides;i++){
      const theta=(i+.05*Math.sin(i*3+ring))*Math.PI*2/sides;
      const edge=1+.075*Math.sin(theta*5+ring*.5)+.045*Math.cos(theta*9);
      const x=Math.cos(theta)*w*factor*edge;
      const z=Math.sin(theta)*l*factor*edge;
      vertices.push(x,heights[ring]+.009*Math.sin(theta*3),z);
    }
  }
  for(let ring=0;ring<ringRadii.length-1;ring++)
    for(let k=0;k<sides;k++){
      const a=ring*sides+k,b=ring*sides+(k+1)%sides,
        c=(ring+1)*sides+k,d=(ring+1)*sides+(k+1)%sides;
      idx.push(a,b,c,b,d,c);
    }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(idx);g.computeVertexNormals();
  const p=add(parent,g,hex,name);
  p.position.set(...xyz);p.rotation.set(...rot);
  // The multi-ring beveled shell itself is the rim; avoid wire-like outlines.
  // This is genuine solid geometry, not a highlight texture.
  return p;
}
function fur(parent,name,start,end,radius,hex){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),
    middle=a.clone().lerp(b,.54);
  middle.x+=.07*Math.sin(start[2]*6+start[0]*2.1);
  middle.y+=.02*Math.cos(start[2]*8);
  const pts=[a.toArray(),middle.toArray(),b.toArray()];
  return tube(parent,name,pts,[radius,radius*.72,.006],hex,9,7);
}
function hideOldMeshes(o){
  for(const child of o.children)if(child.isMesh)child.visible=false;
}
function sculptTorso(rig,secondary){
  const body=rig.body;hideOldMeshes(body);
  // Continuous high-resolution body replaces the disconnected v01 blocks.
  loftZ(body,"v02_ContinuousTorso",[
    [-2.06,0,1.79,.32,.36],[-1.89,0,1.84,.69,.65],
    [-1.58,0,1.87,.92,.81],[-1.16,0,1.91,1.02,.95],
    [-.60,0,1.97,1.12,1.03],[-.08,0,2.10,1.27,1.13],
    [.46,0,2.19,1.36,1.21],[.86,0,2.24,1.33,1.22],
    [1.27,0,2.22,1.17,1.08],[1.53,0,2.19,.93,.88],
    [1.74,0,2.13,.42,.48]
  ],C.ochre,48,112,.004);
  // Scapular hump now a broad muscular organ rather than a sphere.
  loftZ(body,"v02_IntegratedShoulderHump",[
    [-.63,0,2.56,.38,.31],[-.34,0,2.63,.79,.61],
    [.11,0,2.68,1.04,.78],[.54,0,2.70,1.09,.83],
    [1.02,0,2.58,1.02,.79],[1.38,0,2.51,.70,.62],
    [1.58,0,2.38,.38,.35]
  ],C.sienna,38,85,.002);
  loftZ(body,"v02_Abdomen",[
    [-1.42,0,1.42,.26,.18],[-.90,0,1.42,.70,.32],
    [-.28,0,1.44,.87,.34],[.41,0,1.45,.84,.34],
    [1.16,0,1.48,.44,.19]
  ],C.chestnut,30,46);
  for(const side of [-1,1]){
    // True haunches merge into trunk and provide powerful hind legs.
    ball(body,"v02_Haunch_"+side,[side*.79,1.91,-1.37],
      [.46,.66,.57],C.ochre,3);
    ball(body,"v02_Pectoral_"+side,[side*.97,2.10,.91],
      [.46,.69,.62],C.sienna,3);
    // Gradual short muscle ridges on flanks and subtle pale scar patterns.
    for(let i=0;i<6;i++){
      const z=1.15-i*.45;
      ball(body,"v02_FlankMuscle_"+side+"_"+i,
        [side*(1.09-(i%3)*.045),1.75+.09*Math.sin(i*1.3),z],
        [.10,.24,.37],i%3?C.terracotta:C.sienna,2);
    }
    for(let n=0;n<4;n++){
      const z=-.75+n*.19;
      ball(body,"v02_Scar_"+side+"_"+n,
        [side*(1.08+n*.028),2.15-n*.10,z],
        [.016,.044,.14],C.scar,1);
    }
  }
  // Large mutually overlapping articulated armor, following upper body.
  for(let row=0;row<9;row++){
    const z=1.20-row*.39;
    const crest=3.37-.045*Math.max(0,row-3);
    for(let col=-1;col<=1;col++){
      const x=col*.68,yy=crest-.16*Math.abs(col);
      const piece=plate(body,"v02_DorsalScute_"+row+"_"+col,
        [x,yy,z],col===0?.42:.45,.33,.105,
        (row+col)%4===0?C.plateLight:(row+col)%3===0?C.plateDark:C.plate,
        [col*.06,0,-col*.25]);
      if(row<5&&(Math.abs(col)===1||row%2===0)){
        const hinge=j(body,"ArumbarV02_ArmorJoint_"+row+"_"+col,
          [x,yy-.11,z]);
        piece.position.set(0,.11,0);
        hinge.add(piece);
        secondary.armor.push(hinge);
      }
    }
    for(const side of [-1,1]){
      // Shoulder scutes are broad shields, not detached pebble chains.
      const x=side*(1.13-.015*row);
      const y=2.70-.035*row;
      plate(body,"v02_FlankArmor_"+row+"_"+side,
        [x,y,z-.08],.40,.33,.10,
        row%3===0?C.plateLight:C.plate,
        [0,side*.12,side*.63]);
      if(row<5)plate(body,"v02_ArmorLip_"+row+"_"+side,
        [side*(1.23-.025*row),y-.25,z-.09],
        .24,.27,.055,C.plateDark,[.04,side*.14,side*1.2]);
    }
  }
}
function sculptNeck(rig,secondary){
  const neck=rig.neck;hideOldMeshes(neck);
  loftZ(neck,"v02_ImmenseNeck",[
    [-.37,0,.10,.72,.72],[-.20,0,.11,.76,.77],
    [.07,0,.13,.72,.71],[.37,0,.18,.61,.60],
    [.70,0,.18,.51,.46],[1.01,0,.12,.37,.38]
  ],C.ochre,40,76,.003);
  loftZ(neck,"v02_Jugular",[
    [-.25,0,-.25,.32,.20],[.19,0,-.33,.47,.26],
    [.63,0,-.27,.35,.19],[.91,0,-.18,.13,.09]
  ],C.chestnut,32,52);
  for(let side of [-1,1])for(let i=0;i<5;i++){
    plate(neck,"v02_NeckScute_"+side+"_"+i,
      [side*(.62-i*.045),.40-i*.05,i*.23],
      .23,.22,.075,i%2?C.plate:C.plateLight,
      [0,side*.11,side*.90]);
  }
  // Heavy two-level mane with broad fluid clumps instead of spikes.
  const furColors=[C.mane,C.maneDark,C.maneBright,C.chestnut];
  for(let side of [-1,1]){
    const ruff=j(neck,"ArumbarV02_Ruff_"+side,[side*.46,.21,.08]);
    secondary.ruff.push(ruff);
    ball(ruff,"v02_RuffBase",[side*.34,.18,.12],
      [.33,.43,.64],C.mane,2);
    for(let n=0;n<68;n++){
      const row=Math.floor(n/17),col=n%17,
        v=col/16,a=(v-.5)*2.1;
      const x=side*(.17+.59*v),z=-.24+row*.29+.11*Math.sin(a*3);
      const y=.43+Math.sin(v*Math.PI)*.19-row*.09;
      const length=.30+.13*((n*7)%6)/5;
      fur(ruff,"v02_NeckLock_"+side+"_"+n,
        [x,y,z],[x+side*(.045+.035*v),y-.20-length*.18,z+.085+length*.18],
        .078+((n%3)*.009),furColors[(n+row)%furColors.length]);
    }
  }
  for(let n=0;n<56;n++){
    const a=n*2.3999;
    const x=.74*Math.cos(a),z=-.58+(n%22)*.092,
      y=.33+.19*Math.max(0,1-Math.abs(x));
    fur(neck,"v02_ManeUpper_"+n,[x,y,z],
      [x*1.06,y+.08+((n%5)*.016),z-.06],
      .075,n%4?C.mane:C.maneBright);
  }
}
function sculptHead(rig,secondary){
  const head=rig.head;hideOldMeshes(head);
  // A short wide bovine skull, major cheek muscles and true blunt muzzle.
  loftZ(head,"v02_BroadBovineSkull",[
    [-.47,0,.08,.40,.36],[-.24,0,.12,.56,.46],
    [.05,0,.12,.63,.52],[.35,0,.06,.65,.49],
    [.66,0,-.04,.57,.40],[.94,0,-.17,.56,.33],
    [1.21,0,-.25,.59,.29],[1.43,0,-.25,.58,.23],
    [1.52,0,-.26,.46,.16]
  ],C.ochre,40,88,.005);
  loftZ(head,"v02_BroadNoseLeather",[
    [1.06,0,-.19,.41,.17],[1.28,0,-.18,.51,.19],
    [1.49,0,-.19,.54,.18],[1.62,0,-.23,.45,.12]
  ],C.chestnut,40,42,.004);
  ball(head,"v02_NoseTop",[0,-.105,1.33],
    [.47,.115,.24],C.sienna,3);
  for(const side of [-1,1]){
    // Cheek/jowl joins neck and skull. Rounded orbit does not bulge cartoonishly.
    ball(head,"v02_Cheek_"+side,[side*.44,-.15,.48],
      [.25,.33,.42],C.sienna,3);
    ball(head,"v02_Temple_"+side,[side*.52,.22,.16],
      [.20,.26,.31],C.ochre,3);
    // Layered eyelids over restrained amber eye.
    ball(head,"v02_EyeSocket_"+side,[side*.61,.17,.43],
      [.11,.095,.13],C.shadow,2);
    ball(head,"v02_EyeAmber_"+side,[side*.693,.18,.45],
      [.048,.055,.064],C.eye,3);
    ball(head,"v02_Pupil_"+side,[side*.734,.175,.463],
      [.019,.034,.032],C.pupil,2);
    plate(head,"v02_BrowPlating_"+side,
      [side*.55,.31,.39],.29,.25,.08,
      C.plateLight,[0,side*.3,-side*.43]);
    ball(head,"v02_Nostril_"+side,[side*.43,-.19,1.54],
      [.11,.065,.028],C.nostril,2);
    ball(head,"v02_NostrilRim_"+side,[side*.43,-.13,1.49],
      [.12,.035,.07],C.chestnut,2);
    // Ears have actual cartilage, inner dark cavity and secondary swivel joint.
    const ear=j(head,"ArumbarV02_Ear_"+side,[side*.63,.23,-.28]);
    secondary.ears.push(ear);
    ball(ear,"v02_EarOuter_"+side,[side*.21,.035,-.07],
      [.30,.11,.21],C.ochre,3);
    ball(ear,"v02_EarInner_"+side,[side*.26,.075,-.065],
      [.23,.039,.13],C.maneDark,2);
    // A thick, shorter curved ram/bison horn replaces the v01 horn silhouette.
    const p=[
      [side*.51,.49,-.12],[side*.75,.52,-.17],
      [side*1.03,.67,-.24],[side*1.31,.84,-.20],
      [side*1.53,.97,-.01],[side*1.57,1.02,.20],
      [side*1.52,.96,.43],[side*1.39,.91,.58],
      [side*1.22,.97,.70],[side*1.13,1.13,.77]
    ];
    tube(head,"v02_Horn_"+side,p,
      [.27,.31,.29,.24,.18,.13,.09,.054,.029,.004],
      C.horn,82,22);
    ball(head,"v02_HornBoss_"+side,[side*.60,.48,-.16],
      [.36,.30,.34],C.hornBase,2);
    // Base growth rings follow the first natural curve segments.
    for(let k=0;k<6;k++){
      const q=p[k];
      ball(head,"v02_HornRidge_"+side+"_"+k,[q[0],q[1],q[2]],
        [.24-k*.025,.066,.19-k*.012],
        k%3?C.hornBase:C.horn,1);
    }
  }
  // Broad forehead crown plates rather than tiny triangular spikes.
  for(let i=0;i<5;i++){
    plate(head,"v02_ForeheadScute_"+i,
      [(i-2)*.23,.51-i%2*.03,.38],
      .19,.28,.07,i%2?C.plate:C.plateLight,[0,0,(i-2)*.13]);
  }
  const jaw=rig.jaw;hideOldMeshes(jaw);
  loftZ(jaw,"v02_LowerHeavyJaw",[
    [-.20,0,-.03,.30,.13],[.25,0,-.18,.43,.16],
    [.72,0,-.15,.48,.13],[1.18,0,-.14,.43,.10],
    [1.40,0,-.13,.32,.065]
  ],C.chestnut,34,66);
  ball(jaw,"v02_Chin",[0,-.23,.83],[.33,.13,.32],C.maneDark,2);
  for(let n=0;n<14;n++){
    const side=n%2?-1:1;
    const x=side*(.045+(n%7)*.039),z=.45+(n%9)*.10;
    fur(jaw,"v02_ChinFur_"+n,[x,-.22,z],
      [x*1.07,-.32-(n%3)*.025,z+.08],
      .045,n%3?C.maneDark:C.mane);
  }
  // Neck and jaw inherited pivots still animate with original 8 clips.
}
function sculptLeg(rig){
  // Replace the 4 limbs using high polygon lofts, retaining all 12 real joints.
  for(const [label,leg] of Object.entries(rig.legs)){
    const fore=label.startsWith("front"),side=label.endsWith("L")?-1:1;
    const {upper,knee,ankle}=leg;
    [upper,knee,ankle].forEach(hideOldMeshes);
    const wide=fore?.45:.48;
    loftY(upper,"v02_"+label+"_Upper",[
      [.17,0,0,.29,.33],[.02,0,.00,wide,.41],
      [-.26,side*.035,-.02,wide*1.08,.48],
      [-.49,side*.07,-.03,wide*.88,.36],
      [-.72,side*.07,.09,.31,.29],
      [-.91,side*.07,.13,.26,.27]
    ],C.ochre,32,50);
    ball(upper,"v02_"+label+"_Deltoid",
      [side*.08,-.25,-.045],[.40,.48,.44],fore?C.sienna:C.ochre,3);
    ball(upper,"v02_"+label+"_MuscleFascia",
      [side*.08,-.57,.16],[.25,.32,.23],C.terracotta,3);
    loftY(knee,"v02_"+label+"_KneeShape",[
      [.12,0,-.02,.26,.25],[-.05,0,.02,.28,.27],
      [-.23,0,.04,.26,.24],[-.54,0,.09,.19,.19],
      [-.82,0,.17,.18,.17]
    ],C.ochre,28,42);
    ball(knee,"v02_"+label+"_KneeCap",
      [0,-.03,.19],[.22,.18,.19],C.plateDark,2);
    ball(knee,"v02_"+label+"_ShinTendon",
      [0,-.49,.23],[.125,.28,.10],C.sienna,2);
    loftY(ankle,"v02_"+label+"_Fetlock",[
      [.22,0,.01,.16,.17],[.10,0,.10,.21,.21],
      [-.02,0,.18,.24,.26],[-.14,0,.22,.28,.29]
    ],C.chestnut,28,32);
    // A cloven hoof with a visible keratin edge, not spherical toes.
    for(let sideToe of [-1,1]){
      const x=sideToe*.17;
      loftZ(ankle,"v02_"+label+"_Hoof_"+sideToe,[
        [-.07,x,-.10,.11,.11],[.07,x,-.10,.17,.12],
        [.25,x,-.10,.18,.12],[.41,x,-.14,.17,.12],
        [.54,x,-.14,.12,.10],[.62,x,-.15,.08,.055]
      ],C.hoof,22,42);
      ball(ankle,"v02_"+label+"_KeratinRing_"+sideToe,
        [x,-.09,.41],[.17,.035,.18],C.hoofEdge,2);
    }
    // Real coronary band & shank scales; skin seams are geometry.
    for(let n=0;n<7;n++){
      const y=-.21-n*.085;
      ball(knee,"v02_"+label+"_ShinPlate_"+n,
        [0,y,.22],[.145-(n*.006),.03,.085],
        n%2?C.plateDark:C.plate,1);
    }
  }
}
function sculptTail(rig,secondary){
  for(let i=0;i<rig.tail.length;i++){
    const t=rig.tail[i];hideOldMeshes(t);
    tube(t,"v02_TailFlexible_"+i,
      [[0,0,.08],[0,-.04,-.15],[0,-.075,-.29],[0,-.10,-.45]],
      [.20-i*.032,.18-i*.029,.14-i*.023,.092-i*.012],
      i%2?C.chestnut:C.ochre,32,18);
    for(let n=0;n<4;n++)ball(t,"v02_TailScale_"+i+"_"+n,
      [(n%2?1:-1)*.10,-.02,-.04-n*.1],
      [.07,.055,.12],C.plateDark,1);
  }
  hideOldMeshes(rig.tassel);
  ball(rig.tassel,"v02_TailTasselBase",
    [0,-.03,-.28],[.17,.17,.30],C.maneDark,3);
  for(let n=0;n<38;n++){
    const a=n*2.399963,rr=.09+.07*((n*11)%9)/9;
    const x=Math.cos(a)*rr,y=Math.sin(a)*rr,
      endZ=-.65-(n%7)*.045;
    fur(rig.tassel,"v02_TasselLock_"+n,[x,y,-.17],
      [x*1.20,y-.05,endZ],.045+(n%3)*.008,
      n%3?C.maneDark:C.mane);
  }
}
function polygonCount(root){
  let count=0,meshes=0;
  root.traverse(o=>{
    if(!o.isMesh||!o.visible)return;
    meshes++;
    const g=o.geometry;
    count+=(g.index?g.index.count:g.getAttribute("position").count)/3;
  });
  return {triangles:Math.round(count),meshes};
}
const v02=new WeakMap();
export function createArumbarV02(){
  const root=createArumbar(),rig=root.userData.rig;
  root.name="Wildhaven_Arumbar_HighPoly_v02";
  const secondary={armor:[],ruff:[],ears:[]};
  sculptTorso(rig,secondary);
  sculptNeck(rig,secondary);
  sculptHead(rig,secondary);
  sculptLeg(rig);
  sculptTail(rig,secondary);
  root.userData.geometryRevision="v02 high-poly sculpt";
  root.userData.assetId="arumbar";
  v02.set(root,{secondary,meshes:polygonCount(root)});
  return root;
}
function resetDetails(root){
  const data=v02.get(root);if(!data)throw Error("Not a v02 Arumbar");
  for(const key of ["armor","ruff","ears"]){
    for(const bone of data.secondary[key]){
      bone.rotation.set(0,0,0);
      bone.scale.set(1,1,1);
    }
  }
}
export function poseArumbarV02(root,animation,t){
  poseArumbar(root,animation,t);resetDetails(root);
  const rig=root.userData.rig,sec=v02.get(root).secondary;
  const moving=["walk","run","charge"].includes(animation);
  const running=["run","charge"].includes(animation);
  const stride=running?.84:1.72;
  const phase=2*Math.PI*t/stride;
  for(let i=0;i<sec.armor.length;i++){
    sec.armor[i].rotation.x=moving?.013*Math.sin(phase*.7-i*.2):
      animation==="graze"?.009*Math.sin(t*.9+i*.3):0;
  }
  for(let i=0;i<sec.ruff.length;i++){
    const bone=sec.ruff[i];
    bone.rotation.x=moving?.07*Math.sin(phase*.8-i*.4):
      animation==="alert"?-.04:.018*Math.sin(t*.8+i*.4);
    bone.rotation.z=moving?.03*Math.sin(phase*.6+i*.6):0;
  }
  for(let i=0;i<sec.ears.length;i++){
    const ear=sec.ears[i];
    ear.rotation.y=animation==="alert"?.16*Math.sin(t*1.1+i*1.2):
      moving?.05*Math.sin(phase+.5*i):.06*Math.sin(t*.9+i);
  }
  // Keep the immense mass heavy: counter-rotate neck and body on locomotion.
  if(moving){
    rig.neck.rotation.x+=.025*Math.sin(phase+.25);
    rig.head.rotation.x+=.014*Math.sin(phase+.54);
  }
  if(animation==="graze"){
    rig.jaw.rotation.x+=.06*Math.sin(t*9.2);
    rig.head.rotation.y=.045*Math.sin(t*1.8);
  }
  if(animation==="alert")rig.head.rotation.y+=.065*Math.sin(t*1.1);
}
export function arumbarBonesV02(root){
  const groups=[];root.traverse(o=>{
    if(o!==root&&o instanceof THREE.Group&&o.name)groups.push(o);
  });return groups;
}
export function arumbarClipsV02(root){
  const bones=arumbarBonesV02(root),out=[];
  const duration={idle:2.4,walk:1.72,run:.84,graze:3.1,
    drink:3,alert:2.3,charge:.82,death:1.65};
  for(const act of ANIMATIONS){
    const tEnd=duration[act],frames=65,times=[],keyframes=new Map();
    for(const o of bones)keyframes.set(o.name,{pos:[],quat:[],scale:[]});
    for(let i=0;i<frames;i++){
      const t=tEnd*i/(frames-1);times.push(t);
      poseArumbarV02(root,act,t);
      for(const o of bones){
        const k=keyframes.get(o.name);
        k.pos.push(...o.position.toArray());
        k.quat.push(...o.quaternion.toArray());
        k.scale.push(...o.scale.toArray());
      }
    }
    const tracks=[];
    for(const o of bones){
      const k=keyframes.get(o.name);
      tracks.push(new THREE.VectorKeyframeTrack(o.name+".position",times,k.pos),
        new THREE.QuaternionKeyframeTrack(o.name+".quaternion",times,k.quat),
        new THREE.VectorKeyframeTrack(o.name+".scale",times,k.scale));
    }
    out.push(new THREE.AnimationClip(act,tEnd,tracks));
  }
  poseArumbarV02(root,"idle",0);
  return out;
}
export function arumbarV02Stats(root){
  const result=v02.get(root);
  if(!result)throw Error("Missing V02 asset");
  return {geometry:polygonCount(root),secondaryJoints:
    Object.values(result.secondary).reduce((a,v)=>a+v.length,0),
    jointCount:arumbarBonesV02(root).length,
    hiddenOriginalMeshes:(()=>{
      let n=0;root.traverse(o=>{if(o.isMesh&&!o.visible)n++});return n;
    })()};
}
