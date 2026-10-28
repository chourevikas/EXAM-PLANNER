"""
Open-Source Local Machine Translation Service using Helsinki-NLP MarianMT models.
Completely offline, zero API costs, zero token limits, zero cloud dependencies.
Supports English -> Hindi and English -> Marathi with formula/LaTeX/Markdown preservation.
"""

import asyncio
from typing import Optional, List, Dict, Tuple, Any
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from app.config.logger import setup_logger
from app.core.languages import normalize_language
from app.services.google_translation_service import TextProtectionHandler

logger = setup_logger("OpenSourceTranslationService")


class OpenSourceTranslationService:
    """
    Offline local translation engine powered by Hugging Face Seq2Seq models.
    Caches model weights in memory after initial load for fast CPU batch inference.
    """

    MODEL_MAPPING: Dict[str, str] = {
        "hi": "Helsinki-NLP/opus-mt-en-hi",
        "mr": "Helsinki-NLP/opus-mt-en-mr",
    }

    _loaded_models: Dict[str, Any] = {}
    _loaded_tokenizers: Dict[str, Any] = {}

    def __init__(self, device: str = "cpu"):
        self.device = device

    def _get_model_and_tokenizer(self, target_iso: str) -> Tuple[Any, Any]:
        """Loads and caches the model and tokenizer for the specified target language."""
        if target_iso not in self.MODEL_MAPPING:
            raise ValueError(
                f"Unsupported local translation language: '{target_iso}'. "
                f"Available local models: {list(self.MODEL_MAPPING.keys())}"
            )

        if target_iso not in self._loaded_models:
            model_name = self.MODEL_MAPPING[target_iso]
            logger.info(f"🧠 Loading open-source local translation model: {model_name} onto {self.device}...")
            tok = AutoTokenizer.from_pretrained(model_name)
            mod = AutoModelForSeq2SeqLM.from_pretrained(model_name)
            mod.to(self.device)
            mod.eval()
            self._loaded_tokenizers[target_iso] = tok
            self._loaded_models[target_iso] = mod
            logger.info(f"✅ Local model {model_name} loaded successfully.")

        return self._loaded_models[target_iso], self._loaded_tokenizers[target_iso]

    async def translate_text(
        self,
        text: str,
        target_language: str,
        source_language: str = "en",
    ) -> str:
        """Translates a single text string."""
        if not text or not str(text).strip():
            return text or ""
        results = await self.translate_batch(
            [text], target_language=target_language, source_language=source_language
        )
        return results[0] if results else text

    async def translate_batch(
        self,
        texts: List[str],
        target_language: str,
        source_language: str = "en",
        batch_size: int = 16,
    ) -> List[str]:
        """
        Translates a batch of texts into target_language locally on CPU.
        Preserves Markdown formatting, LaTeX formulas, HTML, and tables.
        """
        if not texts:
            return []

        target_iso, _ = normalize_language(target_language)
        source_iso, _ = normalize_language(source_language)

        if target_iso == source_iso:
            return texts

        if target_iso not in self.MODEL_MAPPING:
            logger.warning(
                f"Language '{target_iso}' not supported in local models. Returning original text."
            )
            return texts

        # Mask non-translatable tokens (math formulas, HTML, image URLs, etc.)
        masked_and_stores = [TextProtectionHandler.mask(t or "") for t in texts]
        masked_texts = [m for m, _ in masked_and_stores]
        stores = [s for _, s in masked_and_stores]

        # Filter empty strings for inference
        non_empty_indices = [i for i, t in enumerate(masked_texts) if t.strip()]
        if not non_empty_indices:
            return texts

        logger.info(
            f"🆓 [FREE OPEN-SOURCE TRANSLATION] Translating batch of {len(non_empty_indices)} texts into '{target_iso}' "
            f"using local MarianMT model {self.MODEL_MAPPING.get(target_iso)} (Zero GCP / Zero Gemini API calls)..."
        )

        loop = asyncio.get_event_loop()

        def _infer():
            model, tokenizer = self._get_model_and_tokenizer(target_iso)
            outputs_list: List[str] = [""] * len(texts)

            # Process in sub-batches for memory efficiency
            for i in range(0, len(non_empty_indices), batch_size):
                chunk_indices = non_empty_indices[i : i + batch_size]
                chunk_texts = [masked_texts[idx] for idx in chunk_indices]

                inputs = tokenizer(
                    chunk_texts,
                    padding=True,
                    truncation=True,
                    max_length=512,
                    return_tensors="pt",
                ).to(self.device)

                import torch
                with torch.no_grad():
                    gen_tokens = model.generate(
                        **inputs,
                        max_new_tokens=128,
                        num_beams=1,
                        no_repeat_ngram_size=3,
                    )

                decoded_batch = tokenizer.batch_decode(gen_tokens, skip_special_tokens=True)

                for idx, decoded_text in zip(chunk_indices, decoded_batch):
                    outputs_list[idx] = decoded_text

            return outputs_list

        try:
            raw_translations = await loop.run_in_executor(None, _infer)
        except Exception as e:
            logger.error(f"Local translation failed: {e}", exc_info=True)
            return texts

        # Unmask non-translatable tokens
        final_translations = []
        for i, (orig, trans) in enumerate(zip(texts, raw_translations)):
            if not trans:
                final_translations.append(orig)
            else:
                unmasked = TextProtectionHandler.unmask(trans, stores[i])
                final_translations.append(unmasked)

        return final_translations
