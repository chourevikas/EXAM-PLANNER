from typing import List
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.core.deps import get_current_user, require_challenge_quota
from app.db.models.user import User
from app.services.challenge_service import ChallengeService
from app.schemas.challenge import (
    CreateChallengeRequest,
    ChallengeSummary,
    ChallengePublicPreview,
    InviteUserRequest,
    StartChallengeAttemptResponse,
    SaveChallengeResponseRequest,
    SubmitChallengeAttemptResponse,
    LeaderboardEntry,
    ChallengeOptions,
    ChallengeInvitee,
)

router = APIRouter(prefix="/challenges", tags=["Challenges"])


@router.post("", response_model=ChallengeSummary, summary="Create a Challenge")
async def create_challenge(
    payload: CreateChallengeRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_challenge_quota),
):
    service = ChallengeService(session)
    return await service.create_challenge(current_user, payload)


@router.get("", response_model=List[ChallengeSummary], summary="List My Created & Invited Challenges")
async def list_challenges(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    return await service.list_my_challenges(current_user)


@router.get("/options", response_model=ChallengeOptions, summary="Exams and Years Available for a New Challenge")
async def get_challenge_options(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    return await service.get_options()


@router.get("/public/{share_token}", response_model=ChallengePublicPreview, summary="Public Challenge Preview (Unauthenticated)")
async def get_public_challenge_preview(
    share_token: str,
    session: AsyncSession = Depends(get_async_session),
):
    service = ChallengeService(session)
    return await service.get_public_preview(share_token)


@router.get("/{challenge_id}", response_model=ChallengeSummary, summary="Get Challenge Detail")
async def get_challenge(
    challenge_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    return await service.get_challenge_summary(challenge_id, current_user)


@router.post("/{challenge_id}/invite", response_model=ChallengeInvitee, summary="Invite a Specific User to a Challenge")
async def invite_user(
    challenge_id: int,
    payload: InviteUserRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    return await service.invite_user(challenge_id, current_user, payload.email)


@router.get("/{challenge_id}/invites", response_model=List[ChallengeInvitee], summary="Who the Creator Has Invited")
async def list_invitees(
    challenge_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    return await service.list_invitees(challenge_id, current_user)


@router.get("/{challenge_id}/leaderboard", response_model=List[LeaderboardEntry], summary="Get Challenge Leaderboard")
async def get_leaderboard(
    challenge_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    return await service.get_leaderboard(challenge_id, current_user)


@router.post(
    "/{id_or_token}/attempts/start",
    response_model=StartChallengeAttemptResponse,
    summary="Start (or Resume) a Challenge Attempt",
)
async def start_attempt(
    id_or_token: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    return await service.start_attempt(id_or_token, current_user)


@router.post("/attempts/{attempt_id}/responses", status_code=204, summary="Save a Challenge Attempt Response")
async def save_response(
    attempt_id: int,
    payload: SaveChallengeResponseRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    await service.save_response(
        attempt_id, current_user, payload.question_id,
        payload.selected_option_id, payload.time_spent_seconds,
    )


@router.post(
    "/attempts/{attempt_id}/submit",
    response_model=SubmitChallengeAttemptResponse,
    summary="Submit a Challenge Attempt",
)
async def submit_attempt(
    attempt_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    service = ChallengeService(session)
    return await service.submit_attempt(attempt_id, current_user)
