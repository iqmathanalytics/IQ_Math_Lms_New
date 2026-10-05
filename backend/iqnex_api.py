"""IQNex feature routes: assessments, certificates admin, promo codes, public share."""
from __future__ import annotations

import os
import tempfile
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import certificate_ids
import models
from database import get_db

# Imported from main at include-time to avoid circular import on helpers —
# auth deps and secrets are passed via factory.


class CertIdUpdate(BaseModel):
    prefix: str
    code: str
    number_width: int = 3
    start_number: int = 1


class PromoBody(BaseModel):
    code: str
    discount_type: str
    discount_value: int
    course_id: Optional[int] = None
    max_uses: int = 0
    is_active: bool = True
    valid_until: Optional[str] = None
    note: Optional[str] = None


class PromoValidateBody(BaseModel):
    code: str
    course_id: int


def build_iqnex_router(
    *,
    get_current_user,
    require_instructor,
    require_student,
    secret_key: str,
    algorithm: str,
    oauth2_scheme,
    check_progress_status,
    razorpay_client,
    razorpay_key_id: str,
    razorpay_key_secret: str,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    # Writable on Render free tier; survives process restarts within the same instance
    ASSESSMENT_DIR = os.getenv(
        "ASSESSMENT_UPLOAD_DIR",
        os.path.join(tempfile.gettempdir(), "iqmath_assessment_uploads"),
    )
    try:
        os.makedirs(ASSESSMENT_DIR, exist_ok=True)
    except OSError:
        ASSESSMENT_DIR = os.path.join(os.path.dirname(__file__), "assessment_uploads")
        os.makedirs(ASSESSMENT_DIR, exist_ok=True)
    ALLOWED_EXT = {".pdf", ".zip", ".doc", ".docx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".txt"}
    MAX_BYTES = 20 * 1024 * 1024

    # ---------- Auth optional ----------
    async def get_optional_user(
        authorization: Optional[str] = Header(None),
        db: AsyncSession = Depends(get_db),
    ):
        if not authorization or not authorization.lower().startswith("bearer "):
            return None
        token = authorization.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, secret_key, algorithms=[algorithm])
            email = payload.get("sub")
            if not email:
                return None
        except JWTError:
            return None
        res = await db.execute(select(models.User).where(models.User.email == email))
        return res.scalars().first()

    # ---------- Promo helpers ----------
    def _normalize_code(code: str) -> str:
        return (code or "").replace(" ", "").strip().upper()

    def _parse_valid_until(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            day = datetime.strptime(value[:10], "%Y-%m-%d")
            return day.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="valid_until must be YYYY-MM-DD")

    def _apply_discount(original: int, discount_type: str, discount_value: int) -> int:
        if discount_type == "percent":
            return max(0, original - int(round(original * discount_value / 100.0)))
        return max(0, original - discount_value)

    async def _load_usable_promo(
        db: AsyncSession,
        code: str,
        course_id: int,
        user_id: int,
    ) -> models.PromoCode:
        normalized = _normalize_code(code)
        if not normalized:
            raise HTTPException(status_code=400, detail="Promo code is required")
        res = await db.execute(select(models.PromoCode).where(models.PromoCode.code == normalized))
        promo = res.scalars().first()
        if not promo or not promo.is_active:
            raise HTTPException(status_code=400, detail="Invalid or inactive promo code")
        if promo.valid_until and datetime.utcnow() > promo.valid_until:
            raise HTTPException(status_code=400, detail="Promo code has expired")
        if promo.max_uses and promo.used_count >= promo.max_uses:
            raise HTTPException(status_code=400, detail="Promo code usage limit reached")
        if promo.course_id is not None and promo.course_id != course_id:
            raise HTTPException(status_code=400, detail="Promo code is not valid for this course")
        red_res = await db.execute(
            select(models.PromoRedemption).where(
                models.PromoRedemption.promo_id == promo.id,
                models.PromoRedemption.user_id == user_id,
                models.PromoRedemption.course_id == course_id,
            )
        )
        if red_res.scalars().first():
            raise HTTPException(status_code=400, detail="You already used this promo on this course")
        return promo

    async def _record_redemption(
        db: AsyncSession,
        promo: models.PromoCode,
        user_id: int,
        course_id: int,
        original_price: int,
        final_price: int,
        order_id: Optional[str],
    ):
        db.add(
            models.PromoRedemption(
                promo_id=promo.id,
                user_id=user_id,
                course_id=course_id,
                original_price=original_price,
                final_price=final_price,
                order_id=order_id,
            )
        )
        promo.used_count = int(promo.used_count or 0) + 1

    def _promo_list_item(promo: models.PromoCode) -> Dict[str, Any]:
        return {
            "id": promo.id,
            "code": promo.code,
            "discount_type": promo.discount_type,
            "discount_value": promo.discount_value,
            "course_id": promo.course_id,
            "course_title": promo.course.title if promo.course else None,
            "max_uses": promo.max_uses,
            "used_count": promo.used_count,
            "is_active": promo.is_active,
            "valid_until": promo.valid_until.strftime("%Y-%m-%d") if promo.valid_until else None,
            "note": promo.note or "",
            "created_at": promo.created_at.strftime("%Y-%m-%d") if promo.created_at else "",
        }

    # ---------- Certificate admin ----------
    @router.get("/admin/certificates")
    async def list_certificates(
        db: AsyncSession = Depends(get_db),
        _: models.User = Depends(require_instructor),
    ):
        res = await db.execute(
            select(models.UserCertificate)
            .options(
                selectinload(models.UserCertificate.user),
                selectinload(models.UserCertificate.course),
            )
            .order_by(models.UserCertificate.issued_at.desc())
        )
        rows = res.scalars().all()
        return [
            {
                "id": c.id,
                "student_name": c.user.full_name if c.user else "",
                "email": c.user.email if c.user else "",
                "course_id": c.course_id,
                "course_title": c.course.title if c.course else "",
                "certificate_id": c.certificate_id,
                "issued_at": c.issued_at.strftime("%Y-%m-%d") if c.issued_at else "",
            }
            for c in rows
        ]

    async def _instructor_courses(db: AsyncSession, instructor_id: int):
        res = await db.execute(
            select(models.Course)
            .where(models.Course.instructor_id == instructor_id)
            .order_by(models.Course.id)
        )
        owned = list(res.scalars().all())
        # If this instructor has no owned rows but courses exist (legacy seed / ID drift),
        # still surface them so Promo + Certificate desks stay usable and in sync.
        if not owned:
            all_res = await db.execute(select(models.Course).order_by(models.Course.id))
            owned = list(all_res.scalars().all())
        return owned

    @router.get("/admin/course-options")
    async def list_admin_course_options(
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(require_instructor),
    ):
        """Lightweight course list for Promo + Certificate desks (synced with My Courses)."""
        courses = await _instructor_courses(db, current_user.id)
        return [
            {
                "id": c.id,
                "course_id": c.id,
                "title": c.title or f"Course #{c.id}",
                "is_published": bool(c.is_published),
                "price": c.price,
            }
            for c in courses
        ]

    @router.get("/admin/certificate-id-courses")
    async def list_certificate_id_courses(
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(require_instructor),
    ):
        courses = await _instructor_courses(db, current_user.id)
        payload = [certificate_ids.settings_payload(c) for c in courses]
        # Persist any backfilled cert_* defaults so next load is stable
        await db.commit()
        return payload

    @router.get("/admin/courses/{course_id}/certificate-id")
    async def get_certificate_id_settings(
        course_id: int,
        db: AsyncSession = Depends(get_db),
        _: models.User = Depends(require_instructor),
    ):
        res = await db.execute(select(models.Course).where(models.Course.id == course_id))
        course = res.scalars().first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        return certificate_ids.settings_payload(course)

    @router.put("/admin/courses/{course_id}/certificate-id")
    async def update_certificate_id_settings(
        course_id: int,
        body: CertIdUpdate,
        db: AsyncSession = Depends(get_db),
        _: models.User = Depends(require_instructor),
    ):
        res = await db.execute(select(models.Course).where(models.Course.id == course_id))
        course = res.scalars().first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        payload = certificate_ids.apply_certificate_id_settings(
            course,
            prefix=body.prefix,
            code=body.code,
            number_width=body.number_width,
            start_number=body.start_number,
        )
        await db.commit()
        return payload

    @router.post("/admin/certificate-id-courses/reset-start")
    async def reset_all_certificate_starts(
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(require_instructor),
    ):
        """Save start number = 1 for every course (next ID …-001)."""
        courses = await _instructor_courses(db, current_user.id)
        # Also reset any orphan courses so the whole catalogue stays in sync
        all_res = await db.execute(select(models.Course).order_by(models.Course.id))
        all_courses = list(all_res.scalars().all())
        targets = all_courses if all_courses else courses
        payload = [certificate_ids.reset_course_start_at_one(c) for c in targets]
        await db.commit()
        return {"status": "success", "message": "All courses set to start certificate IDs at 1", "courses": payload}

    # ---------- Course assessments ----------
    async def _ensure_enrolled(db: AsyncSession, user_id: int, course_id: int):
        res = await db.execute(
            select(models.Enrollment).where(
                models.Enrollment.user_id == user_id,
                models.Enrollment.course_id == course_id,
            )
        )
        if not res.scalars().first():
            raise HTTPException(status_code=403, detail="You must be enrolled in this course")

    def _assessment_payload(row: Optional[models.CourseAssessment]) -> Dict[str, Any]:
        if not row:
            return {"submitted": False, "link": "", "file_name": "", "submitted_at": ""}
        return {
            "submitted": True,
            "link": row.link or "",
            "file_name": row.file_name or "",
            "submitted_at": row.submitted_at.strftime("%Y-%m-%d") if row.submitted_at else "",
        }

    @router.get("/courses/{course_id}/assessment")
    async def get_assessment(
        course_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
    ):
        await _ensure_enrolled(db, current_user.id, course_id)
        res = await db.execute(
            select(models.CourseAssessment).where(
                models.CourseAssessment.user_id == current_user.id,
                models.CourseAssessment.course_id == course_id,
            )
        )
        return _assessment_payload(res.scalars().first())

    @router.post("/courses/{course_id}/assessment")
    async def submit_assessment(
        course_id: int,
        link: Optional[str] = Form(None),
        file: Optional[UploadFile] = File(None),
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(require_student),
    ):
        await _ensure_enrolled(db, current_user.id, course_id)
        course_res = await db.execute(select(models.Course).where(models.Course.id == course_id))
        course = course_res.scalars().first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Progress gate
        if course.course_type == "coding":
            total_res = await db.execute(
                select(models.CourseChallenge.id).where(models.CourseChallenge.course_id == course_id)
            )
            challenge_ids = total_res.scalars().all()
            total = len(challenge_ids)
            solved = 0
            if challenge_ids:
                solved_res = await db.execute(
                    select(models.ChallengeProgress).where(
                        models.ChallengeProgress.user_id == current_user.id,
                        models.ChallengeProgress.challenge_id.in_(challenge_ids),
                        models.ChallengeProgress.is_solved == True,
                    )
                )
                solved = len(solved_res.scalars().all())
            if total == 0 or solved < total:
                raise HTTPException(
                    status_code=400,
                    detail="Finish every challenge in the course before submitting the assessment.",
                )
        else:
            _, total, is_done = await check_progress_status(current_user.id, course_id, db)
            if not is_done or total == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Finish every lesson in the course before submitting the assessment.",
                )

        link_val = (link or "").strip()
        stored_name = None
        if file and file.filename:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in ALLOWED_EXT:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXT))}",
                )
            try:
                file_bytes = await file.read()
            except Exception as exc:
                raise HTTPException(status_code=400, detail="Could not read uploaded file") from exc
            if not file_bytes:
                raise HTTPException(status_code=400, detail="Uploaded file is empty")
            if len(file_bytes) > MAX_BYTES:
                raise HTTPException(status_code=400, detail="File exceeds 20 MB limit")
            stored_name = f"{current_user.id}_{course_id}_{int(time.time())}{ext}"
            dest = os.path.join(ASSESSMENT_DIR, stored_name)
            try:
                with open(dest, "wb") as f:
                    f.write(file_bytes)
            except OSError as exc:
                raise HTTPException(
                    status_code=500,
                    detail="Could not save assessment file on server. Please try again or submit a link.",
                ) from exc

        if link_val and not (link_val.startswith("http://") or link_val.startswith("https://")):
            raise HTTPException(status_code=400, detail="Link must start with http:// or https://")

        if not stored_name and not link_val:
            raise HTTPException(
                status_code=400,
                detail="Upload the assessment file or project link before the certificate is issued.",
            )

        try:
            res = await db.execute(
                select(models.CourseAssessment).where(
                    models.CourseAssessment.user_id == current_user.id,
                    models.CourseAssessment.course_id == course_id,
                )
            )
            row = res.scalars().first()
            if row:
                if link_val:
                    row.link = link_val
                if stored_name:
                    if row.file_name:
                        old_path = os.path.join(ASSESSMENT_DIR, row.file_name)
                        if os.path.isfile(old_path):
                            try:
                                os.remove(old_path)
                            except OSError:
                                pass
                    row.file_name = stored_name
                    # Do NOT store BLOB in TiDB — disk is source of truth (avoids 500 / packet errors)
                    row.file_data = None
                row.submitted_at = datetime.utcnow()
            else:
                row = models.CourseAssessment(
                    user_id=current_user.id,
                    course_id=course_id,
                    link=link_val or None,
                    file_name=stored_name,
                    file_data=None,
                    submitted_at=datetime.utcnow(),
                )
                db.add(row)
            await db.commit()
            await db.refresh(row)
            return _assessment_payload(row)
        except HTTPException:
            raise
        except Exception as exc:
            await db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to save assessment. Please try again with a smaller file or a project link.",
            ) from exc

    @router.get("/instructor/courses/{course_id}/assessments")
    async def list_course_assessments(
        course_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(require_instructor),
    ):
        course_res = await db.execute(select(models.Course).where(models.Course.id == course_id))
        course = course_res.scalars().first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        if course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not own this course")
        res = await db.execute(
            select(models.CourseAssessment)
            .options(selectinload(models.CourseAssessment.user))
            .where(models.CourseAssessment.course_id == course_id)
            .order_by(models.CourseAssessment.submitted_at.desc())
        )
        rows = res.scalars().all()
        return [
            {
                "id": r.id,
                "student_name": r.user.full_name if r.user else "",
                "email": r.user.email if r.user else "",
                "file_name": r.file_name or "",
                "link": r.link or "",
                "submitted_at": r.submitted_at.strftime("%Y-%m-%d") if r.submitted_at else "",
            }
            for r in rows
        ]

    @router.get("/instructor/assessments/file/{file_name}")
    async def download_assessment_file(
        file_name: str,
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(require_instructor),
    ):
        safe = os.path.basename(file_name)
        res = await db.execute(
            select(models.CourseAssessment)
            .options(selectinload(models.CourseAssessment.course))
            .where(models.CourseAssessment.file_name == safe)
        )
        row = res.scalars().first()
        if not row:
            raise HTTPException(status_code=404, detail="File not found")
        if not row.course or row.course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        path = os.path.join(ASSESSMENT_DIR, safe)
        if os.path.isfile(path):
            return FileResponse(path, filename=safe)
        if row.file_data:
            return Response(
                content=bytes(row.file_data),
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="{safe}"'},
            )
        raise HTTPException(status_code=404, detail="File missing on disk")

    # ---------- Promo admin + validate ----------
    @router.get("/admin/promo-codes")
    async def list_promos(
        db: AsyncSession = Depends(get_db),
        _: models.User = Depends(require_instructor),
    ):
        res = await db.execute(
            select(models.PromoCode)
            .options(selectinload(models.PromoCode.course))
            .order_by(models.PromoCode.created_at.desc())
        )
        return [_promo_list_item(p) for p in res.scalars().all()]

    @router.post("/admin/promo-codes")
    async def create_promo(
        body: PromoBody,
        db: AsyncSession = Depends(get_db),
        _: models.User = Depends(require_instructor),
    ):
        code = _normalize_code(body.code)
        if body.discount_type not in {"percent", "fixed"}:
            raise HTTPException(status_code=400, detail="discount_type must be percent or fixed")
        if body.discount_type == "percent" and not (1 <= body.discount_value <= 100):
            raise HTTPException(status_code=400, detail="percent discount_value must be 1–100")
        if body.discount_type == "fixed" and body.discount_value < 1:
            raise HTTPException(status_code=400, detail="fixed discount_value must be >= 1")
        exists = await db.execute(select(models.PromoCode).where(models.PromoCode.code == code))
        if exists.scalars().first():
            raise HTTPException(status_code=400, detail="Promo code already exists")
        promo = models.PromoCode(
            code=code,
            discount_type=body.discount_type,
            discount_value=body.discount_value,
            course_id=body.course_id,
            max_uses=body.max_uses or 0,
            is_active=body.is_active,
            valid_until=_parse_valid_until(body.valid_until),
            note=(body.note or "")[:255] or None,
        )
        db.add(promo)
        await db.commit()
        await db.refresh(promo)
        res = await db.execute(
            select(models.PromoCode)
            .options(selectinload(models.PromoCode.course))
            .where(models.PromoCode.id == promo.id)
        )
        return _promo_list_item(res.scalars().first())

    @router.patch("/admin/promo-codes/{promo_id}")
    async def update_promo(
        promo_id: int,
        body: PromoBody,
        db: AsyncSession = Depends(get_db),
        _: models.User = Depends(require_instructor),
    ):
        res = await db.execute(select(models.PromoCode).where(models.PromoCode.id == promo_id))
        promo = res.scalars().first()
        if not promo:
            raise HTTPException(status_code=404, detail="Promo not found")
        code = _normalize_code(body.code)
        if body.discount_type not in {"percent", "fixed"}:
            raise HTTPException(status_code=400, detail="discount_type must be percent or fixed")
        dup = await db.execute(
            select(models.PromoCode).where(models.PromoCode.code == code, models.PromoCode.id != promo_id)
        )
        if dup.scalars().first():
            raise HTTPException(status_code=400, detail="Promo code already exists")
        promo.code = code
        promo.discount_type = body.discount_type
        promo.discount_value = body.discount_value
        promo.course_id = body.course_id
        promo.max_uses = body.max_uses or 0
        promo.is_active = body.is_active
        promo.valid_until = _parse_valid_until(body.valid_until)
        promo.note = (body.note or "")[:255] or None
        await db.commit()
        res = await db.execute(
            select(models.PromoCode)
            .options(selectinload(models.PromoCode.course))
            .where(models.PromoCode.id == promo.id)
        )
        return _promo_list_item(res.scalars().first())

    @router.delete("/admin/promo-codes/{promo_id}")
    async def delete_promo(
        promo_id: int,
        db: AsyncSession = Depends(get_db),
        _: models.User = Depends(require_instructor),
    ):
        res = await db.execute(select(models.PromoCode).where(models.PromoCode.id == promo_id))
        promo = res.scalars().first()
        if not promo:
            raise HTTPException(status_code=404, detail="Promo not found")
        await db.execute(delete(models.PromoRedemption).where(models.PromoRedemption.promo_id == promo_id))
        await db.delete(promo)
        await db.commit()
        return {"status": "success", "message": "Promo deleted"}

    @router.post("/promo/validate")
    async def validate_promo(
        body: PromoValidateBody,
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(require_student),
    ):
        course_res = await db.execute(select(models.Course).where(models.Course.id == body.course_id))
        course = course_res.scalars().first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        promo = await _load_usable_promo(db, body.code, body.course_id, current_user.id)
        original = int(course.price or 0)
        final = _apply_discount(original, promo.discount_type, promo.discount_value)
        savings = original - final
        return {
            "code": promo.code,
            "discount_type": promo.discount_type,
            "discount_value": promo.discount_value,
            "original_price": original,
            "final_price": final,
            "savings": savings,
            "message": f"Promo applied. Pay ₹{final} instead of ₹{original}."
            if final > 0
            else "Promo unlocks this course at no charge.",
        }

    # Expose helpers for main.py order/verify wiring
    router._iqnex_helpers = {  # type: ignore[attr-defined]
        "load_usable_promo": _load_usable_promo,
        "apply_discount": _apply_discount,
        "record_redemption": _record_redemption,
        "normalize_code": _normalize_code,
    }

    # ---------- Public course share ----------
    @router.get("/public/courses/{course_id}")
    async def public_course(
        course_id: int,
        db: AsyncSession = Depends(get_db),
    ):
        res = await db.execute(
            select(models.Course)
            .options(
                selectinload(models.Course.modules).selectinload(models.Module.items)
            )
            .where(models.Course.id == course_id)
        )
        course = res.scalars().first()
        if not course or not course.is_published:
            raise HTTPException(status_code=404, detail="Course not found")

        # Public share is always a module-title teaser — never expose topics/videos
        modules_out: List[Dict[str, Any]] = []
        lesson_count = 0
        for mod in sorted(course.modules or [], key=lambda m: m.order or 0):
            items = sorted(mod.items or [], key=lambda i: i.order or 0)
            lesson_count += len(items)
            modules_out.append(
                {
                    "id": mod.id,
                    "title": mod.title,
                    "order": mod.order,
                    "locked": True,
                    "lesson_count": len(items),
                    "lessons": [],
                }
            )

        payload = {
            "id": course.id,
            "title": course.title,
            "description": course.description or "",
            "price": course.price,
            "image_url": course.image_url or "",
            "language": course.language or "English",
            "course_type": course.course_type or "standard",
            "module_count": len(modules_out),
            "lesson_count": lesson_count,
            "preview": True,
            "modules": modules_out,
        }
        return JSONResponse(
            content=payload,
            headers={"Cache-Control": "public, max-age=60"},
        )

    return router
