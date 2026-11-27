import {batchInstances,terrainOcclusion} from './visibility.mjs';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
r.setPixelRatio(1);document.body.append(r.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(49,1,.35,30000);
scene.background=new T.Color(0xb9cdd6);
scene.add(new T.HemisphereLight(0xfff7df,0x9eab99,2.25));
const sun=new T.DirectionalLight(0xffedd1,1.48);sun.position.set(-3,5,2);scene.add(sun);
const controls=new OrbitControls(camera,r.domElement);controls.maxPolarAngle=Math.PI*.515;
const manifest=await (await fetch('pilot.json')).json(),[ox,oz]=manifest.origin;
const before=new T.Group(),after=new T.Group(),terrain=[],chunks=[];
scene.add(before,after);
const loader=new GLTFLoader(),simple=new T.MeshLambertMaterial({color:0xffffff});
const needle=[new T.ConeGeometry(1,1,9,2),new T.ConeGeometry(1,1,4)];
const round=[new T.IcosahedronGeometry(1,1),new T.IcosahedronGeometry(1,0)];
let blades,petals;
const bark=new T.CylinderGeometry(.65,1,1,6);
const matrix=new T.Matrix4(),q=new T.Quaternion(),v=(x,y,z)=>new T.Vector3(x,y,z);
function instance(geo,items){
 const m=new T.InstancedMesh(geo,simple,items.length);
 items.forEach(([pos,size,color],i)=>{m.setMatrixAt(i,matrix.compose(pos,q,size));m.setColorAt(i,color);});
 m.computeBoundingSphere();return m;
}
const pools=new Map();
function detailPool(mesh){
 if(pools.has(mesh))return pools.get(mesh);
 const geometry=new T.BufferGeometry();
 for(const [name,attr] of Object.entries(mesh.geometry.attributes))geometry.setAttribute(name,attr);
 const source=mesh.geometry.index.array;
 const index=new T.BufferAttribute(new source.constructor(source.length),1).setUsage(T.DynamicDrawUsage);
 geometry.setIndex(index);geometry.setDrawRange(0,0);
 const output=new T.Mesh(geometry,mesh.material);output.frustumCulled=false;mesh.parent.add(output);
 const pool={output,index,source};pools.set(mesh,pool);return pool;
}
let detailMask='';
function updateDetail(){
 const mask=chunks.map(c=>c.lod[0].visible?'1':'0').join('');
 if(mask===detailMask)return;detailMask=mask;
 for(const p of pools.values())p.count=0;
 for(const c of chunks)if(c.lod[0].visible){
  for(const {pool,spans} of c.lod[0].userData.ranges)for(const [start,n] of spans){
   pool.index.array.set(pool.source.subarray(start,start+n),pool.count);pool.count+=n;
  }
 }
 for(const p of pools.values()){
  p.output.geometry.setDrawRange(0,p.count);p.output.visible=p.count>0;
  p.index.clearUpdateRanges();if(p.count){p.index.addUpdateRange(0,p.count);p.index.needsUpdate=true;}
 }
}
function buildChunk(group,maps,trees,plants,tx,tz){
 const lod=[new T.Group(),new T.Group(),new T.Group()],cover=new T.Group(),box=new T.Box3();
 lod[0].userData.ranges=[];
 const proxies={conifer:[],broadleaf:[],bark:[]};
 for(const name of Object.keys(maps)){
  const spans=trees.map(t=>t.spans[name]).filter(Boolean);
  if(spans.length)lod[0].userData.ranges.push({pool:detailPool(maps[name]),spans});
 }
 for(const t of trees){
  const name=t.species+'_canopy',mesh=maps[name],g=mesh.geometry,[start,count]=t.spans[name];
  const b=new T.Box3(),color=new T.Color(0,0,0),sample=new T.Color();
  for(let i=start;i<start+count;i+=3){
   const ix=g.index.getX(i);b.expandByPoint(v().fromBufferAttribute(g.attributes.position,ix));
   color.add(sample.fromBufferAttribute(g.attributes.color,ix));
  }
  color.multiplyScalar(3/count);const size=b.getSize(v()),mid=b.getCenter(v());
  box.union(b);box.expandByPoint(v(...t.pivot));
  proxies[t.species].push([mid,v(size.x/2,t.species==='conifer'?size.y:size.y/2,size.z/2),color]);
  const [x,y,z]=t.pivot,h=Math.max(1,mid.y-y);
  proxies.bark.push([v(x,y+h/2,z),v(h*.032,h,h*.032),new T.Color(.18,.10,.055)]);
 }
 for(let i=0;i<2;i++){
  for(const [key,geo] of [['conifer',needle[i]],['broadleaf',round[i]],['bark',bark]]){
   if(proxies[key].length)lod[i+1].add(instance(geo,proxies[key]));
  }
 }
 const grass=[],flowers=[];
 for(const [x,y,z,type] of plants){
  box.expandByPoint(v(x,y+1,z));grass.push([v(x,y,z),v(1,1,1),new T.Color(.18,.31,.074)]);
  if(type)flowers.push([v(x,y,z),v(1,1,1),new T.Color(.92,.68,.28)]);
 }
 if(grass.length)cover.add(instance(blades,grass));
 if(flowers.length)cover.add(instance(petals,flowers));
 group.add(...lod,cover);box.expandByScalar(18);box.translate(v(tx,0,tz));
 chunks.push({lod,cover,box,center:box.getCenter(v())});
}
for(const tile of manifest.tiles){
 const [base,pilot,data]=await Promise.all([loader.loadAsync('../../../assets/world/continental-272/'+tile.id+'/'+tile.id.toLowerCase()+'_v12.glb'),loader.loadAsync(tile.source.path),fetch('models/'+tile.id+'.json').then(r=>r.json())]);
 const row=Math.round(tile.z/3750),column=Math.round(tile.x/(Math.sqrt(3)*2500)-row/2);
 const tx=Math.sqrt(3)*2500*(column+row/2)-ox,tz=row*3750-oz;
 before.add(base.scene);base.scene.position.set(tx,0,tz);
 after.add(pilot.scene);pilot.scene.position.set(tx,0,tz);
 const maps={},embedded=[];
 pilot.scene.traverse(o=>{
  if(['trunks','branches','conifer_canopy','broadleaf_canopy'].includes(o.name)){maps[o.name]=o;o.visible=false;}
  if(o.name.startsWith('clareira_')){
   const geo=o.geometry;
   if(!geo.attributes.normal)geo.computeVertexNormals();
   if(o.name.startsWith('clareira_capim'))blades??=geo;else petals??=geo;
   embedded.push(o);
  }
  if(o.name==='terrain'){terrain.push(o);o.renderOrder=-2;}
 });
 for(const o of embedded)o.removeFromParent();
 const bins=new Map();
 function bin(x,z){const key=Math.floor(x/450)+','+Math.floor(z/450);if(!bins.has(key))bins.set(key,{trees:[],plants:[]});return bins.get(key);}
 for(const t of data.trees)bin(t.pivot[0],t.pivot[2]).trees.push(t);
 for(const p of data.plants)bin(p[0],p[2]).plants.push(p);
 for(const b of bins.values())buildChunk(pilot.scene,maps,b.trees,b.plants,tx,tz);
}
scene.updateMatrixWorld(true);
const updateBatches=batchInstances(after,chunks),occlusion=terrainOcclusion(r,after,chunks);
let previousCamera="";
const ray=new T.Raycaster();
function ground(x,z){ray.set(v(x,3000,z),v(0,-1,0));return ray.intersectObjects(terrain,false)[0]?.point.y??900;}
const version=document.querySelector('#version'),preset=document.querySelector('#preset');
function frame(which){
 const y=ground(-72,30);
 const poses={air:[0,11650,1600,0,900,-1300],edge:[-530,1220,390,180,905,-75],hunter:[-72,y+1.75,30,220,y+1.6,85],island:[835,1320,965,676,905,676]};
 const p=poses[which];camera.position.set(...p.slice(0,3));controls.target.set(...p.slice(3));controls.update();
}
preset.onchange=()=>frame(preset.value);
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();r.setSize(innerWidth,innerHeight);}
onresize=resize;resize();frame('air');
const frustum=new T.Frustum(),proj=new T.Matrix4();
function draw(){
 after.visible=version.value==='after';before.visible=!after.visible;camera.updateMatrixWorld();
 frustum.setFromProjectionMatrix(proj.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 for(const c of chunks){
  const d=c.box.distanceToPoint(camera.position),visible=frustum.intersectsBox(c.box);
  const level=d<680?0:d<1900?1:2;
  c.lod.forEach((o,i)=>o.visible=visible&&d<17000&&i===level);c.cover.visible=visible&&d<750;
 }
 const key=camera.matrixWorld.elements.join()+camera.projectionMatrix.elements.join()+version.value,changed=key!==previousCamera;
 occlusion(changed,camera.position,after.visible);
 if(after.visible)updateDetail();
 if(changed && after.visible)updateBatches();previousCamera=key;
 r.render(scene,camera);
 document.querySelector('#status').textContent=r.info.render.calls+' draw calls · '+r.info.render.triangles.toLocaleString('pt-BR')+' triângulos';
}
window.review=(mode,view)=>{version.value=mode;preset.value=view;frame(view);draw();
 const buffers=new Set();(mode==='after'?after:before).traverse(o=>{if(o.geometry){for(const a of [...Object.values(o.geometry.attributes),o.geometry.index,o.instanceMatrix,o.instanceColor])if(a?.array)buffers.add(a.array.buffer);}});
 return {calls:r.info.render.calls,triangles:r.info.render.triangles,geometryArrayBytes:[...buffers].reduce((s,b)=>s+b.byteLength,0),jsHeapBytes:performance.memory?.usedJSHeapSize};
};
r.setAnimationLoop(draw);