"""Builds apps/web/public/brand/ifrane-relief.svg: 100 m contour lines of Ifrane
Province from the AWS Terrarium open elevation tiles (no key required).

    pip install numpy pillow matplotlib && python build_relief_contours.py
"""
import math, io, os, urllib.request, json
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Ifrane Province bbox
W, E, S, N = -5.65, -4.75, 33.05, 33.80
Z = 10
def tile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y
x0, y0 = tile(W, N, Z); x1, y1 = tile(E, S, Z)
tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
rows = []
for ty in range(ty0, ty1 + 1):
    row = []
    for tx in range(tx0, tx1 + 1):
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png'
        import time
        for attempt in range(5):
            try:
                raw = urllib.request.urlopen(url, timeout=30).read(); break
            except Exception as e:
                time.sleep(2 * (attempt + 1))
        img = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(np.float64)
        row.append(img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768)
    rows.append(np.hstack(row))
dem = np.vstack(rows)
# crop to bbox in pixel space
px0 = int((x0 - tx0) * 256); py0 = int((y0 - ty0) * 256)
px1 = int((x1 - tx0) * 256); py1 = int((y1 - ty0) * 256)
dem = dem[py0:py1, px0:px1]
# light smoothing
from numpy.lib.stride_tricks import sliding_window_view
k = 7
pad = np.pad(dem, k // 2, mode='edge')
dem = sliding_window_view(pad, (k, k)).mean(axis=(-1, -2))
print('dem', dem.shape, dem.min(), dem.max())
H, Wd = dem.shape
VBW = 1000; VBH = round(1000 * H / Wd)
levels = list(range(800, 3000, 100))
fig = plt.figure()
cs = plt.contour(np.arange(Wd), np.arange(H), dem, levels=levels)
paths = []
for lvl, segs in zip(cs.levels, cs.allsegs):
    d = []
    for seg in segs:
        if len(seg) < 20: continue
        pts = seg[::3]
        coords = ' '.join(f'{p[0]*VBW/Wd:.0f} {p[1]*VBH/H:.0f}' for p in pts)
        d.append('M' + coords)
    if d:
        paths.append({'level': int(lvl), 'major': int(lvl) % 500 == 0, 'd': ' '.join(d)})
out = {'viewBox': [VBW, VBH], 'bbox': [W, S, E, N], 'minElevation': float(dem.min()), 'maxElevation': float(dem.max()), 'contours': paths}
parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VBW} {VBH}" fill="none" stroke="#000" stroke-linejoin="round" stroke-linecap="round">']
for c in paths:
    sw, op = (2.4, 1) if c['major'] else (1.2, 0.6)
    parts.append(f'<path stroke-width="{sw}" stroke-opacity="{op}" d="{c["d"]}"/>')
parts.append('</svg>')
target = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../apps/web/public/brand/ifrane-relief.svg')
open(target, 'w').write(''.join(parts))
print('bytes', os.path.getsize(target), 'levels', len(paths))
