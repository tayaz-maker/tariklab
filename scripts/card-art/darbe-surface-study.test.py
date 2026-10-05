#!/usr/bin/env python3
"""Technical study gates only; passing these does not accept artistic quality."""
import hashlib
import importlib.util
from pathlib import Path
import unittest
import sys
sys.dont_write_bytecode=True
import xml.etree.ElementTree as ET

MODULE=Path(__file__).with_name('darbe-surface-study.py')
spec=importlib.util.spec_from_file_location('surface_study',MODULE)
study=importlib.util.module_from_spec(spec)
spec.loader.exec_module(study)
NS='{http://www.w3.org/2000/svg}'

class SurfaceStudyTests(unittest.TestCase):
 def setUp(self):
  self.svg=study.scene(); self.root=ET.fromstring(self.svg)
 def test_deterministic_after_repeated_calls(self):
  self.assertEqual(self.svg,study.scene())
  self.assertEqual(hashlib.sha256(self.svg.encode()).hexdigest(),'39c2683640310386d03fca81ba425159aa3b1847daf2019d98eb2ba502045b79')
 def test_byte_and_aspect_budget(self):
  self.assertLessEqual(len(self.svg.encode()),80000)
  self.assertEqual(self.root.attrib['viewBox'],'0 0 720 480')
  self.assertEqual(720/480,240/160)
 def test_no_external_embedded_asset_script_or_visible_text(self):
  for tag in ['image','script','foreignObject','text','audio','video','animate','animateTransform']:
   self.assertEqual(list(self.root.iter(NS+tag)),[],tag)
  for node in self.root.iter():
   for k,v in node.attrib.items():
    self.assertFalse(k.endswith('href'),(k,v))
    self.assertNotIn('data:',v)
    self.assertNotIn('http:',v)
    self.assertNotIn('https:',v)
 def test_every_paint_reference_resolves(self):
  ids={n.attrib['id'] for n in self.root.iter() if 'id' in n.attrib}
  self.assertEqual(len(ids),len([n for n in self.root.iter() if 'id' in n.attrib]))
  for n in self.root.iter():
   for v in n.attrib.values():
    if v.startswith('url(#'): self.assertIn(v[5:-1],ids)
 def test_nonvisible_description_is_not_omitted(self):
  self.assertEqual(self.root.attrib['role'],'img')
  self.assertEqual(self.root.attrib['aria-labelledby'],'title desc')
  self.assertTrue(self.root.find(NS+'title').text)
  self.assertTrue(self.root.find(NS+'desc').text)
 def test_generator_only_writes_its_isolated_output(self):
  self.assertEqual(study.OUT,study.ROOT/'outputs/card-realism/darbe-surface-study')
  self.assertFalse((study.OUT/'production').exists())
  self.assertNotIn('/public/',str(study.OUT))

if __name__=='__main__':unittest.main()
