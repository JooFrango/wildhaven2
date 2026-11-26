import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { create,pose } from "./fauna.mjs";
import { colony,feed,advance,animationFromColony } from "./ecology.mjs";

/** Independent, real polygonal biome scene to test 3D models and feeding reach.
 * The official game terrain files are not touched. */
const canvas=document.querySelector("#render");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.28;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x36413a);
scene.fog=new THREE.Fog(0x36413a,30,85);
scene.add(new THREE.HemisphereLight(0xfff4d7,0x455847,2.2));
const light=new THREE.DirectionalLight(0xffe0b6,3.3);
light.position.set(-10,19,10);light.castShadow=true;
light.shadow.mapSize.set(2048,2048);
light.shadow.camera.left=-26;light.shadow.camera.right=26;
light.shadow.camera.top=26;light.shadow.camera.bottom=-26;
light.shadow.camera.near=.2;light.shadow.camera.far=65;light.shadow.bias=-.00018;
scene.add(light);
const camera=new THREE.PerspectiveCamera(46,1,.1,120);
camera.position.set(3.2,7.2,19.0);
const orbit=new OrbitControls(camera,canvas);
orbit.target.set(0,1.0,-.2);orbit.enableDamping=true;
orbit.minDistance=5;orbit.maxDistance=65;
orbit.maxPolarAngle=Math.PI*.49;orbit.update();
const MAT=new Map();
function m(color){
 if(!MAT.has(color))MAT.set(color,new THREE.MeshStandardMaterial({
   color,roughness:.97,flatShading:true
 }));
 return MAT.get(color);
}
function poly(parent,shape,color,xyz,scale,rot){
 const mesh=new THREE.Mesh(shape,m(color));
 mesh.position.set(...xyz);mesh.scale.set(...scale);
 if(rot)mesh.rotation.set(...rot);
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
 return mesh;
}
const primitive={
 rock:new THREE.IcosahedronGeometry(1,1),
 pebble:new THREE.DodecahedronGeometry(1,0),
 leaf:new THREE.IcosahedronGeometry(1,0),
 trunk:new THREE.CylinderGeometry(.13,.25,1,6),
 blade:new THREE.ConeGeometry(.18,.8,5),
};
const stageDefs=[
 {id:"ferrunco",label:"Mata das Colinas Verdes",x:-8.2,soil:0x59754f,accent:0x426045,mound:0.88,animalZ:-3.20,action:"dig"},
 {id:"dunlingua",label:"Cânion das Cinzas",x:0,soil:0xb98c58,accent:0x91613f,mound:0.78,animalZ:-3.55,action:"feed"},
 {id:"pica_termita",label:"Campos do Sol",x:8.2,soil:0x879764,accent:0x69834d,mound:0.74,animalZ:-2.24,action:"peck"},
];
const stages=[];
let seed=909;
function random(){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 return seed/4294967296;
}
function plantTree(g,x,z,scale=1){
 const stem=poly(g,primitive.trunk,0x615344,[x,1.18*scale,z],[scale,2.25*scale,scale]);
 for(let i=0;i<5;i++){
   const a=i*2.39996;
   poly(g,primitive.leaf,i%2?0x4b6950:0x6d8555,
     [x+Math.cos(a)*.29*scale,(2.07+i%3*.28)*scale,
      z+Math.sin(a)*.26*scale],
     [(.66+i%3*.1)*scale,(.68+i%2*.16)*scale,
      (.70+i%4*.07)*scale]);
 }
 return stem;
}
function makeStage(def,index) {
 const group=new THREE.Group();
 group.name="Biome_"+def.id;
 group.position.x=def.x;scene.add(group);
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(4.12,4.24,.34,13),m(def.soil));
 floor.position.y=-.28;floor.receiveShadow=true;group.add(floor);
 const body=create(def.id),termite=create("cupinzeiro");
 const moundSize=def.mound;
 body.position.set(0,0,def.animalZ);
 termite.position.set(0,0,.62);
 termite.scale.setScalar(moundSize);
 body.rotation.y=0;termite.rotation.y=-.23;
 group.add(body,termite);
 const pieces=[];
 for(let i=0;i<44;i++){
   const a=random()*Math.PI*2,rad=1.85+random()*2;
   const x=Math.cos(a)*rad,z=Math.sin(a)*rad-.10;
   if(z<def.animalZ+.45&&Math.abs(x)<1.25)continue;
   if(index===0){
     if(i%9===0&&Math.abs(x)>2)pieces.push(plantTree(group,x,z,.35+random()*.20));
     else if(i%5!==0)
       pieces.push(poly(group,primitive.leaf,i%3?0x486448:0x8a9b59,
         [x,.09,z],[.14,.07,.29],[random()*.25,random()*6.28,random()*.3]));
     else pieces.push(poly(group,primitive.rock,0x656e55,
       [x,.12,z],[.27,.19,.34]));
   } else if(index===1){
     if(i%3===0)pieces.push(poly(group,primitive.rock,i%2?0xac7954:0x8b614b,
       [x,.13,z],[.31+random()*.35,.23+random()*.26,.43],
       [0,random()*6.28,.1]));
     else pieces.push(poly(group,primitive.blade,i%3?0xbca170:0xb2a078,
       [x,.18,z],[.30,.45,.24],[0,random()*6.28,.28]));
   }else{
     if(i%4!==0){
       const tuft=new THREE.Group();tuft.position.set(x,.01,z);group.add(tuft);
       for(let k=0;k<5;k++)pieces.push(poly(tuft,primitive.blade,
         k%2?0xb0a65e:0x65864b,
         [(k-2)*.043,.16,0],[.22,.35,.20],
         [.10,(k-2)*.18,(k-2)*.16]));
     }else pieces.push(poly(group,primitive.rock,0x8c9a78,
       [x,.10,z],[.23,.12,.31]));
   }
 }
 const c=colony(16000);
 const result={...def,index,group,body,termite,pieces,colony:c,
   action:def.action,actionStart:0,updatedAt:0};
 stages.push(result);
 return result;
}
stageDefs.forEach(makeStage);
const list=document.querySelector("#stage");
const status=document.querySelector("#counter");
const clock=new THREE.Clock();
let active="all";
function getActive(){
 return stages.find(x=>x.id===active)??stages[0];
}
function focus(id){
 active=id;
 list.value=id;
 for(const s of stages){s.group.visible=id==="all"||s.id===id;}
 document.querySelector("#names").style.display=id==="all"?"grid":"none";
 if(id==="all"){
   camera.position.set(3.2,7.2,19.0);orbit.target.set(0,1.0,-.20);
 }else{
   const s=getActive();
   camera.position.set(s.x+8.2,4.65,2.0);
   orbit.target.set(s.x,1.05,-1.10);
 }
 orbit.update();
 updateStatus();
}
function updateStatus(){
 if(active==="all"){
   const all=stages.map(s=>s.colony.population.toLocaleString("pt-BR"));
   status.textContent="Cupins: "+all.join(" / ");
 }else{
   const c=getActive().colony;
   status.textContent="Cupins: "+c.population.toLocaleString("pt-BR")+
    (c.extinct?" · COLÔNIA EXTINTA":" · colônia viva");
 }
}
function eat(id){
 const s=stages.find(x=>x.id===id);
 if(!s)return false;
 const result=feed(s.colony,id);
 s.colony=result.colony;
 s.action=result.consumed>0?s.action:"idle";
 s.actionStart=clock.getElapsedTime();
 updateStatus();
 return result.consumed;
}
function grow(days=15){
 for(const s of stages)s.colony=advance(s.colony,days,s.id==="dunlingua"?"dry":"wet");
 updateStatus();
}
function empty(id){
 const s=stages.find(x=>x.id===id);if(!s)return;
 s.colony=feed({...s.colony,population:1,extinct:false},id).colony;
 updateStatus();
}
function reset(){
 for(const s of stages){
   s.colony=colony(16000);s.actionStart=clock.getElapsedTime();
 }
 updateStatus();
}
list.addEventListener("change",()=>focus(list.value));
document.querySelector("#feed").addEventListener("click",()=>{
 if(active==="all"){for(const s of stages)eat(s.id);}else eat(active);
});
document.querySelector("#grow").addEventListener("click",()=>grow(15));
document.querySelector("#deplete").addEventListener("click",()=>{
 if(active==="all"){for(const s of stages)empty(s.id);}else empty(active);
});
document.querySelector("#reset").addEventListener("click",reset);
focus("all");
window.__wildhavenTestScene={
 stages,focus,eat,grow,empty,reset,scene,camera,renderer,orbit,
 get snapshots(){return stages.map(s=>({
   id:s.id,population:s.colony.population,integrity:s.colony.integrity,extinct:s.colony.extinct,
   animal:s.body.position.toArray(),mound:s.termite.position.toArray(),
   parent:s.group.position.toArray(),
 }));},
};
function render(){
 requestAnimationFrame(render);
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=renderer.getPixelRatio();
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 const time=clock.getElapsedTime();
 for(const s of stages){
   const alive=s.colony.population>0;
   const animalAct=alive?s.action:"idle";
   pose(s.body,animalAct,Math.max(0,time-s.actionStart));
   const state=animationFromColony(s.colony);
   pose(s.termite,state,state==="active"?time*.36:
     state==="damaged"?time*.2:Math.max(0,time-s.actionStart));
 }
 orbit.update();renderer.render(scene,camera);
}
render();
