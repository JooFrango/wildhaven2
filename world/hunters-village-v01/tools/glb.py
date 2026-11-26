"""Small read-only glTF accessor for the project's uncompressed, static GLBs."""
import hashlib
import json
import struct
from pathlib import Path

import numpy as np
from base_world import base_path


class GLB:
    def __init__(self, path):
        self.path = Path(path)
        data = self.path.read_bytes()
        magic, version, length, size, tag = struct.unpack_from('<4s4I', data)
        assert magic == b'glTF' and version == 2 and length == len(data) and tag == 0x4E4F534A
        self.doc = json.loads(data[20:20+size])
        self.bin = memoryview(data)[28+size:]
        self.sha = hashlib.sha256(data).hexdigest()

    def array(self, index, normalized=True):
        a = self.doc['accessors'][index]
        view = self.doc['bufferViews'][a['bufferView']]
        dtype = np.dtype({5120:'i1', 5121:'u1', 5122:'<i2', 5123:'<u2',
                          5125:'<u4', 5126:'<f4'}[a['componentType']])
        width = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4}[a['type']]
        result = np.ndarray((a['count'], width), dtype, self.bin,
                            offset=view.get('byteOffset',0)+a.get('byteOffset',0),
                            strides=(view.get('byteStride',width*dtype.itemsize),dtype.itemsize))
        if normalized and a.get('normalized'):
            result = np.maximum(-1, result.astype(float)/np.iinfo(dtype).max)
        return result

    def primitive(self, name):
        return next(m for m in self.doc['meshes'] if m.get('name')==name)['primitives'][0]


HERE = Path(__file__).resolve().parents[1]
BASE = base_path()
MODELS = HERE/'models'
QA = HERE/'tests'
CENTER = np.array([4330.127018922193*6.5, -3750.0])
NEIGHBORS = ('ER_25','ER_22','ER_18','FX_20','ER_21','ER_24')


def dump(path, obj):
    path.parent.mkdir(exist_ok=True, parents=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf8')

