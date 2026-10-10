import hashlib
import tempfile
import unittest
from pathlib import Path
from course_resource_check import ROOT, check, check_pdf

class ResourceRegressionTests(unittest.TestCase):
    def test_recovered_originals_and_course_slots(self):
        self.assertEqual(check(), [])

    def test_http_200_html_error_page_is_rejected(self):
        data = b'<!DOCTYPE html><title>Dropbox - File Deleted</title>'
        record = dict(size=len(data), sha256=hashlib.sha256(data).hexdigest())
        with self.assertRaises(ValueError):
            check_pdf(data, record, 'text/html')
        with self.assertRaises(ValueError):
            check_pdf(data, record, 'application/pdf')

    def test_truncated_and_changed_pdf_are_rejected(self):
        import json
        record = json.loads((ROOT / 'assets/course-resources.json').read_text())['syllabi'][0]
        data = (ROOT / record['path'].lstrip('/')).read_bytes()
        for bad in (data[:-20], data[:100] + bytes([data[100] ^ 1]) + data[101:]):
            with self.assertRaises(ValueError):
                check_pdf(bad, record, 'application/pdf')

    def test_reintroduced_dead_link_is_rejected(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copytree(ROOT / 'assets', root / 'assets')
            for prefix in ('courses', 'pt/courses', 'es/courses'):
                shutil.copytree(ROOT / prefix, root / prefix)
            p = root / 'pt/courses/acts/index.html'
            p.write_text(p.read_text().replace('/assets/syllabi/acts-syllabus.pdf', 'https://www.dropbox.com/s/e8jy6m4ebycmw2w/deleted.pdf'))
            errors = check(root)
            self.assertTrue(any('deleted Dropbox link is active' in e for e in errors))

if __name__ == '__main__':
    unittest.main()
