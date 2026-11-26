#!/usr/bin/env python3
"""Animated GIFs of every clip, rendered from the animated GLB.

    blender --background --factory-startup --python make_gifs.py -- <glb> <outdir>

The machine has no ffmpeg and no ImageMagick, and Blender writes no GIF, so the
GIF89a stream is written here: a per-clip palette by popularity over a 15-bit
colour key, a lookup table for the mapping, and the standard LZW coder.

Frames come from the re-imported binary through the same camera and lights as
the still previews, so the GIFs show the deformation stored in the file.
"""
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_clips import CENTER, build_scene, load  # noqa: E402

RES = (420, 300)
MAX_FRAMES = 24


# --------------------------------------------------------------------------
# GIF writing
# --------------------------------------------------------------------------
def quantize(frames):
    """One palette per clip: the most common colours on a 5-bit-per-channel grid,
    then every 15-bit key mapped to its nearest palette entry once."""
    stack = np.concatenate([f.reshape(-1, 3) for f in frames], axis=0)
    q = (np.clip(stack, 0, 1) * 255).astype(np.uint8) >> 3
    keys = (q[:, 0].astype(np.int32) << 10) | (q[:, 1].astype(np.int32) << 5) | q[:, 2]
    uniq, counts = np.unique(keys, return_counts=True)
    top = uniq[np.argsort(counts)[::-1][:256]]
    pal = np.stack([(top >> 10) & 31, (top >> 5) & 31, top & 31], axis=1)
    pal = (pal.astype(np.uint16) * 255 // 31).astype(np.uint8)
    if len(pal) < 256:
        pal = np.vstack([pal, np.zeros((256 - len(pal), 3), np.uint8)])

    grid = np.arange(32768, dtype=np.int32)
    gcol = np.stack([(grid >> 10) & 31, (grid >> 5) & 31, grid & 31], axis=1)
    gcol = (gcol.astype(np.int32) * 255 // 31)
    lut = np.empty(32768, dtype=np.uint8)
    step = 4096
    palf = pal.astype(np.int32)
    for i in range(0, 32768, step):
        d = ((gcol[i:i + step, None, :] - palf[None, :, :]) ** 2).sum(axis=2)
        lut[i:i + step] = np.argmin(d, axis=1).astype(np.uint8)
    return pal, lut


def to_indices(frame, lut):
    q = (np.clip(frame, 0, 1) * 255).astype(np.uint8) >> 3
    keys = (q[:, :, 0].astype(np.int32) << 10) | \
           (q[:, :, 1].astype(np.int32) << 5) | q[:, :, 2]
    return lut[keys]


class BitWriter:
    def __init__(self):
        self.out = bytearray()
        self.acc = 0
        self.nbits = 0

    def write(self, code, size):
        self.acc |= code << self.nbits
        self.nbits += size
        while self.nbits >= 8:
            self.out.append(self.acc & 0xFF)
            self.acc >>= 8
            self.nbits -= 8

    def flush(self):
        if self.nbits:
            self.out.append(self.acc & 0xFF)
            self.acc = 0
            self.nbits = 0
        return bytes(self.out)


def lzw(data, min_code_size=8):
    clear, end = 1 << min_code_size, (1 << min_code_size) + 1
    bw = BitWriter()
    size = min_code_size + 1
    table = {bytes([i]): i for i in range(1 << min_code_size)}
    nxt = end + 1
    bw.write(clear, size)
    prefix = b""
    for byte in data:
        cur = prefix + bytes([byte])
        if cur in table:
            prefix = cur
            continue
        bw.write(table[prefix], size)
        table[cur] = nxt
        nxt += 1
        if nxt > (1 << size):
            if size < 12:
                size += 1
            else:
                bw.write(clear, size)
                table = {bytes([i]): i for i in range(1 << min_code_size)}
                nxt = end + 1
                size = min_code_size + 1
        prefix = bytes([byte])
    if prefix:
        bw.write(table[prefix], size)
    bw.write(end, size)
    return bw.flush()


def sub_blocks(payload):
    out = bytearray()
    for i in range(0, len(payload), 255):
        chunk = payload[i:i + 255]
        out.append(len(chunk))
        out += chunk
    out.append(0)
    return bytes(out)


def write_gif(path, frames, delay_cs):
    """frames: list of HxWx3 float arrays, top row first."""
    pal, lut = quantize(frames)
    h, w, _ = frames[0].shape
    out = bytearray(b"GIF89a")
    out += w.to_bytes(2, "little") + h.to_bytes(2, "little")
    out += bytes([0xF7, 0, 0])              # global table, 256 entries
    out += pal.tobytes()
    out += bytes([0x21, 0xFF, 0x0B]) + b"NETSCAPE2.0" + bytes([3, 1, 0, 0, 0])
    for frame in frames:
        idx = to_indices(frame, lut)
        out += bytes([0x21, 0xF9, 0x04, 0x00])
        out += int(delay_cs).to_bytes(2, "little") + bytes([0, 0])
        out += bytes([0x2C, 0, 0, 0, 0])
        out += w.to_bytes(2, "little") + h.to_bytes(2, "little") + bytes([0])
        out += bytes([8]) + sub_blocks(lzw(idx.tobytes(), 8))
    out += bytes([0x3B])
    Path(path).write_bytes(bytes(out))
    return len(out)


# --------------------------------------------------------------------------
def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    glb, outdir = Path(argv[0]), Path(argv[1])
    outdir.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    bpy.ops.import_scene.gltf(filepath=str(glb))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    build_scene(CENTER, 12.0)
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = RES

    if not arm.animation_data:
        arm.animation_data_create()
    for track in list(arm.animation_data.nla_tracks):
        track.mute = True

    tmp = outdir / "_frame.png"
    for action in sorted(bpy.data.actions, key=lambda a: a.name):
        arm.animation_data.action = action
        start, end = (int(round(v)) for v in action.frame_range)
        total = max(end - start, 1)
        count = min(MAX_FRAMES, total)
        frames = []
        for i in range(count):
            f = start + round(total * i / count)
            bpy.context.scene.frame_set(f)
            bpy.context.scene.render.filepath = str(tmp)
            bpy.ops.render.render(write_still=True)
            frames.append(load(tmp))
        seconds = total / 24.0
        delay = max(2, round(100 * seconds / count))
        size = write_gif(outdir / f"{action.name}.gif", frames, delay)
        print(f"GIF {action.name} {count} frames {delay}cs {size} bytes")
    if tmp.exists():
        tmp.unlink()
    print("GIFS_OK")


main()
