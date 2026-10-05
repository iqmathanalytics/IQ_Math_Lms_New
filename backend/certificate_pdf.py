"""
Certificate PDF generation using the IQMath Canva template.

Background chrome (logo, titles, signatures, partner logos) lives in
certificate_assets/certificate-template.png. Overlay fields:
  - Certificate number (top-right)
  - Issued date (top-right, under number)
  - Recipient name (under “THIS IS TO CERTIFY THAT”)
  - Course completion body (above signature band)
"""
from __future__ import annotations

import io
import os
from typing import List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ASSETS_DIR = os.path.join(os.path.dirname(__file__), "certificate_assets")
TEMPLATE_PNG = os.path.join(ASSETS_DIR, "certificate-template.png")
WIN_FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")

# A4 landscape points ≈ 842 × 595
PAGE_W, PAGE_H = landscape(A4)

# ---------------------------------------------------------------------------
# DEFAULT certificate format — used for EVERY generated certificate.
# Do not vary per course. Sizes are fixed (pt); boxes are % from page top.
# ---------------------------------------------------------------------------
DEFAULT_CERTIFICATE_FORMAT = {
    "certId": {"x": 54.0, "y": 3.2, "w": 40.0, "h": 4.8, "size": 10.0},
    "issuedDate": {"x": 54.0, "y": 7.8, "w": 40.0, "h": 4.4, "size": 10.0},
    # Below “THIS IS TO CERTIFY THAT”, above body
    "recipient": {"x": 12.0, "y": 33.5, "w": 76.0, "h": 9.0, "size": 34.0},
    # Between name and signature band — body content always 12pt
    "body": {"x": 12.0, "y": 43.5, "w": 76.0, "h": 17.5, "size": 12.0},
}

# Alias used by drawing helpers
LAYOUT = DEFAULT_CERTIFICATE_FORMAT

NAME_COLOR = colors.Color(0x2C / 255, 0x2C / 255, 0x2C / 255)
BODY_COLOR = colors.Color(0x3A / 255, 0x3A / 255, 0x3A / 255)
META_COLOR = colors.Color(0x4A / 255, 0x4A / 255, 0x4A / 255)
CERT_ID_COLOR = colors.Color(0x00 / 255, 0x5E / 255, 0xB8 / 255)

_FONTS_REGISTERED = False
_TEMPLATE_MTIME: Optional[float] = None


def _try_register(family: str, *paths: str) -> Optional[str]:
    for path in paths:
        if path and os.path.isfile(path):
            try:
                pdfmetrics.registerFont(TTFont(family, path))
                return family
            except Exception:
                continue
    return None


def _register_fonts() -> Tuple[str, str, str]:
    """Prefer Georgia / Rockwell (sample look); fall back to Times / Helvetica."""
    global _FONTS_REGISTERED
    regular = "Times-Roman"
    bold = "Times-Bold"
    sans = "Helvetica"

    if not _FONTS_REGISTERED:
        bold = (
            _try_register(
                "CertNameBold",
                os.path.join(ASSETS_DIR, "CertTitle.ttf"),
                os.path.join(WIN_FONTS, "ROCKB.TTF"),
                os.path.join(WIN_FONTS, "rockb.ttf"),
                os.path.join(WIN_FONTS, "georgiab.ttf"),
                os.path.join(WIN_FONTS, "Georgia Bold.ttf"),
            )
            or bold
        )
        regular = (
            _try_register(
                "CertBody",
                os.path.join(ASSETS_DIR, "CertBody.ttf"),
                os.path.join(WIN_FONTS, "georgia.ttf"),
                os.path.join(WIN_FONTS, "Georgia.ttf"),
                os.path.join(WIN_FONTS, "times.ttf"),
            )
            or regular
        )
        sans = (
            _try_register(
                "CertSans",
                os.path.join(WIN_FONTS, "arial.ttf"),
                os.path.join(WIN_FONTS, "Arial.ttf"),
                os.path.join(WIN_FONTS, "calibri.ttf"),
            )
            or sans
        )
        _FONTS_REGISTERED = True
    else:
        registered = set(pdfmetrics.getRegisteredFontNames())
        if "CertNameBold" in registered:
            bold = "CertNameBold"
        if "CertBody" in registered:
            regular = "CertBody"
        if "CertSans" in registered:
            sans = "CertSans"

    return regular, bold, sans


def _box(region: dict) -> Tuple[float, float, float, float]:
    x = PAGE_W * (region["x"] / 100.0)
    h = PAGE_H * (region["h"] / 100.0)
    y_top = PAGE_H * (1.0 - region["y"] / 100.0)
    y = y_top - h
    w = PAGE_W * (region["w"] / 100.0)
    return x, y, w, h


def format_recipient_name(name: str) -> str:
    cleaned = " ".join((name or "").split())
    if not cleaned:
        return "Learner"
    return cleaned.title()


def build_body_text(course_name: str, course_type: Optional[str] = None) -> str:
    del course_type
    program = (course_name or "this programme").strip()
    return (
        f"has successfully completed the {program} conducted by IQmath Technologies. "
        f"Throughout the program, the recipient demonstrated a strong understanding of "
        f"the concepts, practical methodologies, and industry-relevant skills covered "
        f"in the training, with the ability to apply the acquired knowledge to "
        f"real-world professional and business applications."
    )


def _fit_font_size(
    c: canvas.Canvas,
    text: str,
    font: str,
    max_size: float,
    max_width: float,
    min_size: float = 14,
) -> float:
    size = max_size
    while size > min_size and c.stringWidth(text, font, size) > max_width:
        size -= 0.5
    return size


def _wrap_to_width(c: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> List[str]:
    words = text.split()
    if not words:
        return [""]
    lines: List[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _draw_wrapped_centered(
    c: canvas.Canvas,
    text: str,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    font: str,
    size: float,
    color,
    leading_factor: float = 1.38,
) -> None:
    """Wrap at a fixed font size (default body = 12pt). Never shrinks."""
    working_size = float(size)
    lines = _wrap_to_width(c, text, font, working_size, width)
    leading = working_size * leading_factor

    max_lines = max(1, int(height / leading))
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        if len(lines[-1]) > 3:
            lines[-1] = lines[-1].rstrip(".,; ") + "…"

    block_h = leading * len(lines)
    cursor = y + height - working_size * 0.85
    if block_h < height:
        cursor = y + height - ((height - block_h) * 0.18) - working_size * 0.85

    c.setFont(font, working_size)
    c.setFillColor(color)
    cx = x + width / 2.0
    for line in lines:
        c.drawCentredString(cx, cursor, line)
        cursor -= leading


def create_certificate_pdf(
    student_name: str,
    course_name: str,
    date_str: str,
    certificate_id: str,
    course_type: Optional[str] = None,
) -> io.BytesIO:
    if not os.path.isfile(TEMPLATE_PNG):
        raise FileNotFoundError(
            f"Certificate template missing: {TEMPLATE_PNG}. "
            "Place certificate-template.png in certificate_assets/."
        )

    # Always read latest template from disk (no stale cache across restarts)
    global _TEMPLATE_MTIME
    mtime = os.path.getmtime(TEMPLATE_PNG)
    _TEMPLATE_MTIME = mtime

    cert_no = (certificate_id or "").strip() or "PENDING"
    issued = (date_str or "").strip() or "—"

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))
    regular, bold, sans = _register_fonts()

    c.drawImage(
        ImageReader(TEMPLATE_PNG),
        0,
        0,
        width=PAGE_W,
        height=PAGE_H,
        preserveAspectRatio=False,
        mask="auto",
    )

    layout = DEFAULT_CERTIFICATE_FORMAT  # single default for all certificates

    # Certificate number — top right (fixed 10pt)
    ix, iy, iw, ih = _box(layout["certId"])
    id_label = f"Certificate No: {cert_no}"
    id_size = float(layout["certId"]["size"])  # 10pt default
    c.setFont(sans, id_size)
    c.setFillColor(CERT_ID_COLOR)
    c.drawRightString(ix + iw, iy + ih * 0.28, id_label)

    # Issued date — under certificate number (fixed 10pt)
    dx, dy, dw, dh = _box(layout["issuedDate"])
    issued_label = f"Issued Date: {issued}"
    issued_size = float(layout["issuedDate"]["size"])  # 10pt default
    c.setFont(sans, issued_size)
    c.setFillColor(META_COLOR)
    c.drawRightString(dx + dw, dy + dh * 0.28, issued_label)

    # Recipient name (default placement; may shrink only for very long names)
    rx, ry, rw, rh = _box(layout["recipient"])
    name = format_recipient_name(student_name)
    name_size = _fit_font_size(c, name, bold, float(layout["recipient"]["size"]), rw * 0.96, min_size=18)
    c.setFont(bold, name_size)
    c.setFillColor(NAME_COLOR)
    c.drawCentredString(rx + rw / 2.0, ry + rh / 2.0 - name_size * 0.32, name)

    # Body copy — fixed 12pt default for all certificates
    bx, by, bw, bh = _box(layout["body"])
    body = build_body_text(course_name, course_type)
    _draw_wrapped_centered(
        c,
        body,
        x=bx,
        y=by,
        width=bw,
        height=bh,
        font=regular,
        size=float(layout["body"]["size"]),  # 12pt
        color=BODY_COLOR,
    )

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
