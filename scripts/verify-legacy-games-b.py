"""Verify the durable archive and every member without extracting untrusted paths."""
import hashlib, json, tarfile
from pathlib import Path, PurePosixPath
root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'archives/legacy-games-b-2026-10-22/manifest.json').read_text())
archive = root / manifest['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
assert archive.stat().st_size == manifest['bytes']
expected = {row['path']: row for row in manifest['files']}
assert len(expected) == len(manifest['files'])
seen = set()
with tarfile.open(archive, 'r:xz') as tar:
    for member in tar:
        path = PurePosixPath(member.name)
        assert member.isfile() and not path.is_absolute() and '..' not in path.parts
        assert member.name in expected and member.name not in seen
        seen.add(member.name)
        data = tar.extractfile(member).read()
        assert len(data) == expected[member.name]['bytes']
        assert hashlib.sha256(data).hexdigest() == expected[member.name]['sha256'], member.name
assert seen == expected.keys()
for row in manifest['protectedFiles']:
    assert hashlib.sha256((root / row['path']).read_bytes()).hexdigest() == row['sha256'], row['path']
print(json.dumps({'status': 'PASS', 'files': len(seen), 'sha256': manifest['sha256'], 'protectedFiles': len(manifest['protectedFiles'])}))
