#!/usr/bin/env python3
"""MIT's Great Dome (Building 10, Welles Bosworth, 1916) as a glTF binary: landmarks/boston/mit-great-dome.glb.

    python3 landmarks/tools/mit_great_dome.py

A model of the dome above Building 10's roofs, after the Pantheon it quotes: a cylindrical drum
with a cornice, five stepped rings, a shallow spherical-cap dome and the glazed lantern over its
oculus. Heights (m above the ground) and radii are the OpenStreetMap survey of the dome (building
parts, via Overture), so the model sits exactly where the parts it replaces were:

    drum      to 40.69   r 19.33       steps  40.69 43.75 44.47 45.20 45.92 46.65
    dome cap  46.65-51.06 r 13.17      step radii 16.95 16.26 15.49 14.70 14.00
    lantern   51.06-51.41 r 4.33

Frame: metres, x east, y up, z south (the map's frame), origin on the ground at the dome's axis.
"""
import json, math, os, struct

SEG = 128  # facets round the axis

DRUM_R, DRUM_TOP = 19.33, 40.69
CORNICE = [(DRUM_TOP - 1.2, 19.33), (DRUM_TOP - 1.2, 19.75), (DRUM_TOP - 0.45, 19.75), (DRUM_TOP - 0.45, 19.55), (DRUM_TOP, 19.55)]
STEPS = [(40.69, 43.75, 16.95), (43.75, 44.47, 16.26), (44.47, 45.20, 15.49), (45.20, 45.92, 14.70), (45.92, 46.65, 14.00)]
CAP_R, CAP_Y0, CAP_Y1 = 13.17, 46.65, 51.06
LANTERN_R, LANTERN_TOP = 4.33, 51.41


def profile():
    """The dome's outline as (r, y) from the bottom of the drum to the axis at the top."""
    p = [(DRUM_R, 0.0)]
    p += [(r, y) for y, r in CORNICE]
    p.append((STEPS[0][2], DRUM_TOP))
    for i, (y0, y1, r) in enumerate(STEPS):
        p.append((r, y1))
        nxt = STEPS[i + 1][2] if i + 1 < len(STEPS) else CAP_R
        p.append((nxt, y1))
    # the cap: a spherical segment through (CAP_R, CAP_Y0) whose crown would be at CAP_Y1
    h = CAP_Y1 - CAP_Y0
    R = (CAP_R ** 2 + h ** 2) / (2 * h)
    yc = CAP_Y1 - R
    a0, a1 = math.asin(CAP_R / R), math.asin(LANTERN_R / R)
    for k in range(1, 25):
        a = a0 + (a1 - a0) * k / 24
        p.append((R * math.sin(a), yc + R * math.cos(a)))
    # the lantern: a short glazed drum and a low glass crown
    yl = p[-1][1]
    p.append((LANTERN_R, LANTERN_TOP - 0.05))
    p.append((LANTERN_R + 0.15, LANTERN_TOP - 0.05))
    p.append((LANTERN_R + 0.15, LANTERN_TOP + 0.1))
    for k in range(1, 9):
        a = math.pi / 2 * k / 8
        p.append(((LANTERN_R + 0.15) * math.cos(a), LANTERN_TOP + 0.1 + 0.45 * math.sin(a)))
    assert yl < LANTERN_TOP
    return p


def lathe(prof):
    """Surface of revolution; consecutive profile points sharing r or y become flat rings / walls."""
    pos, nrm, idx = [], [], []
    for i in range(len(prof) - 1):
        (r0, y0), (r1, y1) = prof[i], prof[i + 1]
        if (r0, y0) == (r1, y1):
            continue
        # outward normal of the profile segment (turned in the r-y plane)
        dr, dy = r1 - r0, y1 - y0
        L = math.hypot(dr, dy)
        nr, ny = dy / L, -dr / L
        base = len(pos)
        for s in range(SEG + 1):
            t = 2 * math.pi * s / SEG
            c, sn = math.cos(t), math.sin(t)
            for r, y in ((r0, y0), (r1, y1)):
                pos.append((r * c, y, r * sn))
                nrm.append((nr * c, ny, nr * sn))
        for s in range(SEG):
            a, b = base + 2 * s, base + 2 * s + 1
            c2, d = a + 2, b + 2
            # counter-clockwise seen from outside
            idx += [a, c2, b, b, c2, d]
    return pos, nrm, idx


def glb(pos, nrm, idx, path, extras):
    pb = b''.join(struct.pack('<3f', *v) for v in pos)
    nb = b''.join(struct.pack('<3f', *v) for v in nrm)
    ib = struct.pack(f'<{len(idx)}I', *idx)
    pad = lambda b, c=b'\0': b + c * (-len(b) % 4)
    blob = pad(pb) + pad(nb) + pad(ib)
    lo = [min(v[i] for v in pos) for i in range(3)]
    hi = [max(v[i] for v in pos) for i in range(3)]
    doc = {
        'asset': {'version': '2.0', 'generator': 'landmarks/tools/mit_great_dome.py', 'extras': extras},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'MIT Great Dome'}],
        'meshes': [{'name': 'great-dome', 'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1}, 'indices': 2, 'material': 0}]}],
        'materials': [{'name': 'limestone', 'pbrMetallicRoughness': {'baseColorFactor': [0.84, 0.82, 0.77, 1], 'metallicFactor': 0, 'roughnessFactor': 0.9}}],
        'buffers': [{'byteLength': len(blob)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': len(pb), 'target': 34962},
            {'buffer': 0, 'byteOffset': len(pad(pb)), 'byteLength': len(nb), 'target': 34962},
            {'buffer': 0, 'byteOffset': len(pad(pb)) + len(pad(nb)), 'byteLength': len(ib), 'target': 34963},
        ],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3', 'min': lo, 'max': hi},
            {'bufferView': 1, 'componentType': 5126, 'count': len(nrm), 'type': 'VEC3'},
            {'bufferView': 2, 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'},
        ],
    }
    js = pad(json.dumps(doc, separators=(',', ':')).encode(), b' ')
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))
    out += struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(blob), b'BIN\0') + blob
    with open(path, 'wb') as f:
        f.write(out)
    return len(out)


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, '..', 'boston', 'mit-great-dome.glb')
    pos, nrm, idx = lathe(profile())
    n = glb(pos, nrm, idx, out, {'licence': 'CC0 1.0', 'heights': 'OpenStreetMap contributors (ODbL), building parts of MIT Building 10'})
    print(f'{os.path.relpath(out)}: {len(pos)} vertices, {len(idx) // 3} triangles, {n / 1024:.0f} KB')
