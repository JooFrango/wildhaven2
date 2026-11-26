// Trigger v02 animated preview after workflow registration.\nimport * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
const items=[{id:"cer-stage",url:"/cervalume.glb",clip:"antler_push"},{id:"lob-stage",url:"/lobrapedra.glb",clip:"pounce"}];
const states=[];
async function setup(item){
 const host=document.getElementById(item.id);const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.setSize(host.clientWidth,host.clientHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x9f9476,1);host.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x4e4735,2.3));const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(4,7,5);scene.add(key);const fill=new THREE.DirectionalLight(0xbfd6ff,1.1);fill.position.set(-4,3,-3);scene.add(fill);
 const gltf=await new GLTFLoader().loadAsync(item.url);const root=gltf.scene;scene.add(root);root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;}});
 const box=new THREE.Box3().setFromObject(root);const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());root.position.sub(center);const extent=Math.max(size.x,size.y,size.z);
 const camera=new THREE.PerspectiveCamera(30,host.clientWidth/host.clientHeight,.01,100);camera.position.set(extent*2.15,extent*.78,extent*2.45);camera.lookAt(0,extent*.02,0);
 const mixer=new THREE.AnimationMixer(root);const clip=THREE.AnimationClip.findByName(gltf.animations,item.clip);if(!clip)throw new Error("Missing clip "+item.clip);const action=mixer.clipAction(clip);action.play();action.paused=true;
 states.push({renderer,scene,camera,root,mixer,clip,action});
}
await Promise.all(items.map(setup));
function renderPhase(phase){for(const s of states){s.action.paused=false;s.mixer.setTime((phase%1)*s.clip.duration);s.action.paused=true;s.root.updateMatrixWorld(true);s.renderer.render(s.scene,s.camera);}}
renderPhase(0);window.__wildhavenPreview={ready:true,renderPhase};