import {decodePhysicsChunk} from "../compiler/physics.mjs";

/**
 * Read derived WHP1 chunks in browser/Worker. No source GLB needed by runtime.
 * An index is generated but NOT certified by the compiler.
 * The caller must explicitly opt into unverified assets in a test viewer.
 */
export class UncertifiedPhysicsError extends Error {
  constructor(message){super(message);this.name="UncertifiedPhysicsError"}
}
export function makePhysicsChunkLoader({fetchImpl=globalThis.fetch,cryptoImpl=globalThis.crypto,
  allowUnverified=false}={}) {
  if(typeof fetchImpl!=="function")throw TypeError("fetch implementation required");
  const requireSuccess=async(response,label)=>{
    if(!response?.ok)throw Error(label+": HTTP "+response?.status);
    return response;
  };
  const verify=async(bytes,metadata)=>{
    if(metadata.bytes!==bytes.byteLength)throw Error("Physics archive byte length mismatch");
    if(!metadata.sha256)throw Error("Physics archive must have SHA-256");
    if(!cryptoImpl?.subtle)throw Error("crypto.subtle required to validate physical packages");
    const hash=await cryptoImpl.subtle.digest("SHA-256",bytes);
    const str=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
    if(str!==metadata.sha256.toLowerCase())throw Error("Physics archive SHA-256 mismatch");
  };
  const loadIndex=async url=>{
    const base=new URL(url,globalThis.location?.href??"http://localhost/");
    const response=await requireSuccess(await fetchImpl(base),"index");
    const index=await response.json();
    if(index.schema!=="wildhaven.physics.tile.v1")throw Error("Invalid WHP1 index");
    if(!index.certified&&!allowUnverified)throw new UncertifiedPhysicsError("Terrain physical QA pending "+index.tileId);
    if(!Array.isArray(index.chunks)||index.chunks.some(x=>typeof x.url!=="string"||x.url.includes("/")||x.url.includes("\\")))
      throw Error("Invalid physical chunk filenames");
    return {base,index};
  };
  const loadChunk=async({base,index},meta)=>{
    if(!index.chunks.includes(meta))throw Error("Chunk is not in this index");
    const url=new URL(meta.url,base);
    const response=await requireSuccess(await fetchImpl(url),"chunk");
    const packed=await response.arrayBuffer();
    await verify(packed,meta);
    if(typeof DecompressionStream==="undefined")throw Error("gzip DecompressionStream unavailable");
    const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip"));
    const raw=await new Response(stream).arrayBuffer();
    if(raw.byteLength!==meta.uncompressedBytes)throw Error("Uncompressed physical chunk size mismatch");
    if(meta.rawSha256){
      await verify(raw,{bytes:raw.byteLength,sha256:meta.rawSha256});
    }
    const decoded=decodePhysicsChunk(raw);
    if(decoded.x0!==meta.x0||decoded.z0!==meta.z0||decoded.res!==meta.res)
      throw Error("Physical chunk metadata does not match data");
    return decoded;
  };
  return {loadIndex,loadChunk};
}
