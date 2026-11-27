import * as T from 'three';

// Compact visible chunk ranges into one GPU instance buffer per shared mesh.
export function batchInstances(scene,chunks){
 const pools=new Map(),matrix=new T.Matrix4(),color=new T.Color();
 for(const c of chunks)for(const group of [...c.lod.slice(1),c.cover]){
  group.userData.ranges=[];
  for(const mesh of [...group.children]){
   const key=mesh.geometry.uuid;
   if(!pools.has(key))pools.set(key,{geometry:mesh.geometry,material:mesh.material,total:0});
   const pool=pools.get(key);pool.total+=mesh.count;
   group.updateWorldMatrix(true,false);
   group.userData.ranges.push({pool,mesh,world:group.matrixWorld.clone()});
   group.remove(mesh);
  }
 }
 for(const p of pools.values()){
  p.output=new T.InstancedMesh(p.geometry,p.material,p.total);p.output.frustumCulled=false;
  p.output.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(p.output);
 }
 return ()=>{
  for(const p of pools.values())p.count=0;
  for(const c of chunks)for(const group of [...c.lod.slice(1),c.cover]){
   if(!group.visible)continue;
   for(const {pool,mesh,world} of group.userData.ranges){
    for(let i=0;i<mesh.count;i++){
     mesh.getMatrixAt(i,matrix);mesh.getColorAt(i,color);
     pool.output.setMatrixAt(pool.count,matrix.premultiply(world));pool.output.setColorAt(pool.count++,color);
    }
   }
  }
  for(const p of pools.values()){
   p.output.count=p.count;p.output.visible=p.count>0;
   p.output.instanceMatrix.needsUpdate=true;if(p.output.instanceColor)p.output.instanceColor.needsUpdate=true;
  }
 };
}

// Query only detailed batches. Terrain writes depth first, query boxes then test
// conservatively against it. A camera change invalidates every previous result.
export function terrainOcclusion(renderer,scene,chunks){
 const gl=renderer.getContext(),geometry=new T.BoxGeometry(),mat=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide});
 mat.forceSinglePass=true;
 for(const c of chunks){
  const proxy=new T.Mesh(geometry,mat);proxy.position.copy(c.center);c.box.getSize(proxy.scale);
  proxy.visible=false;proxy.renderOrder=-1;scene.add(proxy);
  proxy.onBeforeRender=()=>{c.query=gl.createQuery();gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE,c.query);};
  proxy.onAfterRender=()=>{gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);proxy.visible=false;};
  c.proxy=proxy;
 }
 return (changed,eye,enabled)=>{
  for(const c of chunks){
   if(changed){if(c.query)gl.deleteQuery(c.query);c.query=null;c.occluded=false;c.checked=false;}
   if(c.query&&gl.getQueryParameter(c.query,gl.QUERY_RESULT_AVAILABLE)){
    c.occluded=!gl.getQueryParameter(c.query,gl.QUERY_RESULT);gl.deleteQuery(c.query);c.query=null;c.checked=true;
   }
   c.proxy.visible=enabled&&c.lod[0].visible&&!c.box.containsPoint(eye)&&!c.query&&!c.checked;
   if(c.occluded)c.lod[0].visible=false;
  }
 };
}