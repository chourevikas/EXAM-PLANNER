from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlmodel import select, col
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.db.models.testimonial import Testimonial, TestimonialStatus
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/testimonials", tags=["Testimonials"])


class TestimonialCreatePayload(BaseModel):
    quote: str
    user_exam: str
    rating: Optional[int] = 5
    user_photo: Optional[str] = None


class TestimonialRejectPayload(BaseModel):
    reason: Optional[str] = None


class TestimonialOut(BaseModel):
    id: int | str
    user_name: str
    user_exam: str
    user_photo: Optional[str] = None
    rating: int
    quote: str
    status: TestimonialStatus
    rejection_reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


INITIAL_TESTIMONIALS = [
    {
        "user_name": "Arjun Sharma",
        "user_exam": "UPSC CSE 2024 · Rank 47",
        "user_photo": "/reviewer_arjun.png",
        "rating": 5,
        "quote": "ExamPlanner completely changed how I prepared. The platform identified my weak spots in Polity within days — accuracy jumped from 54% to 83% in just two months.",
        "status": TestimonialStatus.APPROVED,
    },
    {
        "user_name": "Priya Nair",
        "user_exam": "UPSC CSE 2024 · Selected IAS",
        "user_photo": "/reviewer_priya.png",
        "rating": 5,
        "quote": "The personalized study plan felt like having a dedicated mentor. I never had to wonder what to study — the platform always knew exactly where I needed to focus.",
        "status": TestimonialStatus.APPROVED,
    },
    {
        "user_name": "Rohit Gupta",
        "user_exam": "SSC CGL 2024 · AIR 12",
        "user_photo": "/reviewer_rohit.png",
        "rating": 5,
        "quote": "10,000+ questions with intelligent tagging is a game-changer. I solved 4 years of PYQs systematically and the psychometric analysis caught every gap.",
        "status": TestimonialStatus.APPROVED,
    },
]


@router.get("/approved", response_model=List[TestimonialOut])
async def get_approved_testimonials(session: AsyncSession = Depends(get_async_session)):
    stmt = (
        select(Testimonial)
        .where(Testimonial.status == TestimonialStatus.APPROVED)
        .order_by(col(Testimonial.created_at).desc())
    )
    res = await session.exec(stmt)
    items = list(res.all())

    # Seed initial default testimonials if table is empty
    if not items:
        count_stmt = select(Testimonial)
        all_res = await session.exec(count_stmt)
        if not list(all_res.all()):
            for seed in INITIAL_TESTIMONIALS:
                t = Testimonial(**seed)
                session.add(t)
            await session.commit()

            res_seeded = await session.exec(stmt)
            items = list(res_seeded.all())

    return items


@router.post("", response_model=TestimonialOut)
async def submit_testimonial(
    payload: TestimonialCreatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    if not payload.quote or len(payload.quote.strip()) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Testimonial content must be at least 10 characters long.",
        )

    t = Testimonial(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_exam=payload.user_exam or "Aspirant Candidate",
        user_photo=payload.user_photo or current_user.profile_image,
        rating=max(1, min(5, payload.rating or 5)),
        quote=payload.quote.strip(),
        status=TestimonialStatus.PENDING,
    )
    session.add(t)
    await session.commit()
    await session.refresh(t)
    return t


# Super Admin Routes
@router.get("/admin/all", response_model=List[TestimonialOut])
async def list_all_testimonials_for_admin(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    stmt = select(Testimonial).order_by(col(Testimonial.created_at).desc())
    res = await session.exec(stmt)
    items = list(res.all())

    if not items:
        for seed in INITIAL_TESTIMONIALS:
            t = Testimonial(**seed)
            session.add(t)
        await session.commit()
        res_seeded = await session.exec(stmt)
        items = list(res_seeded.all())

    return items


@router.post("/admin/{testimonial_id}/approve", response_model=TestimonialOut)
async def approve_testimonial(
    testimonial_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    try:
        tid = int(testimonial_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Testimonial not found.")

    t = await session.get(Testimonial, tid)
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found.")
    t.status = TestimonialStatus.APPROVED
    t.rejection_reason = None
    t.updated_at = datetime.now(timezone.utc)
    session.add(t)
    await session.commit()
    await session.refresh(t)
    return t


@router.post("/admin/{testimonial_id}/reject", response_model=TestimonialOut)
async def reject_testimonial(
    testimonial_id: int | str,
    payload: TestimonialRejectPayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    try:
        tid = int(testimonial_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Testimonial not found.")

    t = await session.get(Testimonial, tid)
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found.")
    t.status = TestimonialStatus.REJECTED
    t.rejection_reason = payload.reason
    t.updated_at = datetime.now(timezone.utc)
    session.add(t)
    await session.commit()
    await session.refresh(t)
    return t


@router.delete("/admin/{testimonial_id}")
async def delete_testimonial(
    testimonial_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    try:
        tid = int(testimonial_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Testimonial not found.")

    t = await session.get(Testimonial, tid)
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found.")
    await session.delete(t)
    await session.commit()
    return {"message": "Testimonial deleted successfully."}
