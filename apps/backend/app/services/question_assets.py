"""Question asset (diagram/table) serialization and file access shared by question and review APIs."""
import tempfile
from pathlib import Path
from typing import Any, Dict

from app.db.models import QuestionAsset
from app.storage.factory import get_storage_provider

# Cropped asset files downloaded from storage are kept here between requests
ASSET_CACHE_DIR = Path(tempfile.gettempdir()) / "exam_planner_asset_cache"


def asset_image_url(asset_id: int) -> str:
    """Same-origin URL that streams an asset's image; usable directly in an <img src>."""
    return f"/api/v1/questions/assets/{asset_id}/image"


def serialize_question_asset(asset: QuestionAsset) -> Dict[str, Any]:
    return {
        "asset_id": str(asset.id),
        "asset_path": asset.asset_path,
        "asset_type": asset.asset_type.value if hasattr(asset.asset_type, "value") else str(asset.asset_type),
        "caption": asset.caption,
        "table_markdown": asset.table_markdown,
        "display_order": asset.display_order,
        "url": asset_image_url(asset.id) if asset.asset_path else None,
    }


async def local_asset_file(asset: QuestionAsset) -> Path:
    """Local copy of the asset's image (downloaded from storage on first use)."""
    rel_path = asset.asset_path or ""
    target = (ASSET_CACHE_DIR / rel_path).resolve()
    if not str(target).startswith(str(ASSET_CACHE_DIR.resolve())):
        raise FileNotFoundError(rel_path)
    if not target.is_file():
        await get_storage_provider().download_file(rel_path, target)
    return target
