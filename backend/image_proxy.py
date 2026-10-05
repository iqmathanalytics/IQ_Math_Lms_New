"""
Lightweight course-thumbnail proxy.

External hosts (postimg / ibb) serve 1MB+ originals. Cards only need ~480px WebP,
so we fetch → resize → cache with long Cache-Control for Cloudflare / browsers.
"""
from __future__ import annotations

import hashlib
import io
import threading
from collections import OrderedDict
from typing import Optional, Set, Tuple
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None  # type: ignore

router = APIRouter(tags=["media"])

ALLOWED_HOST_SUFFIXES = (
    "postimg.cc",
    "ibb.co",
    "imgur.com",
    "unsplash.com",
    "images.unsplash.com",
    "freepik.com",
    "img.freepik.com",
    "drive.google.com",
    "googleusercontent.com",
    "cloudfront.net",
    "amazonaws.com",
)

_MAX_CACHE = 64
_MAX_SOURCE_BYTES = 8 * 1024 * 1024  # 8 MB
_cache: "OrderedDict[str, Tuple[bytes, str]]" = OrderedDict()
_lock = threading.Lock()


def _host_allowed(hostname: str) -> bool:
    host = (hostname or "").lower().rstrip(".")
    if not host:
        return False
    for suffix in ALLOWED_HOST_SUFFIXES:
        if host == suffix or host.endswith(f".{suffix}"):
            return True
    return False


def _cache_get(key: str) -> Optional[Tuple[bytes, str]]:
    with _lock:
        item = _cache.get(key)
        if item is None:
            return None
        _cache.move_to_end(key)
        return item


def _cache_set(key: str, data: bytes, content_type: str) -> None:
    with _lock:
        _cache[key] = (data, content_type)
        _cache.move_to_end(key)
        while len(_cache) > _MAX_CACHE:
            _cache.popitem(last=False)


def _resize(raw: bytes, width: int, quality: int) -> Tuple[bytes, str]:
    if Image is None:
        raise HTTPException(status_code=500, detail="Pillow not installed")

    with Image.open(io.BytesIO(raw)) as im:
        im = im.convert("RGBA") if im.mode in ("P", "RGBA", "LA") else im.convert("RGB")
        w, h = im.size
        if w > width:
            ratio = width / float(w)
            im = im.resize((width, max(1, int(h * ratio))), Image.Resampling.LANCZOS)

        out = io.BytesIO()
        # Prefer WebP (much smaller); fall back to JPEG
        try:
            save_im = im.convert("RGB") if im.mode == "RGBA" else im
            save_im.save(out, format="WEBP", quality=quality, method=4)
            return out.getvalue(), "image/webp"
        except Exception:
            out = io.BytesIO()
            im.convert("RGB").save(out, format="JPEG", quality=quality, optimize=True)
            return out.getvalue(), "image/jpeg"


@router.get("/api/v1/thumb")
def course_thumb(
    url: str = Query(..., min_length=8, max_length=2000),
    w: int = Query(480, ge=64, le=1280),
    q: int = Query(70, ge=40, le=90),
):
    """
    Resize a remote course image for card thumbnails.
    Example: /api/v1/thumb?url=https://i.postimg.cc/...&w=480&q=70
    """
    try:
        parsed = urlparse(url)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid url") from exc

    if parsed.scheme not in ("http", "https") or not _host_allowed(parsed.hostname or ""):
        raise HTTPException(status_code=400, detail="Host not allowed")

    cache_key = hashlib.sha1(f"{url}|{w}|{q}".encode("utf-8")).hexdigest()
    cached = _cache_get(cache_key)
    if cached:
        data, ctype = cached
        return Response(
            content=data,
            media_type=ctype,
            headers={
                "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
                "X-Thumb-Cache": "HIT",
            },
        )

    try:
        upstream = requests.get(
            url,
            timeout=12,
            stream=True,
            headers={"User-Agent": "IQMathLMS-Thumb/1.0"},
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Upstream fetch failed") from exc

    if upstream.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Upstream status {upstream.status_code}")

    raw = upstream.content
    if not raw or len(raw) > _MAX_SOURCE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large or empty")

    try:
        data, ctype = _resize(raw, w, q)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Unable to process image") from exc

    _cache_set(cache_key, data, ctype)
    return Response(
        content=data,
        media_type=ctype,
        headers={
            "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
            "X-Thumb-Cache": "MISS",
        },
    )
