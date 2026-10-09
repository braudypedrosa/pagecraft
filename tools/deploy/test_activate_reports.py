"""Exercise founder-reports activation with real temp files and fake processes/network."""
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import ExitStack, redirect_stdout
from unittest.mock import Mock, patch
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import activate_reports


class Response(io.BytesIO):
    def __init__(self, value, status=200, headers=None):
        super().__init__(json.dumps(value).encode())
        self.status = status
        self.headers = headers or {}


class ActivationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name).resolve()
        self.sha = 'b' * 40
        self.meta = {'commit': self.sha, 'branch': 'development'}
        self.domain = 'reports.itspagecraft.com'
        self.original_umask = os.umask(0o077)
        self.addCleanup(os.umask, self.original_umask)

        staging_releases = self.home / 'pagecraft-releases/pagecraft-staging'
        self.source = staging_releases / (self.sha + '-1')
        (self.source / 'server/src').mkdir(parents=True)
        (self.source / 'deployment.json').write_text(json.dumps(self.meta))
        (self.source / 'server/src/reports-index.ts').write_text('// fixture')
        (self.source / 'source-only.txt').write_text('tested staging bytes')
        (self.home / 'pagecraft-staging').mkdir()
        (self.home / 'pagecraft-staging/current').symlink_to(self.source)

        reports_releases = self.home / 'pagecraft-reports/releases'
        self.previous = reports_releases / ('a' * 40 + '-1')
        self.previous.mkdir(parents=True)
        (self.previous / 'old.txt').write_text('previous reports release')
        self.reports_current = self.home / 'pagecraft-reports/current'
        self.reports_current.symlink_to(self.previous)
        self.status = self.home / 'pagecraft-reports/deployment-status.json'
        self.status.write_text(json.dumps({'commit': 'a' * 40, 'release': str(self.previous)}))
        self.old_status = self.status.read_bytes()

        self.customer_release = self.home / 'pagecraft-releases/pagecraft-app/customer-1'
        self.customer_release.mkdir(parents=True)
        (self.customer_release / 'customer.txt').write_text('customer release bytes')
        (self.home / 'pagecraft').mkdir()
        self.customer_current = self.home / 'pagecraft/current'
        self.customer_current.symlink_to(self.customer_release)

        self.config_dir = self.home / 'pagecraft-reports-config'
        self.config_dir.mkdir(mode=0o700)
        self.config_dir.chmod(0o700)
        self.config = self.config_dir / 'runtime.json'
        self.storage = self.home / 'private-reports'
        self.storage.mkdir(mode=0o700)
        self.costs = self.storage / 'costs.json'
        self.costs.write_text('{"budgets":"untouched"}')
        self.config.write_text(json.dumps({
            'REPORTS_HOST': self.domain,
            'REPORTS_ORIGIN': 'https://' + self.domain,
            'PAGECRAFT_REPORTS_STORAGE_ROOT': str(self.storage),
        }))
        self.config.chmod(0o600)
        self.old_config = self.config.read_bytes()
        self.old_costs = self.costs.read_bytes()

        node = self.home / 'nodevenv/pagecraft-reports/24/bin/node'
        node.parent.mkdir(parents=True)
        node.write_text('#!/bin/false\n')
        node.chmod(0o700)

        self.process = Mock()
        self.process.poll.return_value = None
        self.process.wait.return_value = 0
        self.restarts = []

    def response(self, request, public_failure=False, local_failure=None):
        url = request if isinstance(request, str) else request.full_url
        parsed = urlparse(url)
        if parsed.scheme == 'https':
            return Response({} if public_failure else self.meta)
        if parsed.path == '/__deployment':
            return Response(self.meta)
        if parsed.path == '/api/owner/billing':
            return Response({}, status=local_failure or 401,
                            headers={'cache-control': 'private, no-store'})
        return Response({}, status=404)

    def cloudlinux(self, _command):
        self.restarts.append(self.reports_current.resolve(strict=False))
        return b'{"result":"success"}'

    def run_activation(self, public_failure=False, local_failure=None, replace=None):
        with ExitStack() as stack:
            stack.enter_context(patch('activate_reports.subprocess.Popen', return_value=self.process))
            stack.enter_context(patch('activate_reports.subprocess.check_output', side_effect=self.cloudlinux))
            stack.enter_context(patch('activate_reports.urllib.request.urlopen',
                                      side_effect=lambda request, **_kwargs:
                                      self.response(request, public_failure, local_failure)))
            stack.enter_context(patch('activate_reports.shutil.disk_usage',
                                      return_value=shutil._ntuple_diskusage(10**9, 1, 10**9)))
            stack.enter_context(patch('activate_reports.time.time', return_value=1700000000))
            stack.enter_context(patch('activate_reports.time.sleep'))
            if replace:
                stack.enter_context(patch('activate_reports.os.replace', side_effect=replace))
            stack.enter_context(redirect_stdout(io.StringIO()))
            return activate_reports.main(self.sha, self.home)

    def assert_non_reports_state_unchanged(self):
        self.assertEqual(self.customer_current.resolve(), self.customer_release)
        self.assertEqual((self.customer_release / 'customer.txt').read_text(), 'customer release bytes')
        self.assertEqual(self.config.read_bytes(), self.old_config)
        self.assertEqual(self.costs.read_bytes(), self.old_costs)

    def assert_rolled_back(self):
        self.assertEqual(self.reports_current.resolve(), self.previous)
        self.assertEqual((self.previous / 'old.txt').read_text(), 'previous reports release')
        self.assertEqual(self.status.read_bytes(), self.old_status)
        self.assert_non_reports_state_unchanged()

    def test_invalid_sha_is_rejected_before_any_candidate_or_pointer_change(self):
        with patch('activate_reports.subprocess.Popen') as popen:
            for commit in ('', 'abc', 'B' * 40, 'b' * 39, 'b' * 41, '../' + 'b' * 40):
                with self.subTest(commit=commit), self.assertRaises(ValueError):
                    activate_reports.main(commit, self.home)
            popen.assert_not_called()
        self.assert_rolled_back()

    def test_source_must_be_exact_revision_inside_staging_release_root(self):
        outside = self.home / 'outside-candidate'
        shutil.copytree(self.source, outside)
        self.home.joinpath('pagecraft-staging/current').unlink()
        self.home.joinpath('pagecraft-staging/current').symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'outside the staging release directory'):
            self.run_activation()
        self.process.terminate.assert_not_called()
        self.assert_rolled_back()

        self.home.joinpath('pagecraft-staging/current').unlink()
        self.home.joinpath('pagecraft-staging/current').symlink_to(self.source)
        (self.source / 'deployment.json').write_text(json.dumps({
            'commit': 'c' * 40, 'branch': 'development',
        }))
        with self.assertRaisesRegex(ValueError, 'exact tested commit'):
            self.run_activation()
        self.process.terminate.assert_not_called()
        self.assert_rolled_back()

    def test_runtime_config_and_parent_must_be_private_physical_paths(self):
        self.config.chmod(0o644)
        with self.assertRaisesRegex(ValueError, 'Protected reports runtime configuration'):
            self.run_activation()
        self.config.chmod(0o600)

        self.config_dir.chmod(0o755)
        with self.assertRaisesRegex(ValueError, 'Protected reports runtime configuration'):
            self.run_activation()
        self.config_dir.chmod(0o700)

        external = self.home / 'external-runtime.json'
        external.write_bytes(self.old_config)
        external.chmod(0o600)
        self.config.unlink()
        self.config.symlink_to(external)
        with self.assertRaisesRegex(ValueError, 'Protected reports runtime configuration'):
            self.run_activation()
        self.process.terminate.assert_not_called()
        self.assertEqual(external.read_bytes(), self.old_config)
        self.assert_non_reports_state_unchanged()

    def test_capacity_failure_copies_nothing_and_preserves_both_app_pointers(self):
        with patch('activate_reports.shutil.disk_usage',
                   return_value=shutil._ntuple_diskusage(1, 1, 0)), \
             patch('activate_reports.subprocess.Popen') as popen:
            with self.assertRaisesRegex(ValueError, 'Insufficient capacity'):
                activate_reports.main(self.sha, self.home)
        popen.assert_not_called()
        self.assertEqual(list((self.home / 'pagecraft-reports/releases').iterdir()), [self.previous])
        self.assert_rolled_back()

    def test_candidate_is_stopped_when_local_security_verification_fails(self):
        with self.assertRaisesRegex(ValueError, 'Anonymous reports data'):
            self.run_activation(local_failure=200)
        self.process.terminate.assert_called_once()
        self.process.wait.assert_called_once_with(timeout=5)
        self.assert_rolled_back()
        self.assertEqual(self.restarts, [])

    def test_candidate_that_ignores_sigterm_is_killed(self):
        self.process.wait.side_effect = [subprocess.TimeoutExpired('node', 5), 0]
        self.run_activation()
        self.process.terminate.assert_called_once()
        self.process.kill.assert_called_once()
        self.assert_non_reports_state_unchanged()

    def test_failed_https_check_restores_and_restarts_previous_reports_release(self):
        with self.assertRaisesRegex(ValueError, 'HTTPS verification failed'):
            self.run_activation(public_failure=True)
        self.process.terminate.assert_called_once()
        self.assert_rolled_back()
        self.assertEqual(len(self.restarts), 2)
        self.assertNotEqual(self.restarts[0], self.previous)
        self.assertEqual(self.restarts[1], self.previous)

    def test_failed_atomic_status_write_also_rolls_back_reports_pointer(self):
        real_replace = os.replace

        def replace(source, destination):
            if Path(source).name == 'deployment-status.next.json':
                raise OSError('simulated status replacement failure')
            return real_replace(source, destination)

        with self.assertRaisesRegex(OSError, 'status replacement failure'):
            self.run_activation(replace=replace)
        self.assert_rolled_back()
        self.assertEqual(self.restarts[-1], self.previous)

    def test_success_switches_only_reports_pointer_and_records_rollback(self):
        self.run_activation()
        release = self.reports_current.resolve()
        self.assertNotEqual(release, self.previous)
        self.assertEqual(release.parent, self.home / 'pagecraft-reports/releases')
        self.assertEqual((release / 'source-only.txt').read_text(), 'tested staging bytes')
        record = json.loads(self.status.read_text())
        self.assertEqual(record['commit'], self.sha)
        self.assertEqual(record['previous'], str(self.previous))
        self.assert_non_reports_state_unchanged()


if __name__ == '__main__':
    unittest.main()
