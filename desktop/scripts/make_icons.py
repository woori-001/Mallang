# 토끼 그림으로 앱 아이콘, 글자 로고로 제목 이미지 만들기
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

bunny_p, word_p, out_desktop, out_web = sys.argv[1:5]
bunny = Image.open(bunny_p).convert('RGBA')
word = Image.open(word_p).convert('RGBA')

def gradient(size, c1, c2):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    t = ((xx + yy) / (w + h - 2))[..., None]
    arr = (np.array(c1) * (1 - t) + np.array(c2) * t).astype(np.uint8)
    return Image.fromarray(np.dstack([arr, np.full((h, w), 255, np.uint8)]), 'RGBA')

C1, C2 = (255, 220, 232), (236, 206, 250)   # 연핑크 → 연보라

def place(canvas, scale, dy=0.0):
    S = canvas.width
    b = bunny.copy()
    bw = int(S * scale)
    b = b.resize((bw, int(b.height * bw / b.width)), Image.LANCZOS)
    # 살짝 그림자
    sh = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    a = b.split()[3].point(lambda v: int(v * 0.28))
    shadow = Image.new('RGBA', b.size, (170, 90, 130, 0)); shadow.putalpha(a)
    x = (S - b.width) // 2; y = (S - b.height) // 2 + int(S * dy)
    sh.paste(shadow, (x, y + int(S * 0.025)), shadow)
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.02))
    canvas.alpha_composite(sh)
    canvas.alpha_composite(b, (x, y))
    return canvas

def rounded_icon(S, radius=0.22, margin=0.04):
    bg = gradient((S, S), C1, C2)
    mask = Image.new('L', (S, S), 0)
    m = int(S * margin)
    ImageDraw.Draw(mask).rounded_rectangle([m, m, S - m - 1, S - m - 1], radius=int(S * radius), fill=255)
    icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    icon.paste(bg, (0, 0), mask)
    return place(icon, 0.74, 0.02)

big = rounded_icon(1024)
big.save(out_desktop + '/build/icon.png')
big.save(out_desktop + '/build/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
# 트레이: 작은 크기에서도 보이게 여백을 줄임
tray = rounded_icon(256, radius=0.24, margin=0.0)
tray.resize((32, 32), Image.LANCZOS).save(out_desktop + '/src/tray.png')
tray.resize((64, 64), Image.LANCZOS).save(out_desktop + '/src/tray@2x.png')

# 웹앱 아이콘
rounded_icon(512).resize((192, 192), Image.LANCZOS).save(out_web + '/icons/icon-192.png')
rounded_icon(512).save(out_web + '/icons/icon-512.png')
full = place(gradient((512, 512), C1, C2), 0.60, 0.02)            # 마스커블: 가장자리까지 배경
full.save(out_web + '/icons/icon-maskable-512.png')
place(gradient((360, 360), C1, C2), 0.74, 0.02).convert('RGB').resize((180, 180), Image.LANCZOS).save(out_web + '/icons/apple-touch-icon.png')

# 제목 로고 (높이 160px, 화면에서는 30~40px로 보여 선명함)
h = 160
lw = word.resize((int(word.width * h / word.height), h), Image.LANCZOS)
lw.save(out_desktop + '/src/renderer/logo.png', optimize=True)
lw.save(out_web + '/logo.png', optimize=True)
# 원본 잘라낸 것도 보관
bunny.save(out_desktop + '/build/bunny-cut.png', optimize=True)
word.save(out_desktop + '/build/logo-cut.png', optimize=True)
print('ok', lw.size)
