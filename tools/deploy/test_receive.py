"""Exercise the receiver transaction with a fake process/network, real files."""
import errno
import io
import json
import os
import pathlib
import tarfile
import tempfile
import unittest
from contextlib import ExitStack, redirect_stdout, redirect_stderr
from unittest.mock import Mock, patch

import receive
from release_storage import ReleaseStorage


class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = pathlib.Path(self.temp.name).resolve()
        self.storage = ReleaseStorage(self.home, 'pagecraft-staging')
        self.active = self.storage.root / ('a' * 40 + '-1')
        self.active.mkdir()
        (self.active / 'keep.txt').write_text('current release bytes')
        (self.home / 'pagecraft-staging').mkdir()
        self.current = self.home / 'pagecraft-staging/current'
        self.current.symlink_to(self.active)
        self.sha = 'b' * 40
        self.meta = {'commit': self.sha, 'branch': 'development'}
        self.record = self.home / 'pagecraft-deploy/pagecraft-staging-current.json'
        self.record.write_text(json.dumps({'release': str(self.active), 'previous': None}))
        self.old_record = self.record.read_bytes()
        self.process = Mock()
        self.process.poll.return_value = None
        self.restarts = []
        self.original_umask = os.umask(0o077)
        self.addCleanup(os.umask, self.original_umask)

    def bundle(self, unsafe=False):
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode='w:gz') as archive:
            data = json.dumps(self.meta).encode()
            member = tarfile.TarInfo('../escape' if unsafe else 'deployment.json')
            member.size = len(data)
            archive.addfile(member, io.BytesIO(data))
        output.seek(0)
        return output

    def cloudlinux(self, command):
        if command[1] == 'restart':
            self.restarts.append(self.current.resolve())
            return b'{"result":"success"}'
        return json.dumps({'available_versions': {'24': {'users': {'itspbuku': {
            'applications': {'pagecraft-staging': {'env_vars': {
                'EDITOR_HOST': 'staging.itspagecraft.com',
                'SUPABASE_URL': 'https://isolated-fixture.supabase.co'
            }}}
        }}}}}).encode()

    def run_receiver(self, quota=False, public_failure=False, record_failure=False, unsafe=False):
        def response(request, **kwargs):
            url = request if isinstance(request, str) else request.full_url
            value = {} if public_failure and url.startswith('https:') else self.meta
            return io.BytesIO(json.dumps(value).encode())
        with ExitStack() as stack:
            stack.enter_context(patch.dict(os.environ, {
                'SSH_ORIGINAL_COMMAND': 'deploy development ' + self.sha,
                'PAGECRAFT_DEPLOY_BRANCH': 'development'
            }))
            stack.enter_context(patch('receive.sys.stdin', Mock(buffer=self.bundle(unsafe))))
            stack.enter_context(patch('receive.subprocess.check_output', side_effect=self.cloudlinux))
            npm = stack.enter_context(patch('receive.subprocess.run'))
            stack.enter_context(patch('receive.subprocess.Popen', return_value=self.process))
            stack.enter_context(patch('receive.urllib.request.urlopen', side_effect=response))
            stack.enter_context(patch('receive.time.sleep'))
            capacity = stack.enter_context(patch.object(ReleaseStorage, 'capacity',
                side_effect=OSError(errno.EDQUOT, 'quota') if quota else None,
                return_value={'reservedBytes': 1, 'reservedFiles': 1}))
            if record_failure:
                stack.enter_context(patch('receive.atomic_json', side_effect=OSError('metadata write failed')))
            stack.enter_context(redirect_stdout(io.StringIO()))
            stack.enter_context(redirect_stderr(io.StringIO()))
            if quota or public_failure or record_failure or unsafe:
                with self.assertRaises(SystemExit) as result:
                    receive.main(str(self.home))
                self.assertEqual(result.exception.code, 1)
            else:
                receive.main(str(self.home))
            return npm, capacity

    def assert_preserved(self):
        self.assertEqual(self.current.resolve(), self.active)
        self.assertEqual((self.active / 'keep.txt').read_text(), 'current release bytes')
        self.assertEqual(self.record.read_bytes(), self.old_record)

    def test_quota_failure_does_not_unpack_install_or_switch_current(self):
        npm, capacity = self.run_receiver(quota=True)
        self.assert_preserved()
        npm.assert_not_called()
        capacity.assert_called_once()
        self.assertEqual(self.restarts, [])
        self.assertEqual(list(self.storage.root.glob('*/deployment.json')), [])

    def test_unsafe_archive_is_rejected_before_retention_or_capacity(self):
        npm, capacity = self.run_receiver(unsafe=True)
        self.assert_preserved()
        npm.assert_not_called()
        capacity.assert_not_called()
        self.assertFalse((self.storage.root / 'escape').exists())

    def test_failed_public_verification_restores_and_restarts_previous(self):
        self.run_receiver(public_failure=True)
        self.assert_preserved()
        self.assertEqual(len(self.restarts), 2)
        self.assertEqual(self.restarts[-1], self.active)
        self.process.terminate.assert_called_once()

    def test_failed_commit_record_write_also_rolls_back(self):
        self.run_receiver(record_failure=True)
        self.assert_preserved()
        self.assertEqual(self.restarts[-1], self.active)

    def test_verified_release_records_rollback_and_success_marker(self):
        self.run_receiver()
        new = self.current.resolve()
        self.assertNotEqual(new, self.active)
        self.assertTrue(self.storage.successful(new))
        record = json.loads(self.record.read_text())
        self.assertEqual(record['previous'], str(self.active))
        self.assertEqual(record['commit'], self.sha)
        self.assertEqual(len(self.restarts), 1)


if __name__ == '__main__':
    unittest.main()
