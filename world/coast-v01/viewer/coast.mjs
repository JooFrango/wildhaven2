import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const params=new URLSearchParams(location.search);
const canvas=document.querySelector('canvas'), message=document.querySelector('output');
const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene(), camera=new T.PerspectiveCamera(43,1,4,95000);
const controls=new OrbitControls(camera,canvas);
controls.maxPolarAngle=Math.PI*.494;
controls.minDistance=30;controls.maxDistance=17000;
const loader=new GLTFLoader();
const names={glacial:'Costa glacial',praia:'Praia de planície',dunas:'Mar de dunas',falesia:'Falésia de selva',arcos:'Arcos da savana'};
const views={perspectiva:'Três-quartos',superior:'Vista superior',mar:'Linha do mar',encaixe:'Encaixe continental'};
function options(id,items,initial){
    const select=document.querySelector(id);
    for(const [key,text] of Object.entries(items))select.add(new Option(text,key));
    select.value=initial;
    return select;
}
async function json(path){const r=await fetch(path);if(!r.ok)throw Error(path);return r.json();}
async function main(){
    const spec=await json('/prototipos.json'),plan=await json('/perimetro.json');
    const kind=params.get('tipo')||'glacial';
    const row=spec.tiles.find(t=>t.id===kind);
    const picker=options('#tipo',names,kind);
    picker.onchange=()=>{params.set('tipo',picker.value);location.search=params;};
    const selector=options('#vista',views,params.get('vista')||'perspectiva');
    if(params.has('foto'))document.querySelector('nav').hidden=true;
    if(params.has('foto'))document.querySelector('nav').style.display='none';
    const env=kind==='dunas'||kind==='arcos'?0xe6dacf:kind==='glacial'?0xcad7e1:0xd3e2df;
    scene.background=new T.Color(env);scene.fog=new T.FogExp2(env,.000052);
    const hemi=new T.HemisphereLight(kind==='glacial'?0xdfedff:0xfff3dc,0x84989c,1.65);
    scene.add(hemi);
    const sun=new T.DirectionalLight(kind==='glacial'?0xfff4df:0xffe3bd,2.25);
    const [ax,az]=row.along,[ox,oz]=row.out;
    const at=(u,v,h)=>new T.Vector3(ax*u+ox*v,h,az*u+oz*v);
    const aboveSea=(u,v,h)=>at(u,v,h+spec.water.level_m);
    sun.position.copy(at(-3100,1900,3200));
    sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-3300,right:3300,top:3300,bottom:-3300,far:13000});
    sun.shadow.normalBias=2.4;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
    const [pilot,depth]=await Promise.all([loader.loadAsync('/'+row.model),new T.TextureLoader().loadAsync('/'+row.depth)]);
    const model=pilot.scene;
    model.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=true;}});
    scene.add(model);
    async function addNeighbor(id){
        const tile=plan.boundary.find(t=>t.id===id), obj=(await loader.loadAsync('/neighbors/'+encodeURIComponent(id)+'.glb')).scene;
        const x=Math.sqrt(3)*2500*(tile.q+tile.r/2),z=3750*tile.r;
        obj.position.set(x-row.center_xz[0],0,z-row.center_xz[1]);
        obj.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=true;}});
        scene.add(obj);
    }
    depth.flipY=false;depth.generateMipmaps=false;depth.minFilter=T.LinearFilter;
    const water=new T.Mesh(new T.PlaneGeometry(140000,140000),new T.ShaderMaterial({
        uniforms:{bath:{value:depth},mist:{value:new T.Color(env)},time:{value:0},finiteBath:{value:row.model.endsWith('-v02.glb')}},
        vertexShader:`varying vec3 wp;void main(){wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
        fragmentShader:`uniform sampler2D bath;uniform vec3 mist;uniform float time;uniform bool finiteBath;varying vec3 wp;
        float hash(vec2 p){return fract(sin(dot(p,vec2(123.34,391.17)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
        void main(){vec2 p=wp.xz;vec2 uv=p/5000.+.5;
        float bed=texture2D(bath,clamp(uv,0.,1.)).r*640.-256.;
        float depth=max(0.,-bed);
        float inside=finiteBath?smoothstep(1.,80.,2165.06351-max(abs(p.x),.5*abs(p.x)+.8660254*abs(p.y))):1.;
        float n=noise(p/110.),fine=noise(p/17.);
        float swell=sin(p.x*.025+p.y*.036+5.7*noise(p/209.)+3.1*n+time);
        float ripple=sin(p.x*.085-p.y*.021+5.*fine+time*.7);
        vec3 sea=mix(vec3(.040,.315,.294),vec3(.015,.095,.149),1.-inside*(1.-smoothstep(0.,135.,depth)));
        sea+=vec3(.009,.018,.025)*(swell+.55*ripple+1.7*(n-.5));
        float foam=(1.-smoothstep(1.4,13.,depth+5.*n))*smoothstep(.1,.9,.55*swell+.45*fine+.3);
        float breaker=(1.-smoothstep(.025,.17,abs(fract(depth/13.-time*.027+.53*n)-.47)))*(1.-smoothstep(0.,38.,depth))*smoothstep(.21,.64,fine);
        sea=mix(sea,vec3(.75,.86,.80),inside*clamp(foam*.93+breaker*.58,0.,1.));
        float dist=distance(cameraPosition,wp);sea=mix(sea,mist,1.-exp(-dist*dist*.0000000027));
        gl_FragColor=vec4(sea,1.);
        #include <colorspace_fragment>
        }`}));
    water.rotation.x=-Math.PI/2;water.position.y=spec.water.level_m;scene.add(water);
    const sky=new T.Mesh(new T.SphereGeometry(73000,36,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{horizon:{value:new T.Color(env)}},
        vertexShader:`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec3 p;uniform vec3 horizon;void main(){float h=clamp(normalize(p).y,0.,1.);gl_FragColor=vec4(mix(horizon,vec3(.14,.32,.53),pow(h,.52)),1.);
        #include <colorspace_fragment>
        }`}));
    scene.add(sky);
    const terrain=model.getObjectByName('terrain');
    const ray=new T.Raycaster();const up=new T.Vector3(0,-1,0);
    function height(v){ray.set(new T.Vector3(v.x,4000,v.z),up);return ray.intersectObject(terrain,false)[0]?.point.y||0;}
    function view(name){
        let subject,eye;
        if(name==='superior'){
            subject=at(0,0,120);eye=at(0,6,7000);
        }else if(name==='encaixe'){
            const d=row.neighbors[0],nb=plan.boundary.find(t=>t.id===d);
            const x=Math.sqrt(3)*2500*(nb.q+nb.r/2)-row.center_xz[0],z=nb.r*3750-row.center_xz[1];
            subject=new T.Vector3(x/2,0,z/2);subject.y=height(subject);
            eye=subject.clone().add(at(1990,2280,1790));
        }else if(name==='mar'){
            const views={glacial:[-200,260,95,1000,1420,102],praia:[-160,265,86,1210,990,68],dunas:[-430,-70,160,900,880,96],falesia:[-510,265,172,650,1250,93],arcos:[-260,720,105,570,1560,79]};
            const a=views[kind];subject=aboveSea(...a.slice(0,3));eye=aboveSea(...a.slice(3));
        }else{
            subject=aboveSea(-130,60,135);eye=aboveSea(2040,3300,1670);
        }
        camera.position.copy(eye);controls.target.copy(subject);camera.lookAt(subject);controls.update();
        window.reviewView=name;
    }
    selector.onchange=()=>view(selector.value);
    view(selector.value);
    const clock=new T.Clock();
    function draw(){
        const w=canvas.clientWidth,h=canvas.clientHeight;const ratio=renderer.getPixelRatio();
        if(canvas.width!==Math.floor(w*ratio)||canvas.height!==Math.floor(h*ratio)){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
        if(!params.has('foto'))water.material.uniforms.time.value=clock.getElapsedTime()*.45;
        renderer.render(scene,camera);
    }
    window.setCoastView=v=>{view(v);draw();};
    draw();message.textContent='Carregando terrenos vizinhos…';
    if(!params.has('foto'))renderer.setAnimationLoop(draw);
    const [background,...neighbors]=await Promise.allSettled([
        loader.loadAsync('/context.glb'),...row.neighbors.map(addNeighbor)
    ]);
    const loaded=row.neighbors.filter((id,i)=>neighbors[i].status==='fulfilled');
    if(background.status==='fulfilled'){
        const context=background.value.scene;
        context.position.set(-row.center_xz[0],0,-row.center_xz[1]);
        context.traverse(o=>{if(o.isMesh){o.visible=!loaded.includes(o.userData.tileId);o.receiveShadow=true;}});
        scene.add(context);
    }
    draw();
    const complete=background.status==='fulfilled' && loaded.length===row.neighbors.length;
    message.textContent=complete?'':'Parte do entorno ficou indisponível. Recarregue para tentar novamente.';
    window.coastLoaded={kind,neighbors:loaded.length,meshes:model.children.length,revision:T.REVISION,complete};
}
main().catch(e=>{console.error(e);document.querySelector('output').textContent=e.message;});
