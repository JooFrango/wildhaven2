import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x1b2422);
const camera=new THREE.OrthographicCamera(-10.7,10.7,6.02,-6.02,0.1,150);
camera.up.set(0,0,1);
camera.position.set(-8,-21,8);camera.lookAt(1.4,0,2.65);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(720,405);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe2e7f0,0x5c5445,2.6));
const key=new THREE.DirectionalLight(0xffe4b0,3.5);
key.position.set(-8,-9,14);scene.add(key);
const fill=new THREE.DirectionalLight(0xd4e6fb,1.3);
fill.position.set(9,8,9);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),
 new THREE.MeshStandardMaterial({color:0x555448,roughness:1}));
ground.position.z=-0.13;scene.add(ground);
const grid=new THREE.GridHelper(22,22,0x898c75,0x53584e);
grid.rotation.x=Math.PI/2;grid.position.z=-.12;scene.add(grid);
let mixer,clips;
window.__error='';
new GLTFLoader().load('/assets/models/creatures/sirocauro/v03/sirocauro-v03-rig41-malha-corrigida.glb',
 g=>{
  let skinned=0;g.scene.traverse(x=>{if(x.isSkinnedMesh)skinned++});
  if(!skinned){window.__error='GLB lacks SkinnedMesh';return;}
  scene.add(g.scene);clips=g.animations;mixer=new THREE.AnimationMixer(g.scene);
  if(clips.length!==41){window.__error='Expected 41 clips, got '+clips.length;return;}
  window.__clips=clips.map(c=>c.name);window.__ready=true;
  renderer.render(scene,camera);
 },undefined,e=>{window.__error=String(e)});
window.__pose=(name,time,label)=>{
 if(!window.__ready)throw new Error(window.__error||'GLB not ready');
 const c=clips.find(c=>c.name===name);
 if(!c)throw new Error('missing '+name);
 mixer.stopAllAction();
 const a=mixer.clipAction(c);
 a.reset().play();a.setLoop(THREE.LoopOnce,1);
 a.clampWhenFinished=true;
 mixer.setTime(Math.max(0,Math.min(time,c.duration-0.00001)));
 document.querySelector('#label').textContent=label;
 renderer.render(scene,camera);
 return {clip:name,seconds:c.duration,time,hasSkeleton:true};
};