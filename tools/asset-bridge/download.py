#!/usr/bin/env python3
"""Download an original GitHub asset using authenticated gh CLI; no checkout needed."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import struct
import subprocess
import tempfile
from urllib.parse import quote, urlencode

REPOS = {"carioca1111/wildhaven", "carioca1111/wildhaven-new"}

def gh_api(endpoint, accept):
    return subprocess.check_output(
        ["gh", "api", "--method", "GET", "-H", "Accept: " + accept, endpoint],
        stderr=None,
    )

def verify(data, metadata, path, expected_sha256=None):
    if data.startswith(b"version https://git-lfs.github.com/spec/v1"):
        raise ValueError("Git LFS pointer: use authenticated git lfs checkout, not this file")
    if len(data) != metadata["size"] or not data:
        raise ValueError("Unexpected or empty binary size")
    git_sha = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    if git_sha != metadata["sha"]:
        raise ValueError("Git blob SHA mismatch; file changed or transfer corrupted")
    digest = hashlib.sha256(data).hexdigest()
    if expected_sha256 and digest.lower() != expected_sha256.lower():
        raise ValueError("SHA-256 mismatch with expected manifest")
    if path.lower().endswith(".glb"):
        if len(data) < 20:
            raise ValueError("Truncated GLB")
        magic, version, declared = struct.unpack_from("<4sII", data)
        if magic != b"glTF" or version != 2 or declared != len(data):
            raise ValueError("Invalid GLB 2.0 header")
        offset = 12
        index = 0
        while offset < len(data):
            if offset + 8 > len(data):
                raise ValueError("Truncated GLB chunk header")
            length, kind = struct.unpack_from("<II", data, offset)
            offset += 8
            if length % 4 or offset + length > len(data):
                raise ValueError("Invalid GLB chunk length")
            if index == 0:
                if kind != 0x4E4F534A:
                    raise ValueError("Missing first JSON chunk")
                gltf = json.loads(data[offset:offset+length].decode("utf-8"))
                if gltf.get("asset", {}).get("version") != "2.0":
                    raise ValueError("Invalid glTF asset version")
            offset += length
            index += 1
        if not index:
            raise ValueError("Missing GLB chunks")
    return {"bytes": len(data), "git_blob_sha": git_sha, "sha256": digest}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo", required=True, choices=sorted(REPOS))
    p.add_argument("--ref", required=True, help="Immutable commit SHA (recommended) or branch")
    p.add_argument("--path", required=True, help="Repository-relative asset path")
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--sha256", help="Expected SHA-256 from existing asset manifest")
    args = p.parse_args()
    parts = PurePosixPath(args.path).parts
    if not parts or args.path.startswith("/") or "\\" in args.path or ".." in parts:
        p.error("Use a safe repository-relative path")
    if args.sha256 and not re.fullmatch(r"[0-9a-fA-F]{64}", args.sha256):
        p.error("SHA-256 must contain 64 hex digits")
    if args.out.exists():
        p.error("Output already exists; choose a new path")
    endpoint = "repos/" + args.repo + "/contents/" + quote(args.path, safe="/") + "?" + urlencode({"ref": args.ref})
    metadata = json.loads(gh_api(endpoint, "application/vnd.github.object+json"))
    if metadata.get("type") != "file" or not metadata.get("sha"):
        raise ValueError("Path is not a regular GitHub file")
    if metadata["size"] > 100 * 1024 * 1024:
        raise ValueError("Above Contents API limit; use authenticated Git/Git LFS")
    data = gh_api(endpoint, "application/vnd.github.raw+json")
    report = verify(data, metadata, args.path, args.sha256)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive publication: never replace an existing local asset.
    fd, temp = tempfile.mkstemp(dir=args.out.parent, prefix=".asset-bridge-")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.link(temp, args.out)
    finally:
        os.unlink(temp)
    print(json.dumps(dict(report, repo=args.repo, ref=args.ref, path=args.path, output=str(args.out)), indent=2))

if __name__ == "__main__":
    main()
