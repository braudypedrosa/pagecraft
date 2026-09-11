import errno
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

from release_storage import ReleaseStorage, archive_inventory, capacity_probe, inventory


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = pathlib.Path(self.temp.name).resolve()
        self.storage = ReleaseStorage(self.home, 'pagecraft-staging')

    def release(self, number, successful=True, storage=None):
        storage = storage or self.storage
        release = storage.root / ('{:040x}-{}'.format(number, number))
        (release / 'nested').mkdir(parents=True)
        (release / 'nested/content.txt').write_text('version ' + str(number))
        (release / 'empty').mkdir()
        (release / 'executable').write_text('#!/bin/sh\n')
        (release / 'executable').chmod(0o755)
        (release / 'link').symlink_to('nested/content.txt')
        if successful:
            storage.mark_success(release)
        return release

    def test_keep_active_rollback_and_three_other_successful_releases(self):
        releases = [self.release(n) for n in range(1, 9)]
        candidate = self.release(9, successful=False)
        other = ReleaseStorage(self.home, 'pagecraft-app')
        production = self.release(1, storage=other)
        result = self.storage.retain(releases[3], releases[1], candidate)
        self.assertEqual(set(result['protected']), {p.name for p in
                         [releases[3], releases[1], candidate] + releases[5:]})
        self.assertEqual(len(result['archived']), 3)
        self.assertTrue(production.exists())
        self.assertTrue(candidate.exists())

    def test_verified_archive_preserves_file_bytes_permissions_and_symlinks(self):
        release = self.release(1)
        (release / 'external-link').symlink_to('/no/such/private/file')
        expected = inventory(release)
        result = self.storage.archive(release, set())
        archive = self.storage.archives / (release.name + '.tar.gz')
        self.assertEqual(archive_inventory(archive), expected)
        receipt = json.loads(archive.with_name(release.name + '.json').read_text())
        self.assertEqual(receipt['sha256'], result['sha256'])
        self.assertFalse(release.exists())

    def test_archive_verification_failure_keeps_original(self):
        release = self.release(1)
        with patch('release_storage.archive_inventory', return_value={}):
            with self.assertRaises(ValueError):
                self.storage.archive(release, set())
        self.assertTrue((release / 'nested/content.txt').is_file())
        self.assertEqual(list(self.storage.archives.iterdir()), [])

    def test_archive_restore_round_trip_keeps_bytes_modes_and_links(self):
        release = self.release(1)
        expected = inventory(release)
        self.storage.archive(release, set())
        restored = self.storage.restore(release.name)
        self.assertEqual(restored, release)
        self.assertEqual(inventory(restored), expected)
        with self.assertRaises(ValueError):
            self.storage.restore(release.name)

    def test_corrupt_archive_cannot_restore_or_leave_partial_release(self):
        release = self.release(1)
        self.storage.archive(release, set())
        (self.storage.archives / (release.name + '.tar.gz')).write_bytes(b'corrupt')
        with self.assertRaises(ValueError):
            self.storage.restore(release.name)
        self.assertFalse(release.exists())
        self.assertEqual(list(self.storage.root.glob('.restore-*')), [])

    def test_source_change_during_archiving_prevents_removal(self):
        release = self.release(1)
        original = inventory(release)
        with patch('release_storage.inventory', side_effect=[original, {}]):
            with self.assertRaises(ValueError):
                self.storage.archive(release, set())
        self.assertTrue(release.exists())

    def test_never_follow_release_symlinks_or_cross_environment(self):
        other = ReleaseStorage(self.home, 'pagecraft-app')
        production = self.release(1, storage=other)
        with self.assertRaises(ValueError):
            self.storage.archive(production, set())
        alias = self.storage.root / ('a' * 40 + '-1')
        alias.symlink_to(production)
        with self.assertRaises(ValueError):
            self.storage.archive(alias, set())
        result = self.storage.retain(None, None)
        self.assertEqual(result['archived'], [])
        self.assertTrue(production.exists())

    def test_symlink_archive_parent_creates_nothing_outside_environment(self):
        external = self.home / 'external'
        external.mkdir()
        link = self.home / 'pagecraft-deploy' / 'release-archives'
        import shutil
        shutil.rmtree(str(link))
        link.symlink_to(external)
        with self.assertRaises(ValueError):
            ReleaseStorage(self.home, 'pagecraft-staging')
        self.assertEqual(list(external.iterdir()), [])

    def test_legacy_bootstrap_protects_three_additional_candidates(self):
        releases = [self.release(n, successful=False) for n in range(1, 7)]
        result = self.storage.retain(releases[0], releases[1], dry_run=True)
        self.assertEqual(set(result['protected']), {p.name for p in releases if p != releases[2]})
        self.assertTrue(all(p.exists() for p in releases))

    def test_only_verified_expired_archives_are_removed(self):
        release = self.release(1)
        self.storage.archive(release, set())
        receipt = self.storage.archives / (release.name + '.json')
        data = json.loads(receipt.read_text())
        now = data['archivedAt'] + 30 * 86400 + 1
        self.assertEqual(self.storage.retain(None, None, now=now, dry_run=True)['expired'], [release.name])
        self.assertTrue(receipt.exists())
        self.storage.retain(None, None, now=now)
        self.assertFalse(receipt.exists())

    def test_corrupt_expired_archive_is_retained_for_investigation(self):
        release = self.release(1)
        self.storage.archive(release, set())
        archive = self.storage.archives / (release.name + '.tar.gz')
        archive.write_bytes(b'corrupt')
        with self.assertRaises(ValueError):
            self.storage.retain(None, None, now=10**12)
        self.assertTrue(archive.exists())

    def test_account_quota_failure_releases_all_probes(self):
        with patch('release_storage.os.posix_fallocate', create=True,
                   side_effect=OSError(errno.EDQUOT, 'Account quota exceeded')):
            with self.assertRaises(OSError):
                capacity_probe(self.storage.root, 1024, 4)
        self.assertEqual(list(self.storage.root.iterdir()), [])

    def test_inode_quota_failure_releases_all_probes(self):
        with patch('release_storage.os.posix_fallocate', create=True), \
             patch.object(pathlib.Path, 'touch', side_effect=OSError(errno.EDQUOT, 'Inode quota')):
            with self.assertRaises(OSError):
                capacity_probe(self.storage.root, 1024, 4)
        self.assertEqual(list(self.storage.root.iterdir()), [])

    def test_capacity_probe_succeeds_without_retaining_files(self):
        with patch('release_storage.os.posix_fallocate', create=True):
            self.assertEqual(capacity_probe(self.storage.root, 1024, 4),
                             {'reservedBytes': 1024, 'reservedFiles': 4})
        self.assertEqual(list(self.storage.root.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
