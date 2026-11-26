/** Minimal self-contained GIF89a/RGB332 encoder for REAL frames from the Three.js renderer.
 * No screenshots of concept artwork are substituted for GLB renders.
 */
function lzw(indexes){
  const output=[];let buffer=0,nBits=0,codeWidth=9,next=258;
  const dict=new Map();
  const send=(code)=>{
    buffer|=(code<<nBits);nBits+=codeWidth;
    while(nBits>=8){output.push(buffer&255);buffer>>>=8;nBits-=8;}
  };
  send(256);
  let prefix=indexes[0]??0;
  for(let i=1;i<indexes.length;i++){
    const k=indexes[i],pair=prefix*256+k;
    if(dict.has(pair)){prefix=dict.get(pair);continue;}
    send(prefix);
    if(next<4096){dict.set(pair,next++);if(next>(1<<codeWidth)&&codeWidth<12)codeWidth++;}
    else{send(256);dict.clear();next=258;codeWidth=9;}
    prefix=k;
  }
  send(prefix);send(257);
  if(nBits)output.push(buffer&255);
  return output;
}
// Optional adaptive palette (v09+): 240 most frequent RGB555 colours over all frames + 16-step grey ramp
// so thin steel blades survive quantisation. Default stays RGB332 so earlier previews are reproducible.
function adaptivePalette(frames){
  const hist=new Uint32Array(32768);
  for(const f of frames)for(let j=0;j<f.length;j+=4)hist[((f[j]>>3)<<10)|((f[j+1]>>3)<<5)|(f[j+2]>>3)]++;
  const keys=[...hist.keys()].filter(k=>hist[k]).sort((a,b)=>hist[b]-hist[a]).slice(0,240);
  const pal=keys.map(k=>[((k>>10)&31)*8+4,((k>>5)&31)*8+4,(k&31)*8+4]);
  for(let g=0;g<16;g++)pal.push([g*17,g*17,g*17]);
  while(pal.length<256)pal.push([0,0,0]);
  const map=new Uint8Array(32768);
  for(let k=0;k<32768;k++){if(!hist[k])continue;const r=((k>>10)&31)*8+4,g=((k>>5)&31)*8+4,b=(k&31)*8+4;let best=0,bd=1e9;
    for(let i=0;i<256;i++){const d=(r-pal[i][0])**2*2+(g-pal[i][1])**2*4+(b-pal[i][2])**2*3;if(d<bd){bd=d;best=i;}}map[k]=best;}
  return {pal,index:(f,j)=>map[((f[j]>>3)<<10)|((f[j+1]>>3)<<5)|(f[j+2]>>3)]};
}
export function encodeGif(frames,width,height,{fps=12,palette='rgb332'}={}){
  const adaptive=palette==='adaptive'?adaptivePalette(frames):null;
  if(!frames?.length||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)throw Error('Invalid GIF dimensions/frames');
  const bytes=[];
  const push=(...b)=>bytes.push(...b);
  const u16=v=>push(v&255,(v>>8)&255);
  for(const c of 'GIF89a')push(c.charCodeAt(0));
  u16(width);u16(height);push(0xF7,0,0); // global palette: 256 RGB332 entries
  if(adaptive)for(const c of adaptive.pal)push(...c);
  else for(let i=0;i<256;i++)push(Math.round(((i>>5)&7)*255/7),Math.round(((i>>2)&7)*255/7),Math.round((i&3)*255/3));
  // Loop forever via NETSCAPE2.0 extension.
  push(0x21,0xFF,0x0B);for(const c of 'NETSCAPE2.0')push(c.charCodeAt(0));push(0x03,0x01,0,0,0);
  const delay=Math.max(2,Math.round(100/fps));
  for(const rgba of frames){
    if(rgba.length!==width*height*4)throw Error('Frame dimensions mismatch');
    const idx=new Uint8Array(width*height);
    for(let i=0,j=0;i<idx.length;i++,j+=4)idx[i]=adaptive?adaptive.index(rgba,j):(rgba[j]&0xE0)|((rgba[j+1]>>3)&0x1C)|(rgba[j+2]>>6);
    push(0x21,0xF9,4,0);u16(delay);push(0,0);
    push(0x2C,0,0,0,0);u16(width);u16(height);push(0,8);
    const compressed=lzw(idx);
    for(let offset=0;offset<compressed.length;offset+=255){const block=compressed.slice(offset,offset+255);push(block.length,...block);}
    push(0);
  }
  push(0x3B);
  return new Uint8Array(bytes);
}