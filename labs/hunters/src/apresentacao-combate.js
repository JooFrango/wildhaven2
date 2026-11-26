// Presentation only: consumes committed events; never advances or modifies the simulation.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const entity=(m,id)=>m?.porId?.get(id)??m?.mortos?.get(id)??m?.animais?.find(a=>a.id===id);
const pairKey=e=>`${e.id}>${e.alvo}`;
const isImpact=e=>e.tipo==='impacto_arma';
const nOf=e=>Number.isFinite(e.n)?e.n:null;

export function criarApresentacao(options={}){return new ApresentacaoCombate(options);}
export class ApresentacaoCombate {
 constructor({THREE,scene,camera,orbit,canvas,trajetoria,audioFactory}={}){
  Object.assign(this,{T:THREE,scene,camera,orbit,canvas,trajetoria,audioFactory});
  this.world=null;this.seen=new Set();this.lastTime=null;this.visualTime=0;this.lastEventN=0;this.cues=[];this.voices=new Set();this.actorMotion=new Map();this.particles=[];this.trails=[];this.previousTips=new Map();this.impactPairs=new Map();this.shakes=[];this.shakeOffset={x:0,y:0,z:0};this.audio=null;this.master=null;this.audioState='locked';this.destroyed=false;this.cameraActive=false;this.serial=0;
  this.counters={events:0,impactos:0,sons:0,vozes:0,passos:0,respiracoes:0,cameraFrames:0};
  this._createEffects();
 }
 _createEffects(){
  const T=this.T;if(!T||!this.scene)return;
  this.group=new T.Group();this.group.name='hunter-combat-presentation';this.scene.add(this.group);
  this.particlePositions=new Float32Array(64*3);this.particleColors=new Float32Array(64*3);this.particlePositions.fill(-10000);
  this.particleGeometry=new T.BufferGeometry();this.particleGeometry.setAttribute('position',new T.BufferAttribute(this.particlePositions,3));this.particleGeometry.setAttribute('color',new T.BufferAttribute(this.particleColors,3));
  this.particleMaterial=new T.PointsMaterial({size:.075,vertexColors:true,transparent:true,opacity:.85,depthWrite:false,sizeAttenuation:true});this.points=new T.Points(this.particleGeometry,this.particleMaterial);this.points.frustumCulled=false;this.group.add(this.points);
  this.trailPositions=new Float32Array(32*6);this.trailColors=new Float32Array(32*6);this.trailPositions.fill(-10000);
  this.trailGeometry=new T.BufferGeometry();this.trailGeometry.setAttribute('position',new T.BufferAttribute(this.trailPositions,3));this.trailGeometry.setAttribute('color',new T.BufferAttribute(this.trailColors,3));
  this.trailMaterial=new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.38,depthWrite:false});this.lines=new T.LineSegments(this.trailGeometry,this.trailMaterial);this.lines.frustumCulled=false;this.group.add(this.lines);
 }
 async unlockAudio(){
  if(this.destroyed)return false;
  try{
   if(!this.audio){const Constructor=globalThis.AudioContext??globalThis.webkitAudioContext;this.audio=this.audioFactory?this.audioFactory():Constructor?new Constructor():null;if(!this.audio){this.audioState='unsupported';return false;}this.master=this.audio.createGain();this.master.gain.value=0;this.master.connect(this.audio.destination);}
   if(this.audio.state==='suspended')await this.audio.resume();this.audioState=this.audio.state==='running'?'ready':this.audio.state;return this.audioState==='ready';
  }catch{this.audioState='unavailable';return false;}
 }
 setTrajetoriaProvider(fn){this.trajetoria=fn;}
 _reset(m){
  this._removeShake();this.world=m;this.lastTime=m.t;this.lastEventN=m.eventos?.reduce((n,e)=>Math.max(n,nOf(e)??0),0)??0;this.seen=new Set(m.eventos??[]);this.actorMotion.clear();this.previousTips.clear();this.impactPairs.clear();this.particles=[];this.trails=[];this.shakes=[];this.lastOpponent=null;
  // Loading a saved encounter does not replay its historic impacts or sounds.
  this._silence();
 }
 update(m,dtReal,{cinematica=false,sons=false,selected=null,efeitos=true,volume=.45}={}){
  if(this.destroyed||!m)return;
  const dt=clamp(Number(dtReal)||0,0,.1);this.visualTime+=dt;
  if(m!==this.world||m.t<(this.lastTime??m.t)-1e-8)this._reset(m);
  const advancing=m.t>(this.lastTime??m.t)+1e-8;
  const focus=entity(m,selected&&typeof selected==='object'?selected.id:selected)??m.hunters?.find(a=>a.vivo)??m.animais?.find(a=>a.vivo);
  if(advancing)this.lastAdvanceVisual=this.visualTime;
  if(this.master){const gain=sons&&(advancing||this.visualTime-(this.lastAdvanceVisual??-99)<.12)?clamp(volume,0,.65):0;this.master.gain.setTargetAtTime(gain,this.audio.currentTime,.025);}
  if(advancing){
   const fresh=(m.eventos??[]).filter(e=>{const n=nOf(e);return n!==null?n>this.lastEventN:!this.seen.has(e);});
   const impacts=new Set(fresh.filter(isImpact).map(pairKey));
   for(const e of fresh){this.seen.add(e);if(nOf(e)!==null)this.lastEventN=Math.max(this.lastEventN,e.n);this.counters.events++;if(isImpact(e))this.impactPairs.set(pairKey(e),m.t);this._event(m,e,{sons,efeitos,focus,impacts});}
   // Flat event objects normally carry a monotonically increasing n. This set only supports ad-hoc fixtures.
   if(this.seen.size>2048)this.seen=new Set((m.eventos??[]).slice(-1024));
   for(const [key,t]of this.impactPairs)if(m.t-t>.3)this.impactPairs.delete(key);
   this._movement(m,focus,{sons,efeitos});this._weaponTrails(m,focus,efeitos);
  }
  this.lastTime=m.t;
  this._effects(dt,efeitos);this._camera(m,focus,dt,!!cinematica);
 }
 _event(m,e,{sons,efeitos,focus,impacts}){
  const a=entity(m,e.id),b=entity(m,e.alvo??e.atacante),heavy=!!e.pesado||/pesad|heavy/.test(e.ataque??a?.hunter?.action?.name??'');
  if(e.tipo==='ferimento'){
   const equivalent={id:e.atacante,alvo:e.id},key=pairKey(equivalent);
   if(impacts.has(key)||m.t-(this.impactPairs.get(key)??-99)<.15)return;
   const intensity=clamp((e.dano??8)/35,.12,1),pos=this._position(m,e,a);
   this._impact(m,e,pos,intensity,e.fratura||intensity>.65,sons,efeitos,focus,a,'carne');return;
  }
  if(isImpact(e)){
   const intensity=clamp(e.intensidade??.45,.08,1),pos=this._position(m,e,b??a),type=e.bloqueado?'metal':e.tipoDano??e.material??'carne';
   this._impact(m,e,pos,intensity,heavy,sons,efeitos,focus,b??a,type);return;
  }
  if(e.tipo==='ataque_inicio'){
   if(sons&&a)this._cue('esforco',heavy?.34:.16,this._audibility(a,focus),this._pan(a,focus),heavy);
  }else if(e.tipo==='golpe_errou'){
   if(sons&&a)this._cue('ar',heavy?.30:.13,this._audibility(a,focus),this._pan(a,focus),heavy);
  }else if(e.tipo==='hunter_bloqueio_tatico'){
   // The guard preparation is a quiet movement. The loud metallic contact comes from impacto_arma.
   if(sons&&a)this._cue('guarda',.08,this._audibility(a,focus),this._pan(a,focus),false);
  }else if(e.tipo==='esquiva'||e.tipo==='hunter_esquiva_tatica'){
   if(sons&&a)this._cue('roupa',.10,this._audibility(a,focus),this._pan(a,focus),false);
  }else if(e.tipo==='combate_fim'){
   if(sons&&focus)this._cue('fim',.17,1,0,false);
  }
 }
 _impact(m,e,pos,intensity,heavy,sons,effects,focus,actor,material){
  this.counters.impactos++;
  const W=(m.terreno?.largura??0)/2,D=(m.terreno?.profundidade??0)/2,local=focus?clamp(1-Math.hypot(pos.x-(focus.x-W),pos.z-(focus.y-D))/28):1;if(local<=0)return;
  if(sons)this._cue(material==='metal'?'metal':'impacto',intensity,local,this._pan(actor,focus),heavy);
  if(effects){
   const count=heavy?9:4;for(let i=0;i<count;i++){const seed=(Number(e.n)||++this.serial)*17+i*37,angle=seed*2.399963,velocity=.4+intensity*.9;
    this.particles.push({x:pos.x,y:pos.y,z:pos.z,vx:Math.cos(angle)*velocity,vy:.4+(i%3)*.17+intensity*.8,vz:Math.sin(angle)*velocity,age:0,life:material==='metal'?.20:.34+(i%3)*.05,color:material==='metal'?[1,.72,.32]:[.77,.63,.42]});}
   if(this.particles.length>64)this.particles.splice(0,this.particles.length-64);
  }
  if(heavy&&intensity>.5){this.shakes.push({born:this.visualTime,power:Math.min(.075,intensity*.075)});if(this.shakes.length>3)this.shakes.shift();}
 }
 _position(m,e,a){const W=(m.terreno?.largura??0)/2,D=(m.terreno?.profundidade??0)/2;return{x:(Number.isFinite(e.x)?e.x:a?.x??W)-W,y:Number.isFinite(e.z)?e.z:(a?.z??0)+.8,z:(Number.isFinite(e.y)?e.y:a?.y??D)-D};}
 _audibility(a,focus){if(!a||!focus)return 1;return clamp(1-distance(a,focus)/28);}
 _pan(a,focus){if(!a||!focus)return 0;return clamp((a.x-focus.x)/12,-.7,.7);}
 _movement(m,focus,{sons,efeitos}){
  const actors=(m.animais??[]).filter(a=>a.vivo&&(!focus||distance(a,focus)<24)).toSorted((a,b)=>focus?distance(a,focus)-distance(b,focus):0).slice(0,4);let stepBudget=3;
  for(const a of actors){
   let s=this.actorMotion.get(a.id);if(!s){s={x:a.x,y:a.y,distance:0,breathAt:m.t+2.5};this.actorMotion.set(a.id,s);continue;}
   const travelled=Math.hypot(a.x-s.x,a.y-s.y);s.x=a.x;s.y=a.y;
   if(travelled<3&&a.velocidade>.3){s.distance+=travelled;const stride=a.hunter?(a.velocidade>4?1.15:.60):Math.max(.65,(a.especie?.corpo?.comprimentoM??2)*.44);
    if(s.distance>=stride&&stepBudget>0){s.distance%=stride;stepBudget--;if(sons){this.counters.passos++;this._cue('passo',a.hunter?.10:.16,this._audibility(a,focus),this._pan(a,focus),a.velocidade>4);}if(efeitos&&a.velocidade>3){const p=this._position(m,{},a);this.particles.push({...p,y:(a.z??0)+.04,vx:0,vy:.12,vz:0,age:0,life:.23,color:[.52,.43,.30]});}}
   }
   if(sons&&a===focus&&a.hunter&&a.energia<40&&m.t>=s.breathAt){this.counters.respiracoes++;s.breathAt=m.t+2.8+(a.energia/40)*1.5;this._cue('respiracao',.05+(1-a.energia/40)*.05,1,0,false);}
  }
  const alive=new Set(actors.map(a=>a.id));for(const id of this.actorMotion.keys())if(!alive.has(id))this.actorMotion.delete(id);
 }
 _weaponTrails(m,focus,enabled){
  if(!enabled||!this.trajetoria)return;
  for(const a of (m.hunters??[]).filter(a=>a.vivo&&(!focus||distance(a,focus)<24)).slice(0,4)){
   const shape=this.trajetoria(a,m.t);if(!shape?.active||!shape.tip){this.previousTips.delete(a.id);continue;}
   const tip=this._position(m,{x:shape.tip.x,y:shape.tip.y,z:shape.tip.z},a),prev=this.previousTips.get(a.id);if(prev&&Math.hypot(tip.x-prev.x,tip.y-prev.y,tip.z-prev.z)<2)this.trails.push({a:prev,b:tip,age:0,life:.13});this.previousTips.set(a.id,tip);
  }
  if(this.trails.length>32)this.trails.splice(0,this.trails.length-32);
 }
 _effects(dt,enabled){
  if(!enabled){this.particles=[];this.trails=[];this.previousTips.clear();}
  for(const p of this.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=3*dt;}
  this.particles=this.particles.filter(p=>p.age<p.life).slice(-64);for(const p of this.trails)p.age+=dt;this.trails=this.trails.filter(p=>p.age<p.life).slice(-32);
  if(!this.group)return;
  this.particlePositions.fill(-10000);this.particleColors.fill(0);for(let i=0;i<this.particles.length;i++){const p=this.particles[i],fade=1-p.age/p.life;this.particlePositions.set([p.x,p.y,p.z],i*3);this.particleColors.set(p.color.map(c=>c*fade),i*3);}this.particleGeometry.attributes.position.needsUpdate=true;this.particleGeometry.attributes.color.needsUpdate=true;
  this.trailPositions.fill(-10000);this.trailColors.fill(0);for(let i=0;i<this.trails.length;i++){const p=this.trails[i],fade=(1-p.age/p.life)*.6;this.trailPositions.set([p.a.x,p.a.y,p.a.z,p.b.x,p.b.y,p.b.z],i*6);this.trailColors.set([fade,fade*.85,fade*.55,fade,fade*.85,fade*.55],i*6);}this.trailGeometry.attributes.position.needsUpdate=true;this.trailGeometry.attributes.color.needsUpdate=true;
 }
 _camera(m,focus,dt,enabled){
  if(!this.camera||!this.orbit||!focus)return;
  this._removeShake();
  if(!enabled){if(this.cameraActive)this.orbit.enabled=this.savedOrbitEnabled;this.cameraActive=false;return;}
  const cam=this.camera,target=this.orbit.target;
  if(!this.cameraActive){this.savedOrbitEnabled=this.orbit.enabled;this.orbit.enabled=false;const dx=cam.position.x-target.x,dz=cam.position.z-target.z,n=Math.hypot(dx,dz)||1;this.viewDirection={x:dx/n,z:dz/n};this.cameraActive=true;}
  const wanted=focus.golpe?.alvo??focus.hunter?.alvoId;let rival=entity(m,wanted)??entity(m,this.lastOpponent);
  if(!rival||rival===focus)rival=(m.animais??[]).filter(a=>a!==focus&&a.vivo&&!(focus.hunter&&a.hunter&&focus.hunter.equipe===a.hunter.equipe)).toSorted((a,b)=>distance(a,focus)-distance(b,focus))[0];
  if(rival)this.lastOpponent=rival.id;
  const W=(m.terreno?.largura??0)/2,D=(m.terreno?.profundidade??0)/2;
  const cx=((focus.x+(rival?.x??focus.x))/2)-W,cz=((focus.y+(rival?.y??focus.y))/2)-D,cy=Math.max(focus.z??0,rival?.z??focus.z??0)+.9;
  const span=(rival?distance(focus,rival):2)+(rival?.especie?.corpo?.comprimentoM??1)*.35;
  const d=clamp(7+span*1.3,9,34),f=1-Math.exp(-dt*3.4),v=this.viewDirection;
  const move=(p,x,y,z,maxSpeed)=>{let dx=(x-p.x)*f,dy=(y-p.y)*f,dz=(z-p.z)*f,n=Math.hypot(dx,dy,dz),limit=maxSpeed*dt;if(n>limit&&n>0){const k=limit/n;dx*=k;dy*=k;dz*=k;}p.x+=dx;p.y+=dy;p.z+=dz;};
  move(target,cx,cy,cz,12);move(cam.position,cx+v.x*d,cy+d*.58,cz+v.z*d,14);
  this.shakes=this.shakes.filter(s=>this.visualTime-s.born<.18);
  let sx=0,sy=0;for(const s of this.shakes){const age=this.visualTime-s.born,falloff=(1-age/.18);sx+=Math.sin(age*95)*s.power*falloff;sy+=Math.sin(age*67)*s.power*.45*falloff;}
  this.shakeOffset={x:clamp(sx,-.08,.08),y:clamp(sy,-.04,.04),z:0};cam.position.x+=this.shakeOffset.x;cam.position.y+=this.shakeOffset.y;cam.lookAt?.(target);this.counters.cameraFrames++;
 }
 _removeShake(){if(this.camera?.position){this.camera.position.x-=this.shakeOffset.x;this.camera.position.y-=this.shakeOffset.y;this.camera.position.z-=this.shakeOffset.z;}this.shakeOffset={x:0,y:0,z:0};}
 _cue(kind,intensity,audibility=1,pan=0,heavy=false){
  if(audibility<=0)return;this.counters.sons++;this.cues.push({kind,intensity,audibility,heavy});if(this.cues.length>32)this.cues.shift();
  if(this.audioState!=='ready'||this.audio?.state!=='running'||this.voices.size>=10)return;
  const ctx=this.audio,now=ctx.currentTime,gain=ctx.createGain(),filter=ctx.createBiquadFilter(),panner=ctx.createStereoPanner?.();let source,duration;
  const metal=kind==='metal',tone=metal||kind==='fim';
  if(tone){source=ctx.createOscillator();source.type=metal?'triangle':'sine';source.frequency.setValueAtTime(metal?(heavy?380:650):155,now);source.frequency.exponentialRampToValueAtTime(metal?220:100,now+.20);duration=metal?.23:.32;}
  else{duration={impacto:heavy?.22:.13,esforco:heavy?.24:.12,ar:heavy?.25:.14,guarda:.075,roupa:.10,passo:heavy?.10:.075,respiracao:.42}[kind]??.12;const length=Math.max(1,Math.ceil(ctx.sampleRate*duration)),buffer=ctx.createBuffer(1,length,ctx.sampleRate),channel=buffer.getChannelData(0);let seed=(++this.serial*1103515245+12345)>>>0;for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const fade=1-i/length;channel[i]=((seed/4294967296)*2-1)*fade;}source=ctx.createBufferSource();source.buffer=buffer;}
  filter.type=metal?'highpass':kind==='ar'||kind==='roupa'?'bandpass':'lowpass';filter.frequency.value=metal?700:kind==='respiracao'?780:kind==='ar'?1800:kind==='passo'?220:kind==='impacto'?(heavy?400:700):1000;filter.Q.value=.6;
  const amount=clamp(intensity)*audibility*(kind==='impacto'?.19:metal?.13:kind==='passo'?.11:.085);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,amount),now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  source.connect(filter);filter.connect(gain);if(panner){panner.pan.value=clamp(pan,-.8,.8);gain.connect(panner);panner.connect(this.master);}else gain.connect(this.master);
  let low=null;if(kind==='impacto'&&heavy){low=ctx.createOscillator();low.type='sine';low.frequency.setValueAtTime(95,now);low.frequency.exponentialRampToValueAtTime(42,now+duration);low.connect(filter);low.start(now);low.stop(now+duration+.015);}
  const voice={source,sources:[source,...(low?[low]:[])],nodes:[source,...(low?[low]:[]),filter,gain,...(panner?[panner]:[])]};this.voices.add(voice);source.onended=()=>{for(const node of voice.nodes)node.disconnect?.();this.voices.delete(voice);};source.start(now);source.stop(now+duration+.02);this.counters.vozes++;
 }
 _silence(){for(const voice of this.voices){for(const source of voice.sources??[voice.source]){try{source.stop();}catch{}}for(const node of voice.nodes)node.disconnect?.();}this.voices.clear();if(this.master)this.master.gain.value=0;}
 stats(){return{...this.counters,audio:this.audioState,voices:this.voices.size,particles:this.particles.length,trails:this.trails.length,cinematica:this.cameraActive,lastCues:this.cues.map(c=>({...c}))};}
 dispose(){if(this.destroyed)return;this.destroyed=true;this._removeShake();if(this.cameraActive&&this.orbit)this.orbit.enabled=this.savedOrbitEnabled;this._silence();this.master?.disconnect();try{Promise.resolve(this.audio?.close?.()).catch(()=>{});}catch{}this.scene?.remove(this.group);for(const key of ['particleGeometry','particleMaterial','trailGeometry','trailMaterial'])this[key]?.dispose();this.particles=[];this.trails=[];}
}
