import importlib.util
from pathlib import Path
import tempfile
import unittest
import yaml
spec=importlib.util.spec_from_file_location('importer',Path(__file__).resolve().parents[1]/'scripts/import_course.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=Path(__file__).resolve().parents[1]
class ImportTests(unittest.TestCase):
 def test_existing_example_dryrun_build(self):
  folder=ROOT/'templates/course-submission';course,copies=m.build(folder,m.load_course(folder))
  self.assertEqual(course['provider'],'ptc');self.assertTrue(copies)
 def test_caption_escape_rejected(self):
  with tempfile.TemporaryDirectory() as t:
   folder=Path(t)/'course';folder.mkdir();(Path(t)/'secret.vtt').write_text('WEBVTT\n')
   with self.assertRaises(SystemExit):m.check_captions(folder,'../secret.vtt')
 def test_script_links_rejected(self):
  folder=ROOT/'templates/course-submission';data=m.load_course(folder)
  data['blocks'][0]['items']=[{'kind':'reading','title':{'en':'test','es':'test','pt':'test'},'href':'javascript:alert(1)'}]
  with self.assertRaises(SystemExit):m.build(folder,data)
 def test_relative_and_https_links_allowed(self):
  for url in ['/assets/test.pdf','https://example.invalid/test.pdf']:
   folder=ROOT/'templates/course-submission';data=m.load_course(folder)
   data['blocks'][0]['items']=[{'kind':'reading','title':{'en':'test','es':'test','pt':'test'},'href':url}]
   course,_=m.build(folder,data);self.assertEqual(course['blocks'][0]['items'][0]['href'],url)
if __name__=='__main__':unittest.main()
