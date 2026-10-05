"""
Certificate PDF generation — FINAL locked structure for ALL users/courses.

Every download from /api/v1/generate-pdf/{course_id} uses this exact layout.
Do not add per-course or per-user format overrides.

Background chrome (logo, titles, signatures, partner logos):
  certificate_assets/certificate-template.png

Overlay fields (FINAL_CERTIFICATE_FORMAT):
  - Certificate ID (top-right, Alice 14pt)
  - Issued date (top-right, Alice 13pt)
  - Recipient name (below “THIS IS TO CERTIFY THAT”)
  - Full body paragraph (15pt, justified, never truncated)
"""
from __future__ import annotations

import copy
import io
import os
from types import MappingProxyType
from typing import Any, Dict, List, Mapping, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ASSETS_DIR = os.path.join(os.path.dirname(__file__), "certificate_assets")
TEMPLATE_PNG = os.path.join(ASSETS_DIR, "certificate-template.png")
ALICE_FONT_PATH = os.path.join(ASSETS_DIR, "Alice-Regular.ttf")
WIN_FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")

# A4 landscape points ≈ 842 × 595
PAGE_W, PAGE_H = landscape(A4)

# Version stamp for the locked final structure (bump only when intentionally changing layout)
FINAL_CERTIFICATE_STRUCTURE_VERSION = "2026-10-05-final"

# ---------------------------------------------------------------------------
# FINAL certificate format — used for EVERY generated certificate.
# Boxes are % from page top; sizes are pt. Mutable copies are returned via
# get_final_certificate_format(); runtime code must not invent alternate layouts.
# ---------------------------------------------------------------------------
_FINAL_CERTIFICATE_FORMAT_RAW: Dict[str, Dict[str, float]] = {
    # Certificate ID + Issued Date — Alice font (Alice-Regular.ttf)
    "certId": {"x": 54.0, "y": 2.8, "w": 40.0, "h": 5.2, "size": 14.0},
    "issuedDate": {"x": 54.0, "y": 7.6, "w": 40.0, "h": 4.8, "size": 13.0},
    # Below “THIS IS TO CERTIFY THAT”, above body
    "recipient": {"x": 12.0, "y": 35.8, "w": 76.0, "h": 8.0, "size": 34.0},
    # Between name and signature band — full body, 15pt, justified
    "body": {"x": 12.0, "y": 44.5, "w": 76.0, "h": 19.5, "size": 15.0},
}

FINAL_CERTIFICATE_FORMAT: Mapping[str, Mapping[str, float]] = MappingProxyType(
    {key: MappingProxyType(dict(val)) for key, val in _FINAL_CERTIFICATE_FORMAT_RAW.items()}
)

# Back-compat aliases (same final structure)
DEFAULT_CERTIFICATE_FORMAT = FINAL_CERTIFICATE_FORMAT
LAYOUT = FINAL_CERTIFICATE_FORMAT


def get_final_certificate_format() -> Dict[str, Dict[str, float]]:
    """Deep copy of the locked final layout (safe to read; changes are discarded)."""
    return copy.deepcopy(_FINAL_CERTIFICATE_FORMAT_RAW)

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


def _register_fonts() -> Tuple[str, str, str, str]:
    """Body/name fonts + Alice for certificate ID / issued date."""
    global _FONTS_REGISTERED
    regular = "Times-Roman"
    bold = "Times-Bold"
    sans = "Helvetica"
    alice = "Times-Roman"

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
        alice = (
            _try_register(
                "CertAlice",
                os.path.join(ASSETS_DIR, "Alice-Regular.ttf"),
                os.path.join(ASSETS_DIR, "Alice.ttf"),
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
        if "CertAlice" in registered:
            alice = "CertAlice"
        else:
            alice = (
                _try_register(
                    "CertAlice",
                    os.path.join(ASSETS_DIR, "Alice-Regular.ttf"),
                    os.path.join(ASSETS_DIR, "Alice.ttf"),
                )
                or sans
            )

    return regular, bold, sans, alice


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


def _draw_justified_line(
    c: canvas.Canvas,
    line: str,
    *,
    x: float,
    y: float,
    width: float,
    font: str,
    size: float,
    justify: bool,
) -> None:
    """Draw one line; justify spreads words to both left and right edges."""
    words = line.split()
    if not words:
        return
    c.setFont(font, size)
    if not justify or len(words) == 1:
        c.drawString(x, y, line)
        return

    word_widths = [c.stringWidth(w, font, size) for w in words]
    total = sum(word_widths)
    gaps = len(words) - 1
    extra = max(0.0, width - total)
    gap = extra / gaps
    cursor_x = x
    for i, word in enumerate(words):
        c.drawString(cursor_x, y, word)
        cursor_x += word_widths[i] + gap


def _draw_wrapped_justified(
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
    leading_factor: float = 1.34,
) -> None:
    """
    Full body text at a fixed size (15pt default). Never truncates.
    Justified alignment (flush left + right); last line left-aligned.
    Leading tightens slightly only if needed to fit the box.
    """
    working_size = float(size)
    lines = _wrap_to_width(c, text, font, working_size, width)
    if not lines:
        return

    leading = working_size * leading_factor
    block_h = leading * len(lines)
    # Fit full content by easing line spacing — never cut words
    min_leading = working_size * 1.18
    while block_h > height and leading > min_leading:
        leading -= 0.25
        block_h = leading * len(lines)

    # Top-align within the body band with a small inset
    cursor = y + height - working_size * 0.9
    if block_h < height:
        # slight top padding so text sits cleanly under the name
        cursor = y + height - min(working_size * 0.35, (height - block_h) * 0.25) - working_size * 0.85

    c.setFillColor(color)
    last_i = len(lines) - 1
    for i, line in enumerate(lines):
        _draw_justified_line(
            c,
            line,
            x=x,
            y=cursor,
            width=width,
            font=font,
            size=working_size,
            justify=(i != last_i),
        )
        cursor -= leading


def create_certificate_pdf(
    student_name: str,
    course_name: str,
    date_str: str,
    certificate_id: str,
    course_type: Optional[str] = None,
    **_ignored: Any,
) -> io.BytesIO:
    """
    Build the FINAL structured certificate PDF for any user/course.

    Only student name, course title, issue date, and certificate ID vary.
    Layout, fonts, sizes, and alignment are locked (FINAL_CERTIFICATE_FORMAT).
    Extra kwargs (e.g. custom format) are ignored so every cert stays identical.
    """
    if not os.path.isfile(TEMPLATE_PNG):
        raise FileNotFoundError(
            f"Certificate template missing: {TEMPLATE_PNG}. "
            "Place certificate-template.png in certificate_assets/."
        )
    if not os.path.isfile(ALICE_FONT_PATH):
        raise FileNotFoundError(
            f"Alice font missing: {ALICE_FONT_PATH}. "
            "Required for the final certificate ID / issued-date style."
        )

    # Always read latest template from disk (no stale cache across restarts)
    global _TEMPLATE_MTIME
    mtime = os.path.getmtime(TEMPLATE_PNG)
    _TEMPLATE_MTIME = mtime

    cert_no = (certificate_id or "").strip() or "PENDING"
    issued = (date_str or "").strip() or "—"

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))
    regular, bold, sans, alice = _register_fonts()
    if alice != "CertAlice":
        raise RuntimeError(
            "Final certificate structure requires Alice font (CertAlice). "
            "Ensure Alice-Regular.ttf is present in certificate_assets/."
        )

    c.drawImage(
        ImageReader(TEMPLATE_PNG),
        0,
        0,
        width=PAGE_W,
        height=PAGE_H,
        preserveAspectRatio=False,
        mask="auto",
    )

    # Locked final layout for every certificate — never overridden
    layout = get_final_certificate_format()

    # Certificate ID — top right (Alice 14pt)
    ix, iy, iw, ih = _box(layout["certId"])
    id_label = f"Certificate ID: {cert_no}"
    id_size = float(layout["certId"]["size"])
    c.setFont(alice, id_size)
    c.setFillColor(CERT_ID_COLOR)
    c.drawRightString(ix + iw, iy + ih * 0.28, id_label)

    # Issued date — under certificate ID (Alice 13pt)
    dx, dy, dw, dh = _box(layout["issuedDate"])
    issued_label = f"Issued: {issued}"
    issued_size = float(layout["issuedDate"]["size"])
    c.setFont(alice, issued_size)
    c.setFillColor(META_COLOR)
    c.drawRightString(dx + dw, dy + dh * 0.28, issued_label)

    # Recipient name (may shrink only for very long names; position fixed)
    rx, ry, rw, rh = _box(layout["recipient"])
    name = format_recipient_name(student_name)
    name_size = _fit_font_size(c, name, bold, float(layout["recipient"]["size"]), rw * 0.96, min_size=18)
    c.setFont(bold, name_size)
    c.setFillColor(NAME_COLOR)
    c.drawCentredString(rx + rw / 2.0, ry + rh / 2.0 - name_size * 0.32, name)

    # Body — full text, 15pt, justified for every certificate
    bx, by, bw, bh = _box(layout["body"])
    body = build_body_text(course_name, course_type)
    _draw_wrapped_justified(
        c,
        body,
        x=bx,
        y=by,
        width=bw,
        height=bh,
        font=regular,
        size=float(layout["body"]["size"]),
        color=BODY_COLOR,
    )

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
