import uuid
import json
from pathlib import Path
from typing import List, Tuple, Dict, Optional
from PIL import Image
from app.storage.base import BaseStorageProvider
from app.pipeline.state import PageExtractionPayload, SeamBlockTypeEnum, CropAssetSchema


class DisjointSetUnion:
    def __init__(self):
        self.parent = {}

    def find(self, i):
        if i not in self.parent:
            self.parent[i] = i
            return i
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            self.parent[root_i] = root_j


def resolve_transitive_passages_dsu(
    raw_results: List[Tuple[int, Optional[PageExtractionPayload], Optional[str]]],
) -> List[dict]:
    dsu = DisjointSetUnion()
    passage_nodes: Dict[str, dict] = {}

    for p_num, payload, err in raw_results:
        if not payload:
            continue
        for mem in payload.new_context_memories:
            mem_dict = mem.model_dump()
            mem_id = mem_dict["memory_id"]
            mem_dict["page_numbers"] = [p_num]
            passage_nodes[mem_id] = mem_dict

    for i in range(len(raw_results) - 1):
        p_curr, payload_curr, _ = raw_results[i]
        p_next, payload_next, _ = raw_results[i + 1]

        if not payload_curr or not payload_next:
            continue

        if (
            payload_curr.page_end_seam == SeamBlockTypeEnum.PASSAGE
            and payload_next.page_start_seam == SeamBlockTypeEnum.PASSAGE
        ):
            for mem_curr in payload_curr.new_context_memories:
                if not mem_curr.is_complete:
                    for mem_next in payload_next.new_context_memories:
                        if mem_curr.section_code == mem_next.section_code:
                            dsu.union(mem_curr.memory_id, mem_next.memory_id)

    groups: Dict[str, List[dict]] = {}
    for mem_id, mem_dict in passage_nodes.items():
        root_id = dsu.find(mem_id)
        if root_id not in groups:
            groups[root_id] = []
        groups[root_id].append(mem_dict)

    unified_passages = []
    for root_id, frag_list in groups.items():
        frag_list.sort(key=lambda x: x["page_numbers"][0])
        base_passage = frag_list[0]

        all_pages = []
        merged_translations: Dict[str, str] = {}
        target_q_nums = set()

        for frag in frag_list:
            all_pages.extend(frag["page_numbers"])
            if frag.get("target_question_numbers"):
                target_q_nums.update(frag["target_question_numbers"])
            for t in frag["translations"]:
                lang = (
                    t["language"].value
                    if hasattr(t["language"], "value")
                    else str(t["language"])
                )
                if lang not in merged_translations:
                    merged_translations[lang] = t["context_text"]
                else:
                    merged_translations[lang] += "\n" + t["context_text"]

        base_passage["page_numbers"] = sorted(list(set(all_pages)))
        base_passage["target_question_numbers"] = sorted(list(target_q_nums))
        base_passage["is_complete"] = frag_list[-1]["is_complete"]
        base_passage["translations"] = [
            {"language": lang, "context_text": text}
            for lang, text in merged_translations.items()
        ]
        unified_passages.append(base_passage)

    return unified_passages


async def async_crop_and_save_asset(
    page_img: Image.Image,
    storage: BaseStorageProvider,
    exam_code: str,
    set_code: str,
    sec_code: str,
    q_num: int,
    asset: CropAssetSchema,
) -> Optional[str]:
    try:
        img_w, img_h = page_img.size
        ymin, xmin, ymax, xmax = asset.bounding_box

        pad_y = int((ymax - ymin) * 0.05)
        pad_x = int((xmax - xmin) * 0.05)

        ymin = max(0, ymin - pad_y)
        xmin = max(0, xmin - pad_x)
        ymax = min(1000, ymax + pad_y)
        xmax = min(1000, xmax + pad_x)

        left = int((xmin / 1000.0) * img_w)
        top = int((ymin / 1000.0) * img_h)
        right = int((xmax / 1000.0) * img_w)
        bottom = int((ymax / 1000.0) * img_h)

        if right <= left or bottom <= top:
            return None

        clean_set = str(set_code).strip().lower().replace("_", "-")
        cropped_img = page_img.crop((left, top, right, bottom))
        asset_rel_path = f"cropped_assets/{exam_code}/{clean_set}/{sec_code}/Q{q_num:03d}_{asset.asset_type.value.lower()}_{uuid.uuid4().hex[:6]}.png"
        return await storage.save_image(cropped_img, asset_rel_path)
    except Exception:
        return None

