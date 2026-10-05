from pathlib import Path
import numpy as np
from PIL import Image

src = Path(
    r"C:\Users\jagat\.cursor\projects\d-IQ-Math-New-iqmathlms-platform-main-1-iqmathlms-platform-main"
    r"\assets\c__Users_jagat_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"ff0a17dbaf85507d425d7851a66d82e0_images_IQ-5e442a22-307e-4516-9809-32e2665224aa.jpg"
)
out = Path(__file__).resolve().parents[1] / "public" / "iqmath-logo.png"

img = Image.open(src).convert("RGBA")
arr = np.asarray(img).copy()
r = arr[:, :, 0].astype(np.float32)
g = arr[:, :, 1].astype(np.float32)
b = arr[:, :, 2].astype(np.float32)

# Distance from pure white — soft alpha for anti-aliased edges
dist = np.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2)
hard_clear = 18.0
soft_end = 55.0
alpha = np.clip((dist - hard_clear) / (soft_end - hard_clear), 0.0, 1.0)
arr[:, :, 3] = (alpha * 255).astype(np.uint8)

ys, xs = np.where(arr[:, :, 3] > 8)
if len(xs) and len(ys):
    pad = 10
    x0, x1 = max(0, int(xs.min()) - pad), min(arr.shape[1], int(xs.max()) + pad + 1)
    y0, y1 = max(0, int(ys.min()) - pad), min(arr.shape[0], int(ys.max()) + pad + 1)
    arr = arr[y0:y1, x0:x1]

result = Image.fromarray(arr, "RGBA")
if result.width < 480:
    scale = 480 / result.width
    result = result.resize(
        (int(result.width * scale), int(result.height * scale)),
        Image.Resampling.LANCZOS,
    )

out.parent.mkdir(parents=True, exist_ok=True)
result.save(out, "PNG", optimize=True)
print(f"saved {out}")
print(f"size={result.size} bytes={out.stat().st_size}")
