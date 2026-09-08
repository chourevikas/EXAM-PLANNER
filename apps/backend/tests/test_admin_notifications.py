import pytest
from datetime import datetime, timezone
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import BackgroundTasks

from app.db.session import engine
from app.db.models.user import User
from app.db.models.enums import UserRole, NotificationContentType, NotificationStatus
from app.db.models.notification import Notification
from app.schemas.notification import NotificationCreatePayload, NotificationUpdatePayload
from app.routers.admin_notifications import (
    create_notification,
    list_admin_notifications,
    get_admin_notification_detail,
    update_notification,
    publish_notification,
    reject_notification,
    delete_notification,
)
from app.routers.notifications import (
    get_user_notifications,
    get_published_notification_detail,
)
from fastapi import HTTPException


@pytest.mark.anyio
async def test_admin_notifications_full_lifecycle():
    async with AsyncSession(engine, expire_on_commit=False) as session:
        # 1. Fetch an admin user and a student user for auth simulation
        admin_user = (await session.exec(
            select(User).where(User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
        )).first()

        student_user = (await session.exec(
            select(User).where(User.role == UserRole.STUDENT)
        )).first()

        if not admin_user:
            admin_user = User(
                full_name="Test Admin",
                email=f"test_admin_{int(datetime.now().timestamp())}@examplanner.in",
                role=UserRole.ADMIN,
            )
            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)

        if not student_user:
            student_user = User(
                full_name="Test Student",
                email=f"test_student_{int(datetime.now().timestamp())}@examplanner.in",
                role=UserRole.STUDENT,
            )
            session.add(student_user)
            await session.commit()
            await session.refresh(student_user)

        # 2. Validation test: Error when neither link nor attachment is provided
        with pytest.raises(Exception):
            NotificationCreatePayload(
                title="Invalid Notification",
                description="Missing both link and attachment",
                contentType="other"
            )

        # 3. Create a valid draft notification
        payload = NotificationCreatePayload(
            title="Comprehensive UPSC 2026 Strategy Session",
            description="Deep dive video analysis on Mains strategy and essay writing.",
            contentType="video",
            link="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        )

        res_create = await create_notification(
            payload=payload,
            session=session,
            current_user=admin_user,
        )
        assert res_create.id is not None
        assert res_create.status == "draft"
        assert res_create.contentType == "video"
        assert res_create.publishedAt is None
        noti_id = res_create.id

        # 4. Fetch notification detail (admin view)
        res_detail = await get_admin_notification_detail(
            notification_id=noti_id,
            session=session,
            current_user=admin_user,
        )
        assert res_detail.id == noti_id
        assert res_detail.title == payload.title
        assert res_detail.status == "draft"

        # 5. List notifications with status filter 'draft'
        res_list = await list_admin_notifications(
            page=1,
            limit=10,
            status_filter="draft",
            session=session,
            current_user=admin_user,
        )
        assert res_list.total >= 1
        draft_ids = [n.id for n in res_list.items]
        assert noti_id in draft_ids

        # 6. Verify draft is NOT visible to student on public endpoints
        res_student_detail_draft = None
        try:
            await get_published_notification_detail(
                notification_id=noti_id,
                current_user=student_user,
                session=session,
            )
        except HTTPException as exc:
            res_student_detail_draft = exc.status_code
        assert res_student_detail_draft == 404, "Draft notification must return 404 to users"

        # 7. Update draft notification
        update_payload = NotificationUpdatePayload(
            title="Updated UPSC 2026 Strategy Masterclass",
            description="Updated description with full breakdown of GS papers.",
        )
        res_update = await update_notification(
            notification_id=noti_id,
            payload=update_payload,
            session=session,
            current_user=admin_user,
        )
        assert res_update.title == "Updated UPSC 2026 Strategy Masterclass"

        # 8. Publish notification (triggers background email task and transitions status)
        bg = BackgroundTasks()
        res_publish = await publish_notification(
            notification_id=noti_id,
            background_tasks=bg,
            session=session,
            current_user=admin_user,
        )
        assert res_publish.status == "published"
        assert res_publish.publishedAt is not None
        assert len(bg.tasks) == 1, "Background email dispatch task must be queued on publish"

        # 9. Server-side rule: Attempting to publish an already published notification must fail
        with pytest.raises(HTTPException) as exc_info:
            await publish_notification(
                notification_id=noti_id,
                background_tasks=bg,
                session=session,
                current_user=admin_user,
            )
        assert exc_info.value.status_code == 400

        # 10. Server-side rule: Editing a published notification must fail
        with pytest.raises(HTTPException) as exc_info:
            await update_notification(
                notification_id=noti_id,
                payload=NotificationUpdatePayload(title="Illegal Edit After Publish"),
                session=session,
                current_user=admin_user,
            )
        assert exc_info.value.status_code == 400

        # 11. Student can now see the published notification
        res_pub_detail = await get_published_notification_detail(
            notification_id=noti_id,
            current_user=student_user,
            session=session,
        )
        import json
        detail_data = json.loads(res_pub_detail.body.decode())
        assert detail_data["id"] == noti_id
        assert detail_data["status"] == "published"
        assert detail_data["title"] == "Updated UPSC 2026 Strategy Masterclass"

        # 12. Student public listing contains published announcement
        res_pub_list = await get_user_notifications(
            page=1,
            limit=10,
            current_user=student_user,
            session=session,
        )
        list_data = json.loads(res_pub_list.body.decode())
        pub_ids = [item["id"] for item in list_data["items"]]
        assert noti_id in pub_ids

        # 13. Create a second notification and test rejection flow
        noti_reject_payload = NotificationCreatePayload(
            title="Old Notification To Be Rejected",
            contentType="article",
            link="https://examplanner.in/article-test",
        )
        res_rejectable = await create_notification(
            payload=noti_reject_payload,
            session=session,
            current_user=admin_user,
        )
        res_rejected = await reject_notification(
            notification_id=res_rejectable.id,
            session=session,
            current_user=admin_user,
        )
        assert res_rejected.status == "rejected"

        # 14. Delete notification
        res_del = await delete_notification(
            notification_id=res_rejectable.id,
            session=session,
            current_user=admin_user,
        )
        assert "deleted successfully" in res_del["message"]
