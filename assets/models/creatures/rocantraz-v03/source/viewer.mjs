import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {VARIANTS,ANIMATIONS,createRocantraz,poseRocantraz,meshStats}
  from "./rocantraz.mjs";

const canvas=document.querySelector("#render");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
renderer.setSize(window.innerWidth,window.innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x718479);
scene.fog=new THREE.Fog(0x718479,40,85);
scene.add(new THREE.HemisphereLight(0xdfe9df,0x55463a,2.1));
const sun=new THREE.DirectionalLight(0xffe2ae,3.6);sun.position.set(-13,20,14);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-24;sun.shadow.camera.right=24;
sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;sun.shadow.camera.far=65;
sun.shadow.bias=-.00035;scene.add(sun);
const camera=new THREE.PerspectiveCamera(43,window.innerWidth/window.innerHeight,.2,135);
camera.position.set(16.5,11.1,24.2);
const controls=new OrbitControls(camera,canvas);
controls.target.set(0,2.80,-1);controls.enableDamping=true;
controls.maxPolarAngle=Math.PI*.49;controls.minDistance=6;controls.maxDistance=62;
controls.update();

const materials=new Map();
function mat(hex){
 if(!materials.has(hex))materials.set(hex,new THREE.MeshStandardMaterial({
  color:hex,roughness:.98,flatShading:true}));
 return materials.get(hex);
}
function place(parent,geo,col,p,scale){
 const o=new THREE.Mesh(geo,mat(col));o.position.set(...p);o.scale.set(...scale);
 o.castShadow=o.receiveShadow=true;parent.add(o);return o;
}
let seed=2847;function rand(){
 seed=(Math.imul(1664525,seed)+1013904223)>>>0;
 return seed/4294967296;
}
const terrainMaterial={
 forest:[0x728262,0x556449,0x84936e,0x4c6050],
 desert:[0xbb9068,0xc8aa7e,0x88715b,0xc4a078]
};
const plains=new THREE.IcosahedronGeometry(1,0);
const shrub=new THREE.ConeGeometry(.27,.92,6);
const trees=new THREE.IcosahedronGeometry(1,1);
const rigs=[];
for(const [i,variant] of VARIANTS.entries()){
 const x=i===0?-6.5:6.5;
 const land=new THREE.Group();land.position.set(x,0,0);land.name="Rocantraz_V03_Diorama_"+variant;
 scene.add(land);
 const palette=terrainMaterial[variant];
 place(land,new THREE.CylinderGeometry(6.15,6.3,.40,22),
   palette[0],[0,-.34,0],[1,1,1]);
 // Scatter low scenic props, keeping the creature silhouette legible.
 for(let k=0;k<145;k++){
  const a=rand()*Math.PI*2,rr=2.6+rand()*3.36;
  const px=Math.sin(a)*rr,pz=Math.cos(a)*rr;
  if(k%7===0){
   place(land,plains,palette[2],[px,.06,pz],
    [.19+rand()*.30,.11+rand()*.23,.21+rand()*.30]);
  }else if(k%3===0){
   place(land,shrub,palette[1],
    [px,.18,pz],[.48+rand()*.45,.52+rand()*.45,.43]);
  }
 }
 // Background regional landscape: forest stones/evergreen and desert rocks.
 for(let j=0;j<3;j++){
  const tx=(j-1)*2.2,tz=-4.9+(j%2)*.65;
  if(variant==="forest"){
   place(land,new THREE.CylinderGeometry(.20,.35,2.5,7),
     0x63574a,[tx,1.17,tz],[1,1,1]);
   place(land,trees,0x596f4c,[tx,2.82,tz],
     [1.03,1.03,1.03]);
  }else{
   place(land,plains,0x91775a,[tx,1.03,tz],[.88,1.17,.68]);
  }
 }
 const obj=createRocantraz(variant);
 land.add(obj);
 rigs.push({variant,root:obj,land,action:"idle",start:0,
  stats:meshStats(obj)});
}
let manual=false,frameCount=0;
const clock=new THREE.Clock();
const variantSelect=document.querySelector("#variant");
const actionSelect=document.querySelector("#action");
let showing="both";
const speciesLabels=document.querySelector("#species");
function setView(variant,view="threeQuarter"){
 showing=variant;
 for(const m of rigs)m.land.visible=variant==="both"||variant===m.variant;
 speciesLabels.style.display=variant==="both"?"grid":"none";
 if(variant==="both"){
  camera.position.set(16.5,10.7,25.4);
  controls.target.set(0,3.00,-1.45);
 }else{
  const x=variant==="forest"?-6.5:6.5;
  const poses={
   threeQuarter:[x+8.3,8.2,14.2],
   side:[x+16.0,7.0,.40],
   front:[x,7.1,17.1],
   rear:[x-8.2,8.3,-15.1]
  };
  camera.position.set(...(poses[view]??poses.threeQuarter));
  controls.target.set(x,3.1,-1.4);
 }
 controls.update();
 if(document.querySelector("#info"))document.querySelector("#info").textContent=variant==="both"?
  "2 modelos 3D bípede" :rigs.find(r=>r.variant===variant).stats.triangles+" triângulos";
}
function setAnimation(name){
 if(!ANIMATIONS.includes(name))throw Error("Invalid Rocantraz action: "+name);
 for(const r of rigs){r.action=name;r.start=clock.getElapsedTime();}
}
variantSelect.onchange=()=>setView(variantSelect.value);
actionSelect.onchange=()=>setAnimation(actionSelect.value);
document.querySelector("#reset").onclick=()=>setAnimation(actionSelect.value);
function draw(timed=true){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=renderer.getPixelRatio();
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 if(timed)for(const r of rigs)
  poseRocantraz(r.root,r.action,clock.getElapsedTime()-r.start);
 controls.update();renderer.render(scene,camera);frameCount++;
}
setView("both");
window.__rocantrazStudio={
 scene,camera,renderer,rigs,
 get status(){return {frameCount,
  creatures:rigs.map(r=>({variant:r.variant,...r.stats}))};},
 renderStill:({variant="both",view="threeQuarter",action="idle",time=.2})=>{
  manual=true;setView(variant,view);
  for(const r of rigs)poseRocantraz(r.root,action,time);
  draw(false);
 }
};
function animate(){
 if(manual)return;
 requestAnimationFrame(animate);draw(true);
}
animate();
