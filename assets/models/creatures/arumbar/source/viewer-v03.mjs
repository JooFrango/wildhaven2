import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {ANIMATIONS} from "./arumbar.mjs";
import {createArumbarV03,poseArumbarV03} from "./arumbar-anatomy-v03.mjs";

const canvas=document.querySelector("#world");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.31;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x808f7c);
scene.fog=new THREE.Fog(0x808f7c,31,70);
scene.add(new THREE.HemisphereLight(0xe9eecb,0x7f6a45,2.5));
const sunlight=new THREE.DirectionalLight(0xffe0a4,3.7);
sunlight.position.set(-9,15,9);sunlight.castShadow=true;
sunlight.shadow.mapSize.set(1024,1024);
sunlight.shadow.camera.left=-18;sunlight.shadow.camera.right=18;
sunlight.shadow.camera.top=18;sunlight.shadow.camera.bottom=-18;
sunlight.shadow.camera.near=.3;sunlight.shadow.camera.far=42;
sunlight.shadow.bias=-.00025;scene.add(sunlight);
const camera=new THREE.PerspectiveCamera(41,1,.1,150);
camera.position.set(5.7,4.5,8.65);
const orbit=new OrbitControls(camera,canvas);
orbit.target.set(0,1.72,0);orbit.enableDamping=true;
orbit.maxPolarAngle=Math.PI*.49;orbit.minDistance=5;orbit.maxDistance=34;
orbit.update();
const m=new Map();
function material(color){
  if(!m.has(color))m.set(color,new THREE.MeshStandardMaterial({
    color,roughness:.98,flatShading:true,
  }));
  return m.get(color);
}
function terrain(geometry,color,pos,scale,rotation){
  const o=new THREE.Mesh(geometry,material(color));
  o.position.set(...pos);o.scale.set(...scale);
  if(rotation)o.rotation.set(...rotation);
  o.receiveShadow=o.castShadow=true;scene.add(o);return o;
}
// Ground is real geometric terrain for preview, not a photo or an official hex.
terrain(new THREE.CylinderGeometry(8.0,8.1,.35,18),0x9b9860,[0,-.32,0],[1,1,1]);
const groundGrass=new THREE.ConeGeometry(.13,.58,5);
const rock=new THREE.IcosahedronGeometry(1,0);
let state=5381;
function rnd(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}
for(let i=0;i<145;i++){
  const a=rnd()*Math.PI*2,rad=1.9+rnd()*5.8;
  const x=Math.cos(a)*rad,z=Math.sin(a)*rad;
  if(rad<3.3&&z>0)continue;
  if(i%7===0)terrain(rock,i%2?0xa4936d:0x817b55,[x,.06,z],
    [.18+rnd()*.3,.15+rnd()*.21,.2+rnd()*.3],[0,rnd()*6.28,0]);
  else for(let n=0;n<3;n++)
    terrain(groundGrass,(i+n)%3===0?0xc1ae63:0x7d8849,
      [x+(n-1)*.09,.18,z+n*.08],
      [.45+rnd()*.7,.65+rnd()*.9,.5],[0,rnd()*6.28,(n-1)*.11]);
}
function acacia(x,z,factor){
  const trunkGeo=new THREE.CylinderGeometry(.12,.27,1.0,6);
  terrain(trunkGeo,0x5e4531,[x,1.12*factor,z],
    [factor,2.1*factor,factor],[0,0,.1]);
  for(let i=0;i<6;i++){
    const a=i*2.39996;
    terrain(new THREE.IcosahedronGeometry(1,0),
      i%2?0x677443:0x8e9851,
      [x+Math.cos(a)*.55*factor,(2.13+(i%3)*.15)*factor,
        z+Math.sin(a)*.33*factor],
      [(1.07+(i%2)*.08)*factor,.31*factor,.74*factor]);
  }
}
acacia(-6,-4,.75);acacia(5.6,-5,.72);acacia(-6,3.8,.48);
const arumbar=createArumbarV03();
arumbar.name="Arumbar_v03_HighPoly_Real";
scene.add(arumbar);
const actionPicker=document.querySelector("#action");
const clock=new THREE.Clock();
let active="idle",origin=0,rendered=0,manualMode=false;
actionPicker.onchange=()=>{
  active=actionPicker.value;origin=clock.getElapsedTime();
  document.querySelector("#status").textContent="v03 anatomy · Animação: "+active;
};
document.querySelector("#restart").onclick=()=>{origin=clock.getElapsedTime();};
const positions={
  threeQuarter:{camera:[5.7,4.5,8.65],target:[0,1.72,0]},
  side:{camera:[10.2,3.9,0.5],target:[0,1.67,0]},
  front:{camera:[0,3.85,9.4],target:[0,1.68,0]},
  rear:{camera:[-5.3,5.0,-12.0],target:[0,1.70,0]},
  grazing:{camera:[5.8,4.1,9.1],target:[0,1.35,0]},
};
window.__arumbarStudio={
  scene,arumbar,renderer,clock,positions,
  setAnimation:(name,time=0)=>{
    if(!ANIMATIONS.includes(name))throw Error("Invalid "+name);
    active=name;actionPicker.value=name;
    origin=clock.getElapsedTime()-time;
    poseArumbarV03(arumbar,name,time);
  },
  setView:name=>{
    const view=positions[name];
    if(!view)throw Error("Unknown view "+name);
    camera.position.set(...view.camera);orbit.target.set(...view.target);
    orbit.update();
  },
  snapshot:()=>({meshes:(()=>{let n=0;arumbar.traverse(o=>{if(o.isMesh)n++});return n})(),
    action:active,view:camera.position.toArray(),frame:rendered}),
  // Freeze animation before screenshots: software WebGL does not need to
  // re-render 182k triangles on every animation frame while encoding PNG.
  renderStill:(view,animation,time)=>{
    if(!ANIMATIONS.includes(animation))throw Error("Invalid action: "+animation);
    if(!positions[view])throw Error("Invalid camera: "+view);
    manualMode=true;
    active=animation;actionPicker.value=animation;
    const target=positions[view];
    camera.position.set(...target.camera);
    orbit.target.set(...target.target);
    draw(animation,time);
  },
};
function draw(animation,t){
 const w=canvas.clientWidth,h=canvas.clientHeight,pixel=renderer.getPixelRatio();
 if(canvas.width!==Math.round(w*pixel)||canvas.height!==Math.round(h*pixel)){
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 poseArumbarV03(arumbar,animation,t);
 orbit.update();renderer.render(scene,camera);rendered++;
}
function frame(){
 if(manualMode)return;
 requestAnimationFrame(frame);
 draw(active,Math.max(0,clock.getElapsedTime()-origin));
}
frame();
