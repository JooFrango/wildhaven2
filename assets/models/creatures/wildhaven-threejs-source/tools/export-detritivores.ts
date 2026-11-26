import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDetritivore, animateDetritivore, DETRITIVORE_SPECIES, DETRITIVORE_ANIMATIONS,
} from "../src/rendering/detritivores";

// Three.js GLTFExporter consumes browser FileReader APIs in Node.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer()
      .then(buffer => { this.result = buffer; this.onloadend?.(); })
      .catch(error => this.onerror?.(error));
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = "data:" + (blob.type || "application/octet-stream")
        + ";base64," + Buffer.from(buffer).toString("base64");
      this.onloadend?.();
    }).catch(error => this.onerror?.(error));
  }
}
(globalThis as unknown as { FileReader: typeof FileReader }).FileReader =
  NodeFileReader as unknown as typeof FileReader;

function parseJson(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67) throw Error("bad GLB magic");
  if (view.getUint32(4, true) !== 2) throw Error("GLB 2 required");
  if (view.getUint32(8, true) !== bytes.byteLength) throw Error("GLB invalid length");
  if (view.getUint32(16, true) !== 0x4e4f534a) throw Error("GLB missing JSON");
  const len = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, len)));
}
async function exportVariant(id: (typeof DETRITIVORE_SPECIES)[number]) {
  const root = createDetritivore(id);
  const pivots: THREE.Group[] = [];
  let counter = 0;
  root.traverse(obj => {
    if (obj instanceof THREE.Group && obj !== root) {
      obj.name = id + "_pivot_" + String(counter++).padStart(3, "0");
      pivots.push(obj);
    }
  });
  if (pivots.length < 9) throw Error(id + ": expected true articulated pivots");

  const clips: THREE.AnimationClip[] = [];
  for (const action of DETRITIVORE_ANIMATIONS) {
    const duration = action === "walk" || action === "flee" ? 1.7 : 2.4;
    const frames = 33;
    const times: number[] = [];
    const poses = new Map<string, { positions: number[]; rotations: number[]; scales: number[] }>();
    for (const b of pivots)
      poses.set(b.name, { positions: [], rotations: [], scales: [] });

    for (let i = 0; i < frames; i++) {
      const t = duration * i / (frames - 1);
      times.push(t);
      root.userData.previewAnimation = action;
      animateDetritivore(root, t, action === "walk" || action === "flee", "explorar");
      root.updateMatrixWorld(true);
      for (const b of pivots) {
        const dest = poses.get(b.name)!;
        dest.positions.push(b.position.x, b.position.y, b.position.z);
        dest.rotations.push(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        dest.scales.push(b.scale.x, b.scale.y, b.scale.z);
      }
    }
    const tracks: THREE.KeyframeTrack[] = [];
    for (const b of pivots) {
      const pose = poses.get(b.name)!;
      tracks.push(new THREE.VectorKeyframeTrack(b.name + ".position", times, pose.positions));
      tracks.push(new THREE.QuaternionKeyframeTrack(b.name + ".quaternion", times, pose.rotations));
      tracks.push(new THREE.VectorKeyframeTrack(b.name + ".scale", times, pose.scales));
    }
    clips.push(new THREE.AnimationClip(id + "_" + action, duration, tracks));
  }
  root.userData.previewAnimation = null;
  animateDetritivore(root, 0, false, "explorar");
  // The original live rig stores circular THREE.Group references.
  delete root.userData.rig;
  delete root.userData.previewAnimation;

  const buffer = await new Promise<ArrayBuffer>((ok, fail) => {
    new GLTFExporter().parse(root,
      glb => glb instanceof ArrayBuffer ? ok(glb) : fail(new Error("expected binary GLB")),
      error => fail(error),
      { binary: true, onlyVisible: true, trs: true, animations: clips });
  });
  const data = parseJson(buffer);
  const animationNames: string[] = (data.animations || []).map((c: { name: string }) => c.name);
  if (animationNames.length !== DETRITIVORE_ANIMATIONS.length)
    throw Error(id + ": incomplete animation count");
  if ((data.nodes || []).filter((node: { mesh?: number }) => node.mesh != null).length < 10)
    throw Error(id + ": not enough actual 3D meshes");
  if (!(data.animations || []).every((animation: { channels?: unknown[] }) =>
      (animation.channels?.length || 0) > 10)) throw Error(id + ": empty animation tracks");

  const output = resolve("dist-creatures", id + "-animated.glb");
  writeFileSync(output, Buffer.from(buffer));
  console.log(id, JSON.stringify({
    file: output, bytes: buffer.byteLength,
    meshes: data.meshes.length, nodes: data.nodes.length,
    clips: animationNames,
  }));
}
async function main() {
  mkdirSync(resolve("dist-creatures"), { recursive: true });
  for (const id of DETRITIVORE_SPECIES) await exportVariant(id);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
