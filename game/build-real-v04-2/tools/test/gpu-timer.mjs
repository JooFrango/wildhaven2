// node --experimental-strip-types tools/test/gpu-timer.mjs (Node 22.6+)
import assert from 'node:assert/strict';
import { Perf } from '../../client/src/perf.ts';
let active=false, began=0, ended=0, deleted=0;
const gl={
  getExtension:()=>({TIME_ELAPSED_EXT:1}),createQuery:()=>({}),
  beginQuery(){assert.equal(active,false); active=true;began++;},
  endQuery(){assert.equal(active,true,'endQuery sem beginQuery');active=false;ended++;},
  deleteQuery(){deleted++;}
};
const perf=new Perf();
perf.attach({getContext:()=>gl});
for(let i=0;i<12;i++){perf.beginGpu();perf.endGpu();}
assert.equal(began,5);assert.equal(ended,5);
perf.attach(null);assert.equal(deleted,began);
console.log({began,ended,deleted});
