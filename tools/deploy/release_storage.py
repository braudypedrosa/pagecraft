"""Environment-scoped release retention and real quota checks (Python 3.6+).

Call under the receiver's environment lock. Archives are private operational
backups, not application artifacts; symlinks are recorded but never followed.
"""
import hashlib
import json
import os
import pathlib
import re
import shutil
import stat
import tarfile
import tempfile
import time

RELEASE_NAME = re.compile(r'^[0-9a-f]{40}-[0-9]+$')
SUCCESS_FILE = '.pagecraft-success.json'
MIB = 1024 * 1024


def digest(stream):
    result = hashlib.sha256()
    while True:
        chunk = stream.read(MIB)
        if not chunk:
            return result.hexdigest()
        result.update(chunk)


def file_digest(path):
    with path.open('rb') as stream:
        return digest(stream)


def inventory(root):
    result = {}
    pending = [root]
    while pending:
        parent = pending.pop()
        for path in sorted(parent.iterdir()):
            info = path.lstat()
            name = str(path.relative_to(root))
            item = {'mode': stat.S_IMODE(info.st_mode)}
            if stat.S_ISLNK(info.st_mode):
                item.update(kind='link', target=os.readlink(str(path)))
            elif stat.S_ISDIR(info.st_mode):
                item['kind'] = 'directory'
                pending.append(path)
            elif stat.S_ISREG(info.st_mode):
                item.update(kind='file', size=info.st_size, sha256=file_digest(path))
            else:
                raise ValueError('Unsupported release entry: ' + name)
            result[name] = item
    return result


def archive_inventory(path):
    result = {}
    with tarfile.open(str(path), 'r:gz') as archive:
        for member in archive:
            name = pathlib.PurePosixPath(member.name)
            if (name.is_absolute() or '..' in name.parts or str(name) in ('', '.')
                    or str(name) != member.name.rstrip('/') or str(name) in result):
                raise ValueError('Invalid archive inventory')
            item = {'mode': member.mode}
            if member.isdir():
                item['kind'] = 'directory'
            elif member.issym():
                item.update(kind='link', target=member.linkname)
            elif member.isfile():
                item.update(kind='file', size=member.size,
                            sha256=digest(archive.extractfile(member)))
            else:
                raise ValueError('Unsupported archive entry')
            result[str(name)] = item
    return result


def atomic_json(path, data):
    with tempfile.NamedTemporaryFile(mode='w', prefix=path.name + '.', suffix='.tmp',
                                     dir=str(path.parent), delete=False) as stream:
        temporary = pathlib.Path(stream.name)
        try:
            json.dump(data, stream, sort_keys=True)
            stream.flush()
            os.fsync(stream.fileno())
        except Exception:
            temporary.unlink()
            raise
    try:
        os.replace(str(temporary), str(path))
    finally:
        if temporary.exists():
            temporary.unlink()


def capacity_probe(root, required_bytes, required_files):
    """Exercise filesystem AND account quotas, without expanding a candidate.

    fallocate reserves real blocks. Creating empty entries exercises inode quotas
    which statvfs does not expose on CloudLinux. Reservations always get removed.
    A later competing account write can still exhaust capacity; normal failed
    candidate isolation remains necessary.
    """
    if required_bytes < 0 or required_files < 0:
        raise ValueError('Invalid capacity request')
    available = os.statvfs(str(root))
    if available.f_bavail * available.f_frsize < required_bytes:
        raise ValueError('Insufficient deployment disk space')
    if available.f_favail >= 0 and available.f_favail < required_files + 2:
        raise ValueError('Insufficient deployment file capacity')
    with tempfile.TemporaryDirectory(prefix='.capacity-', dir=str(root)) as directory:
        block = pathlib.Path(directory) / 'blocks'
        with block.open('wb') as stream:
            if not hasattr(os, 'posix_fallocate'):
                raise ValueError('Real disk reservation is unavailable on this host')
            os.posix_fallocate(stream.fileno(), 0, max(1, required_bytes))
        for number in range(required_files):
            (pathlib.Path(directory) / str(number)).touch(exist_ok=False)
    return {'reservedBytes': required_bytes, 'reservedFiles': required_files}


class ReleaseStorage:
    def __init__(self, home, app):
        if app not in ('pagecraft-app', 'pagecraft-staging'):
            raise ValueError('Unknown deployment environment')
        self.home = pathlib.Path(home).resolve()
        self.app = app
        self.root = self.home / 'pagecraft-releases' / app
        self.archives = self.home / 'pagecraft-deploy' / 'release-archives' / app
        for directory in (self.root, self.archives):
            for parent in [directory] + list(directory.parents):
                if parent == self.home:
                    break
                if parent.is_symlink():
                    raise ValueError('Deployment directory must not be a symlink')
            directory.mkdir(parents=True, exist_ok=True)
            if directory.resolve() != directory:
                raise ValueError('Deployment directory must not be a symlink')

    def release(self, path):
        path = pathlib.Path(path)
        if path.parent != self.root or not RELEASE_NAME.fullmatch(path.name):
            raise ValueError('Release is outside this environment')
        if path.is_symlink() or path.resolve() != path:
            raise ValueError('Release must not be a symlink')
        return path

    def successful(self, release):
        marker = release / SUCCESS_FILE
        if not marker.is_file() or marker.is_symlink():
            return False
        data = json.loads(marker.read_text())
        return data.get('commit') == release.name[:40] and data.get('app') == self.app

    def mark_success(self, release):
        release = self.release(release)
        atomic_json(release / SUCCESS_FILE,
                    {'commit': release.name[:40], 'app': self.app, 'verifiedAt': time.time()})

    def protected(self, active, previous, candidate=None):
        keep = {self.release(p).name for p in (active, previous, candidate) if p}
        successful = sorted((p for p in self.root.iterdir()
                             if RELEASE_NAME.fullmatch(p.name) and not p.is_symlink()
                             and p.is_dir() and self.successful(p) and p.name not in keep),
                            key=lambda p: int(p.name.split('-')[1]), reverse=True)
        keep.update(p.name for p in successful[:3])
        # Legacy receivers did not record successful verification. Preserve three
        # additional legacy candidates until three proven rollback extras exist.
        missing = max(0, 3 - len(successful[:3]))
        legacy = sorted((p for p in self.root.iterdir()
                         if RELEASE_NAME.fullmatch(p.name) and not p.is_symlink()
                         and p.is_dir() and p.name not in keep),
                        key=lambda p: int(p.name.split('-')[1]), reverse=True)
        keep.update(p.name for p in legacy[:missing])
        return keep

    def archive(self, release, protected):
        release = self.release(release)
        if release.name in protected:
            raise ValueError('Cannot archive a protected release')
        before = inventory(release)
        target = self.archives / (release.name + '.tar.gz')
        receipt = self.archives / (release.name + '.json')
        if target.is_symlink() or receipt.is_symlink():
            raise ValueError('Archive must not be a symlink')
        if not target.exists():
            descriptor, name = tempfile.mkstemp(prefix=target.name + '.', suffix='.tmp', dir=str(self.archives))
            temporary = pathlib.Path(name)
            try:
                with os.fdopen(descriptor, 'wb') as stream:
                    with tarfile.open(fileobj=stream, mode='w:gz', dereference=False) as archive:
                        for name in sorted(before):
                            archive.inodes.clear()  # Store hardlinked files independently.
                            archive.add(str(release / name), arcname=name, recursive=False)
                    stream.flush()
                    os.fsync(stream.fileno())
                if archive_inventory(temporary) != before:
                    raise ValueError('Archive verification failed')
                os.replace(str(temporary), str(target))
            finally:
                if temporary.exists():
                    temporary.unlink()
        if archive_inventory(target) != before or inventory(release) != before:
            raise ValueError('Release changed or archive verification failed')
        checksum = file_digest(target)
        if receipt.exists():
            data = json.loads(receipt.read_text())
            if data.get('sha256') != checksum or data.get('inventory') != before:
                raise ValueError('Archive receipt mismatch')
        else:
            atomic_json(receipt, {'version': 1, 'app': self.app, 'release': release.name,
                                 'archivedAt': time.time(), 'sha256': checksum,
                                 'inventory': before})
        # Only this immediate release child is removed, after byte/link/mode checks.
        shutil.rmtree(str(self.release(release)))
        return {'release': release.name, 'sha256': checksum, 'entries': len(before)}

    def restore(self, name):
        """Restore an archive as an inactive release; never switch the app."""
        destination = self.release(self.root / name)
        if destination.exists():
            raise ValueError('Release already exists')
        archive = self.archives / (name + '.tar.gz')
        receipt = self.archives / (name + '.json')
        if archive.is_symlink() or receipt.is_symlink():
            raise ValueError('Archive must not be a symlink')
        data = json.loads(receipt.read_text())
        if (data.get('app') != self.app or data.get('release') != name
                or file_digest(archive) != data.get('sha256')):
            raise ValueError('Archive receipt mismatch')
        expected = archive_inventory(archive)
        if expected != data.get('inventory'):
            raise ValueError('Archive inventory mismatch')
        # A regular entry cannot live beneath a link, even if a receipt were
        # tampered with. Links are installed last and never traversed.
        for entry in expected:
            for parent in pathlib.PurePosixPath(entry).parents:
                if str(parent) == '.':
                    break
                if expected.get(str(parent), {}).get('kind') != 'directory':
                    raise ValueError('Invalid archive parent')
        with tempfile.TemporaryDirectory(prefix='.restore-', dir=str(self.root)) as directory:
            root = pathlib.Path(directory) / 'release'
            root.mkdir()
            with tarfile.open(str(archive), 'r:gz') as source:
                for member in source:
                    target = root / member.name
                    if member.isdir():
                        target.mkdir(parents=True, exist_ok=True)
                    elif member.isfile():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        with target.open('xb') as stream:
                            shutil.copyfileobj(source.extractfile(member), stream)
                for entry, item in expected.items():
                    target = root / entry
                    if item['kind'] == 'link':
                        target.symlink_to(item['target'])
                    else:
                        target.chmod(item['mode'])
            if inventory(root) != expected:
                raise ValueError('Restored release verification failed')
            os.rename(str(root), str(destination))
        return destination

    def retain(self, active, previous, candidate=None, now=None, dry_run=False):
        protected = self.protected(active, previous, candidate)
        result = {'protected': sorted(protected), 'archived': [], 'expired': []}
        for release in sorted(self.root.iterdir()):
            if (not RELEASE_NAME.fullmatch(release.name) or release.is_symlink()
                    or not release.is_dir() or release.name in protected):
                continue
            result['archived'].append(release.name if dry_run else self.archive(release, protected))
        cutoff = (time.time() if now is None else now) - 30 * 86400
        for receipt in sorted(self.archives.glob('*.json')):
            name = receipt.stem
            if not RELEASE_NAME.fullmatch(name) or name in protected or receipt.is_symlink():
                continue
            data = json.loads(receipt.read_text())
            if (data.get('app') != self.app or data.get('release') != name
                    or data.get('archivedAt', float('inf')) >= cutoff):
                continue
            archive = self.archives / (name + '.tar.gz')
            if archive.is_symlink() or not archive.is_file() or file_digest(archive) != data.get('sha256'):
                raise ValueError('Expired archive verification failed')
            result['expired'].append(name)
            if not dry_run:
                archive.unlink()
                receipt.unlink()
        return result

    def capacity(self, unpacked_bytes, members, active=None):
        installed = inventory(self.release(active)) if active else {}
        previous_bytes = sum(item.get('size', 0) for item in installed.values())
        # Include npm's installed tree, extraction temporaries and a fixed margin.
        size = max(256 * MIB, unpacked_bytes + previous_bytes * 2 + 64 * MIB)
        files = max(12000, members * 2 + len(installed) * 2 + 2048)
        return capacity_probe(self.root, size, files)
