import unittest
import tempfile
from pathlib import Path
from PIL import Image
from app.storage.local import LocalStorageProvider


class TestStorage(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.temp_dir.name)
        self.storage = LocalStorageProvider(base_dir=self.tmp_path)

    async def asyncTearDown(self):
        self.temp_dir.cleanup()

    async def test_local_storage_provider(self):
        # Test Image Save
        img = Image.new("RGB", (100, 100), color="blue")
        key = await self.storage.save_image(img, "test_dir/sample.png")
        self.assertEqual(key, "test_dir/sample.png")
        self.assertTrue(await self.storage.exists(key))

        # Test Download
        download_dst = self.tmp_path / "downloaded.png"
        downloaded = await self.storage.download_file(key, download_dst)
        self.assertTrue(downloaded.exists())

        # Test Upload File
        src_file = self.tmp_path / "src.txt"
        src_file.write_text("Hello World")
        uploaded_key = await self.storage.upload_file(src_file, "text_files/dest.txt")
        self.assertTrue(await self.storage.exists(uploaded_key))


if __name__ == "__main__":
    unittest.main()
