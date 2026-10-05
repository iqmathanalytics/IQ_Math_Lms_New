from pathlib import Path
import numpy as np
from PIL import Image

src = Path(
    r"C:\Users\jagat\.cursor\projects\d-IQ-Math-New-iqmathlms-platform-main-1-iqmathlms-platform-main\assets"
    r"\c__Users_jagat_AppData_Roaming_Cursor_User_workspaceStorage_ff0a17dbaf85507d425d7851a66d82e0_images_IQmath_Technologies_Logo-506e9b08-7528-4640-ada0-b3d8e3e27dfb.jpg"
)
out = Path(__file__).resolve().parents[1] / "public" / "iqmath-logo.png"
jpg_out = Path(__file__).resolve().parents[1] / "public" / "iqmath-logo-dark.jpg"

img = Image.open(src).convert("RGBA")
arr = np.asarray(img).astype(np.float32)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
mx = np.maximum(np.maximum(r, g), b)

# Soft key out near-black; keep glow and brand colors
alpha = np.clip((mx - 16.0) / (52.0 - 16.0), 0, 1) * 255.0
colorfulness = (np.abs(r - g) + np.abs(g - b) + np.abs(r - b)) / 3.0
alpha = np.maximum(alpha, np.clip((colorfulness - 8) / 30.0, 0, 1) * 255.0 * (mx > 22))
arr[:, :, 3] = alpha

mask = arr[:, :, 3] > 8
ys, xs = np.where(mask)
if len(xs):
    pad = 16
    y0, y1 = max(0, ys.min() - pad), min(arr.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(arr.shape[1], xs.max() + pad + 1)
    arr = arr[y0:y1, x0:x1]

out.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(arr.astype(np.uint8), "RGBA").save(out, optimize=True)
Image.open(src).save(jpg_out, quality=92)
print(f"saved {out} size={arr.shape[1]}x{arr.shape[0]}")
print(f"saved {jpg_out}")
