#!/usr/bin/env python3
"""Check recovered originals and unavailable video slots, optionally over anonymous HTTP."""
import argparse
import hashlib
import json
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]

class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.items = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.items.append((tag, dict(attrs)))

def check_pdf(data, record, content_type=None):
    if content_type and content_type.split(';')[0] != 'application/pdf':
        raise ValueError('expected application/pdf, got ' + content_type)
    if not data.startswith(b'%PDF-') or not data.rstrip().endswith(b'%%EOF'):
        raise ValueError('invalid PDF signature/trailer (possibly an error page)')
    if len(data) != record['size'] or hashlib.sha256(data).hexdigest() != record['sha256']:
        raise ValueError('bytes differ from verified original')

def check(root=ROOT, base_url=None):
    manifest = json.loads((root / 'assets/course-resources.json').read_text())
    errors = []
    def read(path):
        if base_url:
            with urlopen(base_url.rstrip('/') + '/' + path.lstrip('/'), timeout=30) as r:
                return r.read(), r.headers.get('Content-Type', '')
        return (root / path.lstrip('/')).read_bytes(), None
    for record in manifest['syllabi']:
        try:
            data, mime = read(record['path'])
            check_pdf(data, record, mime)
        except Exception as e:
            errors.append(record['path'] + ': ' + str(e))
    for prefix in ('', 'pt/', 'es/'):
        for slug in ('acts', 'orality', 'missiology', 'mentoring', 'practicum'):
            path = f'{prefix}courses/{slug}/index.html'
            try:
                data, _ = read(path)
                text = data.decode('utf-8')
                links = Links(text).items
                for r in manifest['syllabi']:
                    if r['course'] == slug and not any(a.get('href') == r['path'] for _, a in links):
                        errors.append(path + ': recovered syllabus link missing')
                    if any(r['old_link_id'] in a.get('href', '') for _, a in links):
                        errors.append(path + ': deleted Dropbox link is active')
                for v in manifest['unavailable_videos']:
                    if any(v['id'] in a.get('href', '') or v['id'] in a.get('src', '') for _, a in links):
                        errors.append(path + ': unavailable video link is active')
                    if slug in v['courses']:
                        slots = [a for _, a in links if a.get('data-resource-id') == v['id']]
                        if len(slots) != 1 or slots[0].get('aria-disabled') != 'true' or slots[0].get('href'):
                            errors.append(path + ': unavailable video slot missing or clickable')
                if prefix == 'pt/' and '<html lang="pt-BR"' not in text:
                    errors.append(path + ': Portuguese language metadata lost')
            except Exception as e:
                errors.append(path + ': ' + str(e))
    return errors

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', help='Preview URL; requests use no credentials or cookies')
    args = parser.parse_args()
    errors = check(base_url=args.base_url)
    for error in errors:
        print('ERROR:', error)
    print(f'Course resources: 3 PDFs and 15 course pages checked; {len(errors)} error(s).')
    raise SystemExit(bool(errors))
