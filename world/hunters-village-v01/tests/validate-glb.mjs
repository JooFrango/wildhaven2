import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(import.meta.url)
const validator=require(process.env.GLTF_VALIDATOR_PACKAGE||'gltf-validator')
const files=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).files
const rows=[]
for(const {file,sha256} of files){
  const r=await validator.validateBytes(new Uint8Array(fs.readFileSync(path.join(root,file))),{uri:file,maxIssues:60})
  rows.push({file,sha256,errors:r.issues.numErrors,warnings:r.issues.numWarnings,messages:r.issues.messages.filter(m=>m.severity<=1).slice(0,4)})
}
fs.writeFileSync(path.join(root,'tests/gltf-validator.json'),JSON.stringify(rows,null,2)+'\n')
console.log('GLBs',rows.length,'errors',rows.reduce((s,r)=>s+r.errors,0),'warnings',rows.reduce((s,r)=>s+r.warnings,0))
if(rows.some(r=>r.errors))process.exitCode=1

