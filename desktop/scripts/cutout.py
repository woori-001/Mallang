# 체크무늬(무채색) 배경 지우기: 색이 살짝이라도 있는 부분만 남김
import sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

src, out, thr = sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 4
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
ch = a.max(2) - a.min(2)
ch_s = cv2.GaussianBlur(ch, (0, 0), 1.2)           # 잡티 줄이기
m = ch_s >= thr
m = ndi.binary_closing(m, structure=np.ones((5, 5)), iterations=2)
m = ndi.binary_fill_holes(m)
lab, n = ndi.label(m)
sizes = ndi.sum(m, lab, range(1, n + 1))
keep = np.zeros_like(m)
big = sizes.max()
for i, s in enumerate(sizes, 1):
    if s > big * 0.01:                               # 작은 얼룩은 버림
        keep |= lab == i
filled = ndi.binary_fill_holes(keep)
# 글자 속 구멍(a, g 등)에 남은 체크무늬는 투명하게: 회색 칸(233~241)이 많이 보이면 배경
holes = filled & ~keep
hl, hn = ndi.label(holes)
gray = (a.min(2) >= 232) & (a.max(2) <= 242) & (ch <= 3)
for i in range(1, hn + 1):
    r = hl == i
    if r.sum() > 30 and gray[r].mean() > 0.2:
        filled[r] = False
keep = ndi.binary_opening(filled, structure=np.ones((3, 3)))
# 아주 작은 구멍(체크무늬가 비치는 곳): 무채색 덩어리 중 회색 칸이 섞인 것
neu = ch <= 2
nl, nn = ndi.label(neu)
bright = a.mean(2)
for i in range(1, nn + 1):
    r = nl == i
    sz = r.sum()
    if sz < 12 or sz > 4000 or not keep[r].any():
        continue
    v = bright[r]
    if ((v > 230) & (v < 243)).mean() >= 0.15:
        near = ndi.binary_dilation(r, iterations=10)
        hole = near & (ch <= 4) & (bright > 228)
        keep[ndi.binary_dilation(hole, iterations=2)] = False
# 가장자리 부드럽게 (1.5px 정도)
alpha = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.0)
alpha = np.clip((alpha - 0.45) / 0.5, 0, 1)
# 가장자리 밝은 테두리 줄이기: 반투명 가장자리 색을 안쪽 색으로 채움
edge = (alpha > 0) & (alpha < 1)
inner = cv2.erode(keep.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
idx = ndi.distance_transform_edt(~inner, return_distances=False, return_indices=True)
a[edge] = a[idx[0][edge], idx[1][edge]]
rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
im = Image.fromarray(rgba, 'RGBA')
im = im.crop(im.getbbox())
im.save(out)
print(out, im.size)
