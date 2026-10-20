"""Read-only verification of the preserved source package; never extracts."""
import hashlib
import io
import json
import lzma
from pathlib import Path, PurePosixPath
import tarfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'archives/MANIFEST.json').read_text())
packed = (root / manifest['path']).read_bytes()
assert len(packed) == manifest['compressedBytes']
assert hashlib.sha256(packed).hexdigest() == manifest['sha256']
raw = lzma.decompress(packed)
assert len(raw) == manifest['tarBytes']
expected = {item['path']: item for item in manifest['files']}
assert len(expected) == len(manifest['files'])
seen = set()
with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
    for member in archive:
        path = PurePosixPath(member.name)
        assert member.isfile() and not path.is_absolute() and '..' not in path.parts
        assert member.name not in seen and member.name in expected
        seen.add(member.name)
        data = archive.extractfile(member).read()
        item = expected[member.name]
        assert len(data) == item['bytes']
        assert hashlib.sha256(data).hexdigest() == item['sha256'], member.name
assert seen == expected.keys()
assert sum(item['bytes'] for item in expected.values()) == manifest['sourceBytes']
print(json.dumps({'status': 'PASS', 'files': len(seen), 'sourceBytes': manifest['sourceBytes'], 'compressedBytes': len(packed)}))
