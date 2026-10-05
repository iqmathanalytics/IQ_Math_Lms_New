"""Sequential certificate ID helpers: {prefix}-{CODE}-{padded number}."""
from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException


def suggest_cert_code(title: Optional[str]) -> str:
    """Derive a 3-letter A–Z code from a course title."""
    letters = re.sub(r"[^A-Za-z]", "", title or "")
    if len(letters) >= 3:
        return letters[:3].upper()
    padded = (letters + "XYZ")[:3]
    return padded.upper()


def normalize_prefix(prefix: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]", "", (prefix or "").strip().upper())
    if not cleaned or len(cleaned) > 8:
        raise HTTPException(status_code=400, detail="prefix must be 1–8 alphanumeric characters")
    return cleaned


def normalize_code(code: str) -> str:
    cleaned = re.sub(r"[^A-Za-z]", "", (code or "").strip().upper())
    if len(cleaned) != 3:
        raise HTTPException(status_code=400, detail="code must be exactly 3 letters (A–Z)")
    return cleaned


def normalize_width(width: int) -> int:
    try:
        w = int(width)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="number_width must be an integer 1–8")
    if w < 1 or w > 8:
        raise HTTPException(status_code=400, detail="number_width must be between 1 and 8")
    return w


def format_certificate_id(prefix: str, code: str, seq: int, width: int) -> str:
    return f"{prefix}-{code}-{str(seq).zfill(width)}"


def resolve_course_cert_settings(course, *, strict: bool = True) -> Tuple[str, str, int, int]:
    """
    Read certificate ID template from a course.
    When strict=False (list/preview), never raise — fall back to safe defaults.
    """
    try:
        prefix = normalize_prefix(getattr(course, "cert_prefix", None) or "IQ")
    except HTTPException:
        if strict:
            raise
        prefix = "IQ"

    code_raw = getattr(course, "cert_code", None) or suggest_cert_code(getattr(course, "title", "") or "")
    try:
        code = normalize_code(code_raw)
    except HTTPException:
        if strict:
            raise
        code = suggest_cert_code(getattr(course, "title", "") or "")

    try:
        width = normalize_width(getattr(course, "cert_number_width", None) or 3)
    except HTTPException:
        if strict:
            raise
        width = 3

    try:
        seq = int(getattr(course, "cert_seq", None) or 0)
    except (TypeError, ValueError):
        seq = 0
    if seq < 0:
        seq = 0
    return prefix, code, width, seq


def preview_next_id(course) -> str:
    prefix, code, width, seq = resolve_course_cert_settings(course)
    return format_certificate_id(prefix, code, seq + 1, width)


def allocate_next_certificate_id(course, used_ids: Optional[set] = None) -> str:
    """
    Increment course.cert_seq and return the next public certificate ID.
    Skips any IDs already present in used_ids (existing user_certificates).
    """
    prefix, code, width, seq = resolve_course_cert_settings(course, strict=False)
    used = used_ids or set()
    next_seq = max(seq, 0) + 1
    # Cap runaway loops; 10000 is far beyond normal course volume
    for _ in range(10000):
        candidate = format_certificate_id(prefix, code, next_seq, width)
        if candidate not in used:
            course.cert_prefix = prefix
            course.cert_code = code
            course.cert_number_width = width
            course.cert_seq = next_seq
            return candidate
        next_seq += 1
    raise HTTPException(status_code=500, detail="Unable to allocate a unique certificate ID")


def apply_certificate_id_settings(
    course,
    *,
    prefix: str,
    code: str,
    number_width: int,
    start_number: int,
) -> Dict[str, Any]:
    """
    Update template. start_number is the next sequence to issue (cert_seq = start_number - 1).
    Allowed to reset back to 1 for all courses; uniqueness is enforced at issue time.
    """
    new_prefix = normalize_prefix(prefix)
    new_code = normalize_code(code)
    new_width = normalize_width(number_width)
    try:
        start = int(start_number)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="start_number must be an integer >= 1")
    if start < 1:
        raise HTTPException(status_code=400, detail="start_number must be >= 1")

    course.cert_prefix = new_prefix
    course.cert_code = new_code
    course.cert_number_width = new_width
    course.cert_seq = start - 1

    return {
        "prefix": new_prefix,
        "code": new_code,
        "number_width": new_width,
        "start_number": start,
        "cert_seq": course.cert_seq,
        "preview": format_certificate_id(new_prefix, new_code, start, new_width),
    }


def reset_course_start_at_one(course) -> Dict[str, Any]:
    """Force next certificate number to 1 for this course (keeps/fills prefix+code)."""
    prefix, code, width, _ = resolve_course_cert_settings(course, strict=False)
    course.cert_prefix = prefix
    course.cert_code = code
    course.cert_number_width = width
    course.cert_seq = 0
    return settings_payload(course)


def settings_payload(course) -> Dict[str, Any]:
    prefix, code, width, seq = resolve_course_cert_settings(course, strict=False)
    # Keep DB in sync with resolved defaults so admin UI always sees real values
    if not getattr(course, "cert_prefix", None):
        course.cert_prefix = prefix
    if not getattr(course, "cert_code", None):
        course.cert_code = code
    if getattr(course, "cert_number_width", None) in (None, 0):
        course.cert_number_width = width
    if getattr(course, "cert_seq", None) is None:
        course.cert_seq = seq
    return {
        "course_id": course.id,
        "id": course.id,
        "title": course.title or f"Course #{course.id}",
        "prefix": prefix,
        "code": code,
        "number_width": width,
        "cert_seq": seq,
        "start_number": seq + 1,
        "preview": format_certificate_id(prefix, code, seq + 1, width),
        "is_published": bool(getattr(course, "is_published", False)),
        "price": getattr(course, "price", None),
    }
