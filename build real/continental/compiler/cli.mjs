#!/usr/bin/env node
/**
 * Wildhaven WHP1 offline compiler — no npm dependencies.
 * SINGLE: node cli.mjs --tile FX_20 --glb <source.glb> --out <output-dir>
 * BATCH:  node cli.mjs --all --old-root <wildhaven@historic-commit>
 *                --new-root <wildhaven-new@V02.3> --out <output-dir>
 * Does NOT install, modify or copy any GLBs; each output is a new, versioned derived folder.
 */
import {readFile, writeFile, mkdir, rename, stat, rm} from "node:fs/promises";
import {resolve, join, dirname, relative} from "node:path";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {fileURLToPath} from "node:url";
import {compileTile} from "./physics.mjs";
import {extractSidecarTrees} from "./vegetation.mjs";

const argv=process.argv.slice(2),opts={};
for(let i=0;i<argv.length;i++){
  const k=argv[i];
  if(!k.startsWith("--"))throw Error("Unknown argument "+k);
  if(k==="--all"){opts.all=true;continue;}
  if(!argv[i+1]||argv[i+1].startsWith("--"))throw Error("Missing value for "+k);
  opts[k.slice(2)]=argv[++i];
}
if(!opts.out)throw Error("--out is required (new derived directory)");
if(!opts.all&&(!opts.tile||!opts.glb))throw Error("Single tile needs --tile and --glb");
if(opts.all&&(!opts["old-root"]||!opts["new-root"]))throw Error("Batch needs --old-root and --new-root");
if(opts.all&&opts.vegetation)throw Error("--vegetation is single-tile only; batch sidecars need explicit per-tile mapping");
const here=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await readFile(opts.manifest?resolve(opts.manifest):join(here,"../data/continent-272.manifest.json"),"utf8"));
const specs=opts["tree-rules"]?JSON.parse(await readFile(resolve(opts["tree-rules"]),"utf8")):{};
if(specs.schema && specs.schema!=="wildhaven.tree-rules.v1")throw Error("Wrong tree-rule schema");
const outBase=resolve(opts.out);
const sha256=b=>createHash("sha256").update(b).digest("hex");
const blobSha=b=>createHash("sha1").update("blob "+b.byteLength+"\0").update(b).digest("hex");
function checkedPath(root, p) {
  const abs=resolve(root,p),rel=relative(resolve(root),abs);
  if(rel===".."||rel.startsWith("../")||rel.startsWith("..\\")||rel.startsWith("/"))throw Error("Unsafe source path "+p);
  return abs;
}
async function compileOne(tile, file){
  const bytes=await readFile(file);
  if(bytes.length!==tile.source.bytes)throw Error("Source GLB byte mismatch for "+tile.id+": "+bytes.length+" vs "+tile.source.bytes);
  if(tile.source.gitBlobSha1 && blobSha(bytes)!==tile.source.gitBlobSha1)throw Error("Git blob hash mismatch: "+tile.id);
  if(tile.source.sha256 && sha256(bytes)!==tile.source.sha256)throw Error("Source SHA-256 mismatch: "+tile.id);
  const rules=specs.byTile?.[tile.id]??{};
  const result=compileTile(bytes,{id:tile.id,centerX:tile.x,centerZ:tile.z,
    res:Number(opts.res??2),chunkMeters:Number(opts.chunk??256),baseY:Number(opts.baseY??878.959),
    nodeClasses:rules.nodeClasses??{},treeRules:rules.trees??{}});
  if(opts.vegetation){
    const sidecar=await readFile(resolve(opts.vegetation));
    const sidecarHash=sha256(sidecar);
    if(opts["vegetation-sha256"]&&sidecarHash!==opts["vegetation-sha256"].toLowerCase())
      throw Error("Sidecar vegetation SHA-256 mismatch for "+tile.id);
    const extracted=extractSidecarTrees(sidecar,{tileId:tile.id,centerX:tile.x,centerZ:tile.z,
      treeRules:rules.trees??{},sourceLabel:"vegetation"});
    result.trees.push(...extracted.trees);
    result.report.sidecarVegetation={source:resolve(opts.vegetation),sha256:sidecarHash,
      treeInstances:extracted.trees.length,unmappedInstanceGroups:extracted.missing};
    if(extracted.missing.length)result.report.warnings.push("Unmapped vegetation instances: not certified");
    result.report.dynamicTreeCount=result.trees.length;
  }
  const destination=join(outBase,tile.id+"-physics-v01");
  try{await stat(destination);throw Error("Output exists; preserve version: "+destination)}
  catch(e){if(e.code!=="ENOENT")throw e;}
  const staging=join(outBase,".staging-"+tile.id+"-"+process.pid);
  await mkdir(staging,{recursive:false});
  try{
    const chunks=[];
    for(const chunk of result.chunks){
      const compressed=gzipSync(chunk.data,{level:7});
      const url=chunk.name+".gz";
      await writeFile(join(staging,url),compressed);
      chunks.push({...chunk.info,url,bytes:compressed.byteLength,uncompressedBytes:chunk.data.byteLength,
        sha256:sha256(compressed),rawSha256:sha256(chunk.data)});
    }
    const catalog={schema:"wildhaven.physics.tile.v1",tileId:tile.id,source:tile.source,
      status:"generated-unverified",baseY:Number(opts.baseY??878.959),resolutionMeters:Number(opts.res??2),
      chunkMeters:Number(opts.chunk??256),trees:"trees.json",chunks,report:result.report,
      certified:false};
    await writeFile(join(staging,"index.json"),JSON.stringify(catalog,null,2)+"\n");
    await writeFile(join(staging,"trees.json"),JSON.stringify({schema:"wildhaven.trees.catalog.v1",tileId:tile.id,
      trees:result.trees,requiresMappingReview:result.report.unknownNodes.length>0||
        !!result.report.sidecarVegetation?.unmappedInstanceGroups.length},null,2)+"\n");
    await rename(staging,destination);
    return {id:tile.id,ok:true,physicalChunks:result.chunks.length,treeInstances:result.trees.length,
      unknownMeshes:result.report.unknownNodes.length,output:destination,sourceBytes:bytes.byteLength,
      packedBytes:chunks.reduce((sum,c)=>sum+c.bytes,0)};
  }catch(e){await rm(staging,{recursive:true,force:true});throw e;}
}
await mkdir(outBase,{recursive:true});
const tiles=opts.all?manifest.tiles:manifest.tiles.filter(t=>t.id===opts.tile);
if(!tiles.length)throw Error("Unknown ID "+opts.tile);
const report=[];
for(const tile of tiles){
  let file;
  if(!opts.all)file=resolve(opts.glb);
  else {
    const root=tile.source.repository==="carioca1111/wildhaven"?opts["old-root"]:opts["new-root"];
    file=checkedPath(root,tile.source.path);
  }
  try{
    const item=await compileOne(tile,file);report.push(item);console.log("[WHP1] OK "+item.id+" chunks="+item.physicalChunks+" bytes="+item.packedBytes);
  }catch(e){
    const item={id:tile.id,ok:false,source:file,error:String(e.message??e)};
    report.push(item);console.error("[WHP1] FAILED "+tile.id+": "+item.error);
    if(!opts.all)break;
  }
}
const summary={schema:"wildhaven.physics.compile-report.v1",requested:tiles.length,
  success:report.filter(t=>t.ok).length,failures:report.filter(t=>!t.ok).length,
  scope:"derived-assets-only-no-certified-portals",items:report};
await writeFile(join(outBase,"compile-report.json"),JSON.stringify(summary,null,2)+"\n");
console.log("[WHP1] "+summary.success+"/"+summary.requested+" source GLBs compiled; all outputs require physical QA");
if(summary.failures)process.exitCode=1;
