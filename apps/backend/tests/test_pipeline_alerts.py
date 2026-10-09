import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.settings import settings
from app.db.models import Exam
from app.services import pipeline_alert_service
from app.services.pipeline_alert_service import notify_pipeline_failure
from app.services.pipeline_management_service import PipelineManagementService

_RealAsyncClient = httpx.AsyncClient


def _mock_discord(handler):
    """Routes the alert service's httpx client through an in-process transport."""
    return patch.object(
        pipeline_alert_service.httpx,
        "AsyncClient",
        lambda **kw: _RealAsyncClient(transport=httpx.MockTransport(handler), **kw),
    )


class TestNotifyPipelineFailure(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._saved = (
            settings.DISCORD_ALERT_WEBHOOK_URL,
            settings.PIPELINE_ALERT_EMAILS,
            settings.PIPELINE_ALERTS_ENABLED,
        )
        settings.DISCORD_ALERT_WEBHOOK_URL = "https://discord.test/api/webhooks/1/abc"
        settings.PIPELINE_ALERT_EMAILS = "a@examplanner.in, b@examplanner.in"
        settings.PIPELINE_ALERTS_ENABLED = True
        label = patch.object(pipeline_alert_service, "_exam_label", AsyncMock(return_value="#7 — UPSC 2024"))
        label.start()
        self.addCleanup(label.stop)

    def tearDown(self):
        (
            settings.DISCORD_ALERT_WEBHOOK_URL,
            settings.PIPELINE_ALERT_EMAILS,
            settings.PIPELINE_ALERTS_ENABLED,
        ) = self._saved

    async def test_sends_discord_and_email_with_traceback(self):
        requests = []

        def handler(request):
            requests.append(request)
            return httpx.Response(204)

        with _mock_discord(handler), patch(
            "app.services.email_service.send_admin_alert_email", AsyncMock(return_value=True)
        ) as send_email:
            try:
                raise ValueError("OCR blew up @everyone")
            except ValueError as exc:
                await notify_pipeline_failure(7, "DOCUMENT_EXTRACTION", str(exc), failed_step="OCR → FAILED")

        self.assertEqual(len(requests), 1)
        body = json.loads(requests[0].content)
        self.assertEqual(body["allowed_mentions"], {"parse": []})
        embed = body["embeds"][0]
        self.assertEqual(embed["title"], "DOCUMENT_EXTRACTION pipeline FAILED")
        self.assertIn("OCR blew up", embed["description"])
        self.assertIn("ValueError", embed["description"])  # traceback tail included
        fields = {f["name"]: f["value"] for f in embed["fields"]}
        self.assertEqual(fields["Exam"], "#7 — UPSC 2024")
        self.assertEqual(fields["Failed step"], "OCR → FAILED")

        recipients, subject, html = send_email.await_args.args
        self.assertEqual(recipients, ["a@examplanner.in", "b@examplanner.in"])
        self.assertIn("DOCUMENT_EXTRACTION pipeline FAILED", subject)
        self.assertIn("OCR blew up", html)

    async def test_error_text_is_html_escaped_in_email(self):
        with patch("app.services.email_service.send_admin_alert_email", AsyncMock(return_value=True)) as send_email:
            settings.DISCORD_ALERT_WEBHOOK_URL = None
            await notify_pipeline_failure(7, "QUESTION_TRANSLATION", "<script>x</script>")
        html = send_email.await_args.args[2]
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)

    async def test_never_raises_when_channels_fail(self):
        def handler(request):
            return httpx.Response(500)

        with _mock_discord(handler), patch(
            "app.services.email_service.send_admin_alert_email", AsyncMock(side_effect=RuntimeError("smtp down"))
        ):
            await notify_pipeline_failure(7, "S3_SYNC", "boom")  # must not raise

    async def test_one_channel_failing_does_not_block_the_other(self):
        with _mock_discord(lambda r: httpx.Response(500)), patch(
            "app.services.email_service.send_admin_alert_email", AsyncMock(return_value=True)
        ) as send_email:
            await notify_pipeline_failure(7, "S3_SYNC", "boom")
        send_email.assert_awaited_once()

    async def test_disabled_sends_nothing(self):
        settings.PIPELINE_ALERTS_ENABLED = False
        requests = []
        with _mock_discord(lambda r: requests.append(r) or httpx.Response(204)), patch(
            "app.services.email_service.send_admin_alert_email", AsyncMock(return_value=True)
        ) as send_email:
            await notify_pipeline_failure(7, "S3_SYNC", "boom")
        self.assertEqual(requests, [])
        send_email.assert_not_awaited()

    async def test_partial_failure_title(self):
        settings.DISCORD_ALERT_WEBHOOK_URL = None
        with patch("app.services.email_service.send_admin_alert_email", AsyncMock(return_value=True)) as send_email:
            await notify_pipeline_failure(7, "DOCUMENT_EXTRACTION", "batch failed", partial=True)
        self.assertIn("DOCUMENT_EXTRACTION pipeline PARTIALLY FAILED", send_email.await_args.args[1])


class TestUpdatePipelineStatusAlerts(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        async with self.session_factory() as s:
            exam = Exam(name="UPSC CSE Prelims 2024", code="upsc-2024", source_year=2024, is_active=True)
            s.add(exam)
            await s.commit()
            self.exam_id = exam.id
        for target in ("app.cache.invalidate_pipeline_status_cache",):
            p = patch(target, AsyncMock())
            p.start()
            self.addCleanup(p.stop)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_failed_status_alerts_with_step_that_failed(self):
        with patch.object(pipeline_alert_service, "notify_pipeline_failure", AsyncMock()) as notify:
            async with self.session_factory() as s:
                pm = PipelineManagementService(s)
                await pm.update_pipeline_status(
                    self.exam_id, "DOCUMENT_EXTRACTION", "RUNNING", "EXTRACTING_DOCUMENT_WITH_DOCLING_OCR", 30.0
                )
                notify.assert_not_awaited()
                await pm.update_pipeline_status(
                    self.exam_id, "DOCUMENT_EXTRACTION", "FAILED", "FAILED_WITH_ERROR", 0.0, error_log="disk full"
                )
        notify.assert_awaited_once_with(
            self.exam_id,
            "DOCUMENT_EXTRACTION",
            "disk full",
            failed_step="EXTRACTING_DOCUMENT_WITH_DOCLING_OCR → FAILED_WITH_ERROR",
        )

    async def test_non_failed_statuses_do_not_alert(self):
        with patch.object(pipeline_alert_service, "notify_pipeline_failure", AsyncMock()) as notify:
            async with self.session_factory() as s:
                pm = PipelineManagementService(s)
                for status in ("RUNNING", "STOPPED", "CANCELLED", "COMPLETED"):
                    await pm.update_pipeline_status(self.exam_id, "KNOWLEDGE_ENRICHMENT", status, status, 50.0)
        notify.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
