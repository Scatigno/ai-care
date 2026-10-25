# Converte as texturas TGA do Rocketbox para os arquivos leves do app.
# Uso: python3 scripts/avatar/textures.py <pasta Textures> <prefixo ex. f002> <saida>
import os
import sys
from PIL import Image

src, prefix, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
names = {'head_color': 'head.jpg', 'body_color': 'body.jpg', 'head_normal': 'head_n.jpg', 'body_normal': 'body_n.jpg'}
for key, name in names.items():
    im = Image.open(f'{src}/{prefix}_{key}.tga').convert('RGB').resize((1024, 1024), Image.LANCZOS)
    im.save(f'{out}/{name}', quality=85 if 'color' in key else 80)
hair = Image.open(f'{src}/{prefix}_opacity_color.tga').resize((1024, 1024), Image.LANCZOS)
hair.save(f'{out}/hair.webp', quality=82, method=6)
print('ok', sorted(os.listdir(out)))
