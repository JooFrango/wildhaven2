import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const canvas=document.querySelector('canvas'),status=document.querySelector('output'),picker=document.querySelector('#tile');
const scene=new T.Scene(),renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
scene.background=new T.Color(0xb7d1d7);
scene.fog=new T.FogExp2(0xc6dada,.0000024);
scene.add(new T.HemisphereLight(0xfff4df,0x8eada1,1.55));
const sun=new T.DirectionalLight(0xffe4b8,2.05);sun.position.set(-.55,1,-.45);scene.add(sun);
const camera=new T.PerspectiveCamera(41,1,2,650000);
const controls=new OrbitControls(camera,canvas);
controls.minDistance=65;controls.maxDistance=380000;controls.maxPolarAngle=Math.PI*.493;
controls.zoomToCursor=true;
const loader=new GLTFLoader(),full=new Map(),loading=new Set(),far=new Map(),desired=new Set();
const names={glacial:'Glacial',praia:'Praia',dunas:'Dunas',falesia:'Falésia',arcos:'Arcos'};
const fetchJSON=async url=>{const r=await fetch(url);if(!r.ok)throw Error(url);return r.json();};
const [catalog,plan]=await Promise.all([fetchJSON('/viewer/continente/composition.json'),fetchJSON('/perimetro.json')]);
const byId=new Map(catalog.tiles.map(t=>[t.id,t]));
const border=new Map(plan.boundary.map(t=>[t.id,t]));
const loaded=(url)=>loader.loadAsync(url).then(g=>g.scene);
const params=new URLSearchParams(location.search);
let photo=params.has('foto'),whole=true,debounce,selected=null;
if(photo)document.querySelector('nav').style.display='none';
const records=[...catalog.tiles,...plan.boundary.map(t=>({id:t.id,center_xz:[Math.sqrt(3)*2500*(t.q+t.r/2),3750*t.r],model:'neighbors/'+encodeURIComponent(t.id)+'.glb'}))];
const coords=new Map(records.map(r=>[r.id,r]));
picker.add(new Option('Cordilheira interior','cordilheira'));
for(const r of catalog.tiles)picker.add(new Option(names[r.kind]+' · '+r.id,r.id));
function dispose(obj){
    obj.removeFromParent();const resources=new Set();
    obj.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.isMesh){resources.add(o.geometry);for(const m of [].concat(o.material)){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}}});
    for(const v of resources)v.dispose();
}
async function pump(){
    const id=[...desired].find(k=>!loading.has(k)&&!full.has(k));if(!id||loading.size>=3)return;
    loading.add(id);const row=coords.get(id);
    try{
        const obj=await loaded('/'+row.model);
        if(desired.has(id)){obj.position.set(row.center_xz[0],0,row.center_xz[1]);scene.add(obj);full.set(id,obj);if(far.has(id))far.get(id).visible=false;}
        else dispose(obj);
    }catch(e){status.textContent='Falha ao carregar '+id+'. '+e.message;desired.delete(id);}
    finally{loading.delete(id);pump();}
}
function update(){
    const distance=camera.position.distanceTo(controls.target);
    const x=controls.target.x,z=controls.target.z;
    const sorted=records.map(r=>[Math.hypot(r.center_xz[0]-x,r.center_xz[1]-z),r.id]).sort((a,b)=>a[0]-b[0]);
    desired.clear();
    if(distance<15500){
        for(const [d,id] of sorted.slice(0,6))if(d<9500)desired.add(id);
        if(selected && Math.hypot(x-selected.center_xz[0],z-selected.center_xz[1])<4800)desired.add(selected.id);
    }
    for(const [id,obj] of full)if(!desired.has(id)){dispose(obj);full.delete(id);if(far.has(id))far.get(id).visible=true;}
    for(let i=0;i<3;i++)pump();
}
controls.addEventListener('change',()=>{clearTimeout(debounce);debounce=setTimeout(update,100);});
function frame(){
    const X=catalog.tiles.map(t=>t.center_xz[0]),Z=catalog.tiles.map(t=>t.center_xz[1]);
    const width=Math.max(...X)-Math.min(...X)+6000,length=Math.max(...Z)-Math.min(...Z)+6500;
    controls.target.set((Math.max(...X)+Math.min(...X))/2,0,(Math.max(...Z)+Math.min(...Z))/2);
    const dist=1.13*Math.max(length,width/camera.aspect)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
    camera.position.copy(controls.target).add(new T.Vector3(0,1,.20).normalize().multiplyScalar(dist));
    controls.update();
}
function focus(id){
    if(id==='cordilheira'){
        selected=null;whole=false;picker.value=id;
        controls.target.set(6600,1100,-800);
        if(params.get('vista')==='mata'){
            controls.target.set(6850,1450,-9520);
            camera.position.set(9250,7180,-16450);
        }else if(params.get('vista')==='dunas'){
            controls.target.set(6330,1250,-1700);
            camera.position.set(-11000,13200,-6300);
        }else camera.position.set(22100,13900,1500);
        controls.update();update();return;
    }
    selected=byId.get(id);whole=!selected;picker.value=selected?.id||'';
    if(whole){frame();update();return;}
    const t=selected,near=border.get(t.contacts[0]),[x,z]=t.center_xz;
    const outward=new T.Vector3(x-Math.sqrt(3)*2500*(near.q+near.r/2),0,z-3750*near.r).normalize();
    controls.target.set(x,100,z);
    camera.position.copy(controls.target).addScaledVector(outward,3900).add(new T.Vector3(outward.z*1000,2300,-outward.x*1000));
    controls.update();update();
}
picker.onchange=()=>focus(picker.value);
document.querySelector('#mouth').onclick=()=>focus(catalog.tiles.find(t=>t.q===5&&t.r===5).id);
const bath=await new T.TextureLoader().loadAsync('/viewer/continente/bath.png');bath.flipY=false;bath.generateMipmaps=false;bath.minFilter=T.LinearFilter;
const water=new T.Mesh(new T.PlaneGeometry(600000,600000),new T.ShaderMaterial({
 uniforms:{bath:{value:bath},origin:{value:new T.Vector2(...catalog.bath_min_xz)},span:{value:new T.Vector2(...catalog.bath_size_xz)},clock:{value:0}},
 vertexShader:`varying vec2 pos;void main(){vec4 w=modelMatrix*vec4(position,1.);pos=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform sampler2D bath;uniform vec2 origin,span;uniform float clock;varying vec2 pos;void main(){
 vec2 uv=(pos-origin)/span;vec3 b=vec3(0.);if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.))))b=texture2D(bath,uv).rgb;
 if(b.b>.55)discard;
 float depth=255.*(1.-b.r);float wave=sin(pos.x*.027+pos.y*.037+2.9*sin(pos.x*.009-pos.y*.005)+clock);
 float near=1.-smoothstep(3500.,22000.,distance(cameraPosition.xz,pos)+abs(cameraPosition.y)*.72);
 vec3 col=mix(vec3(.021,.11,.16),vec3(.053,.34,.32),b.g*(1.-smoothstep(0.,122.,depth)));
 float foam=(1.-smoothstep(.5,15.,depth))*b.g*(.68+.31*wave*near);col+=vec3(.013,.02,.022)*wave*near;
 col=mix(col,vec3(.70,.83,.80),foam*.82);gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
 }`}));
water.rotation.x=-Math.PI/2;water.position.y=catalog.sea_m;scene.add(water);
function resize(){
    renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);camera.updateProjectionMatrix();if(whole)frame();
}
new ResizeObserver(resize).observe(canvas);resize();
const [land,coast,shelf,ridgeCatalog]=await Promise.all([loaded('/context.glb'),loaded('/viewer/continente/litoral.glb'),loaded('/viewer/continente/plataforma.glb'),fetchJSON('/models/cordilheira/composition.json')]);
for(const obj of [land,coast,shelf]){scene.add(obj);obj.traverse(o=>{if(o.userData.tileId)far.set(o.userData.tileId,o);});}
await Promise.all(ridgeCatalog.tiles.map(async tile=>{
    const original=coords.get(tile.id);
    if(original)original.model=tile.model_url.replace('/world/coast-v01/','')+'?v='+tile.sha256;
    const hex=await loaded(tile.model_url.replace('/world/coast-v01/', '/')+'?v='+tile.sha256);
    hex.position.set(tile.center_x,0,tile.center_z);
    far.get(tile.id)?.removeFromParent();
    far.set(tile.id,hex);
    scene.add(hex);
}));
status.textContent='';focus(params.get('trecho'));
renderer.setAnimationLoop(t=>{water.material.uniforms.clock.value=photo?0:t*.00042;renderer.render(scene,camera);});
window.continentState=()=>({count:far.size,overview:far.size,full:[...full.keys()],selected:picker.value,loading:loading.size});
