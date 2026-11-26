// The rendered terrain triangles are also the solid ground. X/Z are continental metres.
const CELL = 96;
const LIMIT = Math.cos(37 * Math.PI / 180);
// Shared float32 GLB rim points differ by fractions of a millimetre after translation.
const EPS = 2e-5;
export class TerrainCollider {
  constructor(obstacles = []) {
    this.tiles = new Map();
    this.obstacles = obstacles;
  }
  add(id, x0, z0, positions, indices) {
    const buckets = new Map(), slope = new Float32Array(indices.length / 3);
    for (let f = 0; f < slope.length; f++) {
      const a = indices[3*f]*3, b = indices[3*f+1]*3, c = indices[3*f+2]*3;
      const x = positions[a], y = positions[a+1], z = positions[a+2];
      const ux=positions[b]-x, uy=positions[b+1]-y, uz=positions[b+2]-z;
      const vx=positions[c]-x, vy=positions[c+1]-y, vz=positions[c+2]-z;
      const ny=uz*vx-ux*vz;
      slope[f]=ny/Math.hypot(uy*vz-uz*vy,ny,ux*vy-uy*vx);
      const loX=Math.floor((x+Math.min(0,ux,vx))/CELL), hiX=Math.floor((x+Math.max(0,ux,vx))/CELL);
      const loZ=Math.floor((z+Math.min(0,uz,vz))/CELL), hiZ=Math.floor((z+Math.max(0,uz,vz))/CELL);
      for(let i=loX;i<=hiX;i++) for(let j=loZ;j<=hiZ;j++){
        const key=i*128+j;
        if(!buckets.has(key)) buckets.set(key,[]);
        buckets.get(key).push(f);
      }
    }
    this.tiles.set(id,{x0,z0,positions,indices,slope,buckets});
  }
  candidates(x,z,X,Z,visit) {
    for(const tile of this.tiles.values()){
      const {x0,z0,positions:p,indices,buckets}=tile;
      if(Math.min(x,X)>x0+2165.1||Math.max(x,X)<x0-2165.1||Math.min(z,Z)>z0+2500.1||Math.max(z,Z)<z0-2500.1) continue;
      let seen=new Set();
      for(let i=Math.floor((Math.min(x,X)-x0)/CELL);i<=Math.floor((Math.max(x,X)-x0)/CELL);i++)
        for(let j=Math.floor((Math.min(z,Z)-z0)/CELL);j<=Math.floor((Math.max(z,Z)-z0)/CELL);j++)
          for(const f of buckets.get(i*128+j)||[]){
            if(seen.has(f))continue;
            seen.add(f);
            const a=3*indices[3*f],b=3*indices[3*f+1],c=3*indices[3*f+2];
            const ax=p[a]+x0,az=p[a+2]+z0,ux=p[b]-p[a],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vz=p[c+2]-p[a+2];
            const det=ux*vz-uz*vx;
            const bary=(px,pz)=>{const u=((px-ax)*vz-(pz-az)*vx)/det,v=(ux*(pz-az)-uz*(px-ax))/det;return [1-u-v,u,v];};
            visit(bary(x,z),bary(X,Z),p[a+1],p[b+1],p[c+1],tile.slope[f]);
          }
    }
  }
  height(x,z){
    let y=null;
    this.candidates(x,z,x,z,(b,_,a,h,c)=>{
      if(Math.min(...b)>=-EPS)y=b[0]*a+b[1]*h+b[2]*c;
    });
    return y;
  }
  step(x,z,X,Z){
    // Reject the entire move if it crosses even a narrow cliff or a missing tile.
    for(const o of this.obstacles){
      const ax=(x-o.x)/o.rx,az=(z-o.z)/o.rz,dx=(X-x)/o.rx,dz=(Z-z)/o.rz;
      if(o.kind==='water'){
        const t=Math.min(1,Math.max(0,-(ax*dx+az*dz)/(dx*dx+dz*dz||1)));
        if(Math.hypot(ax+t*dx,az+t*dz)<=1)return null;
      }else{
        let lo=0,hi=1;
        for(const [p,d] of [[ax,dx],[az,dz]]){
          if(Math.abs(d)<EPS){if(Math.abs(p)>1){hi=-1;break;}}
          else {const u=(-1-p)/d,v=(1-p)/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));}
        }
        if(lo<=hi)return null;
      }
    }
    const spans=[];let blocked=false,y=null;
    this.candidates(x,z,X,Z,(a,b,h0,h1,h2,slope)=>{
      let lo=0,hi=1;
      for(let k=0;k<3;k++){
        const d=b[k]-a[k];
        if(Math.abs(d)<1e-12){if(a[k]<-EPS)return;}
        else if(d>0)lo=Math.max(lo,(-EPS-a[k])/d);
        else hi=Math.min(hi,(-EPS-a[k])/d);
      }
      if(hi<lo)return;
      if(slope<LIMIT){if(hi-lo>1e-4)blocked=true;return;}
      spans.push([lo,hi]);
      if(Math.min(...b)>=-EPS)y=b[0]*h0+b[1]*h1+b[2]*h2;
    });
    if(blocked||y===null)return null;
    spans.sort((a,b)=>a[0]-b[0]);let end=0;
    const tolerance=.001/Math.max(.001,Math.hypot(X-x,Z-z));
    for(const [lo,hi] of spans){if(lo>end+tolerance)return null;end=Math.max(end,hi);}
    return end>=1-tolerance?y:null;
  }
}
