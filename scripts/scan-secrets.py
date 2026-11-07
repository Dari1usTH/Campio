#!/usr/bin/env python3
"""Scan tracked working files and git history without displaying secret values."""
import pathlib
import re
import subprocess
import sys

patterns = [
    re.compile(rb'AIza[0-9A-Za-z_-]{30,}'),
    re.compile(rb'sk-(?:or-v1-)?[A-Za-z0-9_-]{40,}'),
    re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(rb'(?i)(?:SESSION_SECRET|TEST_USER_PASSWORD|SMTP_PASSWORD|GEMINI_API_KEY|GOOGLE_CLIENT_SECRET)\s*=\s*[\"\']?[A-Za-z0-9_+/=-]{16,}'),
]
issues = []
files = subprocess.check_output(['git', 'ls-files', '-z']).split(b'\0')
for name in files:
    if not name:
        continue
    path = pathlib.Path(name.decode())
    if not path.is_file() or path.name in {'package-lock.json', 'bun.lock', 'go.sum', 'scan-secrets.py'}:
        continue
    data = path.read_bytes()
    if any(p.search(data) for p in patterns):
        issues.append(str(path))
# Historical objects, including deleted paths, are scanned separately.
objects = subprocess.check_output(['git', 'rev-list', '--objects', '--all']).splitlines()
batch = subprocess.Popen(['git', 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
for entry in objects:
    sha, _, name = entry.partition(b' ')
    if not name or name.endswith((b'package-lock.json', b'bun.lock', b'go.sum', b'scan-secrets.py')):
        continue
    batch.stdin.write(sha + b'\n')
    batch.stdin.flush()
    header = batch.stdout.readline().split()
    size = int(header[2])
    data = batch.stdout.read(size)
    batch.stdout.read(1)
    if header[1] != b'blob' or b'\0' in data[:8192]:
        continue
    if any(p.search(data) for p in patterns):
        issues.append('history:' + name.decode(errors='replace'))
batch.stdin.close()
batch.wait()
if issues:
    print('Potential secret signatures in: ' + ', '.join(sorted(set(issues))))
    sys.exit(1)
print(f'Secret signature scan passed ({len(files)-1} tracked paths and git history).')
