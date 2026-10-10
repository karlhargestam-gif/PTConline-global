#!/usr/bin/env python3
"""Build widgets/catalog.json from the course pages (stdlib only).

The catalog is derived only from what the HTML already says:
  - course order and provider grouping come from /courses/index.html
  - title, description and URL come from each translated course page's
    <title>, <meta name="description"> and <link rel="canonical">
  - a language is listed only if a translated page exists for it
    (/courses/<slug>/, /es/courses/<slug>/, /pt/courses/<slug>/)

Languages are page translations of the course page, nothing more. The script
does not infer subtitles, dubbing, credit, accreditation or certificates.

Usage:
  python3 .github/scripts/build_catalog.py           # rewrite widgets/catalog.json
  python3 .github/scripts/build_catalog.py --check   # exit 1 if it is stale
"""

import argparse
import json
import os
import re
import sys
from html.parser import HTMLParser

LANGS = [("en", ""), ("es", "es/"), ("pt", "pt/")]  # language code, path prefix
OUT = os.path.join("widgets", "catalog.json")


class Head(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = self.title = self.description = self.canonical = None
        self._in_title = False
        self._title = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "title":
            self._in_title = True
        elif tag == "meta" and (a.get("name") or "").lower() == "description":
            self.description = (a.get("content") or "").strip()
        elif tag == "link" and "canonical" in (a.get("rel") or "").lower().split():
            self.canonical = a.get("href")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
            self.title = "".join(self._title).strip()

    def handle_data(self, data):
        if self._in_title:
            self._title.append(data)


class CatalogIndex(HTMLParser):
    """Reads provider headings and course card links, in page order."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.entries = []  # (slug, provider)
        self._provider = None
        self._in_provider = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if "entity-name" in classes:
            self._in_provider, self._provider = True, ""
        elif tag == "a" and "catalog-card" in classes:
            m = re.fullmatch(r"/courses/([a-z0-9-]+)/?", a.get("href") or "")
            if m:
                self.entries.append((m.group(1), (self._provider or "").strip() or None))

    def handle_endtag(self, tag):
        if self._in_provider and tag == "p":
            self._in_provider = False

    def handle_data(self, data):
        if self._in_provider:
            self._provider += data


def read_head(path):
    p = Head()
    with open(path, encoding="utf-8") as fh:
        p.feed(fh.read())
    return p


def short_title(title):
    # "Book of Acts | Pentecostal Theological Consortium" -> "Book of Acts"
    return title.split(" | ")[0].strip()


def build(root):
    index = CatalogIndex()
    with open(os.path.join(root, "courses", "index.html"), encoding="utf-8") as fh:
        index.feed(fh.read())
    if not index.entries:
        raise SystemExit("no course cards found in courses/index.html")

    catalog_pages = {}
    for code, prefix in LANGS:
        page = os.path.join(root, prefix + "courses", "index.html")
        if os.path.isfile(page):
            catalog_pages[code] = read_head(page).canonical

    courses = []
    for slug, provider in index.entries:
        pages = {}
        for code, prefix in LANGS:
            page = os.path.join(root, prefix + "courses", slug, "index.html")
            if not os.path.isfile(page):
                continue
            h = read_head(page)
            if h.lang != code:
                raise SystemExit(f"{page}: <html lang> is {h.lang!r}, expected {code!r}")
            if not (h.title and h.canonical):
                raise SystemExit(f"{page}: missing <title> or canonical")
            pages[code] = {
                "title": short_title(h.title),
                "description": h.description or "",
                "url": h.canonical,
            }
        courses.append({
            "id": slug,
            "provider": provider,
            "pageTranslations": list(pages),
            "pages": pages,
        })

    return {
        "schemaVersion": 1,
        "name": "Pentecostal Theological Consortium course catalog",
        "generatedBy": ".github/scripts/build_catalog.py",
        "note": ("Generated from the course pages. 'pageTranslations' lists the languages "
                 "in which the course page itself is published; it says nothing about "
                 "subtitles, dubbing, credit or certificates."),
        "catalogPages": catalog_pages,
        "courses": courses,
    }


def render(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--check", action="store_true", help="fail if widgets/catalog.json is stale")
    args = ap.parse_args()

    out = os.path.join(args.root, OUT)
    fresh = render(build(args.root))
    if args.check:
        try:
            with open(out, encoding="utf-8") as fh:
                current = fh.read()
        except FileNotFoundError:
            current = None
        if current != fresh:
            msg = (f"{OUT} is stale: run `python3 .github/scripts/build_catalog.py` "
                   "and commit the result")
            print(f"error: {msg}")
            if os.environ.get("GITHUB_ACTIONS"):
                print(f"::error::{msg}")
            sys.exit(1)
        print(f"{OUT} is up to date.")
        return
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(fresh)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
