import unittest
from app.pipeline.dsu_stitcher import resolve_transitive_passages_dsu, DisjointSetUnion
from app.pipeline.state import (
    PageExtractionPayload,
    SeamBlockTypeEnum,
    ContextMemoryItem,
    MemoryTypeEnum,
)


class TestPipeline(unittest.TestCase):
    def test_dsu_transitive_passages(self):
        dsu = DisjointSetUnion()
        dsu.union("mem_1", "mem_2")
        self.assertEqual(dsu.find("mem_1"), dsu.find("mem_2"))

        mem1 = ContextMemoryItem(
            memory_id="mem_1",
            section_code="GS_1",
            memory_type=MemoryTypeEnum.PASSAGE,
            target_question_range="Q1 to Q5",
            target_question_numbers=[1, 2, 3, 4, 5],
            is_complete=False,
            translations=[{"language": "ENGLISH", "context_text": "Passage Part 1"}],
        )

        mem2 = ContextMemoryItem(
            memory_id="mem_2",
            section_code="GS_1",
            memory_type=MemoryTypeEnum.PASSAGE,
            target_question_range="Q1 to Q5",
            target_question_numbers=[1, 2, 3, 4, 5],
            is_complete=True,
            translations=[{"language": "ENGLISH", "context_text": "Passage Part 2"}],
        )

        payload1 = PageExtractionPayload(
            page_languages=["ENGLISH"],
            detected_layout_type="SINGLE_COLUMN",
            page_start_seam=SeamBlockTypeEnum.NONE,
            page_end_seam=SeamBlockTypeEnum.PASSAGE,
            new_context_memories=[mem1],
            extracted_questions=[],
        )

        payload2 = PageExtractionPayload(
            page_languages=["ENGLISH"],
            detected_layout_type="SINGLE_COLUMN",
            page_start_seam=SeamBlockTypeEnum.PASSAGE,
            page_end_seam=SeamBlockTypeEnum.NONE,
            new_context_memories=[mem2],
            extracted_questions=[],
        )

        raw_results = [(1, payload1, None), (2, payload2, None)]

        unified = resolve_transitive_passages_dsu(raw_results)
        self.assertEqual(len(unified), 1)
        self.assertEqual(unified[0]["page_numbers"], [1, 2])
        self.assertIn(
            "Passage Part 1\nPassage Part 2",
            unified[0]["translations"][0]["context_text"],
        )
        self.assertTrue(unified[0]["is_complete"])


if __name__ == "__main__":
    unittest.main()
