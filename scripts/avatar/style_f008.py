# Visual "Clara" sobre as texturas do Rocketbox Female_Adult_08 (MIT):
# blusa de gola alta preta (a gola em si é feita no app, ver scene.js),
# batom rosado, íris castanha e cabelo em tons de cinza (a cor do cabelo,
# escuro na raiz e acobreado nas pontas, vem das cores de vértice no app).
#
# Personagem original inspirado no estilo de uma imagem de referência; não
# copia rosto de ninguém.
#
# Uso (depois de textures.py):
#   python3 scripts/avatar/style_f008.py public/avatars/f008
import sys
import numpy as np
from PIL import Image, ImageFilter

out = sys.argv[1]


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---- Blusa preta de malha, mangas compridas (textura do corpo) ----
body = Image.open(f'{out}/body.jpg').convert('RGB')
a = np.asarray(body).astype(np.float32) / 255
lum = a @ [0.299, 0.587, 0.114]
# Luminância borrada: mantém as dobras e apaga a estampa da camiseta.
blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255
h, w = lum.shape
yy, xx = np.mgrid[0:h, 0:w]
sat = a.max(2) - a.min(2)
shirt = (xx > 0.335 * w) & (xx < 0.66 * w) & (yy < 0.76 * h) & (sat < 0.12) & (lum > 0.06)
# Mangas compridas: a pele dos braços (faixas laterais) também vira malha.
skin = (a[..., 0] > a[..., 2] + 0.08) & (lum > 0.25)
arms = ((xx < 0.335 * w) | (xx > 0.66 * w)) & (yy > 0.27 * h) & (yy < 0.53 * h)
shirt |= arms & (skin | (sat < 0.15))
rib = 0.012 * np.sin(xx * (2 * np.pi / 5.0))
knit = np.clip(0.05 + (blur - blur[shirt].mean()) * 0.2 + rib, 0.015, 0.16)
knit_rgb = np.stack([knit * 1.0, knit * 0.98, knit * 1.02], -1)
m = shirt[..., None].astype(np.float32)
# Borda suave para não deixar contorno claro
m = np.asarray(Image.fromarray((m[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[..., None] / 255
a = a * (1 - m) + knit_rgb * m
Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(f'{out}/body.jpg', quality=85)

# ---- Batom e íris (textura da cabeça) ----
head = Image.open(f'{out}/head.jpg').convert('RGB')
a = np.asarray(head).astype(np.float32) / 255
h, w = a.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
lum = a @ [0.299, 0.587, 0.114]

# Lábios: elipse em torno da boca, só nos pixels mais avermelhados que a pele.
cx, cy, rx, ry = 512.0, 417.0, 58.0, 26.0
ell = 1 - smooth(0.75, 1.0, np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2))
red = (a[..., 0] - a[..., 1]) / np.maximum(a[..., 0], 1e-3)
lip = ell * smooth(0.24, 0.34, red)
rose = np.array([0.88, 0.37, 0.36])
tinted = rose * (lum / max(lum[lip > 0.5].mean(), 1e-3) * 0.72)[..., None]
a = a * (1 - lip[..., None] * 0.75) + tinted * lip[..., None] * 0.75

# Íris: castanho escuro, preservando a pupila e o brilho.
ex, ey, er = 270.0, 953.0, 19.0
d = np.sqrt((xx - ex) ** 2 + (yy - ey) ** 2)
iris = (1 - smooth(er - 2, er + 1, d)) * smooth(6, 8.5, d)
brown = np.array([0.36, 0.21, 0.12]) * (0.55 + lum[..., None] * 1.1)
a = a * (1 - iris[..., None]) + brown * iris[..., None]
Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(f'{out}/head.jpg', quality=88)

# ---- Cabelo em tons de cinza (a cor vem do app) ----
hair = Image.open(f'{out}/hair.webp').convert('RGBA')
a = np.asarray(hair).astype(np.float32) / 255
lum = a[..., :3] @ [0.299, 0.587, 0.114]
vis = a[..., 3] > 0.5
lum = np.clip(lum / np.percentile(lum[vis], 97) * 0.92, 0, 1)
g = (lum * 255).astype(np.uint8)
rgba = np.dstack([g, g, g, (a[..., 3] * 255).astype(np.uint8)])
Image.fromarray(rgba, 'RGBA').save(f'{out}/hair.webp', quality=82, method=6)
print('ok')
