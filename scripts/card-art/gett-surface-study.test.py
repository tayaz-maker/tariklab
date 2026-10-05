"""Artifact contract checks; these do not certify artistic or anatomy quality."""
from pathlib import Path
import ast, hashlib, json, subprocess, sys, tempfile, unittest
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs/card-realism/gett-surface-study'
SOURCE=Path(__file__).with_name('gett-surface-study.py')

class SurfaceStudyContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta=json.loads((OUT/'metrics.json').read_text())
        cls.artifacts=OUT
        cls.temporary=None
        if any(not (OUT/item['path']).exists() for item in cls.meta['outputs']):
            cls.temporary=tempfile.TemporaryDirectory(prefix='gett-surface-contract-')
            cls.artifacts=Path(cls.temporary.name)
            subprocess.run([sys.executable,str(SOURCE),'--output',str(cls.artifacts)],cwd=ROOT,check=True,capture_output=True,text=True,timeout=60)
    @classmethod
    def tearDownClass(cls):
        if cls.temporary: cls.temporary.cleanup()
    def test_rejection_is_explicit(self):
        self.assertEqual(self.meta['status'],'REJECTED_REALISM_NOT_PRODUCTION')
        self.assertFalse(self.meta['runtimeChanges'])
        self.assertFalse(self.meta['imagegen'])
        self.assertEqual(self.meta['externalInputs'],0)
    def test_card_identity_matches_authoritative_data(self):
        cards=json.loads((ROOT/'public/games/gett-oh/source-cards.json').read_text())
        if isinstance(cards,dict): cards=cards.get('cards',list(cards.values()))
        card=next(c for c in cards if c.get('id')=='RCN-001')
        self.assertEqual(card['name'],self.meta['name'])
        self.assertEqual(self.meta['cardId'],'RCN-001')
    def test_artifact_sizes_decode_and_dimensions(self):
        for width in (400,160):
            path=self.artifacts/f'RCN-001-study-{width}.webp'
            with Image.open(path) as im:
                im.load();self.assertEqual(im.size,(width,width*3//4))
                self.assertEqual(im.mode,'RGB')
            self.assertLess(path.stat().st_size,50_000)
    def test_source_and_output_integrity(self):
        self.assertEqual(hashlib.sha256(SOURCE.read_bytes()).hexdigest(),self.meta['sourceSha256'])
        for out in self.meta['outputs']:
            data=(self.artifacts/out['path']).read_bytes()
            self.assertEqual(len(data),out['bytes'])
            self.assertEqual(hashlib.sha256(data).hexdigest(),out['sha256'])
    def test_source_has_no_remote_loader_or_font(self):
        tree=ast.parse(SOURCE.read_text())
        imports=set()
        for node in ast.walk(tree):
            if isinstance(node,ast.Import):imports.update(x.name.split('.')[0] for x in node.names)
            if isinstance(node,ast.ImportFrom):imports.add(node.module.split('.')[0])
        self.assertEqual(imports,{'pathlib','argparse','hashlib','json','math','re','time','numpy','PIL','scipy'})
        calls={ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n,ast.Call)}
        self.assertFalse(calls.intersection({'Image.open','ImageFont.truetype','requests.get','urlopen'}))
        self.assertFalse(any(isinstance(n,ast.Constant) and isinstance(n.value,str) and n.value.startswith(('https://','http://')) for n in ast.walk(tree)))
    def test_rejected_renders_are_not_tracked(self):
        tracked=subprocess.check_output(['git','ls-files','--','outputs/card-realism/gett-surface-study/*.webp','outputs/card-realism/gett-surface-study/*.png'],cwd=ROOT,text=True)
        self.assertEqual(tracked,'')
    def test_runtime_files_unchanged(self):
        diff=subprocess.check_output(['git','diff','be160c95eb5283e5ed2ce8bf139ef7aa714d329d','--name-only','--','public','src','package.json','package-lock.json','.github'],cwd=ROOT,text=True)
        self.assertEqual(diff,'')

if __name__=='__main__':unittest.main()
