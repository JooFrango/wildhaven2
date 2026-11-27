import {WireState} from '../client/src/wire.ts';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [action,path,url]=process.argv.slice(2);
if(action==='capture'){
  const frames=[];
  const socket=new WebSocket(url);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.close();reject(Error('Tempo esgotado'));},30000);
    socket.onerror=()=>{clearTimeout(timer);reject(Error('WebSocket indisponível'));};
    socket.onmessage=e=>{frames.push(e.data);if(frames.length===60){clearTimeout(timer);socket.close();resolve();}};
  });
  fs.writeFileSync(path,JSON.stringify(frames));
} else if(action==='replay'){
  const frames=JSON.parse(fs.readFileSync(path)),times=[];
  let checksum;
  for(let r=0;r<36;r++){
    const w=new WireState();
    const start=performance.now();
    for(const text of frames)assert.ok(w.receive(text));
    if(r>=6)times.push(performance.now()-start);
    assert.equal(w.resyncs,0);
    const hash=createHash('sha256').update(JSON.stringify(w.state)).digest('hex');
    if(checksum)assert.equal(hash,checksum);checksum=hash;
  }
  times.sort((a,b)=>a-b);
  console.log(JSON.stringify({frames:frames.length,p50Ms:times[14],p95Ms:times[28],checksum,times}));
} else throw Error('capture ARQUIVO ws://host/api/v1/stream ou replay ARQUIVO');
