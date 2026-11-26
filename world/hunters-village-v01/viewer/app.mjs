import {Village,Ground,localAccount,walkingHeight,blocked,disposeGroup} from '../runtime.mjs'

export async function startVillage(T,OrbitControls,GLTFLoader,assetUrl,worldUrl){
const ui=id=>document.getElementById(id),canvas=ui('scene'), status=ui('status')
const say=(s,busy=false)=>{status.textContent=s;status.setAttribute('aria-busy',String(busy))}
const read=async url=>{const r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);return r.json()}
const renderer=new T.WebGLRenderer({canvas,antialias:true,logarithmicDepthBuffer:true,preserveDrawingBuffer:true})
const gl=renderer.getContext(),adapterInfo=gl.getExtension('WEBGL_debug_renderer_info')
const software=adapterInfo && /swiftshader|llvmpipe|software rasterizer|basic render driver/i.test(gl.getParameter(adapterInfo.UNMASKED_RENDERER_WEBGL))
renderer.setPixelRatio(software?Math.min(.75,600/innerWidth):Math.min(1.65,devicePixelRatio))
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap
const scene=new T.Scene();scene.background=new T.Color('#b9c8c5')
const camera=new T.PerspectiveCamera(43,1,.08,350000)
const controls=new OrbitControls(camera,canvas)
controls.maxPolarAngle=Math.PI*.489;controls.minDistance=3;controls.maxDistance=200000
const hemi=new T.HemisphereLight(0xfffaeb,0x788975,1.8);scene.add(hemi)
const sun=new T.DirectionalLight(0xffe4bb,2.35);scene.add(sun,sun.target);sun.castShadow=true
sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-76,right:76,top:76,bottom:-76,near:1,far:390})
sun.shadow.normalBias=.035;sun.shadow.bias=-.00025;sun.shadow.camera.updateProjectionMatrix()
const group=new T.Group();scene.add(group)
const loader=new GLTFLoader(),keys=new Set(),frames=[]
let player,site,progress,composition,ground,landRoot,landLod=false,forest,world,marker,mode='village',walking=false,ready=false,epoch=0
let yaw=0,tilt=.01,position=new T.Vector2(),last=0,dirty=true,account,neighborEpoch=0
const mapSamples=new Map(),neighbors=new Map(),inflight=new Map()
let canopyBatches=[],lastTreeFocus=null
const modes={village:'Núcleo da vila',top:'Planta da vila',hex:'Terreno em Geometry Nodes',seam:'Junção HV_01 · FX_20',world:'170 hexágonos de origem + a vila'}
const invalidate=()=>{dirty=true}
controls.addEventListener('change',invalidate)
function resize(){
  renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();invalidate()
}
addEventListener('resize',resize);resize()
function aim(x,h,z,dx,dh,dz){
  controls.target.set(x,h,z);camera.position.set(x+dx,h+dh,z+dz);camera.up.set(0,1,0)
  camera.lookAt(controls.target);controls.update();invalidate()
}
function setLight(x,h,z){sun.target.position.set(x,h,z);sun.position.set(x-75,h+112,z+68)}
function markStage(){
  for(const b of ui('phases').children)b.setAttribute('aria-pressed',String(+b.value===player.phase))
  ui('stage').textContent=progress.phases[player.phase-1].name
}
async function stage(n){
  const change=epoch;say('Carregando fase '+n+'…',true)
  const ok=await player.set(n,['village','top'].includes(mode)?'near':'far')
  if(!ok || change!==epoch)return
  markStage();ready=true;invalidate();say(modes[mode]+' · Fase '+n)
}
function clearNeighbors(){
  ++neighborEpoch
  for(const g of neighbors.values())disposeGroup(g)
  for(const id of neighbors.keys())mapSamples.delete(id)
  neighbors.clear()
}
async function loadNeighbor(id){
  if(neighbors.has(id))return
  const version=neighborEpoch,key=id+'_'+version
  if(inflight.has(key))return inflight.get(key)
  const tile=composition.tiles.find(t=>t.id===id)
  const task=(async()=>{
  const asset=await loader.loadAsync(worldUrl('detailed/'+id.toLowerCase()+'_v12.glb'))
    if(version!==neighborEpoch){disposeGroup(asset.scene);return}
    const obj=asset.scene,dx=tile.center_x-site.worldCoord[0],dz=tile.center_z-site.worldCoord[2]
    obj.position.set(dx,0,dz)
    let surface
    obj.traverse(o=>{if(!o.isMesh)return;if(o.name==='terrain')surface=o;if(/side_cut|skirt/.test(o.name))o.visible=false})
    if(!surface)throw Error('Superfície ausente em '+id)
    mapSamples.set(id,new Ground(surface,dx,dz));neighbors.set(id,obj);group.add(obj);invalidate()
  })()
  inflight.set(key,task)
  try{await task}finally{inflight.delete(key)}
}
async function loadWorld(token){
  const a=await loader.loadAsync(worldUrl('models/world_170_v12.glb'))
  if(epoch!==token){disposeGroup(a.scene);return false}
  world=a.scene;world.position.set(-site.worldCoord[0],0,-site.worldCoord[2]);group.add(world);return true
}
async function setTerrain(coarse,token){
  if(landRoot && landLod===coarse)return true
  const file='models/hv_01_terrain'+(coarse?'_lod1':'')+'.glb'
  const groveFile='models/hv_01_forest'+(coarse?'_lod1':'')+'.glb'
  const [land,grove]=await Promise.all([file,groveFile].map(f=>loader.loadAsync(assetUrl(f))))
  if(token!==epoch){disposeGroup(land.scene);disposeGroup(grove.scene);return false}
  disposeGroup(landRoot);landRoot=land.scene;landLod=coarse;group.add(landRoot)
  disposeGroup(forest);forest=grove.scene;group.add(forest)
  canopyBatches=[];lastTreeFocus=null
  forest.traverse(o=>{
    if(o.isMesh){o.castShadow=!coarse;o.receiveShadow=!coarse}
    if(o.isInstancedMesh && !coarse)canopyBatches.push([o,o.instanceMatrix.array.slice()])
  })
  landRoot.traverse(o=>{if(o.isMesh)ground=o})
  mapSamples.set('HV_01',new Ground(ground));return true
}
function selectTrees(x,z,radius){
  if(!canopyBatches.length)return
  if(lastTreeFocus && Math.hypot(x-lastTreeFocus[0],z-lastTreeFocus[1])<15 && Math.abs(radius-lastTreeFocus[2])<22)return
  lastTreeFocus=[x,z,radius]
  for(const [o,original] of canopyBatches){
    let count=0
    for(let i=0;i<original.length;i+=16){
      if(Math.hypot(original[i+12]-x,original[i+14]-z)>radius)continue
      o.instanceMatrix.array.set(original.subarray(i,i+16),16*count++)
    }
    o.count=count;o.visible=count>0;o.instanceMatrix.needsUpdate=true
    if(count)o.computeBoundingSphere()
  }
}
function outline(){
  const pts=[]
  for(let i=0;i<=6;i++){const a=i*Math.PI/3;pts.push(new T.Vector3(2500*Math.sin(a),990,2500*Math.cos(a)))}
  const g=new T.Group(),line=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0xffbc42,depthTest:false}))
  line.renderOrder=12;g.add(line)
  const pin=new T.Mesh(new T.ConeGeometry(330,1150,6),new T.MeshBasicMaterial({color:0xf2a037}))
  pin.rotation.z=Math.PI;pin.position.y=1660;g.add(pin);return g
}
function stopWalk(remember=true){
  if(walking && remember)player.remember(position.x,position.y,yaw)
  walking=false;keys.clear();controls.enabled=true;ui('walk').textContent='Caminhar pela vila'
  ui('help').textContent='Arraste para girar. Use a roda para aproximar.'
}
async function view(name){
  const token=++epoch;ready=false;stopWalk();mode=name;ui('view').value=name
  say('Carregando '+modes[name].toLowerCase()+'…',true)
  clearNeighbors()
  if(world){disposeGroup(world);world=null}
  if(marker){disposeGroup(marker);marker=null}
  const dat=site.village_datum_m
  if(!await setTerrain(name==='world'||name==='hex',token))return
  if(!await player.set(player.phase,['top','village'].includes(name)?'near':'far',false) || token!==epoch)return
  if(name==='world'){
    if(!await loadWorld(token))return
    marker=outline();group.add(marker)
  }
  const close=name==='village'||name==='top'
  renderer.shadowMap.enabled=close&&!software;forest.visible=true
  ground.receiveShadow=close;setLight(0,dat,0)
  if(name==='village')aim(0,dat+5,-5,34,49,92)
  else if(name==='top')aim(0,dat,-5,0,144,.01)
  else if(name==='hex')aim(0,dat,0,1600,4100,5300)
  else if(name==='seam'){
    await loadNeighbor('FX_20');if(token!==epoch)return
    const t=composition.tiles.find(t=>t.id==='FX_20')
    const x=(t.center_x-site.worldCoord[0])/2,z=(t.center_z-site.worldCoord[2])/2
    aim(x,walkingHeight(mapSamples.values(),player.stage,x,z)??dat,z,330,420,510)
  }else{
    const b=new T.Box3().setFromObject(world),c=b.getCenter(new T.Vector3()),s=b.getSize(new T.Vector3())
    const span=Math.max(s.x,s.z)
    aim(c.x,c.y,c.z,span*.34,span*.55,span*.66)
    const corners=[]
    world.traverse(o=>{if(!o.isMesh)return;const box=new T.Box3().setFromObject(o)
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new T.Vector3(x,y,z))})
    for(let i=0;i<28;i++){
      camera.updateMatrixWorld()
      if(corners.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<.94&&Math.abs(q.y)<.93}))break
      camera.position.sub(controls.target).multiplyScalar(1.06).add(controls.target);controls.update()
    }
  }
  if(token!==epoch)return
  ready=true;markStage();say(modes[name]+' · Fase '+player.phase);invalidate()
}
function step(dx,dz){
  const x=position.x+dx,z=position.y+dz,target=walkingHeight(mapSamples.values(),player.stage,x,z)
  if(target===null||blocked(player.stage,x,z,target))return false
  const h=walkingHeight(mapSamples.values(),player.stage,position.x,position.y)
  if(h!==null && Math.abs(target-h)>.42+Math.hypot(dx,dz)*.75)return false
  position.set(x,z);return true
}
function syncEye(){
  const h=walkingHeight(mapSamples.values(),player.stage,position.x,position.y)??site.village_datum_m
  camera.position.set(position.x,h+1.72,position.y)
  camera.rotation.order='YXZ';camera.rotation.set(tilt,yaw,0,'YXZ');invalidate()
}
async function walk(){
  if(walking){stopWalk();await view('village');return}
  if(!ready)return
  if(mode!=='seam'&&mode!=='village')await view('village')
  let start=player.state.position
  if(mode==='seam'){
    const t=composition.tiles.find(t=>t.id==='FX_20')
    start=[(t.center_x-site.worldCoord[0])*.499,(t.center_z-site.worldCoord[2])*.499];yaw=Math.PI/6
  }else{
    if(!Array.isArray(start)||start.length!==2||!start.every(Number.isFinite))start=[-13,23]
    if(Math.hypot(...start)>1900){
      for(const e of site.edges){
        const t=composition.tiles.find(t=>t.id===e.id)
        if(Math.hypot(start[0]-t.center_x+site.worldCoord[0],start[1]-t.center_z+site.worldCoord[2])<2550)await loadNeighbor(e.id)
      }
    }
    yaw=Number.isFinite(player.state.heading)?player.state.heading:0
  }
  if(walkingHeight(mapSamples.values(),player.stage,...start)===null || blocked(player.stage,...start,walkingHeight(mapSamples.values(),player.stage,...start)))start=[-13,23]
  position.set(...start);walking=true;controls.enabled=false;tilt=0
  ui('walk').textContent='Voltar à órbita';ui('help').textContent='WASD move. Arraste para olhar. Shift corre. Esc retorna.'
  canvas.focus();syncEye()
}
let drag=null
canvas.addEventListener('pointerdown',e=>{if(walking){drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)}})
canvas.addEventListener('pointermove',e=>{if(walking&&drag){yaw-=(e.clientX-drag[0])*.005;tilt=Math.max(-1.0,Math.min(1.15,tilt-(e.clientY-drag[1])*.005));drag=[e.clientX,e.clientY];syncEye()}})
canvas.addEventListener('pointerup',()=>{drag=null})
canvas.addEventListener('pointercancel',()=>{drag=null})
addEventListener('keydown',e=>{
  if(!walking)return
  if(e.code==='Escape'){walk().catch(fail);return}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);e.preventDefault()}
})
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear())
addEventListener('pagehide',()=>{if(walking)player.remember(position.x,position.y,yaw)})
let checkAt=0
function tick(now){
  const dt=Math.min(.06,(now-last)/1000);last=now
  if(walking&&ready&&keys.size){
    const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)
    const side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))
    yaw+=dt*1.5*(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))
    const s=dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?7:3.5)/Math.max(1,Math.hypot(side,forward))
    const dx=(side*Math.cos(yaw)-forward*Math.sin(yaw))*s, dz=(-side*Math.sin(yaw)-forward*Math.cos(yaw))*s
    if(!step(dx,dz)){if(!step(dx,0))step(0,dz)}
    if(now>checkAt){
      checkAt=now+800
      for(const e of site.edges){
        const t=composition.tiles.find(v=>v.id===e.id),dist=Math.hypot(position.x-t.center_x+site.worldCoord[0],position.y-t.center_z+site.worldCoord[2])
        if(dist<2390)loadNeighbor(e.id).catch(fail)
        else if(dist>2850&&neighbors.has(e.id)){disposeGroup(neighbors.get(e.id));neighbors.delete(e.id);mapSamples.delete(e.id)}
      }
    }
    syncEye()
  }
  if(dirty){
    if(walking)selectTrees(position.x,position.y,640)
    else selectTrees(controls.target.x,controls.target.z,Math.max(245,camera.position.distanceTo(controls.target)*2.4))
    const start=performance.now();renderer.render(scene,camera);frames.push(performance.now()-start)
    if(frames.length>100)frames.shift();dirty=false
  }
  requestAnimationFrame(tick)
}
function fail(error){say('Falha ao abrir o cenário · '+error.message);console.error(error)}
async function main(){
  ;[site,progress,composition]=await Promise.all(['site.json','progression.json','composition_171.json'].map(p=>read(assetUrl(p))))
  const id=new URL(location.href).searchParams.get('conta')||'visitante-local'
  account=localAccount(id);player=new Village(T,loader,group,assetUrl,progress.phases,account)
  for(const s of progress.phases){const b=document.createElement('button');b.type='button';b.value=s.phase;b.textContent=s.phase;b.title=s.name;b.setAttribute('aria-label',s.phase+' · '+s.name);b.onclick=()=>stage(s.phase).catch(fail);ui('phases').append(b)}
  ui('view').onchange=e=>view(e.target.value).catch(fail);ui('walk').onclick=()=>walk().catch(fail)
  requestAnimationFrame(tick);await view('village')
  controls.addEventListener('end',async()=>{
    if(!ready||walking||!['village','top'].includes(mode))return
    const detail=camera.position.distanceTo(controls.target)>190?'far':'near'
    try{if(await player.set(player.phase,detail,false))invalidate()}catch(e){fail(e)}
  })
  window.villageQA={view,stage,walk,step,renderer,camera,controls,get mode(){return mode},get ready(){return ready},
    get walking(){return walking},get phase(){return player.phase},get point(){return [position.x,position.y]},
    get stageLayers(){return player.current?.children.length??0},get neighbors(){return [...neighbors.keys()]},
    get worldTiles(){return composition.tile_count},get metrics(){return {triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}},
    measure:async(n=12)=>{const ticks=[];let last=performance.now();for(let i=0;i<n;i++){await new Promise(requestAnimationFrame);renderer.render(scene,camera);const now=performance.now();ticks.push(now-last);last=now}return ticks},
    height:(x,z)=>walkingHeight(mapSamples.values(),player.stage,x,z)}
}
try{await main()}catch(e){fail(e);throw e}
}

