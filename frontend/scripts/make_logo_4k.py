"""Build transparent IQMath logos from the best available source."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

SRC = Path(
    r"C:\Users\jagat\.cursor\projects\d-IQ-Math-New-iqmathlms-platform-main-1-iqmathlms-platform-main"
    r"\assets\c__Users_jagat_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"ff0a17dbaf85507d425d7851a66d82e0_images_IQmath_Technologies_Logo-506e9b08-7528-4640-ada0-b3d8e3e27dfb.jpg"
)
PUBLIC = Path(__file__).resolve().parents[1] / "public"


def to_transparent(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).copy()
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    dist = np.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2)
    hard_clear, soft_end = 16.0, 52.0
    alpha = np.clip((dist - hard_clear) / (soft_end - hard_clear), 0.0, 1.0)
    arr[:, :, 3] = (alpha * 255).astype(np.uint8)

    ys, xs = np.where(arr[:, :, 3] > 8)
    if len(xs) and len(ys):
        pad = 12
        x0, x1 = max(0, int(xs.min()) - pad), min(arr.shape[1], int(xs.max()) + pad + 1)
        y0, y1 = max(0, int(ys.min()) - pad), min(arr.shape[0], int(ys.max()) + pad + 1)
        arr = arr[y0:y1, x0:x1]
    return Image.fromarray(arr, "RGBA")


def upscale_to_width(img: Image.Image, target_w: int) -> Image.Image:
    if img.width >= target_w:
        return img
    scale = target_w / img.width
    target = (target_w, max(1, int(round(img.height * scale))))
    out = img.resize(target, Image.Resampling.LANCZOS)
    # Mild sharpen so upscaled edges stay crisp on retina / 4K displays
    return out.filter(ImageFilter.UnsharpMask(radius=1.6, percent=140, threshold=2))


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    base = to_transparent(Image.open(SRC))
    print(f"source cropped transparent: {base.size}")

    # Standard web logo (~2x retina for common UI sizes)
    std = upscale_to_width(base, 1600)
    std_path = PUBLIC / "iqmath-logo.png"
    std.save(std_path, "PNG", optimize=True)
    print(f"saved {std_path} {std.size} ({std_path.stat().st_size} bytes)")

    # 4K-class asset for landing / hero (3840px wide)
    hi = upscale_to_width(base, 3840)
    hi_path = PUBLIC / "iqmath-logo-4k.png"
    hi.save(hi_path, "PNG", optimize=True)
    print(f"saved {hi_path} {hi.size} ({hi_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
