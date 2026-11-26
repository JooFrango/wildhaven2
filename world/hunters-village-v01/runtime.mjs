// The host supplies THREE, a GLTFLoader and its authenticated account's storage adapter.
export function localAccount(id, storage = globalThis.localStorage) {
  if (typeof id !== 'string' || !id.trim()) throw Error('Identificador da conta ausente')
  const key = 'wildhaven.village.HV_01.' + encodeURIComponent(id)
  return {
    read() {
      try { return JSON.parse(storage.getItem(key)) || {} } catch { return {} }
    },
    write(state) { storage.setItem(key, JSON.stringify(state)) }
  }
}

export function disposeGroup(root) {
  if (!root) return
  const geo = new Set(), materials = new Set(), textures = new Set()
  root.traverse(o => {
    if (o.geometry) geo.add(o.geometry)
    for (const mat of [o.material].flat().filter(Boolean)) {
      materials.add(mat)
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value)
    }
    if (o.isInstancedMesh) o.dispose()
  })
  root.removeFromParent()
  geo.forEach(g => g.dispose())
  materials.forEach(m => m.dispose())
  const images = new Set([...textures].map(t => t.source?.data))
  textures.forEach(t => t.dispose())
  images.forEach(im => im?.close?.())
}

export class Village {
  constructor(three, loader, parent, base, phases, account) {
    Object.assign(this, { three, loader, parent, base, phases, account })
    this.state = account.read()
    this.phase = this.phases.some(s => s.phase === this.state.phase) ? this.state.phase : 1
    this.version = 0
    this.close = false
  }

  async set(phase, detail = 'near', save = true) {
    const stage = this.phases.find(s => s.phase === phase)
    if (!stage) throw RangeError('Fase inválida')
    const version = ++this.version
    const files = detail === 'near' ? [stage.exterior, stage.interior] : [stage.lod1]
    if (this.stage?.phase === phase && this.detail === detail) return true
    const group = new this.three.Group()
    try {
      // Load sequentially so a superseded phase does not start an interior download.
      for (const path of files) {
        const asset = await this.loader.loadAsync(this.base(path))
        group.add(asset.scene)
        if (this.close || version !== this.version) { disposeGroup(group); return false }
      }
      group.traverse(o => {
        if (o.isMesh) { o.castShadow = detail === 'near'; o.receiveShadow = true }
      })
      disposeGroup(this.current)
      this.current = group
      this.parent.add(group)
      Object.assign(this, { phase, stage, detail })
      if (save) { this.state.phase = phase; this.account.write(this.state) }
      return true
    } catch (e) { disposeGroup(group); throw e }
  }

  remember(x, z, heading) {
    this.state = { ...this.state, phase:this.phase, position:[x,z], heading }
    this.account.write(this.state)
  }

  unload() {
    ++this.version
    disposeGroup(this.current)
    this.current = this.stage = null
  }

  dispose() { this.close = true; this.unload() }
}

// Spatial bins hold triangle indices from the actual exported terrain, including its irregular rim.
export class Ground {
  constructor(mesh, offsetX = 0, offsetZ = 0) {
    const geometry = mesh.geometry
    this.pos = geometry.getAttribute('position')
    this.indices = geometry.index?.array
    this.bins = new Map()
    this.dx = offsetX
    this.dz = offsetZ
    this.step = 22
    const idx = this.indices, n = idx?.length ?? this.pos.count
    for (let i=0; i<n; i+=3) {
      const vertices=[0,1,2].map(j=>idx ? idx[i+j] : i+j)
      const xs=vertices.map(j=>this.pos.getX(j)), zs=vertices.map(j=>this.pos.getZ(j))
      const ax=Math.floor(Math.min(...xs)/this.step), bx=Math.floor(Math.max(...xs)/this.step)
      const az=Math.floor(Math.min(...zs)/this.step), bz=Math.floor(Math.max(...zs)/this.step)
      for(let x=ax;x<=bx;x++) for(let z=az;z<=bz;z++) {
        const key=x+','+z
        if(!this.bins.has(key)) this.bins.set(key,[])
        this.bins.get(key).push(i)
      }
    }
  }

  height(x,z) {
    x-=this.dx;z-=this.dz
    const bin=this.bins.get(Math.floor(x/this.step)+','+Math.floor(z/this.step))
    if(!bin) return null
    const v=this.pos
    for(const off of bin) {
      const a=this.indices?.[off]??off, b=this.indices?.[off+1]??off+1, c=this.indices?.[off+2]??off+2
      const ax=v.getX(a), az=v.getZ(a), ux=v.getX(b)-ax, uz=v.getZ(b)-az
      const vx=v.getX(c)-ax, vz=v.getZ(c)-az, den=ux*vz-uz*vx
      if(Math.abs(den)<1e-9) continue
      const u=((x-ax)*vz-(z-az)*vx)/den, w=(ux*(z-az)-uz*(x-ax))/den
      if(u>=-2e-5 && w>=-2e-5 && u+w<=1.00002) return v.getY(a)*(1-u-w)+v.getY(b)*u+v.getY(c)*w
    }
    return null
  }
}

export function walkingHeight(grounds, stage, x, z) {
  let h=null
  for(const g of grounds) {
    h=g.height(x,z)
    if(h!==null) break
  }
  if(h===null) return null
  for(const [cx,cz,w,d,top] of stage.walkable) {
    if(Math.abs(x-cx)<=w/2+.04 && Math.abs(z-cz)<=d/2+.04) h=Math.max(h,top)
  }
  for(const lot of stage.lots){
    if(!lot.floorLift)continue
    const [cx,cy,cz]=lot.anchor,dx=x-cx,dy=cz-z,cs=Math.cos(lot.yaw),sn=Math.sin(lot.yaw)
    if(Math.abs(dx*cs+dy*sn)<lot.bounds_m[0]/2 && Math.abs(-dx*sn+dy*cs)<lot.bounds_m[1]/2)h=Math.max(h,cy+lot.floorLift)
  }
  return h
}

export function blocked(stage,x,z,h,radius=.25) {
  for(const [cx,cz,w,d,lo,hi] of stage.blockers)
    if(h+1.68>lo && h<hi-.1 && Math.abs(x-cx)<w/2+radius && Math.abs(z-cz)<d/2+radius)return true
  for(const lot of stage.lots) {
    const [cx,cy,cz]=lot.anchor, dx=x-cx, dy=cz-z, cos=Math.cos(lot.yaw), sin=Math.sin(lot.yaw)
    const lx=dx*cos+dy*sin, ly=-dx*sin+dy*cos
    for(const [bx,by,w,d,lo,hi] of lot.collision) {
      if(h+1.68>cy+lo && h<cy+hi-.1 && Math.abs(lx-bx)<w/2+radius && Math.abs(ly-by)<d/2+radius) return true
    }
  }
  return false
}

