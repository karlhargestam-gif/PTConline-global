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
  - a top-bar logo taller than 24.8px, or touching the bar edges, at phone, 820px, and desktop widths
  - body text, headings, or section spacing off the shared type scale
  - visible text that does not match the baseline, aside from whitespace

Usage: python3 site_check.py --host www.example.com [--root .] [--max-page-kb 1024]
External links are not fetched (keeps CI fast and deterministic).
"""

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from html import unescape as html_unescape
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

SKIP_DIRS = {".git", "node_modules", ".github", ".vercel"}
INLINE_IMAGE_LIMIT = 100 * 1024  # base64 chars
LOCKUP_MARK_MAX = 24.8
LOCKUP_WORD_MAX = 20.0
LOCKUP_WIDTHS = (390, 820, 1280)


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
    classes = len(re.findall(r"\.[\w-]+", selector))
    cleaned = re.sub(r"#[\w-]+|\.[\w-]+|::?[\w-]+(?:\([^)]*\))?|\[[^\]]*\]", " ", selector)
    tags = len(re.findall(r"[a-zA-Z*][\w-]*", cleaned))
    if "*" in cleaned.split():
        tags -= cleaned.split().count("*")
    return (ids, classes, tags)


def _compound_ok(compound, tag, classes):
    if re.search(r":(?:hover|focus|active|visited)|::", compound):
        return False
    tag_match = re.match(r"^([a-zA-Z*][\w-]*)", compound)
    if tag_match and tag_match.group(1) != "*" and tag_match.group(1).lower() != tag:
        return False
    needed = set(re.findall(r"\.([\w-]+)", compound))
    return needed <= classes and not re.search(r"#[\w-]+", compound)


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


def _css_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def _css_rules(css, media=None):
    css = _css_comments(css)
    i, n = 0, len(css)
    while i < n:
        while i < n and css[i].isspace():
            i += 1
        if i >= n:
            break
        if css.startswith("@import", i):
            semi = css.find(";", i)
            yield ("import", css[i:semi], media)
            i = semi + 1
            continue
        if css.startswith("@", i):
            brace = css.find("{", i)
            if brace < 0:
                break
            header = css[i:brace].strip()
            depth, j = 1, brace + 1
            while j < n and depth:
                depth += css[j] == "{"
                depth -= css[j] == "}"
                j += 1
            if header.lower().startswith("@media"):
                yield from _css_rules(css[brace + 1:j - 1], header)
            i = j
            continue
        brace = css.find("{", i)
        if brace < 0:
            break
        selector = css[i:brace].strip()
        depth, j = 1, brace + 1
        while j < n and depth:
            depth += css[j] == "{"
            depth -= css[j] == "}"
            j += 1
        yield (selector, css[brace + 1:j - 1], media)
        i = j


def _decls(body):
    found = {}
    for piece in body.split(";"):
        if ":" not in piece:
            continue
        prop, raw = piece.split(":", 1)
        found[prop.strip().lower()] = raw.strip()
    return found


def _px(value):
    if not value:
        return None
    match = re.search(r"(-?\d+(?:\.\d+)?)px", value)
    return float(match.group(1)) if match else None


def _media_matches(query, width):
    if not query:
        return True
    mins = [int(item) for item in re.findall(r"min-width:\s*(\d+)px", query)]
    maxs = [int(item) for item in re.findall(r"max-width:\s*(\d+)px", query)]
    return all(width >= item for item in mins) and all(width <= item for item in maxs)


def _read_sheet(root, href, seen):
    path = href.strip("\"' ").split("?", 1)[0]
    path = re.sub(r"^url\((.*)\)$", r"\1", path).strip("\"' ")
    if path.startswith("/"):
        path = path[1:]
    full = os.path.normpath(os.path.join(root, path))
    if full in seen or not full.startswith(root) or not os.path.isfile(full):
        return []
    seen.add(full)
    with open(full, encoding="utf-8", errors="replace") as fh:
        css = fh.read()
    rules = []
    for kind, payload, media in _css_rules(css):
        if kind == "import":
            match = re.search(r"""['"]([^'"]+)['"]""", payload)
            if match:
                rules.extend(_read_sheet(root, match.group(1), seen))
            continue
        rules.append((kind, _decls(payload), media))
    return rules


def _paint(tag, classes, ancestors, rules, width):
    chosen = {}
    ranked = []
    order = 0
    for selector, decls, media in rules:
        if not _media_matches(media, width):
            continue
        for one in selector.split(","):
            one = one.strip()
            if one and _selector_matches(one, tag, classes, ancestors):
                ranked.append((_specificity(one), order, decls))
            order += 1
    for _spec, _order, decls in sorted(ranked):
        chosen.update(decls)
    return chosen


def _box_height(decls):
    height = _px(decls.get("height")) or _px(decls.get("min-height"))
    if height is None:
        return None
    border = _px(decls.get("border-bottom-width"))
    if border is None:
        border = _px(decls.get("border-bottom")) or 0
    padding = (_px(decls.get("padding-top")) or 0) + (_px(decls.get("padding-bottom")) or 0)
    box = (decls.get("box-sizing") or "border-box").lower()
    if box == "border-box":
        return height - border - padding
    return height


def lockup_problems(root, pages):
    problems = []
    cache = {}
    bar_ancestors = []
    mark_ancestors = [("nav", {"official-bar"}), ("span", {"pcg-lockup"})]
    for page in pages:
        rel = os.path.relpath(page, root)
        with open(page, encoding="utf-8", errors="replace") as fh:
            html = fh.read()
        if 'class="official-bar"' not in html and "class='official-bar'" not in html:
            continue
        hrefs = re.findall(r'<link[^>]+href="([^"]+\.css)"', html)
        key = tuple(hrefs)
        if key not in cache:
            rules = []
            seen = set()
            for href in hrefs:
                rules.extend(_read_sheet(root, href, seen))
            cache[key] = rules
        rules = cache[key]
        if not rules:
            problems.append(f"{rel}: top-bar logo stylesheet is missing")
            continue
        for width in LOCKUP_WIDTHS:
            star = _paint("*", set(), [], rules, width)
            bar = _paint("nav", {"official-bar"}, bar_ancestors, rules, width)
            bar = {**star, **bar}
            mark = _paint("img", {"pcg-mark"}, mark_ancestors, rules, width)
            word = _paint("img", {"pcg-wordmark"}, mark_ancestors, rules, width)
            mark_h = _px(mark.get("height"))
            word_h = _px(word.get("height"))
            inner = _box_height(bar)
            where = f"{rel} at {width}px"
            if mark_h is None or word_h is None or inner is None:
                problems.append(f"{where}: top-bar logo size is not set in the shared stylesheet")
                continue
            if mark_h > LOCKUP_MARK_MAX + 0.05:
                problems.append(f"{where}: logo mark is {mark_h}px, above {LOCKUP_MARK_MAX}px")
            if word_h > LOCKUP_WORD_MAX + 0.05:
                problems.append(f"{where}: logo wordmark is {word_h}px tall, above {LOCKUP_WORD_MAX}px")
            gap = (inner - max(mark_h, word_h)) / 2
            if gap <= 0:
                problems.append(f"{where}: logo touches the bar edge (gap {gap:.1f}px)")
    return problems


def _resolve(value, variables, depth=0):
    if not value or depth > 8 or "var(" not in value:
        return value or ""
    def repl(match):
        return variables.get(match.group(1), "")
    return _resolve(re.sub(r"var\(\s*(--[\w-]+)\s*\)", repl, value), variables, depth + 1)


def _px_resolved(value, variables):
    return _px(_resolve(value, variables))


def _contrast(hex_a, hex_b):
    def channel(value):
        value = value / 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

    def lum(color):
        red = int(color[1:3], 16)
        green = int(color[3:5], 16)
        blue = int(color[5:7], 16)
        return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)

    lighter, darker = sorted((lum(hex_a), lum(hex_b)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def _color(value, variables):
    resolved = _resolve(value or "", variables).strip().lower()
    named = {"white": "#ffffff", "black": "#000000", "#fff": "#ffffff"}
    if resolved in named:
        return named[resolved]
    match = re.search(r"#([0-9a-f]{3,8})", resolved)
    if not match:
        return None
    digits = match.group(1)
    if len(digits) == 3:
        digits = "".join(ch * 2 for ch in digits)
    return "#" + digits[:6]


def _sheet_bundle(root, hrefs):
    rules = []
    variables = {}
    seen = set()

    def absorb(href):
        path = href.strip("\"' ").split("?", 1)[0]
        path = re.sub(r"^url\((.*)\)$", r"\1", path).strip("\"' ")
        if path.startswith("/"):
            path = path[1:]
        full = os.path.normpath(os.path.join(root, path))
        if full in seen or not full.startswith(root) or not os.path.isfile(full):
            return
        seen.add(full)
        with open(full, encoding="utf-8", errors="replace") as fh:
            css = fh.read()
        for kind, payload, media in _css_rules(css):
            if kind == "import":
                match = re.search(r"""['"]([^'"]+)['"]""", payload)
                if match:
                    absorb(match.group(1))
                continue
            decls = _decls(payload)
            if kind.strip() == ":root":
                for prop, raw in decls.items():
                    if prop.startswith("--"):
                        variables[prop] = raw
            rules.append((kind, decls, media))

    for href in hrefs:
        absorb(href)
    return rules, variables


def _padding_parts(value):
    parts = []
    buf = []
    depth = 0
    for ch in value:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch.isspace() and depth == 0:
            if buf:
                parts.append("".join(buf))
                buf = []
            continue
        buf.append(ch)
    if buf:
        parts.append("".join(buf))
    return parts


def _padding_left(decls, variables):
    for prop in ("padding-left", "padding-inline"):
        if prop in decls:
            return _px_resolved(decls[prop], variables)
    parts = _padding_parts(_resolve(decls.get("padding", ""), variables))
    if len(parts) == 1:
        return _px(parts[0])
    if len(parts) in (2, 3):
        return _px(parts[1])
    if len(parts) >= 4:
        return _px(parts[3])
    return None


def layout_problems(root, pages):
    problems = []
    cache = {}
    checks = [
        ("a", {"button"}, [("article", {"prose"})], "button"),
        ("a", {"give-button"}, [], "Give"),
        ("a", set(), [("article", {"prose"})], "article link"),
        ("a", set(), [("footer", {"site-footer"})], "footer link"),
    ]
    for page in pages:
        rel = os.path.relpath(page, root)
        with open(page, encoding="utf-8", errors="replace") as fh:
            html = fh.read()
        if 'class="button"' in html:
            for match in re.finditer(r'<a class="([^"]*\bbutton\b[^"]*)"[^>]*>(.*?)</a>', html, flags=re.S):
                text = re.sub(r"<[^>]+>", "", match.group(2))
                text = re.sub(r"\s+", " ", text).strip()
                if not text:
                    problems.append(f"{rel}: .button has no visible text")
        hrefs = re.findall(r'<link[^>]+href="([^"]+\.css)"', html)
        key = tuple(hrefs)
        if key not in cache:
            cache[key] = _sheet_bundle(root, hrefs)
        rules, _unused = cache[key]
        for width in LOCKUP_WIDTHS:
            variables = {}
            for selector, decls, media in rules:
                if selector.strip() == ":root" and _media_matches(media, width):
                    for prop, raw in decls.items():
                        if prop.startswith("--"):
                            variables[prop] = raw
            button = _paint("a", {"button"}, [("article", {"prose"})], rules, width)
            color = _color(button.get("color"), variables)
            background = _color(button.get("background") or button.get("background-color"), variables)
            if color and background and color == background:
                problems.append(f"{rel} at {width}px: .button text {color} matches its background")
            if color and background and _contrast(color, background) < 4.5:
                problems.append(f"{rel} at {width}px: .button contrast {_contrast(color, background):.2f} is below 4.5")
            link = _paint("a", set(), [("article", {"prose"})], rules, width)
            link_color = _color(link.get("color"), variables)
            if link_color and _contrast(link_color, "#ffffff") < 4.5:
                problems.append(f"{rel} at {width}px: article link contrast {_contrast(link_color, '#ffffff'):.2f} is below 4.5")
            sign_in = _paint("a", {"official-bar-sign-in"}, [("nav", {"official-bar"})], rules, width)
            wrap = (sign_in.get("white-space") or "").lower()
            if wrap != "nowrap":
                problems.append(f"{rel} at {width}px: Portal sign-in can wrap")
            if width >= 820:
                banner = _paint("header", {"site-banner"}, [], rules, width)
                nav = _paint("nav", {"banner-nav"}, [("header", {"site-banner"})], rules, width)
                if (banner.get("flex-wrap") or "").lower() == "wrap":
                    problems.append(f"{rel} at {width}px: header row wraps")
                if (nav.get("flex-wrap") or "").lower() == "wrap":
                    problems.append(f"{rel} at {width}px: header nav wraps")
            bar = _paint("nav", {"official-bar"}, [], rules, width)
            banner = _paint("header", {"site-banner"}, [], rules, width)
            footer = _paint("footer", {"site-footer"}, [], rules, width)
            if not _padding_left(footer, variables):
                footer = _paint("footer", {"footer"}, [], rules, width)
            content = _paint("header", {"masthead"}, [], rules, width)
            if _padding_left(content, variables) is None:
                content = _paint("div", {"content"}, [], rules, width)
            edges = [
                _padding_left(bar, variables),
                _padding_left(banner, variables),
                _padding_left(footer, variables),
                _padding_left(content, variables),
            ]
            edges = [edge for edge in edges if edge is not None]
            if len(edges) >= 2 and max(edges) - min(edges) > 0.6:
                problems.append(f"{rel} at {width}px: gutter misaligned {edges}")
    return problems


def _length_px(value, variables, root_px=16.0):
    resolved = _resolve(value or "", variables).strip().lower()
    match = re.match(r"^(-?\d+(?:\.\d+)?)(px|rem)$", resolved)
    if not match:
        return _px(resolved)
    number = float(match.group(1))
    return number * root_px if match.group(2) == "rem" else number


def _unitless(value, variables):
    resolved = _resolve(value or "", variables).strip().lower()
    match = re.match(r"^(-?\d+(?:\.\d+)?)$", resolved)
    return float(match.group(1)) if match else None


def visible_text(html):
    cleaned = re.sub(r"<(script|style|noscript)\b[^>]*>.*?</\1>", " ", html, flags=re.I | re.S)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = html_unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def text_problems(root, pages):
    baseline_path = os.path.join(root, ".github", "visible-text.txt")
    if not os.path.isfile(baseline_path):
        return ["visible text baseline is missing"]
    expected = {}
    with open(baseline_path, encoding="utf-8") as fh:
        for line in fh:
            rel, _, text = line.rstrip("\n").partition("\t")
            if rel:
                expected[rel] = text
    problems = []
    seen = set()
    for page in pages:
        rel = os.path.relpath(page, root)
        seen.add(rel)
        with open(page, encoding="utf-8", errors="replace") as fh:
            current = visible_text(fh.read())
        if rel not in expected:
            problems.append(f"{rel}: visible text has no baseline")
        elif current != expected[rel]:
            problems.append(f"{rel}: visible text changed")
    for rel in sorted(set(expected) - seen):
        problems.append(f"{rel}: page missing from the visible text check")
    return problems


def scale_problems(root, pages):
    problems = []
    cache = {}
    for page in pages:
        rel = os.path.relpath(page, root)
        with open(page, encoding="utf-8", errors="replace") as fh:
            html = fh.read()
        hrefs = re.findall(r'<link[^>]+href="([^"]+\.css)"', html)
        key = tuple(hrefs)
        if key not in cache:
            cache[key] = _sheet_bundle(root, hrefs)
        rules, _unused = cache[key]
        home = "home.css" in " ".join(hrefs)
        for width in LOCKUP_WIDTHS:
            variables = {}
            for selector, decls, media in rules:
                if selector.strip() == ":root" and _media_matches(media, width):
                    for prop, raw in decls.items():
                        if prop.startswith("--"):
                            variables[prop] = raw
            body = _paint("body", set(), [], rules, width)
            body_size = _length_px(body.get("font-size"), variables)
            leading = _unitless(body.get("line-height"), variables)
            where = f"{rel} at {width}px"
            if body_size is None or abs(body_size - 18) > 0.2:
                problems.append(f"{where}: body text is not the 18px scale")
            if leading is None or abs(leading - 1.65) > 0.01:
                problems.append(f"{where}: body line-height is not 1.65")
            if home:
                heading = _paint("h1", set(), [], rules, width)
                section = _paint("section", {"vision-section"}, [], rules, width)
                expected = _length_px("var(--size-display)", variables)
            else:
                heading = _paint("h1", set(), [("header", {"masthead"})], rules, width)
                section = _paint("header", {"masthead"}, [], rules, width)
                expected = _length_px("var(--size-h1)", variables)
            actual = _length_px(heading.get("font-size"), variables)
            if expected is None or actual is None or abs(actual - expected) > 0.2:
                problems.append(f"{where}: heading is off the shared scale")
            space = _length_px("var(--space-section)", variables)
            padding = _padding_parts(_resolve(section.get("padding", ""), variables))
            top = _length_px(padding[0], variables) if padding else None
            if space is None or top is None or abs(top - space) > 0.2:
                problems.append(f"{where}: section spacing is off the shared scale")
    return problems


def figure_problems(root, pages):
    wanted = {
        "enroll/index.html": "img",
        "apply/index.html": "img",
        "about/index.html": "img",
        "courses/index.html": "img",
        "es/enroll/index.html": "img",
        "pt/apply/index.html": "img",
        "about/karl-hargestam/index.html": "placeholder",
        "privacy/index.html": "placeholder",
        "terms/index.html": "placeholder",
        "copyright/index.html": "placeholder",
    }
    problems = []
    have = {}
    for page in pages:
        rel = os.path.relpath(page, root)
        with open(page, encoding="utf-8", errors="replace") as fh:
            html = fh.read()
        have[rel] = html
    for rel, kind in wanted.items():
        html = have.get(rel, "")
        if 'class="page-split"' not in html:
            problems.append(f"{rel}: inner page is still a single left column")
        elif kind == "img" and "<img" not in html.split('class="page-figure"', 1)[-1][:400]:
            problems.append(f"{rel}: missing the page image")
        elif kind == "placeholder" and "is-placeholder" not in html:
            problems.append(f"{rel}: missing the marked image placeholder")
    return problems


def polish_problems(root):
    problems = []
    course = open(os.path.join(root, "assets/css/course.css"), encoding="utf-8").read()
    base = open(os.path.join(root, "assets/css/base.css"), encoding="utf-8").read()
    if ".catalog-card:focus-visible" not in course:
        problems.append("course cards have no visible focus state")
    if ".button:focus-visible" not in course and ".button:focus-visible" not in base:
        problems.append("buttons have no visible focus state")
    if ".site-footer a:focus-visible" not in base:
        problems.append("footer links have no visible focus state")
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

    errors.extend(lockup_problems(root, pages))
    errors.extend(layout_problems(root, pages))
    errors.extend(scale_problems(root, pages))
    errors.extend(text_problems(root, pages))
    errors.extend(figure_problems(root, pages))
    errors.extend(polish_problems(root))
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
