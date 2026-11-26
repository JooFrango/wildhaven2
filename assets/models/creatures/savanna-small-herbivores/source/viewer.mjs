import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {SPECIES,create,pose,meshStats} from "./fauna.mjs";
const canvas=document.querySelector("#world");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.35;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x7c8c78);
scene.fog=new THREE.Fog(0x7c8c78,22,53);
scene.add(new THREE.HemisphereLight(0xfff0ce,0x59674e,2.8));
const sun=new THREE.DirectionalLight(0xffdcb1,3.1);
sun.position.set(-6,10,9);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-12;sun.shadow.camera.right=12;
sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;
sun.shadow.camera.far=35;sun.shadow.bias=-.0003;scene.add(sun);
const camera=new THREE.PerspectiveCamera(43,1,.08,90);
camera.position.set(3.2,2.7,5.5);
const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,.48,0);
orbit.enableDamping=true;orbit.minDistance=1.7;orbit.maxDistance=20;
orbit.maxPolarAngle=Math.PI*.49;orbit.update();
const mat=new Map();
function material(color){
 if(!mat.has(color))mat.set(color,new THREE.MeshStandardMaterial({color,roughness:.96,flatShading:true}));
 return mat.get(color);
}
function shape(parent,geo,color,pos,scale,rot){
 const o=new THREE.Mesh(geo,material(color));o.position.set(...pos);
 o.scale.set(...scale);if(rot)o.rotation.set(...rot);
 o.receiveShadow=o.castShadow=true;parent.add(o);return o;
}
const rock=new THREE.DodecahedronGeometry(1,0);
const grass=new THREE.ConeGeometry(.055,.3,4);
const pads=[];
const models=[];
let seed=79193;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(const [i,id] of Object.keys(SPECIES).entries()){
 const x=i===0?-1.35:1.35;
 const land=new THREE.Group();land.name="Diorama_"+id;land.position.x=x;scene.add(land);
 shape(land,new THREE.CylinderGeometry(1.24,1.30,.12,15),id==="velsari"?0xa49a6a:0xa28b61,[0,-.115,0],[1,1,1]);
 for(let k=0;k<100;k++){
  const a=rand()*Math.PI*2,r=.49+rand()*.76;
  const xx=Math.cos(a)*r,zz=Math.sin(a)*r;
  if(k%10===0)shape(land,rock,k%2?0x7e7a5c:0x9b8561,
    [xx,.02,zz],[.10+rand()*.13,.09+rand()*.08,.14+rand()*.10],[0,rand()*6.28,0]);
  else if(Math.abs(xx)>.42||Math.abs(zz)>.53) {
    for(let q=0;q<3;q++)shape(land,grass,
      (k+q)%3?0x8e9a50:0xc5b468,
      [xx+(q-1)*.05,.065,zz+q*.025],
      [.5+rand()*.35,.6+rand()*.55,.5],[0,rand()*6.28,(q-1)*.2]);
  }
 }
 const obj=create(id);land.add(obj);
 models.push({id,obj,land,clip:"idle",started:0,stats:meshStats(obj)});
 pads.push(land);
}
const clipPicker=document.querySelector("#clip");
const speciesPicker=document.querySelector("#species");
const info=document.querySelector("#info");
const clock=new THREE.Clock();
let manual=false,frames=0,visible="all";
function setupClips(species){
 const actions=species==="all"?["idle","walk","alert","graze","forage","run","trot","dig","leap","rest","death"]:
  SPECIES[species].clips;
 clipPicker.innerHTML="";
 for(const action of actions){
  const opt=document.createElement("option");
  opt.value=action;opt.textContent=action;clipPicker.appendChild(opt);
 }
}
function focus(species){
 visible=species;
 for(const model of models)model.land.visible=species==="all"||model.id===species;
 document.querySelector("#labels").style.display=species==="all"?"grid":"none";
 if(species==="all"){camera.position.set(3.2,2.7,5.5);orbit.target.set(0,.48,0);}
 else{
  const x=species==="velsari"?-1.35:1.35;
  camera.position.set(x+1.65,1.55,2.70);
  orbit.target.set(x,.52,0);
 }
 orbit.update();
 setupClips(species);
 info.textContent=species==="all"?"2 modelos 3D reais":
  models.find(m=>m.id===species)?.stats?.triangles+" triângulos";
}
speciesPicker.onchange=()=>focus(speciesPicker.value);
clipPicker.onchange=()=>{
 for(const model of models){
  model.clip=SPECIES[model.id].clips.includes(clipPicker.value)?clipPicker.value:"idle";
  model.started=clock.getElapsedTime();
 }
};
document.querySelector("#reset").onclick=()=>{
 for(const m of models)m.started=clock.getElapsedTime();
};
focus("all");
function draw(useClock=true){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=renderer.getPixelRatio();
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 if(useClock)for(const m of models)
   pose(m.obj,m.clip,Math.max(0,clock.getElapsedTime()-m.started));
 orbit.update();renderer.render(scene,camera);frames++;
}
window.__savannaPreview={
 models,camera,scene,renderer,
 get status(){return {frames,models:models.map(m=>({id:m.id,...m.stats}))};},
 renderStill:({species="all",action="idle",view="threeQuarter",time=0})=>{
  manual=true;focus(species);
  for(const m of models){
   const chosen=SPECIES[m.id].clips.includes(action)?action:"idle";
   pose(m.obj,chosen,time);
   m.clip=chosen;
  }
  if(species!=="all"){
   const x=species==="velsari"?-1.35:1.35;
   const setups={
    threeQuarter:[x+1.70,1.56,2.80],
    side:[x+3.12,1.28,.08],
    front:[x,.98,3.0],
    action:[x+1.76,1.40,2.68]
   };
   const position=setups[view]??setups.threeQuarter;
   camera.position.set(...position);
   orbit.target.set(x,.55,0);orbit.update();
  }else{
    camera.position.set(2.9,2.4,5.5);orbit.target.set(0,.52,0);orbit.update();
  }
  draw(false);
 }
};
function frame(){
 if(manual)return;
 requestAnimationFrame(frame);
 draw(true);
}
frame();
