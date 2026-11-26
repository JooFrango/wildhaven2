import {decodePhysicsChunk} from "../compiler/physics.mjs";

/**
 * Dynamic collision overlay on immutable WHP1 ground.
 * Tree IDs must be stable; edited states are saved separately from terrain.
 * Never clear rocks, cliffs or original permanent obstacles.
 */
export const TREE_STATES = ["standing","fallen","removed"];
const VALID = new Set(TREE_STATES);
export class TreeObstacleOverlay {
  constructor(catalog=[], onDirty=()=>{}) {
    this.trees=new Map();
    this.deltas=new Map();
    this.onDirty=onDirty;
    for(const t of catalog){
      if(!t.id||this.trees.has(t.id)||!Number.isFinite(t.worldX)||!Number.isFinite(t.worldZ)
        ||!(t.radius>0))throw Error("Invalid/duplicate tree entry");
      this.trees.set(t.id,{...t,state:"standing"});
    }
  }
  status(id){if(!this.trees.has(id))throw Error("Unknown tree "+id);return this.deltas.get(id)?.state??"standing"}
  update(id,state,{fallDirection=0,fallLength=null}={}){
    const tree=this.trees.get(id);
    if(!tree)throw Error("Unknown tree "+id);
    if(!tree.cuttable)throw Error("Tree is not approved as destructible "+id);
    if(!VALID.has(state))throw Error("Invalid tree state "+state);
    if(!Number.isFinite(fallDirection)||fallLength!==null&&(!(fallLength>0)||!Number.isFinite(fallLength)))
      throw Error("Invalid fall geometry");
    const prev=this.status(id);
    if(state==="standing")this.deltas.delete(id);
    else this.deltas.set(id,{state,fallDirection,fallLength:fallLength??tree.radius*6});
    if(prev!==state)this.onDirty(tree); // Engine updates the affected nav tile(s), not the entire hexagon.
  }
  save(){
    return {schema:"wildhaven.trees.delta.v1",changes:[...this.deltas.entries()].map(([id,value])=>({id,...value}))};
  }
  load(data){
    if(data?.schema!=="wildhaven.trees.delta.v1"||!Array.isArray(data.changes))throw Error("Invalid tree save");
    const restored=new Map();
    for(const d of data.changes){
      const t=this.trees.get(d.id);
      if(!t||!t.cuttable||restored.has(d.id)||!["fallen","removed"].includes(d.state))
        throw Error("Invalid tree delta "+d.id);
      if(!Number.isFinite(d.fallDirection)||!(d.fallLength>0)||!Number.isFinite(d.fallLength))
        throw Error("Invalid fall parameters "+d.id);
      restored.set(d.id,{state:d.state,fallDirection:d.fallDirection,fallLength:d.fallLength});
    }
    this.deltas=restored;
    for(const t of this.trees.values())this.onDirty(t);
  }
  /**
   * Return a merged COLLISION mask, never mutate the original WHP1 static data.
   * Cut trees can be standing circles or fallen capsules.
   * Fallen trunk collision is provisional geometry: game/animation must validate it.
   */
  blockedForChunk(chunkBytes) {
    const c=decodePhysicsChunk(chunkBytes),out=c.blocked.slice();
    const res=c.res,x0=c.x0,z0=c.z0;
    const stamp=(x,z,r)=>{
      const minI=Math.max(0,Math.floor((x-r-x0)/res-0.5)),maxI=Math.min(c.nx-1,Math.ceil((x+r-x0)/res-0.5));
      const minJ=Math.max(0,Math.floor((z-r-z0)/res-0.5)),maxJ=Math.min(c.nz-1,Math.ceil((z+r-z0)/res-0.5));
      for(let j=minJ;j<=maxJ;j++)for(let i=minI;i<=maxI;i++){
        const px=x0+(i+0.5)*res,pz=z0+(j+0.5)*res;
        if((px-x)**2+(pz-z)**2<=r*r)out[j*c.nx+i]=1;
      }
    };
    for(const t of this.trees.values()){
      const state=this.status(t.id);if(state==="removed")continue;
      if(state==="standing"){stamp(t.worldX,t.worldZ,t.radius);continue;}
      const d=this.deltas.get(t.id),L=d.fallLength;
      const x2=t.worldX+Math.cos(d.fallDirection)*L,z2=t.worldZ+Math.sin(d.fallDirection)*L;
      // Conservative capsule sampling at <= radius spacing.
      const steps=Math.ceil(L/Math.max(t.radius,res/2));
      for(let i=0;i<=steps;i++){const f=i/steps;stamp(t.worldX+(x2-t.worldX)*f,t.worldZ+(z2-t.worldZ)*f,t.radius)}
    }
    return out;
  }
}
