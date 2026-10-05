from pathlib import Path
from xml.etree import ElementTree as E
import json, hashlib, gzip
p=Path(__file__).resolve().parent
b=(p/'geometry-export.svg').read_bytes();root=E.fromstring(b)
for e in root.iter():
 assert e.tag.split('}')[-1] not in {'image','script','foreignObject','filter','animate','animateTransform','text'}
 assert not any(k.split('}')[-1].startswith('on')for k in e.attrib)
assert b'data:' not in b and b'http' not in b.replace(b'http://www.w3.org/2000/svg',b'')
m=json.loads((p/'metrics.json').read_text())
assert len(b)==m['rawBytes']
assert len(gzip.compress(b,mtime=0))==m['gzipBytes']
assert hashlib.sha256(b).hexdigest()==m['sha256']
assert sum(e.tag.endswith('path')for e in root.iter())==m['svgPathCount']
failed_contacts=[x['finger']for x in m['contacts']if x['absoluteSurfaceDistanceToPlane']>.01 or not x['insidePaperXY']]
assert failed_contacts==['little','thumb'],'Known contact failure must not be hidden.'
assert not m['productionEligibility'] and m['acceptedArt']==0
print(json.dumps({'vectorSafety':'PASS','byteHashPathAccounting':'PASS','contactGate':'FAIL','failedContacts':failed_contacts,'quality':'FAIL','acceptedArt':0}))
