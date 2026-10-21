# 앱 아이콘 생성: 라벤더 그라데이션 둥근 사각형 + 흰 메모지 + 하트
from PIL import Image, ImageDraw, ImageFilter
S = 1024
def grad(w, h, c1, c2):
    g = Image.new('RGB', (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return g
base = grad(256, 256, (124, 131, 247), (182, 140, 240)).resize((S, S))
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([40, 40, S - 40, S - 40], radius=230, fill=255)
icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
icon.paste(base, (0, 0), mask)
# 메모지 그림자
sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(sh).rounded_rectangle([250, 250, 790, 810], radius=90, fill=(60, 40, 140, 90))
sh = sh.filter(ImageFilter.GaussianBlur(30))
icon.alpha_composite(sh)
d = ImageDraw.Draw(icon)
d.rounded_rectangle([240, 220, 784, 780], radius=90, fill=(255, 255, 255, 245))
# 줄
for i, y in enumerate([380, 470, 560]):
    d.rounded_rectangle([330, y, 690 - (i == 2) * 120, y + 34], radius=17, fill=(203, 196, 250, 255))
# 하트 (파라메트릭 곡선)
import math
pts=[]
for i in range(200):
    t=2*math.pi*i/200
    x=16*math.sin(t)**3
    y=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
    pts.append((650+x*7.2, 650-y*7.2))
d.polygon(pts, fill=(242, 120, 160, 255))
icon.save('build/icon.png')
icon.save('build/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
icon.resize((32, 32), Image.LANCZOS).save('src/tray.png')
icon.resize((64, 64), Image.LANCZOS).save('src/tray@2x.png')
print('ok')
