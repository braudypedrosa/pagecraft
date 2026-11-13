#!/usr/bin/env python3
"""Activate a tested development artifact in the separate founder reports app.

Run on the hosting account with an explicit commit. It never changes the customer
app pointer, database, reports credentials, or persistent budget storage.
"""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request


def main(commit, home=Path('/home/itspbuku')):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('Expected an exact tested commit')
    os.umask(0o077)
    app_root = home / 'pagecraft-reports'
    releases = app_root / 'releases'
    if app_root.is_symlink() or releases.is_symlink():
        raise ValueError('Reports application directories must be physical directories')
    releases.mkdir(parents=True, exist_ok=True)
    lock = (app_root / '.activate.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        source = (home / 'pagecraft-staging' / 'current').resolve(strict=True)
        if source.parent != home / 'pagecraft-releases' / 'pagecraft-staging':
            raise ValueError('Candidate is outside the staging release directory')
        meta = {'commit': commit, 'branch': 'development'}
        if json.loads((source / 'deployment.json').read_text()) != meta:
            raise ValueError('Staging must already contain the exact tested commit')
        if not (source / 'server/src/reports-index.ts').is_file():
            raise ValueError('Candidate does not contain the founder console')
        config_path = home / 'pagecraft-reports-config/runtime.json'
        if config_path.is_symlink() or config_path.parent.is_symlink() or not config_path.is_file() or config_path.stat().st_mode & 0o077 or config_path.parent.stat().st_mode & 0o077:
            raise ValueError('Protected reports runtime configuration is required')
        saved = json.loads(config_path.read_text())
        domain = saved.get('REPORTS_HOST')
        if domain != 'reports.itspagecraft.com' or saved.get('REPORTS_ORIGIN') != 'https://' + domain:
            raise ValueError('Unexpected reports host configuration')
        node = home / 'nodevenv/pagecraft-reports/24/bin/node'
        if not node.is_file():
            raise ValueError('Reports Node 24 environment is not provisioned')
        release = releases / (commit + '-' + str(int(time.time())))
        required = sum(path.stat().st_size for path in source.rglob('*') if path.is_file() and not path.is_symlink())
        if shutil.disk_usage(releases).free < required + 32 * 1024 * 1024:
            raise ValueError('Insufficient capacity for an isolated reports release')
        shutil.copytree(source, release, symlinks=True)
        env = {**os.environ, 'NODE_ENV': 'production', 'PAGECRAFT_REPORTS_CONFIG': str(config_path),
               'BIND_HOST': '127.0.0.1', 'PATH': str(node.parent) + ':' + os.environ.get('PATH', '')}
        with socket.socket() as server:
            server.bind(('127.0.0.1', 0))
            port = server.getsockname()[1]
        env['PORT'] = str(port)
        log_path = app_root / ('verify-' + commit + '.log')
        with log_path.open('w') as log:
            process = subprocess.Popen([str(node), 'server/src/reports-index.ts'], cwd=release, env=env,
                                       stdout=log, stderr=log)
            def local(path):
                request = urllib.request.Request('http://127.0.0.1:' + str(port) + path,
                                                 headers={'Host': domain})
                try:
                    return urllib.request.urlopen(request, timeout=5)
                except urllib.error.HTTPError as error:
                    return error
            try:
                for _ in range(30):
                    if process.poll() is not None:
                        raise ValueError('Reports candidate exited before readiness')
                    try:
                        with local('/__deployment') as response:
                            if json.load(response) == meta:
                                break
                    except (OSError, ValueError):
                        time.sleep(1)
                else:
                    raise ValueError('Reports candidate readiness timed out')
                for path in ('/api/owner/billing', '/api/crm/summary', '/exports/customers.csv'):
                    with local(path) as response:
                        if response.status != 401 or 'no-store' not in response.headers.get('cache-control', ''):
                            raise ValueError('Anonymous reports data must be denied privately')
                for path in ('/sign-up', '/edit/example', '/api/sites'):
                    with local(path) as response:
                        if response.status != 404:
                            raise ValueError('Customer application route exposed in reports')
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
        current = app_root / 'current'
        if current.exists() and not current.is_symlink():
            raise ValueError('Reports current pointer must be a symlink')
        previous = current.resolve() if current.is_symlink() else None
        temporary = app_root / 'current.next'
        if temporary.is_symlink():
            temporary.unlink()
        temporary.symlink_to(release)
        def restart():
            result = json.loads(subprocess.check_output(['cloudlinux-selector', 'restart', '--json',
                '--interpreter', 'nodejs', '--domain', domain, '--app-root', 'pagecraft-reports']))
            if result.get('result') != 'success':
                raise ValueError('Reports restart failed')
        try:
            os.replace(temporary, current)
            restart()
            for _ in range(20):
                try:
                    with urllib.request.urlopen('https://' + domain + '/__deployment', timeout=5) as response:
                        if json.load(response) == meta:
                            break
                except (OSError, ValueError):
                    time.sleep(1)
            else:
                raise ValueError('Reports HTTPS verification failed')
            status_temporary = app_root / 'deployment-status.next.json'
            status_temporary.write_text(json.dumps({**meta, 'release': str(release),
                'previous': str(previous) if previous else None}))
            os.replace(status_temporary, app_root / 'deployment-status.json')
        except Exception:
            if temporary.is_symlink():
                temporary.unlink()
            if previous:
                temporary.symlink_to(previous)
                os.replace(temporary, current)
            elif current.is_symlink():
                current.unlink()
            restart()
            raise
        print(json.dumps({'deployed': domain, **meta}))
    finally:
        lock.close()


if __name__ == '__main__':
    try:
        main(sys.argv[1])
    except Exception as error:
        print('Reports deployment failed; inspect its protected verification log: ' + type(error).__name__, file=sys.stderr)
        sys.exit(1)
