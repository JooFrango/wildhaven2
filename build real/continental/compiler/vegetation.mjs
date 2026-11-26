import {parseGlb,traverseMeshes,instanceCenters} from "./glb.mjs";

/**
 * Optional sidecar vegetation GLB pass. Many tropical trees live in a separate
 * instanced GLB rather than inside the terrain GLB. No tree is considered
 * destructible without an explicit rule giving a measured collider radius.
 */
export function extractSidecarTrees(bytes,{tileId,centerX,centerZ,treeRules={},sourceLabel="vegetation"}={}){
  if(!tileId||!Number.isFinite(centerX)||!Number.isFinite(centerZ))throw Error("Tile and world center required");
  if(!/^[a-z0-9_-]+$/i.test(sourceLabel))throw Error("Invalid source label");
  const glb=parseGlb(bytes),trees=[],missing=[];
  traverseMeshes(glb,({node,nodeIndex,world})=>{
    const name=node.name??"node"+nodeIndex,rule=treeRules[name];
    const items=instanceCenters(glb,node,world);
    if(!items){
      if(rule)throw Error("Sidecar cuttable rule requires individual instances: "+name);
      return;
    }
    if(!rule){missing.push({name,nodeIndex,count:items.length});return;}
    if(!Number.isFinite(rule.radius)||rule.radius<=0)throw Error("Measured tree radius required for "+name);
    for(let i=0;i<items.length;i++){
      const it=items[i];
      trees.push({id:tileId+":"+sourceLabel+":"+nodeIndex+":"+i,node:name,
        worldX:it.position[0]+centerX,worldY:it.position[1],worldZ:it.position[2]+centerZ,
        radius:rule.radius*Math.max(Math.abs(it.scale[0]),Math.abs(it.scale[2])),
        cuttable:rule.cuttable===true,state:"standing",sourceAsset:sourceLabel});
    }
  });
  return {trees,missing,status:"uncertified-needs-review"};
}
