#!/usr/bin/env python3
"""Static-site health check (stdlib only).

Fails the build when a change would ship:
  - a page over the size budget, or a large base64 image inlined in HTML
  - a missing / non-absolute / off-host canonical URL
  - invalid JSON-LD structured data
  - a relative og:image / twitter:image
  - an internal link or asset that does not exist in the repo
  - a robots.txt or sitemap.xml that is missing, invalid, or points off-host
  - a .button whose text color matches its background, or whose visible text is empty

Usage: python3 site_check.py --host www.example.com [--root .] [--max-page-kb 1024]
External links are not fetched (keeps CI fast and deterministic).
"""

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

SKIP_DIRS = {".git", "node_modules", ".github", ".vercel"}
INLINE_IMAGE_LIMIT = 100 * 1024  # base64 chars


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonicals = []
        self.meta = {}
        self.refs = []  # (attr, value)
        self.jsonld = []
        self._in_jsonld = False
        self._buf = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "link":
            rel = (a.get("rel") or "").lower().split()
            if "canonical" in rel and a.get("href"):
                self.canonicals.append(a["href"])
            if a.get("href") and not {"preconnect", "dns-prefetch", "alternate", "canonical", "sitemap"} & set(rel):
                self.refs.append(("href", a["href"]))
        elif tag == "meta":
            key = a.get("property") or a.get("name")
            if key:
                self.meta.setdefault(key.lower(), a.get("content") or "")
        elif tag == "script":
            if (a.get("type") or "").lower() == "application/ld+json":
                self._in_jsonld, self._buf = True, []
            elif a.get("src"):
                self.refs.append(("src", a["src"]))
        elif tag in ("a",) and a.get("href"):
            self.refs.append(("href", a["href"]))
        elif tag in ("img", "source", "video", "audio", "track", "iframe") and a.get("src"):
            self.refs.append(("src", a["src"]))
        if tag in ("video",) and a.get("poster"):
            self.refs.append(("poster", a["poster"]))

    def handle_endtag(self, tag):
        if tag == "script" and self._in_jsonld:
            self.jsonld.append("".join(self._buf))
            self._in_jsonld = False

    def handle_data(self, data):
        if self._in_jsonld:
            self._buf.append(data)


def html_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".html"):
                yield os.path.join(dirpath, name)


def resolve(root, page_path, url, host):
    """Return the repo file a same-site URL should map to, or None if external/ignorable."""
    if not url or url.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "sms:")):
        return None
    parts = urlsplit(url)
    if parts.scheme in ("http", "https"):
        if parts.hostname not in (host, host.removeprefix("www."), "www." + host.removeprefix("www.")):
            return None
        path = parts.path or "/"
    elif parts.scheme or parts.netloc:
        return None
    else:
        path = parts.path
        if not path:
            return None
    path = unquote(path)
    if path.startswith("/"):
        target = os.path.join(root, path.lstrip("/"))
    else:
        target = os.path.join(os.path.dirname(page_path), path)
    return os.path.normpath(target)


def exists_as_page(target):
    if os.path.isfile(target):
        return True
    if os.path.isdir(target) and os.path.isfile(os.path.join(target, "index.html")):
        return True
    return os.path.isfile(target.rstrip("/") + ".html")  # cleanUrls


def _strip_css_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def _css_blocks(css):
    """Yield (selector, body) including rules nested in @media."""
    css = _strip_css_comments(css)
    i, n = 0, len(css)
    while i < n:
        while i < n and css[i].isspace():
            i += 1
        if i >= n:
            break
        if css.startswith("@", i):
            brace = css.find("{", i)
            if brace < 0:
                break
            header = css[i:brace].strip()
            depth, j = 1, brace + 1
            while j < n and depth:
                if css[j] == "{":
                    depth += 1
                elif css[j] == "}":
                    depth -= 1
                j += 1
            inner = css[brace + 1:j - 1]
            if header.lower().startswith("@media"):
                yield from _css_blocks(inner)
            i = j
            continue
        brace = css.find("{", i)
        if brace < 0:
            break
        selector = css[i:brace].strip()
        depth, j = 1, brace + 1
        while j < n and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        yield selector, css[brace + 1:j - 1]
        i = j


def _specificity(selector):
    ids = len(re.findall(r"#[\w-]+", selector))
    classes = len(re.findall(r"\.[\w-]+", selector)) + len(re.findall(r":(?!:)[\w-]+(?:\([^)]*\))?", selector))
    cleaned = re.sub(r"#[\w-]+|\.[\w-]+|::?[\w-]+(?:\([^)]*\))?|\[[^\]]*\]", " ", selector)
    tags = len(re.findall(r"[a-zA-Z*][\w-]*", cleaned))
    return (ids, classes, tags)


def _compound_ok(compound, tag, classes):
    if re.search(r":(?:hover|focus|active|visited)|::", compound):
        return False
    tag_match = re.match(r"^([a-zA-Z*][\w-]*)", compound)
    if tag_match and tag_match.group(1) != "*" and tag_match.group(1).lower() != tag:
        return False
    needed = set(re.findall(r"\.([\w-]+)", compound))
    if not needed <= classes:
        return False
    if re.search(r"#[\w-]+", compound):
        return False
    return True


def _selector_matches(selector, tag, classes, ancestors):
    parts = [part for part in re.split(r"\s*>\s*|\s+", selector.strip()) if part]
    if not parts or not _compound_ok(parts[-1], tag, classes):
        return False
    index = len(ancestors) - 1
    for compound in reversed(parts[:-1]):
        found = False
        while index >= 0:
            parent_tag, parent_classes = ancestors[index]
            index -= 1
            if _compound_ok(compound, parent_tag, parent_classes):
                found = True
                break
        if not found:
            return False
    return True


def _color_token(value, variables, seen=None):
    if not value:
        return None
    seen = seen or set()
    value = re.sub(r"\s*!important\s*", "", value.strip().lower())
    var = re.search(r"var\(\s*(--[\w-]+)\s*\)", value)
    if var:
        name = var.group(1)
        if name in seen:
            return None
        seen.add(name)
        return _color_token(variables.get(name, ""), variables, seen)
    if value in {"transparent", "none", "inherit", "initial", "unset", "currentcolor"}:
        return None
    named = {"white": "#ffffff", "black": "#000000"}
    if value in named:
        return named[value]
    match = re.search(r"#([0-9a-f]{3,8})", value)
    if not match:
        return None
    hex_digits = match.group(1)
    if len(hex_digits) == 3:
        hex_digits = "".join(ch * 2 for ch in hex_digits)
    return "#" + hex_digits[:6]


def _load_style(root, hrefs):
    variables = {}
    rules = []
    order = 0
    for href in hrefs:
        path = href.split("?", 1)[0]
        if path.startswith("/"):
            path = path[1:]
        full = os.path.normpath(os.path.join(root, path))
        if not full.startswith(root) or not os.path.isfile(full):
            continue
        with open(full, encoding="utf-8", errors="replace") as fh:
            css = fh.read()
        for selector, body in _css_blocks(css):
            decls = {}
            for piece in body.split(";"):
                if ":" not in piece:
                    continue
                prop, raw = piece.split(":", 1)
                decls[prop.strip().lower()] = raw.strip()
            if selector.strip() == ":root":
                for prop, raw in decls.items():
                    if prop.startswith("--"):
                        variables[prop] = raw
                continue
            for one in selector.split(","):
                one = one.strip()
                if not one:
                    continue
                rules.append((one, decls, order, _specificity(one)))
                order += 1
    return variables, rules


def _button_paint(tag, classes, ancestors, variables, rules):
    color = None
    background = None
    ranked = []
    for selector, decls, order, spec in rules:
        if _selector_matches(selector, tag, classes, ancestors):
            ranked.append((spec, order, decls))
    for _spec, _order, decls in sorted(ranked):
        if "color" in decls:
            token = _color_token(decls["color"], variables)
            if token:
                color = token
        if "background-color" in decls:
            token = _color_token(decls["background-color"], variables)
            if token:
                background = token
        elif "background" in decls:
            token = _color_token(decls["background"], variables)
            if token:
                background = token
    return color, background


def button_problems(html, rel, root, cache):
    stylesheet_hrefs = re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', html)
    stylesheet_hrefs += re.findall(r'<link[^>]+href="([^"]+)"[^>]+rel="stylesheet"', html)
    key = tuple(stylesheet_hrefs)
    if key not in cache:
        cache[key] = _load_style(root, stylesheet_hrefs)
    variables, rules = cache[key]
    problems = []
    ancestors = []
    stack = []
    for match in re.finditer(r"<(/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)", html):
        closing, tag, attrs, text = match.groups()
        if text is not None:
            if stack:
                stack[-1][2].append(text)
            continue
        tag = tag.lower()
        if closing:
            if stack and stack[-1][0] == tag:
                _tag, _classes, chunks, parents = stack.pop()
                visible_text = "".join(chunks)
                if stack:
                    stack[-1][2].append(visible_text)
                if "button" in _classes:
                    visible = re.sub(r"\s+", " ", visible_text).strip()
                    if not visible:
                        problems.append(f"{rel}: .button has no visible text")
                    else:
                        color, background = _button_paint(_tag, _classes, parents, variables, rules)
                        if color and background and color == background:
                            problems.append(
                                f"{rel}: .button text {visible!r} is {color} on {background}"
                            )
                if ancestors:
                    ancestors.pop()
            continue
        classes = set()
        class_match = re.search(r'class="([^"]*)"', attrs)
        if class_match:
            classes = set(class_match.group(1).split())
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}:
            stack.append([tag, classes, [], list(ancestors)])
            ancestors.append((tag, classes))
    return problems


def check(root, host, max_page_kb):
    errors, warnings = [], []
    root = os.path.abspath(root)
    pages = sorted(html_files(root))
    button_styles = {}
    if not pages:
        errors.append("no .html files found")

    for page in pages:
        rel = os.path.relpath(page, root)
        with open(page, encoding="utf-8", errors="replace") as fh:
            html = fh.read()
        size_kb = len(html.encode("utf-8")) / 1024
        if size_kb > max_page_kb:
            errors.append(f"{rel}: page is {size_kb:,.0f} KB (budget {max_page_kb} KB)")
        big_inline = [m for m in re.finditer(r"data:image/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)", html)
                      if len(m.group(1)) > INLINE_IMAGE_LIMIT]
        if big_inline:
            total = sum(len(m.group(1)) for m in big_inline) * 3 / 4 / 1024
            errors.append(f"{rel}: {len(big_inline)} large base64 image(s) inlined (~{total:,.0f} KB) — "
                          "save them as files and reference them")

        p = PageParser()
        p.feed(html)
        errors.extend(button_problems(html, rel, root, button_styles))

        if not p.canonicals:
            errors.append(f"{rel}: missing <link rel=\"canonical\">")
        for c in p.canonicals:
            cp = urlsplit(c)
            if cp.scheme != "https" or cp.hostname != host:
                errors.append(f"{rel}: canonical {c!r} must be an absolute https URL on {host}")

        for key in ("og:title", "og:description", "og:image", "twitter:card"):
            if not p.meta.get(key):
                errors.append(f"{rel}: missing {key}")
        for key in ("og:image", "twitter:image"):
            v = p.meta.get(key)
            if v and not v.startswith("https://"):
                errors.append(f"{rel}: {key} must be an absolute https URL, got {v!r}")
        if "hreflang=\"x-default\"" not in html and "hreflang='x-default'" not in html:
            errors.append(f"{rel}: missing hreflang x-default")

        for block in p.jsonld:
            try:
                json.loads(block)
            except json.JSONDecodeError as exc:
                errors.append(f"{rel}: invalid JSON-LD ({exc.msg} at line {exc.lineno})")

        seen = set()
        for attr, url in p.refs:
            target = resolve(root, page, url, host)
            if target is None or target in seen:
                continue
            seen.add(target)
            if not target.startswith(root):
                errors.append(f"{rel}: {attr}={url!r} points outside the site")
            elif not exists_as_page(target):
                errors.append(f"{rel}: broken internal {attr} {url!r}")

    robots = os.path.join(root, "robots.txt")
    if not os.path.isfile(robots):
        errors.append("robots.txt is missing")
    else:
        with open(robots, encoding="utf-8") as fh:
            sitemaps = [ln.split(":", 1)[1].strip() for ln in fh if ln.lower().startswith("sitemap:")]
        if not sitemaps:
            errors.append("robots.txt has no Sitemap: line")
        for s in sitemaps:
            if urlsplit(s).hostname != host:
                errors.append(f"robots.txt Sitemap {s!r} is not on {host}")

    sitemap = os.path.join(root, "sitemap.xml")
    if not os.path.isfile(sitemap):
        errors.append("sitemap.xml is missing")
    else:
        try:
            tree = ET.parse(sitemap)
            locs = [el.text.strip() for el in tree.iter() if el.tag.endswith("}loc") and el.text]
            if not locs:
                errors.append("sitemap.xml lists no URLs")
            for loc in locs:
                if urlsplit(loc).hostname != host:
                    errors.append(f"sitemap.xml URL {loc!r} is not on {host}")
                    continue
                target = resolve(root, os.path.join(root, "index.html"), loc, host)
                if target and not exists_as_page(target):
                    errors.append(f"sitemap.xml URL {loc!r} has no matching page")
        except ET.ParseError as exc:
            errors.append(f"sitemap.xml is not valid XML ({exc})")

    return pages, errors, warnings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", required=True, help="canonical host, e.g. www.example.com")
    ap.add_argument("--root", default=".")
    ap.add_argument("--max-page-kb", type=int, default=1024)
    args = ap.parse_args()

    pages, errors, warnings = check(args.root, args.host, args.max_page_kb)
    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"error: {e}")
        if os.environ.get("GITHUB_ACTIONS"):
            print(f"::error::{e}")
    print(f"\nChecked {len(pages)} page(s) for {args.host}: {len(errors)} error(s).")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
