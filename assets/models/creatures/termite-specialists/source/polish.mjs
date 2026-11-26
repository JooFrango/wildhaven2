import * as THREE from "three";

/**
 * Wildhaven termite fauna art polish v0.2.
 * Sculptural overlays, not textures or still-image substitutes.
 * All bones are transformable nodes, exported into the GLBs.
 * This module is self-contained and never imports game/alpha01.
 */
const geometries={
  ellipsoid:new THREE.IcosahedronGeometry(1,2),
  facet:new THREE.IcosahedronGeometry(1,1),
  pebble:new THREE.DodecahedronGeometry(1,0),
  needle:new THREE.ConeGeometry(1,1,7),
  band:new THREE.TorusGeometry(1,.15,5,13),
};
const materials=new Map();
function color(hex){
  if(!materials.has(hex))materials.set(hex,new THREE.MeshStandardMaterial({
    color:hex,roughness:.86,metalness:.015,flatShading:true,
  }));
  return materials.get(hex);
}
function gem(parent,kind,hex,xyz,sizes,rot=[0,0,0]){
  const o=new THREE.Mesh(geometries[kind],color(hex));
  o.position.set(...xyz);o.scale.set(...sizes);o.rotation.set(...rot);
  o.castShadow=true;o.receiveShadow=true;parent.add(o);
  return o;
}
function bone(parent,name,xyz){
  const o=new THREE.Group();
  o.name=name;o.position.set(...xyz);parent.add(o);
  return o;
}
function barb(parent,hex,start,end,width){
  const delta=new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
  const middle=new THREE.Vector3(...start).addScaledVector(delta,.5);
  const obj=gem(parent,"needle",hex,middle.toArray(),[width,delta.length(),width*.78]);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  return obj;
}
function layeredSpots(parent,hex1,hex2,minZ,maxZ,n,yFn,xFn){
  for(let i=0;i<n;i++){
    const z=minZ+(maxZ-minZ)*((i+.25)/n);
    const s=i%2?-1:1;
    const x=s*xFn(z,i);
    const y=yFn(z,i);
    const ellipse=gem(parent,"pebble",i%3?hex1:hex2,
      [x,y,z],[.085+(i%4)*.022,.026,.12+(i%3)*.016],
      [0,s*.18,s*.06]);
    ellipse.castShadow=false;
  }
}
function enhanceFerrunco(result){
  const {body,head,neck,jaw,tail,foreL,foreR,hindL,hindR}=result.rig;
  const mud=0x523f31,clay=0x987959,trim=0xbba481,moss=0x60764e,bright=0x8cad67,
    brown=0x332a26,eye=0xf6d387;
  // Expanded trapezoidal shoulder girdle and articulated rib musculature.
  for(const side of [-1,1]){
    gem(body,"ellipsoid",mud,[side*.53,.91,.40],[.31,.43,.43],[0,0,side*.19]);
    for(let i=0;i<6;i++){
      const z=.75-i*.32;
      gem(body,"facet",i%2?clay:trim,[side*(.43+.015*i),1.00,z],
        [.21,.19,.29],[.04,side*.18,side*.22]);
    }
    gem(head,"ellipsoid",mud,[side*.26,-.04,.40],[.16,.15,.31],[0,side*.12,0]);
    gem(head,"facet",brown,[side*.325,.145,.48],[.10,.13,.12]);
    gem(head,"ellipsoid",eye,[side*.390,.17,.52],[.04,.045,.055]);
    gem(head,"facet",brown,[side*.086,-.155,.98],[.06,.028,.07]);
    // Curved digging claw plates on both forearms, distinctly larger than rear paws.
    const fore=side<0?foreL:foreR;
    gem(fore.upper,"facet",clay,[side*.10,-.42,.12],[.24,.31,.17],
      [0,0,side*.12]);
    gem(fore.lower,"facet",trim,[0,-.12,.16],[.17,.18,.21]);
    for(let k=0;k<4;k++){
      barb(fore.foot,trim,[(k-1.5)*.13,.02,.34],
        [(k-1.5)*.15,-.19,.64],.047);
    }
    const hind=side<0?hindL:hindR;
    gem(hind.upper,"facet",clay,[side*.07,-.23,-.06],[.20,.29,.18]);
  }
  // Scale mosaic in paired longitudinal rows; light mineral veins echo concept.
  layeredSpots(body,moss,bright,-.80,.80,28,z=>1.48+.035*Math.cos(z*9),
    (z,i)=>.37+.08*(i%4)/4);
  for(let i=0;i<8;i++){
    const z=-.92+i*.24;
    gem(body,"pebble",i%3?trim:clay,[0,1.51,z],
      [.22,.042,.13]);
  }
  const nostrilShield=bone(head,"Ferrunco_RostrumShield",[0,-.06,.74]);
  gem(nostrilShield,"facet",mud,[0,0,.06],[.20,.09,.30]);
  gem(jaw,"ellipsoid",clay,[0,-.095,.32],[.20,.085,.29]);
  // Decorative bony tail rings follow tail pivot in all animations.
  for(let i=0;i<8;i++){
    const z=-.18-i*.10;
    gem(tail,"pebble",i%2?mud:clay,[0,.04-.016*i,z],
      [.205-.013*i,.045,.09]);
  }
  result.rig.polish={shield:nostrilShield};
}
function enhanceDunlingua(result){
  const r=result.rig;
  const {body,head,neck,tail,foreL,foreR,hindL,hindR}=r;
  const hide=0x996044,sand=0xd6a36b,clay=0xab653d,deep=0x513527,
    pale=0xeacb94,olive=0x725a36,eye=0xe2bb77;
  // Rib plating follows the long trunk; flatter horizontal bands reduce
  // the visually disconnected "stacked blocks" silhouette.
  for(const side of [-1,1]){
    for(let i=0;i<10;i++){
      const z=-.86+i*.20;
      gem(body,"ellipsoid",i%3?hide:clay,[side*.405,.92,z],
        [.11,.10,.135],[0,side*.12,side*.08]);
      gem(body,"pebble",i%4?clay:pale,[side*.395,1.06,z],
        [.12,.05,.12]);
    }
    // Face is built from brows, cheekbones and nostril plates.
    gem(head,"facet",deep,[side*.22,.15,.41],[.14,.07,.23]);
    gem(head,"ellipsoid",eye,[side*.305,.16,.43],[.04,.04,.07]);
    gem(head,"facet",deep,[side*.072,-.13,.97],[.05,.024,.07]);
    gem(neck,"ellipsoid",hide,[side*.22,.025,.28],[.15,.22,.22]);
    const fore=side<0?foreL:foreR;
    gem(fore.upper,"facet",clay,[side*.10,-.30,.07],[.22,.29,.16]);
    const hind=side<0?hindL:hindR;
    gem(hind.upper,"ellipsoid",hide,[side*.04,-.33,.01],[.22,.35,.25]);
  }
  // A banded flexible distal tail with two independently animated segments.
  const t1=bone(tail,"Dunlingua_TailFlexible1",[0,-.18,-1.08]);
  const t2=bone(t1,"Dunlingua_TailFlexible2",[0,-.02,-.32]);
  gem(t1,"ellipsoid",sand,[0,.04,-.23],[.15,.13,.40],[0,0,0]);
  gem(t2,"ellipsoid",clay,[0,.02,-.29],[.085,.078,.36]);
  for(let i=0;i<7;i++){
    barb(t1,i%2?pale:clay,[0,.11,-.07-i*.11],
      [0,.22,-.20-i*.13],.065);
  }
  // Distinctive ochre side stripes / tough heat-dissipating scute ridges.
  layeredSpots(body,pale,olive,-.75,.84,26,
    z=>.92+.02*Math.sin(z*10),()=>.44);
  for(let i=0;i<7;i++){
    gem(head,"pebble",i%2?sand:pale,[0,.21,.11+i*.14],
      [.16-i*.009,.045,.065]);
  }
  r.polish={tail1:t1,tail2:t2};
}
function enhanceBird(result){
  const r=result.rig, {body,head,neck,crest,tail,wingL,wingR,legL,legR}=r;
  const ebony=0x302a29,bronze=0x885241,cream=0xf0d8ad,fire=0xee7035,
    ochre=0xf7b84d,teal=0x4b9ca1,black=0x222224;
  // Tapered breast and dark shoulder muscles form a plausible wing root.
  gem(body,"ellipsoid",cream,[0,.72,.26],[.185,.22,.28]);
  gem(body,"facet",bronze,[0,.93,-.13],[.23,.14,.29]);
  for(const side of [-1,1]){
    gem(head,"ellipsoid",black,[side*.134,.16,.07],[.085,.11,.12]);
    gem(head,"facet",cream,[side*.14,.015,.02],[.095,.14,.12]);
    const wing=side<0?wingL:wingR;
    gem(wing.wing,"ellipsoid",ebony,[side*.16,-.015,-.09],
      [.18,.085,.32],[0,0,side*.13]);
    for(let k=0;k<10;k++){
      const z=.18-k*.052;
      gem(wing.wing,"facet",k%4?bronze:teal,
        [side*(.24+.03*k),-.063,z-.06-k*.024],
        [.075,.035,.10],[0,side*.12,side*.08]);
    }
    const leg=side<0?legL:legR;
    gem(leg.upper,"facet",ebony,[side*.01,-.17,-.04],[.079,.15,.082]);
  }
  // Crest has a muscular sheath at base, each extra feather articulated.
  const crestSprig=bone(crest,"PicaTermita_CrestTip",[0,.18,-.12]);
  for(let i=0;i<8;i++){
    const k=i/7;
    barb(crestSprig,i%3?fire:ochre,
      [(k-.5)*.10,0,-.03],
      [(k-.5)*.26,.34+.25*Math.sin(k*Math.PI),-.10-k*.17],
      .027);
  }
  for(let i=0;i<11;i++){
    const span=(i-5)/5;
    gem(tail,"facet",i%3?bronze:fire,
      [span*.17,-.07,-.60],[.05,.025,.22],
      [0,span*.10,0]);
  }
  // Upper neck collar and keratin bill highlight.
  gem(neck,"ellipsoid",cream,[0,.22,.15],[.10,.21,.12]);
  gem(head,"facet",ochre,[0,.21,-.06],[.12,.07,.09]);
  r.polish={crestSprig};
}
function enhanceMound(result){
  const r=result.rig,root=result.root,base=r.mass.children.find(x=>x.name==="Cupinzeiro_Base");
  const ochre=0xa96d40,clay=0xb98452,dry=0xd9ae6f,dark=0x64412d;
  // Broad, low buttresses with layers of real polygonal clay grains. Only exterior.
  for(let i=0;i<20;i++){
    const a=i*Math.PI*2/20;
    const radius=1.38+.12*Math.sin(i*2.9);
    const x=Math.cos(a)*radius,z=Math.sin(a)*radius;
    gem(base,"ellipsoid",i%3?ochre:clay,[x,.13,z],
      [.23,.16,.28],[.1,a,0]);
    gem(base,"pebble",i%4?clay:dry,
      [x*.87,.30,z*.87],[.16,.07,.19],[0,a,.11]);
  }
  for(let i=0;i<35;i++){
    const a=i*2.39996,level=(i%9)/9;
    const x=Math.cos(a)*(.74-.34*level);
    const z=Math.sin(a)*(.69-.25*level)-.14;
    const y=.57+level*2.06;
    gem(base,"pebble",i%4?ochre:dry,
      [x,y,z],[.07,.028,.12],[a*.18,a*.35,a*.13]);
  }
  // Separated crumb clusters disappear/roll outward after colony extinction.
  const crumbs=[];
  for(let i=0;i<18;i++){
    const a=i*2.3999,rr=.8+(i%5)*.19;
    const cr=bone(root,"Cupinzeiro_Crumb"+i,
      [rr*Math.sin(a),.12+(i%4)*.055,rr*Math.cos(a)]);
    gem(cr,"pebble",i%3?ochre:dry,[0,0,0],
      [.15+(i%3)*.035,.095,.17],[a*.10,a*.22,a*.08]);
    crumbs.push(cr);
  }
  r.polish={crumbs};
}
export function addPolish(id,result){
  if(id==="ferrunco")enhanceFerrunco(result);
  else if(id==="dunlingua")enhanceDunlingua(result);
  else if(id==="pica_termita")enhanceBird(result);
  else if(id==="cupinzeiro")enhanceMound(result);
}
/** Preserve rest offsets for every pivot to avoid pose-dependent drift. */
const rest=new WeakMap();
export function recordRest(root){
  root.traverse(o=>{
    if(o instanceof THREE.Group&&o!==root)rest.set(o,{
      position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),
    });
  });
}
export function resetPose(root){
  root.traverse(o=>{
    if(!(o instanceof THREE.Group)||o===root)return;
    const pose=rest.get(o);if(!pose)return;
    o.position.copy(pose.position);o.quaternion.copy(pose.quaternion);
    o.scale.copy(pose.scale);
  });
}
export function polishPose(id,rig,action,t){
  const cycle=2*Math.PI*t;
  const p=rig.polish;
  if(!p)return;
  if(id==="cupinzeiro"){
    const collapse=Math.min(1,t/3.6);
    const breaking=action==="crumbling"||action==="disappearing";
    for(let i=0;i<p.crumbs.length;i++){
      const crumb=p.crumbs[i];
      const a=i*2.3999;
      crumb.rotation.set(breaking?collapse*(i%3)*.20:0,
        0,breaking?collapse*(i%2?1:-1)*.9:0);
      if(breaking){
        crumb.position.x+=Math.sin(a)*collapse*(.13+i%4*.045);
        crumb.position.z+=Math.cos(a)*collapse*(.13+i%4*.045);
        crumb.position.y=Math.max(.04,crumb.position.y-collapse*.14);
      }
      const fading=action==="disappearing"?1-Math.min(1,t/3.2):1;
      crumb.scale.setScalar(Math.max(.001,fading));
    }
    return;
  }
  if(id==="ferrunco"){
    const feeding=action==="feed",dig=action==="dig";
    p.shield.rotation.x=dig?.06*Math.sin(cycle*1.5):0;
    if(dig){
      rig.body.rotation.x=.14;
      rig.neck.rotation.x=.22+.09*Math.sin(cycle*1.7);
      rig.foreL.foot.rotation.x=-.30-.20*Math.sin(cycle*1.7);
      rig.foreR.foot.rotation.x=-.30+.20*Math.sin(cycle*1.7);
      rig.tail.rotation.x=-.04+.05*Math.sin(cycle*.5);
    }
    if(feeding) {
      rig.head.rotation.y=.11*Math.sin(cycle*.75);
      rig.tongue.rotation.x=.23+.16*Math.sin(cycle*2.2);
      rig.tongue.scale.z=.32+.68*(.5+.5*Math.sin(cycle*1.15));
      rig.jaw.rotation.x=.22+.08*Math.sin(cycle*2.2);
    }
    if(action==="sniff"||action==="inspect"){
      rig.neck.rotation.y=.14*Math.sin(cycle*.5);
      rig.head.rotation.y=.12*Math.sin(cycle*.42+.4);
    }
    if(action==="alert"){rig.neck.rotation.x=-.22;rig.head.rotation.x=-.14;}
    if(action==="sleep")rig.body.rotation.z=.07;
  }
  if(id==="dunlingua"){
    p.tail1.rotation.y=.13*Math.sin(cycle*.63+.4);
    p.tail2.rotation.y=.18*Math.sin(cycle*.63+.9);
    if(action==="dig"){
      rig.foreL.upper.rotation.x=-.52+.33*Math.sin(cycle*1.6);
      rig.foreR.upper.rotation.x=-.52-.33*Math.sin(cycle*1.6);
      rig.head.rotation.x=.12;rig.body.rotation.x=.09;
    }
    if(action==="scent"||action==="inspect"){
      rig.head.rotation.y=.15*Math.sin(cycle*.54);
      rig.neck.rotation.y=.06*Math.sin(cycle*.45+.5);
    }
    if(action==="feed"){
      rig.neck.rotation.x=.19;
      rig.head.rotation.x=.28+.11*Math.sin(cycle*1.6);
      rig.tongue.scale.z=.28+.72*(.5+.5*Math.sin(cycle*.9));
      rig.tongue.rotation.x=.12*Math.sin(cycle*.92);
    }
    if(action==="run"||action==="flee"){
      rig.body.rotation.y=.05*Math.sin(cycle*2.5);
      p.tail1.rotation.y=.20*Math.sin(cycle*2.0);
    }
  }
  if(id==="pica_termita"){
    if(action==="fly"){
      rig.body.position.y=.65+.07*Math.sin(cycle*2.6);
      rig.body.rotation.x=-.13;
      rig.legL.upper.rotation.x=.50;rig.legR.upper.rotation.x=.50;
      rig.wingL.wing.rotation.z=-1.03-.52*Math.sin(cycle*2.6);
      rig.wingR.wing.rotation.z=1.03+.52*Math.sin(cycle*2.6);
      rig.wingL.tip.rotation.z=-.22-.28*Math.sin(cycle*2.6+.8);
      rig.wingR.tip.rotation.z=.22+.28*Math.sin(cycle*2.6+.8);
      rig.tail.rotation.x=.21;
      rig.crest.rotation.x=-.12;
    }
    if(action==="land"){
      const progress=Math.min(1,t/1.25),ease=progress*progress*(3-2*progress);
      rig.body.position.y=.55*(1-ease);
      rig.wingL.wing.rotation.z=-.99*(1-ease);
      rig.wingR.wing.rotation.z=.99*(1-ease);
      rig.legL.upper.rotation.x=.45*(1-ease);
      rig.legR.upper.rotation.x=.45*(1-ease);
    }
    if(action==="peck"||action==="feed"){
      const tap=Math.max(0,Math.sin(cycle*2.1));
      rig.neck.rotation.x=.20+.57*tap;
      rig.head.rotation.x=.18+.23*tap;
      rig.beak.rotation.x=.10*tap;
    }
    if(action==="lookout"||action==="inspect"){
      rig.neck.rotation.y=.17*Math.sin(cycle*.43);
      rig.head.rotation.y=.23*Math.sin(cycle*.45+.2);
    }
    p.crestSprig.rotation.x=action==="crest_display"?-.22+.1*Math.sin(cycle*.85):
      action==="fly"?.12*Math.sin(cycle*2.6):.03*Math.sin(cycle*.5);
  }
}