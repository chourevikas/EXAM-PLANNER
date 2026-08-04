import uuid
from fastapi import HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.report_compiler import compile_comprehensive_psychometric_report
from app.formatters.report_json_formatter import format_report_to_json
from app.formatters.report_yaml_formatter import format_report_to_yaml
from app.formatters.report_markdown_formatter import format_report_to_markdown
from app.config.logger import setup_logger

logger = setup_logger("AnalyticsService")


class AnalyticsService:
    """Service compiling and formatting psychometric diagnostic analytics reports."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_psychometric_report_json(
        self, user_id: uuid.UUID, exam_id: uuid.UUID
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id, exam_id
            )
            json_content = format_report_to_json(report_data)
            return Response(content=json_content, media_type="application/json")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except Exception as exc:
            logger.error(
                f"Error compiling JSON report for User {user_id} on Exam {exam_id}: {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_psychometric_report_yaml(
        self, user_id: uuid.UUID, exam_id: uuid.UUID
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id, exam_id
            )
            yaml_content = format_report_to_yaml(report_data)
            return Response(content=yaml_content, media_type="text/yaml")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except Exception as exc:
            logger.error(
                f"Error compiling YAML report for User {user_id} on Exam {exam_id}: {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_psychometric_report_markdown(
        self, user_id: uuid.UUID, exam_id: uuid.UUID
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id, exam_id
            )
            markdown_content = format_report_to_markdown(report_data)
            return Response(content=markdown_content, media_type="text/markdown")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except Exception as exc:
            logger.error(
                f"Error compiling Markdown report for User {user_id} on Exam {exam_id}: {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))
