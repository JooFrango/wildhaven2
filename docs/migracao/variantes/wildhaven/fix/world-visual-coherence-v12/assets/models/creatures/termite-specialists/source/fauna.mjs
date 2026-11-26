import * as THREE from "three";
import { addPolish, polishPose, recordRest, resetPose } from "./polish.mjs";

/** Wildhaven asset workshop, v0.1. Meshes and joints are real 3D, no billboards.
 * +Z forward; Y up. Animations are procedural then sampled into glTF tracks.
 * This module is standalone: no imports from game/alpha01. */
export const SPECIES = ["ferrunco","dunlingua","pica_termita","cupinzeiro"];
export const ANIMATIONS = {
  ferrunco: ["idle","walk","trot","sniff","inspect","dig","feed","tongue_out","tongue_in","alert","defend","flee","rest","sleep","hurt","death"],
  dunlingua:["idle","walk","run","scent","inspect","dig","feed","tongue_out","tongue_in","sun_bask","alert","defend","flee","rest","hurt","death"],
  pica_termita:["idle","walk","hop","fly","land","lookout","inspect","peck","feed","tongue_out","tongue_in","crest_display","wing_spread","alert","flee","rest","hurt","death"],
  cupinzeiro:["active","feeding","damaged","abandoned","crumbling","disappearing"],
};
export const DOSSIER = {
  ferrunco:{name:"Ferrunco",biome:["floresta tropical","floresta temperada"],lengthM:2.15,heightM:1.15,role:"especialista escavador de cupins",intakePerVisit:340,structureDamage:0.15,climate:"úmido"},
  dunlingua:{name:"Dunlíngua",biome:["deserto","cânions"],lengthM:2.9,heightM:1.2,role:"caçador crepuscular de cupins",intakePerVisit:210,structureDamage:0.08,climate:"árido"},
  pica_termita:{name:"Pica-Termita de Crista",biome:["planícies","savanas","bordas de floresta"],lengthM:0.85,heightM:0.9,role:"extrator aéreo de cupins",intakePerVisit:60,structureDamage:0.01,climate:"quente e ameno"},
  cupinzeiro:{name:"Cupinzeiro de Auralis",biome:["planícies","savanas","bordas de floresta"],heightM:3.2,capacity:20000,initialPopulation:[12000,20000],role:"recurso alimentar de colônia"},
};
const std=new Map();
function material(color,metal=0.015){
  const key=color+"-"+metal;
  if(!std.has(key))std.set(key,new THREE.MeshStandardMaterial({
    color,roughness:.9,metalness:metal,flatShading:true,side:THREE.DoubleSide
  }));
  return std.get(key);
}
const G={
  orb:new THREE.SphereGeometry(1,12,10),
  ico:new THREE.IcosahedronGeometry(1,1),
  shard:new THREE.ConeGeometry(1,1,6),
  cylinder:new THREE.CylinderGeometry(1,1,1,10),
  tetra:new THREE.TetrahedronGeometry(1),
  plate:new THREE.DodecahedronGeometry(1,0),
};
function mesh(parent,shape,color,p,s,r=[0,0,0]){
  const m=new THREE.Mesh(G[shape],material(color));
  m.position.set(...p);m.scale.set(...s);m.rotation.set(...r);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function pivot(parent,name,p){
  const joint=new THREE.Group();joint.name=name;joint.position.set(...p);
  parent.add(joint);return joint;
}
function tube(parent,pts,radii,color,radial=9){
  // Fully closed low-poly tapered curved tube with actual cross-sections.
  const verts=[],idx=[];
  for(let i=0;i<pts.length;i++){
    const p=new THREE.Vector3(...pts[i]);
    const before=new THREE.Vector3(...pts[Math.max(0,i-1)]);
    const after=new THREE.Vector3(...pts[Math.min(pts.length-1,i+1)]);
    const tangent=after.sub(before).normalize();
    let u=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,0,1));
    if(u.length()<.01)u=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,1,0));
    u.normalize();const v=new THREE.Vector3().crossVectors(tangent,u).normalize();
    for(let j=0;j<radial;j++){
      const ang=j*2*Math.PI/radial;
      const pos=p.clone().addScaledVector(u,Math.cos(ang)*radii[i])
        .addScaledVector(v,Math.sin(ang)*radii[i]);
      verts.push(pos.x,pos.y,pos.z);
    }
  }
  for(let i=0;i<pts.length-1;i++)for(let j=0;j<radial;j++){
    const a=i*radial+j,b=i*radial+(j+1)%radial,c=(i+1)*radial+j,d=(i+1)*radial+(j+1)%radial;
    idx.push(a,c,b,b,c,d);
  }
  const n=verts.length/3;
  for(let q=0;q<2;q++)verts.push(...pts[q?pts.length-1:0]);
  for(let j=0;j<radial;j++){
    idx.push(n,(j+1)%radial,j);
    const o=(pts.length-1)*radial;idx.push(n+1,o+j,o+(j+1)%radial);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);
  geo.computeVertexNormals();
  const o=new THREE.Mesh(geo,material(color));
  o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function spike(parent,color,start,end,wide=.14){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end);
  const dir=b.clone().sub(a);
  const m=mesh(parent,"shard",color,[(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2],
    [wide,dir.length(),wide*.82]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
  return m;
}
const rigPart=pivot;
function loftMound(parent,seed,center,height,radius,color,segments=15){
  const vert=[],ids=[],rings=8,px=center[0],pz=center[1];
  for(let i=0;i<rings;i++){
    const t=i/(rings-1);
    const level=height*t;
    const r=Math.max(.035,radius*Math.pow(1-t,0.74)*(1+.15*Math.sin(t*17+seed)));
    for(let j=0;j<segments;j++){
      const theta=j*Math.PI*2/segments;
      const undulation=1+.09*Math.sin(j*2.85+seed+i*.53)+.07*Math.cos(j*.95+seed*2);
      const leanX=.15*Math.sin(t*4+seed),leanZ=.13*Math.cos(t*4.1+seed);
      vert.push(px+leanX+t*.08*Math.sin(seed)+r*Math.cos(theta)*undulation,
        level+.04*Math.sin(j*2.6+i*3.2+seed)*(1-t),
        pz+leanZ+r*Math.sin(theta)*undulation);
    }
  }
  for(let i=0;i<rings-1;i++)for(let j=0;j<segments;j++){
    let a=i*segments+j,b=i*segments+(j+1)%segments,c=(i+1)*segments+j,d=(i+1)*segments+(j+1)%segments;
    ids.push(a,b,c,b,d,c);
  }
  const n=vert.length/3;
  vert.push(px,0,pz,px,height,pz);
  for(let j=0;j<segments;j++){
    ids.push(n,j,(j+1)%segments);
    const o=(rings-1)*segments;ids.push(n+1,o+(j+1)%segments,o+j);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(vert,3));
  geo.setIndex(ids);geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,material(color));
  m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
function digits(parent,color,claw,x,y,z,spread,n=3,length=.25){
  for(let i=0;i<n;i++){
    const s=i-(n-1)/2;
    tube(parent,[[x+s*spread*.75,y,z],[x+s*spread,y-.055,z+length*.4],
      [x+s*spread*1.05,y-.065,z+length]],[.075,.06,.038],color,7);
    spike(parent,claw,[x+s*spread*1.05,y-.035,z+length*.86],
      [x+s*spread*1.12,y-.14,z+length+.14],.055);
  }
}
function feet4(parent,name,x,z,upper,length,color,claw,front=false) {
  const sign=x<0?-1:1;
  const limb=pivot(parent,name,[x,upper,z]);
  tube(limb,[[0,0,0],[sign*.055,-length*.40,front?.07:-.08],
    [sign*.08,-length*.74,.06]],[.22,.21,.15],color);
  const elbow=pivot(limb,name+"_lower",[sign*.08,-length*.71,.06]);
  tube(elbow,[[0,.03,0],[0,-length*.17,.07],[0,-length*.26,.15]],[.15,.14,.12],color);
  const foot=pivot(elbow,name+"_foot",[0,-length*.27,.13]);
  mesh(foot,"ico",color,[0,.025,.13],[.18,.09,.29]);
  digits(foot,color,claw,0,.025,.21,.14,front?4:3,.23);
  return {upper:limb,lower:elbow,foot};
}
function makeFerrunco(){
  const root=new THREE.Group();root.name="Ferrunco";
  const rig={},body=pivot(root,"Ferrunco_Body",[0,0,0]);rig.body=body;
  const hide=0x56412d,belly=0x775a3f,armor=0x514638,plate=0x897457;
  const edge=0xc4a778,moss=0x587a51,cyan=0x5cbd9b,claw=0xd8c7a2;
  mesh(body,"orb",hide,[0,.89,-.12],[.64,.69,1.06]);
  mesh(body,"orb",belly,[0,.66,.21],[.49,.43,.70]);
  mesh(body,"ico",hide,[0,.96,.58],[.67,.55,.66]);
  mesh(body,"ico",armor,[0,1.33,-.32],[.71,.24,.85]);
  // 10 overlapping dorsal armor rows and flexible flank plates.
  for(let i=0;i<10;i++){
    const z=-.98+i*.235,r=.9-.40*Math.abs(z-.05);
    mesh(body,"ico",i%3?plate:armor,[0,1.34+.16*r,z],
      [.62*r,.15+.04*r,.22],[.04,0,i%2?.02:-.03]);
    for(const s of [-1,1]){
      mesh(body,"plate",i%2?armor:plate,
        [s*(.46+.10*r),1.18+.08*r,z], [.30,.20,.23],
        [0,s*.28,s*.12]);
      if(i%2===0)mesh(body,"ico",edge,[s*.60,1.25,z-.04],
        [.06,.03,.10]);
    }
  }
  for(let i=0;i<14;i++){
    const zz=-.85+(i%8)*.28,side=i%2?-1:1;
    mesh(body,"tetra",i%4?moss:cyan,
      [side*(.42+.04*(i%3)),1.49+.015*(i%4),zz],
      [.09,.05,.12],[0,i*.13,.3]);
  }
  const tail=pivot(body,"Ferrunco_Tail",[0,.78,-1.02]);rig.tail=tail;
  tube(tail,[[0,0,0],[0,-.13,-.39],[0,-.20,-.73],[0,-.19,-1.03]],
    [.29,.22,.12,.055],armor,12);
  for(let i=0;i<8;i++)mesh(tail,"plate",i%2?armor:plate,[0,-.11,-.16-i*.105],
    [.22-i*.017,.08,.16]);
  rig.neck=pivot(body,"Ferrunco_Neck",[0,1.04,.78]);
  mesh(rig.neck,"ico",belly,[0,.05,.20],[.42,.37,.45]);
  rig.head=pivot(rig.neck,"Ferrunco_Head",[0,.17,.35]);
  mesh(rig.head,"ico",hide,[0,.05,.28],[.43,.31,.48]);
  tube(rig.head,[[0,-.045,.29],[0,-.11,.65],[0,-.22,1.06]],
    [.34,.21,.10],belly,10);
  mesh(rig.head,"plate",edge,[0,.31,.26],[.42,.17,.40]);
  for(const s of [-1,1]){
    for(let i=0;i<4;i++)spike(rig.head,edge,
      [s*(.25+i*.05),.18,.27-i*.10],
      [s*(.36+i*.10),.36+i*.06,-.04-i*.10],.09);
    mesh(rig.head,"ico",0x201c18,[s*.34,.12,.53],[.085,.08,.10]);
    mesh(rig.head,"ico",0xf3c777,[s*.38,.13,.57],[.037,.039,.042]);
    spike(rig.head,edge,[s*.24,.03,.92],[s*.34,-.05,1.05],.055);
  }
  rig.jaw=pivot(rig.head,"Ferrunco_Jaw",[0,-.20,.48]);
  mesh(rig.jaw,"ico",belly,[0,-.17,.28],[.24,.11,.38]);
  rig.tongue=pivot(rig.head,"Ferrunco_Tongue",[0,-.25,.80]);
  tube(rig.tongue,[[0,0,0],[0,-.12,.20],[0,-.30,.53],[0,-.42,.91]],
    [.085,.075,.055,.028],0xc65e6d,8);
  rig.foreL=feet4(body,"Ferrunco_ForeL",-.52,.63,1.04,.87,hide,claw,true);
  rig.foreR=feet4(body,"Ferrunco_ForeR",.52,.63,1.04,.87,hide,claw,true);
  rig.hindL=feet4(body,"Ferrunco_HindL",-.49,-.76,.84,.66,hide,claw,false);
  rig.hindR=feet4(body,"Ferrunco_HindR",.49,-.76,.84,.66,hide,claw,false);
  for(const s of [-1,1])for(let i=0;i<4;i++)
    spike(rig.foreL.upper.parent,edge,[s*(.52+i*.045),1.25,.56-i*.17],
      [s*(.59+i*.095),1.43,.40-i*.21],.075);
  return {root,rig};
}
function makeDunlingua(){
  const root=new THREE.Group();root.name="Dunlingua";
  const rig={},body=pivot(root,"Dunlingua_Body",[0,0,0]);rig.body=body;
  const hide=0xa15e38,sand=0xc78b58,bone=0xe0b984,spine=0xaa4d28;
  const dark=0x522d22,beak=0xe5cf9b,tongue=0xd56884;
  tube(body,[[0,.80,-.85],[0,.88,-.50],[0,.90,.15],[0,.93,.72]],
    [.42,.52,.52,.38],hide,14);
  mesh(body,"ico",sand,[0,.94,.23],[.43,.38,.62]);
  mesh(body,"ico",hide,[0,.72,-.59],[.46,.28,.42]);
  for(let i=0;i<10;i++){
    const z=-.85+i*.19;
    mesh(body,"plate",i%3?hide:sand,[0,1.13,z],[.35,.10,.16]);
    for(const s of [-1,1]){
      mesh(body,"ico",i%2?spine:sand,[s*.35,1.01,z],[.13,.13,.18],[0,s*.20,0]);
      if(i<8)spike(body,spine,[s*.16,1.19,z],
        [s*.28,1.45+Math.sin(i*Math.PI/9)*.24,z-.23],.09);
    }
  }
  // Tall sail-like spined dorsal silhouette, low-poly solid geometry.
  for(let i=0;i<10;i++){
    const z=-.86+i*.24;
    const h=.42+.32*Math.sin((i+1)/11*Math.PI);
    spike(body,i%2?bone:spine,[0,1.11,z],[0,1.11+h,z-.24],.14);
    mesh(body,"ico",spine,[0,1.18,z-.04],[.18,.13,.17]);
  }
  rig.neck=pivot(body,"Dunlingua_Neck",[0,.94,.74]);
  tube(rig.neck,[[0,0,0],[0,.10,.37],[0,.17,.66]],[.35,.31,.23],hide,12);
  rig.head=pivot(rig.neck,"Dunlingua_Head",[0,.15,.59]);
  tube(rig.head,[[0,0,-.1],[0,-.035,.28],[0,-.12,.73],[0,-.17,1.08]],
    [.28,.32,.16,.08],sand,10);
  mesh(rig.head,"ico",dark,[0,.12,.26],[.27,.13,.31]);
  for(const s of [-1,1]){
    mesh(rig.head,"ico",0x251b17,[s*.29,.12,.31],[.065,.07,.08]);
    mesh(rig.head,"ico",0xf4bb66,[s*.32,.13,.35],[.026,.033,.03]);
    spike(rig.head,bone,[s*.23,.18,.13],[s*.54,.47,-.18],.11);
    mesh(rig.head,"ico",dark,[s*.09,-.16,.92],[.07,.02,.06]);
  }
  rig.jaw=pivot(rig.head,"Dunlingua_Jaw",[0,-.17,.34]);
  tube(rig.jaw,[[0,0,0],[0,-.08,.40],[0,-.18,.82]],[.19,.16,.055],hide,9);
  rig.tongue=pivot(rig.head,"Dunlingua_Tongue",[0,-.19,.77]);
  tube(rig.tongue,[[0,0,0],[0,-.15,.40],[0,-.34,.77],[0,-.47,1.12]],
    [.07,.06,.045,.016],tongue,8);
  rig.tail=pivot(body,"Dunlingua_Tail",[0,.84,-.94]);
  tube(rig.tail,[[0,0,0],[0,-.08,-.49],[0,-.16,-1.0],
    [0,-.21,-1.49],[0,-.23,-1.94]],[.36,.29,.20,.10,.018],hide,12);
  for(let i=0;i<15;i++){
    const z=-.23-i*.116;
    spike(rig.tail,i%2?sand:spine,[0,.13-i*.015,z],
      [0,.30-i*.018,z-.17],.07);
  }
  rig.foreL=feet4(body,"Dunlingua_ForeL",-.43,.65,.75,.70,sand,beak,true);
  rig.foreR=feet4(body,"Dunlingua_ForeR",.43,.65,.75,.70,sand,beak,true);
  rig.hindL=feet4(body,"Dunlingua_HindL",-.43,-.67,.76,.73,hide,beak);
  rig.hindR=feet4(body,"Dunlingua_HindR",.43,-.67,.76,.73,hide,beak);
  for(const s of [-1,1])for(let i=0;i<9;i++)
    mesh(body,"tetra",i%2?bone:spine,
      [s*(.39+.04*Math.sin(i)),.91+.06*Math.cos(i*2.3),.48-i*.15],
      [.13,.10,.14],[.2,s*.2,s*.2]);
  return {root,rig};
}
function makeBird(){
  const root=new THREE.Group();root.name="PicaTermita";
  const rig={},body=pivot(root,"PicaTermita_Body",[0,0,0]);rig.body=body;
  const bronze=0x3c332f,cream=0xe6cda0,black=0x221d21,wing=0x924b38,
    red=0xe75d23,orange=0xf4a340,blue=0x458d97,beak=0x4d493e;
  mesh(body,"orb",bronze,[0,.78,0],[.25,.28,.42]);
  mesh(body,"orb",cream,[0,.76,.24],[.16,.18,.26]);
  mesh(body,"ico",wing,[0,.96,-.24],[.20,.13,.23]);
  rig.neck=pivot(body,"PicaTermita_Neck",[0,.99,.22]);
  tube(rig.neck,[[0,-.01,0],[0,.15,.10],[0,.39,.21]],[.16,.13,.11],cream,12);
  rig.head=pivot(rig.neck,"PicaTermita_Head",[0,.37,.21]);
  mesh(rig.head,"orb",cream,[0,.05,.04],[.19,.20,.20]);
  mesh(rig.head,"ico",black,[0,.15,.13],[.14,.11,.16]);
  for(const s of [-1,1]){
    mesh(rig.head,"ico",black,[s*.17,.08,.17],[.045,.050,.060]);
    mesh(rig.head,"ico",orange,[s*.192,.094,.192],[.020,.021,.020]);
  }
  rig.beak=pivot(rig.head,"PicaTermita_Beak",[0,-.02,.19]);
  tube(rig.beak,[[0,.01,0],[0,-.04,.22],[0,-.11,.50],[0,-.22,.79]],
    [.075,.053,.033,.008],beak,8);
  rig.tongue=pivot(rig.head,"PicaTermita_Tongue",[0,-.07,.38]);
  tube(rig.tongue,[[0,0,0],[0,-.12,.18],[0,-.29,.37],[0,-.48,.51]],
    [.022,.019,.014,.007],0xb65364,7);
  rig.crest=pivot(rig.head,"PicaTermita_Crest",[0,.19,-.02]);
  for(let i=0;i<12;i++){
    const fan=i/11;
    spike(rig.crest,i%3?red:orange,
      [(fan-.5)*.15,.02,-.12],
      [(fan-.5)*.39,.39+.40*Math.sin(fan*Math.PI),-.17-.32*fan],.034+.02*Math.sin(fan*Math.PI));
  }
  function makeWing(side){
    const name=side<0?"L":"R";
    const wingPivot=pivot(body,"PicaTermita_Wing"+name,[side*.20,.94,.01]);
    const under=pivot(wingPivot,"PicaTermita_WingTip"+name,[side*.27,.02,-.11]);
    mesh(wingPivot,"ico",bronze,[side*.12,-.09,-.06],[.24,.11,.31],
      [0,side*.1,side*.2]);
    for(let i=0;i<10;i++){
      const z=.19-i*.065;
      const angle=i*.45;
      tube(wingPivot,[[side*.05,0,z],[side*.30,-.06,z-.06],
        [side*(.44+.045*i),-.12,z-.10-i*.03]],
        [.055,.065,.015],i%3===0?cream:i%3===1?wing:bronze,7);
      if(i%2===0)mesh(wingPivot,"ico",blue,
        [side*.32,-.035,z-.07],[.055,.023,.035]);
    }
    for(let i=0;i<8;i++)
      tube(under,[[0,0,-i*.055],[side*.18,-.02,-i*.08],
        [side*(.33+.028*i),-.09,-i*.13]],[.045,.038,.012],
        i%3?wing:cream,6);
    return {wing:wingPivot,tip:under};
  }
  rig.wingL=makeWing(-1);rig.wingR=makeWing(1);
  rig.tail=pivot(body,"PicaTermita_Tail",[0,.81,-.32]);
  for(let i=0;i<9;i++){
    const s=(i-4)/4;
    tube(rig.tail,[[s*.03,0,.02],[s*.09,-.08,-.32],
      [s*.19,-.13,-.66],[s*.27,-.10,-1.10+(i%3)*.09]],
      [.045,.040,.027,.008],i%3===0?cream:i%3===1?red:wing,7);
    if(i%2===0)mesh(rig.tail,"ico",orange,[s*.15,-.10,-.72],
      [.040,.023,.08]);
  }
  function birdLeg(side){
    const name=side<0?"L":"R";
    const leg=pivot(body,"PicaTermita_Leg"+name,[side*.14,.63,.05]);
    tube(leg,[[0,0,0],[side*.02,-.25,-.09],[side*.03,-.51,.08]],
      [.075,.058,.035],beak,8);
    const clawJoint=pivot(leg,"PicaTermita_Foot"+name,[side*.03,-.50,.08]);
    for(let i=-1;i<=1;i++)
      tube(clawJoint,[[0,0,0],[i*.073,-.025,.12],[i*.11,-.04,.24]],
        [.028,.022,.007],beak,7);
    tube(clawJoint,[[0,0,0],[0,-.025,-.10],[0,-.04,-.18]],
      [.026,.021,.006],beak,7);
    return {upper:leg,foot:clawJoint};
  }
  rig.legL=birdLeg(-1);rig.legR=birdLeg(1);
  for(let i=0;i<14;i++)mesh(body,"tetra",i%4===0?cream:i%3===1?orange:bronze,
    [(i%2?1:-1)*(.13+.01*(i%3)),.85+.02*(i%5),-.27+i*.039],
    [.045,.025,.065]);
  return {root,rig};
}
function makeMound(){
  const root=new THREE.Group();root.name="CupinzeiroAuralis";
  const rig={chunks:[],mouths:[],dust:[],root};
  const clay=0xa66f3e,ochre=0xc28a51,brown=0x86512e,light=0xddae69,dark=0x482d23;
  rig.mass=pivot(root,"Cupinzeiro_Mass",[0,0,0]);
  // Asymmetric mound made from closed polygonal surface layers.
  const base=pivot(rig.mass,"Cupinzeiro_Base",[0,0,0]);
  loftMound(base,1,[0,0],1.55,1.50,clay,23);
  loftMound(base,2,[.13,-.28],2.86,.78,ochre,17);
  loftMound(base,6,[-.75,.34],2.21,.57,brown,15);
  loftMound(base,7,[.91,-.25],1.96,.60,clay,15);
  loftMound(base,9,[-.20,.92],1.25,.52,ochre,13);
  // Raised earthen ridges, buttresses and thin crust flakes.
  for(let i=0;i<21;i++){
    const ang=i*Math.PI*2/21;
    const x=Math.cos(ang)*1.22,z=Math.sin(ang)*1.12;
    mesh(base,"ico",i%3?clay:brown,[x,.18+(i%3)*.055,z],
      [.34,.22,.39],[0,ang/2,.3]);
  }
  for(let i=0;i<42;i++){
    const a=i*2.4,t=(i%10)/10;
    const x=Math.cos(a)*(.33+.50*(1-t));
    const z=Math.sin(a)*(.34+.45*(1-t))-.21;
    const y=.55+t*1.90;
    mesh(base,"tetra",i%4?clay:light,[x,y,z],
      [.09,.11+.02*(i%3),.17],[a*.1,a*.19,a*.07]);
  }
  // Actual opaque dark entrance inset + volumetric lip, no interior modeled.
  for(const [i,x,y,z,s] of [
    [0,-.89,.47,.67,.17],[1,.82,.62,.40,.13],[2,-.33,1.18,.51,.12],
    [3,.37,.98,.59,.16],[4,.12,1.66,.27,.095],[5,-.48,.86,-.53,.11],
  ]){
    const mouth=pivot(base,"Cupinzeiro_Mouth"+i,[x,y,z]);
    mesh(mouth,"ico",dark,[0,0,.02],[s,s*.78,.033]);
    mesh(mouth,"ico",brown,[0,-s*.66,.085],[s*1.35,s*.23,.045]);
    mesh(mouth,"ico",light,[0,s*.72,.09],[s*1.20,s*.20,.04]);
    rig.mouths.push(mouth);
  }
  for(let i=0;i<12;i++){
    const a=i*2.399, x=.35*Math.cos(a), z=.36*Math.sin(a)-.28;
    // Narrow fissure segments as 3D grooves, visually readable up close.
    const cr=rigPart(rig.mass,"Cupinzeiro_Crack"+i,[0,0,0]);
    tube(cr,[[x,.68+i*.11,z],[x+.08, .81+i*.11,z+.05],
      [x+.11,.91+i*.11,z-.02]],[.028,.019,.008],brown,6);
    rig.chunks.push(cr);
  }
  for(let i=0;i<15;i++){
    const a=i*2.4;
    const debris=pivot(root,"Cupinzeiro_Debris"+i,
      [Math.cos(a)*(.60+(i%3)*.19),.08,Math.sin(a)*(.70+(i%4)*.14)]);
    mesh(debris,"tetra",i%2?clay:ochre,[0,0,0],
      [.18+(i%3)*.04,.14,.13+(i%4)*.03]);
    rig.dust.push(debris);
  }
  rig.cap=pivot(rig.mass,"Cupinzeiro_Cap",[.13,2.5,-.23]);
  mesh(rig.cap,"ico",ochre,[0,-.04,0],[.21,.14,.24]);
  for(let i=0;i<4;i++)
    spike(rig.cap,ochre,[.14*Math.sin(i*1.9),.07,-.18],
      [.14*Math.sin(i*1.9)+.14*Math.cos(i),.36+.15*Math.sin(i*2.3),-.21],.075);
  return {root,rig};
}
export function create(id){
  let result;
  switch(id){
    case "ferrunco":result=makeFerrunco();break;
    case "dunlingua":result=makeDunlingua();break;
    case "pica_termita":result=makeBird();break;
    case "cupinzeiro":result=makeMound();break;
    default:throw Error("Unknown Wildhaven asset: "+id);
  }
  addPolish(id,result);
  recordRest(result.root);
  result.root.userData.assetId=id;
  result.root.userData.rig=result.rig;
  result.root.userData.previewAction=null;
  return result.root;
}
function setPose(root){
  resetPose(root); // reset all rest translations/rotations/scales before evaluating pose
}
function moveLeg(l,phase,mag,step,side=1){
  l.upper.rotation.x=Math.sin(phase)*mag;
  l.lower.rotation.x=Math.max(0,Math.sin(phase))*step+.12;
  l.foot.rotation.x=-l.upper.rotation.x*.35-l.lower.rotation.x*.55;
  l.upper.rotation.z=side*.025*Math.sin(phase);
}
export function pose(root,action,time){
  const id=root.userData.assetId;
  const r=root.userData.rig;
  if(!r)throw Error("Missing rig "+id);
  setPose(root);
  const t=Math.max(0,time),cycle=t*2*Math.PI;
  if(id==="cupinzeiro"){
    const f=action==="disappearing"?Math.min(1,t/3.2):action==="crumbling"?Math.min(1,t/3.6):0;
    const dmg=action==="damaged"?.25:action==="feeding"?.06:0;
    r.mass.scale.set(1-dmg*.08-f*.33,1-dmg*.18-f*.73,1-dmg*.07-f*.33);
    r.cap.position.y=2.5-(f*.63+dmg*.25);
    r.cap.rotation.z=f*.37;
    r.mouths.forEach((m,i)=>{m.scale.setScalar(action==="abandoned"?.35:1-.14*f+
      (action==="active"?.045*Math.sin(cycle+i):0));});
    r.chunks.forEach((m,i)=>{m.rotation.z=(dmg+f)*Math.sin(i*2.4)*.4;});
    r.dust.forEach((m,i)=>{
      const a=i*2.4;
      m.position.y=.08+(action==="feeding"?.03*Math.sin(cycle*3+i):0)+f*.12;
      m.position.x=Math.cos(a)*(.60+i%3*.19)*(1+f*.16);
      m.rotation.z=f*(i%2?1:-1)*.7;
      m.scale.setScalar(action==="abandoned"?.75:1);
    });
    if(action==="disappearing")r.mass.scale.multiplyScalar(1-.45*f);
    polishPose(id,r,action,t);
    return;
  }
  const move=["walk","trot","run","flee","hop","fly"].includes(action);
  const run=["run","flee","trot","fly"].includes(action);
  const stride=action==="walk"?1.2:action==="trot"?2.0:action==="hop"?1.75:action==="fly"?2.9:2.6;
  const wave=cycle*stride,amp=action==="walk"?.30:action==="hop"?.54:run?.57:.22;
  const dig=action==="dig",feed=action==="feed",inspect=action==="inspect";
  const tongueIn=action==="tongue_in",tongueOut=action==="tongue_out";
  const death=action==="death",hurt=action==="hurt";
  const deathF=Math.min(1,t/1.35),impact=Math.pow(Math.sin(t*12),2);
  const sniff=action==="sniff"||action==="scent"||action==="lookout"||action==="detect";
  if(id==="pica_termita"){
    const wingFly=action==="fly"||action==="wing_spread";
    r.body.position.y=action==="fly"?Math.sin(wave)*.10+.40:action==="hop"?
      .12*Math.max(0,Math.sin(wave)):death?-.35*deathF:0;
    r.body.rotation.z=death?.73*deathF:move?.065*Math.sin(wave):0;
    r.legL.upper.rotation.x=move?.38*Math.sin(wave):0;
    r.legR.upper.rotation.x=move?.38*Math.sin(wave+Math.PI):0;
    r.legL.foot.rotation.x=move?-.18*Math.sin(wave):0;
    r.legR.foot.rotation.x=move?-.18*Math.sin(wave+Math.PI):0;
    r.wingL.wing.rotation.z=wingFly?-1.12-.39*Math.sin(wave*1.5):.03*Math.sin(wave);
    r.wingR.wing.rotation.z=wingFly?1.12+.39*Math.sin(wave*1.5):-.03*Math.sin(wave);
    r.wingL.tip.rotation.z=wingFly?-.20-.22*Math.sin(wave*1.5+.8):0;
    r.wingR.tip.rotation.z=wingFly?.20+.22*Math.sin(wave*1.5+.8):0;
    r.neck.rotation.x=action==="peck"?Math.sin(cycle*2.4)*.48:
      feed?.46+.1*Math.sin(cycle*2):inspect?.23:death?.25*deathF:0;
    r.head.rotation.x=action==="peck"?.35+impact*.28:
      sniff?.17*Math.sin(cycle*.9):death?.20*deathF:0;
    r.crest.rotation.x=action==="crest_display"?
      -.42+.13*Math.sin(cycle*1.3):move?.06*Math.sin(wave):0;
    r.tail.rotation.x=action==="crest_display"?-.23:
      wingFly?.17:move?.04*Math.sin(wave+1):0;
    r.beak.rotation.x=action==="peck"?impact*.15:0;
    r.tongue.scale.z=tongueOut?1:feed?.70+.20*Math.sin(cycle*2):
      tongueIn?Math.max(.02,1-t/1.25):.02;
    r.tongue.rotation.x=feed?.07*Math.sin(cycle*2):0;
    if(action==="rest")r.body.position.y=-.09;
    polishPose(id,r,action,t);
    return;
  }
  r.body.position.y=death?-.42*deathF:action==="rest"||action==="sleep"?-.14:
    move?.052*Math.cos(wave*2):.014*Math.sin(t*2.5);
  r.body.rotation.z=death?.55*deathF:move?.034*Math.sin(wave):hurt?.1*impact:0;
  r.body.rotation.x=action==="sleep"?.10:inspect?.04:0;
  const foreL=r.foreL,foreR=r.foreR,hindL=r.hindL,hindR=r.hindR;
  if(move){
    moveLeg(foreL,wave,amp,.38,-1);
    moveLeg(foreR,wave+Math.PI,amp,.38,1);
    moveLeg(hindL,wave+Math.PI,amp*.85,.32,-1);
    moveLeg(hindR,wave,amp*.85,.32,1);
  }
  if(dig){
    const stroke=Math.sin(cycle*1.85);
    foreL.upper.rotation.x=-.67+stroke*.51;
    foreR.upper.rotation.x=-.67-stroke*.51;
    foreL.lower.rotation.x=.55+stroke*.34;
    foreR.lower.rotation.x=.55-stroke*.34;
    r.body.rotation.x=.10;
  }
  if(action==="defend"){
    foreL.upper.rotation.z=-.20;foreR.upper.rotation.z=.20;
    foreL.upper.rotation.x=-.31;foreR.upper.rotation.x=-.31;
    r.body.rotation.x=-.07;
  }
  if(death){
    foreL.upper.rotation.x=deathF*.5;foreR.upper.rotation.x=deathF*.32;
    hindL.upper.rotation.x=deathF*.18;hindR.upper.rotation.x=deathF*.25;
  }
  r.neck.rotation.x=feed?.15:inspect?.17:action==="sniff"||action==="scent"?.03+.07*Math.sin(cycle):death?.23*deathF:0;
  r.head.rotation.x=feed?.19+.065*Math.sin(cycle*2):
    inspect?.11:sniff?.13*Math.sin(cycle*.70):death?.18*deathF:0;
  r.jaw.rotation.x=feed?.24+.09*Math.sin(cycle*2):
    action==="alert"?.30:death?.12*deathF:0;
  r.tongue.scale.set(1,1,tongueOut?1:feed?.70+.29*Math.sin(cycle*2.4):
    tongueIn?Math.max(.03,1-t/1.2):.015);
  r.tongue.rotation.x=feed?.16*Math.sin(cycle*2.4):0;
  r.tail.rotation.y=move?.12*Math.sin(wave*.62):.05*Math.sin(t*.9);
  if(action==="sun_bask"){r.body.position.y=-.10;r.head.rotation.x=-.13;}
  polishPose(id,r,action,t);
}
export function bones(root){
  const list=[];
  root.traverse(o=>{if(o instanceof THREE.Group && o.name && o!==root)list.push(o);});
  return list;
}
export function clips(root){
  const id=root.userData.assetId,rig=bones(root);
  const output=[];
  for(const act of ANIMATIONS[id]){
    const duration=act==="walk"?1.25:act==="run"||act==="flee"?0.75:
      act==="trot"?1.0:act==="death"?1.45:act==="crumbling"?3.6:
      act==="disappearing"?3.2:act==="feeding"||act==="feed"||act==="peck"?1.6:2.3;
    const frames=41,times=[],arr=new Map();
    for(const b of rig)arr.set(b.name,{p:[],q:[],s:[]});
    for(let i=0;i<frames;i++){
      const t=duration*i/(frames-1);times.push(t);pose(root,act,t);
      for(const b of rig){
        const a=arr.get(b.name);
        a.p.push(b.position.x,b.position.y,b.position.z);
        a.q.push(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
        a.s.push(b.scale.x,b.scale.y,b.scale.z);
      }
    }
    const tracks=[];
    for(const b of rig){
      const a=arr.get(b.name);
      tracks.push(new THREE.VectorKeyframeTrack(b.name+".position",times,a.p));
      tracks.push(new THREE.QuaternionKeyframeTrack(b.name+".quaternion",times,a.q));
      tracks.push(new THREE.VectorKeyframeTrack(b.name+".scale",times,a.s));
    }
    output.push(new THREE.AnimationClip(act,duration,tracks));
  }
  pose(root,ANIMATIONS[id][0],0);
  return output;
}
