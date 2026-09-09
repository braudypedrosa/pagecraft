import hashlib
import json
import pathlib
import shutil
import subprocess
import tarfile
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('bundle.py')

class BundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        (self.root / 'tools/deploy').mkdir(parents=True)
        shutil.copy(SCRIPT, self.root / 'tools/deploy/bundle.py')
        for name in ['app.cjs', 'index.html', 'package.json', 'package-lock.json', 'server/src/index.ts']:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('{}')
        package = self.root / 'premade-sites/demo/1.0.0/site.zip'
        package.parent.mkdir(parents=True)
        package.write_bytes(b'published template')
        catalog = {'templates': [{'id':'demo', 'version':'1.0.0', 'packageFile':'site.zip',
                                 'packageSha256': hashlib.sha256(package.read_bytes()).hexdigest()}]}
        (self.root / 'premade-sites/catalog.json').write_text(json.dumps(catalog))
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture')
        self.sha = self.git('rev-parse', 'HEAD').strip()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True)

    def bundle(self, sha=None):
        return subprocess.run(['python3', 'tools/deploy/bundle.py', sha or self.sha,
                               'development', 'release.tar.gz'], cwd=self.root, capture_output=True)

    def test_only_tracked_source_and_verified_release_are_bundled(self):
        (self.root / 'server/.env').write_text('SECRET=must-not-ship')
        self.assertEqual(self.bundle().returncode, 0)
        with tarfile.open(self.root / 'release.tar.gz') as archive:
            self.assertNotIn('server/.env', archive.getnames())
            self.assertIn('premade-sites/demo/1.0.0/site.zip', archive.getnames())
            self.assertEqual(json.load(archive.extractfile('deployment.json')),
                             {'commit':self.sha, 'branch':'development'})

    def test_modified_release_is_rejected(self):
        (self.root / 'premade-sites/demo/1.0.0/site.zip').write_bytes(b'changed')
        self.assertNotEqual(self.bundle().returncode, 0)

    def test_wrong_commit_is_rejected(self):
        self.assertNotEqual(self.bundle('0' * 40).returncode, 0)

    def test_symlink_source_is_rejected(self):
        target = self.root / 'server/src/index.ts'
        target.unlink()
        target.symlink_to('/etc/passwd')
        self.assertNotEqual(self.bundle().returncode, 0)
