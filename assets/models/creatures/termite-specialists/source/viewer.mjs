import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { create,pose,ANIMATIONS,SPECIES } from "./fauna.mjs";

const canvas=document.querySelector("#view");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.28;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x354039);
scene.fog=new THREE.Fog(0x354039,24,55);
const camera=new THREE.PerspectiveCamera(44,1,.1,120);
camera.position.set(6.3,5.6,14.1);
const orbit=new OrbitControls(camera,canvas);
orbit.target.set(0,1.0,0);orbit.enableDamping=true;
orbit.minDistance=3;orbit.maxDistance=44;orbit.maxPolarAngle=Math.PI*.49;
orbit.update();
scene.add(new THREE.HemisphereLight(0xeaf9ec,0x4d5844,2));
const sun=new THREE.DirectionalLight(0xffe2bb,3.6);
sun.position.set(-7,13,9);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-18;sun.shadow.camera.right=18;
sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;
scene.add(sun);
const floor=new THREE.Mesh(new THREE.CylinderGeometry(11.5,11.7,.25,12),new THREE.MeshStandardMaterial({color:0x27332e,roughness:1,flatShading:true}));
floor.position.y=-.25;floor.receiveShadow=true;scene.add(floor);
const xPos=[-5.1,-1.7,1.9,5.5];
const colors=[0x66835a,0xa87c53,0xb1a07b,0x9e7650];
const previewScales=[1,1,1.85,.82];
const models=[];
const platforms=[];
for(let i=0;i<SPECIES.length;i++){
  const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.62,.18,12),
    new THREE.MeshStandardMaterial({color:colors[i],roughness:.99,flatShading:true}));
  pad.position.set(xPos[i],-.11,0);pad.receiveShadow=true;scene.add(pad);
  platforms.push(pad);
  const obj=create(SPECIES[i]);
  obj.position.set(xPos[i],0,0);
  obj.scale.setScalar(previewScales[i]);
  obj.rotation.y=-.33;
  obj.castShadow=true;scene.add(obj);models.push(obj);
}
const select=document.querySelector("#asset");
const action=document.querySelector("#animation");
const status=document.querySelector("#hud");
const button=document.querySelector("#isolate");
const clock=new THREE.Clock();
let start=0,isolated=false,selected=0;
const defaults=["idle","idle","idle","active"];
function refresh(){
  selected=SPECIES.indexOf(select.value);
  const id=SPECIES[selected];
  const options=ANIMATIONS[id];
  action.innerHTML=options.map(x=>'<option value="'+x+'">'+x.replaceAll("_"," ")+'</option>').join("");
  action.value=id==="cupinzeiro"?"active":"idle";
  start=clock.getElapsedTime();
  status.textContent=id+" · "+options.length+" animações";
}
select.addEventListener("change",refresh);
action.addEventListener("change",()=>{start=clock.getElapsedTime();});
button.addEventListener("click",()=>{isolated=!isolated;button.textContent=isolated?"Mostrar todos":"Mostrar selecionado";show(isolated?selected:-1);});
refresh();
function show(index){
  for(let i=0;i<models.length;i++){
    models[i].visible=index<0||index===i;
    platforms[i].visible=models[i].visible;
    models[i].position.x=index>=0?0:xPos[i];
    platforms[i].position.x=index>=0?0:xPos[i];
  }
  document.querySelector("#labels").style.display=index>=0?"none":"grid";
  if(index>=0){
    camera.position.set(3.6,3.7,index===3?7.3:6.5);
    orbit.target.set(0,index===3?1.2:.83,0);
  }else{
    camera.position.set(6.3,5.6,14.1);orbit.target.set(0,1,0);
  }
  orbit.update();
}
window.__wildhavenPreview={
  show,models,scene,renderer,camera,
  selectAnimation:(id,animation)=>{
    selected=SPECIES.indexOf(id);select.value=id;refresh();action.value=animation;
    start=clock.getElapsedTime();
    show(selected);isolated=true;
  }
};
function frame(){
  requestAnimationFrame(frame);
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=renderer.getPixelRatio();
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  const time=clock.getElapsedTime();
  for(let i=0;i<models.length;i++){
    const m=models[i],a=i===selected?action.value:defaults[i];
    const t=i===selected?time-start:time;
    pose(m,a,Math.max(0,t));
  }
  orbit.update();renderer.render(scene,camera);
}
frame();
