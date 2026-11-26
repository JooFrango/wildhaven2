import {TerrainCollider} from './collision.mjs';

export async function startRange(THREE, GLTFLoader, region, assetURL) {
  const canvas=document.querySelector('canvas');
  let hud=document.querySelector('#hud');
  if(!hud){hud=document.createElement('div');hud.id='hud';document.body.append(hud);}
  hud.innerHTML='<strong>Serra Oriental</strong><p>Clique para explorar · WASD para andar · mouse ou setas para olhar · Shift para correr · Esc para soltar o mouse</p><output>Carregando o sopé…</output>';
  hud.style.cssText='position:fixed;top:12px;left:12px;max-width:340px;background:#12241de8;color:#fff;padding:12px 16px;border-radius:8px;font:14px system-ui;pointer-events:none';
  document.body.style.margin='0';canvas.style.cssText='display:block;width:100vw;height:100vh';
  const output=hud.querySelector('output');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(68,1,.2,25000);
  scene.background=new THREE.Color(0xaec9d6);scene.fog=new THREE.FogExp2(0xb9d0d7,.00010);
  scene.add(new THREE.HemisphereLight(0xfff9ed,0x819179,1.8));
  const sun=new THREE.DirectionalLight(0xfff5dc,2.3);sun.position.set(-2000,3400,1350);scene.add(sun);
  const ground=new TerrainCollider(region.obstacles),loaded=new Map(),pending=new Set(),keys=new Set();
  const loader=new GLTFLoader();let x=region.spawn[0],z=region.spawn[1],heading=.7,pitch=0,last=performance.now(),streamAt=0;
  let width=0,height=0;
  async function load(t){
    if(loaded.has(t.id)||pending.has(t.id))return;
    pending.add(t.id);
    try{
      const gltf=await loader.loadAsync(assetURL(t.model_path)),s=gltf.scene;
      const mesh=s.getObjectByName('terrain');if(!mesh?.isMesh)throw Error('Terreno ausente em '+t.id);
      ground.add(t.id,t.center_x,t.center_z,mesh.geometry.attributes.position.array,mesh.geometry.index.array);
      s.traverse(o=>{if(o.name.includes('side_cut'))o.visible=false;});
      s.position.set(t.center_x,0,t.center_z);scene.add(s);loaded.set(t.id,s);
    }finally{pending.delete(t.id);}
  }
  function distance(t){return Math.hypot(x-t.center_x,z-t.center_z);}
  async function stream(){
    const nearby=region.tiles.filter(t=>distance(t)<8200).sort((a,b)=>distance(a)-distance(b));
    for(const tile of nearby)await load(tile);
    for(const tile of region.tiles){
      if(distance(tile)<11500||!loaded.has(tile.id))continue;
      const s=loaded.get(tile.id);scene.remove(s);ground.tiles.delete(tile.id);loaded.delete(tile.id);
      s.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [].concat(o.material))m.dispose();}});
    }
  }
  const first=[...region.tiles].sort((a,b)=>distance(a)-distance(b));
  for(const t of first.slice(0,3)){await load(t);if(ground.height(x,z)!==null)break;}
  if(ground.height(x,z)===null)throw Error('Ponto inicial sem apoio.');
  const fail=e=>{output.textContent='Falha ao carregar terreno: '+e.message;};
  let streaming=false;
  function updateStream(){
    if(streaming)return;
    streaming=true;stream().catch(fail).finally(()=>{streaming=false;});
  }
  const focus=()=>canvas.requestPointerLock?.()?.catch?.(()=>{});
  canvas.addEventListener('click',focus);
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){heading-=e.movementX*.002;pitch=Math.max(-1.4,Math.min(1.4,pitch-e.movementY*.002));}});
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
  function animate(now){
    const dt=Math.min(.06,(now-last)/1000);last=now;
    heading+=((keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0))*dt*1.65;
    const f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
    const r=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    const scale=dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?15:5)/Math.max(1,Math.hypot(f,r));
    const dx=(-f*Math.sin(heading)+r*Math.cos(heading))*scale,dz=(-f*Math.cos(heading)-r*Math.sin(heading))*scale;
    if(f||r){
      for(const [xx,zz] of [[x+dx,z+dz],[x+dx,z],[x,z+dz]]){
        if((xx!==x||zz!==z)&&ground.step(x,z,xx,zz)!==null){x=xx;z=zz;break;}
      }
    }
    if(now>streamAt){streamAt=now+850;updateStream();}
    const y=ground.height(x,z);camera.position.set(x,y+2.15,z);camera.rotation.order='YXZ';camera.rotation.set(pitch,heading,0);
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(w!==width||h!==height){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();width=w;height=h;}
    output.textContent='Altitude '+Math.round(y)+' m';
    canvas.dataset.position=x.toFixed(3)+','+z.toFixed(3);
    renderer.render(scene,camera);requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
