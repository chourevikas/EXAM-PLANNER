import uuid
from fastapi import HTTPException
from fastapi.responses import Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.engine.report_compiler import compile_comprehensive_psychometric_report
from app.formatters.report_json_formatter import format_report_to_json
from app.formatters.report_yaml_formatter import format_report_to_yaml
from app.formatters.report_markdown_formatter import format_report_to_markdown
from app.config.logger import setup_logger

logger = setup_logger("AnalyticsService")


from typing import Optional


class AnalyticsService:
    """Service compiling and formatting psychometric diagnostic analytics reports."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_psychometric_report_json(
        self,
        user_id: Optional[uuid.UUID] = None,
        exam_id: Optional[uuid.UUID] = None,
        attempt_id: Optional[uuid.UUID] = None,
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            json_content = format_report_to_json(report_data)
            return Response(content=json_content, media_type="application/json")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except Exception as exc:
            logger.error(
                f"Error compiling JSON report for Attempt '{attempt_id or exam_id}': {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_psychometric_report_yaml(
        self,
        user_id: Optional[uuid.UUID] = None,
        exam_id: Optional[uuid.UUID] = None,
        attempt_id: Optional[uuid.UUID] = None,
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            yaml_content = format_report_to_yaml(report_data)
            return Response(content=yaml_content, media_type="text/yaml")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except Exception as exc:
            logger.error(
                f"Error compiling YAML report for Attempt '{attempt_id or exam_id}': {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_psychometric_report_markdown(
        self,
        user_id: Optional[uuid.UUID] = None,
        exam_id: Optional[uuid.UUID] = None,
        attempt_id: Optional[uuid.UUID] = None,
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            markdown_content = format_report_to_markdown(report_data)
            return Response(content=markdown_content, media_type="text/markdown")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except Exception as exc:
            logger.error(
                f"Error compiling Markdown report for Attempt '{attempt_id or exam_id}': {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

