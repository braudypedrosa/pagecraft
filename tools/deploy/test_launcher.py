import pathlib
import shutil
import subprocess
import tempfile
import unittest

class LauncherTests(unittest.TestCase):
    def test_fixed_root_fallback_release_and_rollback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            app = root / 'app'
            original = app / 'server/src/index.ts'
            original.parent.mkdir(parents=True)
            original.write_text("console.log('original');")
            shutil.copy(pathlib.Path(__file__).with_name('launcher.cjs'), app / 'app.cjs')
            release = root / 'release'
            entry = release / 'server/src/index.ts'
            entry.parent.mkdir(parents=True)
            entry.write_text("console.log('release');")
            def launch():
                return subprocess.check_output(['node', str(app / 'app.cjs')], text=True).strip()
            self.assertEqual(launch(), 'original')
            (app / 'current').symlink_to(release)
            self.assertFalse(app.is_symlink())
            self.assertEqual(launch(), 'release')
            (app / 'current').unlink()
            self.assertEqual(launch(), 'original')
