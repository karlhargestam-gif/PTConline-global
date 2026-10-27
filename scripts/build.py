#!/usr/bin/env python3
"""Build the static EN/ES/PT site from content/*.json and src/partials.

Usage (from the repository root):
  python3 scripts/build.py
  python3 scripts/build.py --check

--check exits 1 when a generated file would change. It does not write.
"""

import argparse
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARTIALS = ROOT / "src" / "partials"
CONTENT = ROOT / "content"
LANGS = ("en", "es", "pt")
SITE_SUFFIX = {
    "en": "Pentecostal Theological Consortium",
    "es": "Consorcio Teológico Pentecostal",
    "pt": "Consórcio Teológico Pentecostal",
}
ORIENTATION = "ocbeb795lqkazli"
ORIENTATION_TRACK = {
    "src": "/assets/orientation_pt.vtt",
    "srclang": "pt",
    "label": "Português",
}

LENGTH_OVERRIDE = {
    "practicum": {
        "en": "Overseas practicum",
        "es": "Práctica en el extranjero",
        "pt": "Estágio no exterior",
    },
    "level2": {"en": "Level 2 track", "es": "Vía de nivel 2", "pt": "Trilha de nível 2"},
}


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def esc(value):
    return html.escape(value or "", quote=True)


def fill(template, mapping):
    def replace(match):
        key = match.group(1)
        if key not in mapping:
            raise KeyError(key)
        return mapping[key]

    return re.sub(r"\{\{([a-z0-9_]+)\}\}", replace, template)


def prefix(lang):
    return "" if lang == "en" else f"/{lang}"


def href_for(lang, route):
    """Public link with a trailing slash. route has no leading or trailing slash."""
    base = prefix(lang)
    if not route:
        return base + "/" if base else "/"
    return f"{base}/{route}/"


def canonical_for(site, lang, route):
    base = prefix(lang)
    if not route:
        return site["host"] + (base or "") + ("/" if not base else "")
    return site["host"] + base + "/" + route


def file_size(href):
    if not href or not href.startswith("/assets/"):
        return ""
    path = ROOT / href.lstrip("/")
    if not path.is_file():
        raise SystemExit(f"missing asset {href}")
    size = path.stat().st_size
    if size < 1024 * 1024:
        return f"{max(1, round(size / 1024))} KB"
    mb = size / (1024 * 1024)
    return f"{mb:.0f} MB" if mb >= 10 else f"{mb:.1f} MB"


def external(href):
    return href.startswith("http://") or href.startswith("https://")


def anchor_attrs(href):
    if external(href) or href.lower().endswith(".pdf"):
        return ' target="_blank" rel="noopener noreferrer"'
    return ""


class Site:
    def __init__(self, check):
        self.check = check
        self.errors = []
        self.site = load_json(CONTENT / "site.json")
        self.pages = load_json(CONTENT / "pages.json")
        self.meta = load_json(CONTENT / "meta.json")["routes"]
        self.courses = []
        for path in sorted((CONTENT / "courses").glob("*.json")):
            self.courses.append(load_json(path))
        self.courses.sort(key=lambda course: (course["provider"], course["order"]))
        self.head = (PARTIALS / "head.tpl").read_text(encoding="utf-8")
        self.banner_t = (PARTIALS / "banner.tpl").read_text(encoding="utf-8")
        self.banner_home_t = (PARTIALS / "banner-home.tpl").read_text(encoding="utf-8")
        self.footer_t = (PARTIALS / "footer.tpl").read_text(encoding="utf-8")
        self.footer_home_t = (PARTIALS / "footer-home.tpl").read_text(encoding="utf-8")
        self.week_t = (PARTIALS / "week.tpl").read_text(encoding="utf-8")
        self.ui = self.site["ui"]

    def emit(self, rel, text):
        if not text.endswith("\n"):
            text += "\n"
        path = ROOT / rel
        if self.check:
            current = path.read_text(encoding="utf-8") if path.exists() else None
            if current != text:
                self.errors.append(rel)
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def t(self, node, lang):
        if isinstance(node, dict) and lang in node:
            return node[lang]
        return node

    def provider_name(self, provider, lang):
        key = "moeName" if provider == "moe" else "messengerName"
        return self.ui[key][lang]

    def lang_links(self, lang, route):
        parts = []
        for code in LANGS:
            current = ' aria-current="true"' if code == lang else ""
            parts.append(
                f'<a href="{href_for(code, route)}" hreflang="{code}"{current}>{code.upper()}</a>'
            )
        return "".join(parts)

    def flame_src(self, lang, home):
        if home and lang == "en":
            return "assets/pcg-flame-96.webp"
        return "/assets/pcg-flame-96.webp"

    def banner(self, lang, route, home=False):
        mapping = {
            "home_href": href_for(lang, ""),
            "name": esc(self.ui["bannerName"][lang]),
            "flame_src": self.flame_src(lang, home),
            "flame_alt": esc(self.ui["flameAlt"][lang]),
            "nav_label": esc(self.ui["navLabel"][lang]),
            "courses_href": href_for(lang, "courses"),
            "courses_label": esc(self.ui["courses"][lang]),
            "home_label": esc(self.ui["home"][lang]),
            "pcg_url": esc(self.site["pcgUrl"]),
            "pcg_label": esc(self.ui["pcg"][lang]),
            "lang_switch": self.lang_links(lang, route),
        }
        template = self.banner_home_t if home else self.banner_t
        return fill(template, mapping).rstrip("\n")

    def footer(self, lang, home=False):
        note_key = "homeFooterNote" if home else "courseFooterNote"
        label_key = "homeFooterLabel" if home else "courseFooterLabel"
        template = self.footer_home_t if home else self.footer_t
        return fill(
            template,
            {
                "note": esc(self.ui[note_key][lang]),
                "label": esc(self.ui[label_key][lang]),
                "global_education_url": esc(self.site["globalEducationUrl"]),
                "global_education": esc(self.ui["globalEducation"][lang]),
                "pcg_url": esc(self.site["pcgUrl"]),
                "pcg": esc(self.ui["pcg"][lang]),
            },
        ).rstrip("\n")

    def hreflang(self, route):
        lines = []
        for lang in LANGS:
            lines.append(
                f'<link rel="alternate" hreflang="{lang}" href="{canonical_for(self.site, lang, route)}">'
            )
        lines.append(
            f'<link rel="alternate" hreflang="x-default" href="{canonical_for(self.site, "en", route)}">'
        )
        return "\n".join(lines)

    def jsonld(self, kind, lang, route, title, description, extra=None):
        url = canonical_for(self.site, lang, route)
        if kind == "course":
            data = extra
        else:
            data = {
                "@context": "https://schema.org",
                "@type": "WebPage",
                "@id": url + "#webpage",
                "url": url,
                "name": title,
                "description": description,
                "inLanguage": lang,
                "isPartOf": {"@id": self.site["host"] + "/#website"},
                "publisher": {"@id": self.site["host"] + "/#organization"},
            }
        out = '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"
        crumbs = self.breadcrumbs(lang, route, title)
        if crumbs:
            out += '\n<script type="application/ld+json">' + json.dumps(crumbs, ensure_ascii=False) + "</script>"
        return out

    def breadcrumbs(self, lang, route, title):
        """BreadcrumbList for every page below the home page."""
        if not route:
            return None
        trail = [(self.ui["home"][lang], canonical_for(self.site, lang, ""))]
        parts = route.split("/")
        for i in range(1, len(parts)):
            parent = "/".join(parts[:i])
            label = self.ui["courses"][lang] if parent == "courses" else self.ui["about"][lang] if parent == "about" else parent
            trail.append((label, canonical_for(self.site, lang, parent)))
        trail.append((title, canonical_for(self.site, lang, route)))
        return {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": i, "name": name, "item": url}
                for i, (name, url) in enumerate(trail, 1)
            ],
        }

    def meta_description(self, lang, route, description):
        """Search snippet for the head tags. Visible text keeps the full description."""
        return self.meta.get(route, {}).get(lang) or description

    def document(self, lang, route, title, description, body, jsonld, main_class):
        full_title = title if title.endswith(SITE_SUFFIX[lang]) else f"{title} | {SITE_SUFFIX[lang]}"
        description = self.meta_description(lang, route, description)
        head = fill(
            self.head,
            {
                "title": esc(full_title),
                "description": esc(description),
                "canonical": canonical_for(self.site, lang, route),
                "og_image": self.site["ogImage"],
                "og_alt": esc(self.site["ogAlt"][lang]),
                "og_locale": self.site["locale"][lang],
                "hreflang": self.hreflang(route),
                "jsonld": jsonld,
            },
        )
        return (
            f'<!doctype html>\n<html lang="{lang}">\n<head>\n{head}\n</head>\n<body>\n'
            f'<a class="skip-link" href="#main">{esc(self.ui["skip"][lang])}</a>\n'
            f"{self.banner(lang, route)}\n"
            f'<main id="main" class="{main_class}">\n{body}\n</main>\n'
            f"{self.footer(lang)}\n</body>\n</html>\n"
        )

    def out_path(self, lang, route):
        parts = [] if lang == "en" else [lang]
        if route:
            parts.extend(route.split("/"))
        parts.append("index.html")
        return "/".join(parts)

    def label_for(self, item, lang, size):
        name = self.ui["labels"][item["kind"]][lang]
        extra = []
        fmt = item.get("format") or ""
        if fmt:
            extra.append(fmt)
        if size:
            extra.append(size)
        if extra:
            return f"{name} ({', '.join(extra)})"
        return name

    def render_item(self, item, lang):
        title = item["title"][lang]
        href = item.get("href") or ""
        src = item.get("src") or ""
        if src and ORIENTATION in src:
            tracks = list(item.get("tracks") or [])
            if not any(track["src"] == ORIENTATION_TRACK["src"] for track in tracks):
                tracks.append(ORIENTATION_TRACK)
        else:
            tracks = item.get("tracks") or []
        size = file_size(href) if href.startswith("/assets/") else ""
        label = self.label_for(item, lang, size)
        bits = [f"<strong>{esc(label)}:</strong> "]
        if item.get("status") == "unavailable":
            bits.append(f'<span class="unavailable">{esc(self.ui["unavailable"][lang])}</span>')
            body = f"<p>{''.join(bits)}</p>"
        elif src:
            track_html = "".join(
                f'<track kind="subtitles" src="{esc(track["src"])}" srclang="{esc(track["srclang"])}" label="{esc(track["label"])}">'
                for track in tracks
            )
            body = (
                f"<p>{''.join(bits)}{esc(title)}</p>"
                f'<video src="{esc(src)}" controls preload="metadata">{track_html}</video>'
            )
        elif href:
            bits.append(f'<a href="{esc(href)}"{anchor_attrs(href)}>{esc(title)}</a>')
            body = f"<p>{''.join(bits)}</p>"
        else:
            bits.append(esc(title))
            if item["kind"] in ("assignment", "discussion", "quiz"):
                bits.append(f' <span class="where">{esc(self.ui["inCanvas"][lang])}</span>')
            elif item["kind"] != "note":
                bits.append(f' <span class="where">{esc(self.ui["notPosted"][lang])}</span>')
            body = f"<p>{''.join(bits)}</p>"
        text = (item.get("text") or {}).get(lang)
        if text:
            body += f'\n<p class="note-text">{esc(text)}</p>'
        return f"<li>\n{body}\n</li>"

    def render_block(self, block, lang, index):
        if block["kind"] == "week":
            word = self.ui["week"][lang]
            title = block["title"][lang]
            heading = f"{word} {block['n']}: {title}" if title else f"{word} {block['n']}"
            kicker = f'<p class="kicker">{esc(word)} {block["n"]}</p>'
            anchor = f"week-{block['n']}"
        else:
            heading = block["title"][lang]
            kicker = ""
            anchor = f"section-{index}"
        if block["items"]:
            items = "\n".join(self.render_item(item, lang) for item in block["items"])
            body = f'<ul class="resources">\n{items}\n</ul>'
        else:
            body = f'<p class="hint">{esc(self.ui["emptySection"][lang])}</p>'
        return fill(
            self.week_t,
            {"anchor": anchor, "kicker": kicker, "heading": esc(heading), "body": body},
        )

    def course_schema(self, course, lang, route):
        url = canonical_for(self.site, lang, route)
        provider = "Mission One Eleven" if course["provider"] == "moe" else "Messenger College"
        provider_url = self.site["moeUrl"] if course["provider"] == "moe" else self.site["messengerUrl"]
        data = {
            "@context": "https://schema.org",
            "@type": "Course",
            "@id": url + "#course",
            "url": url,
            "name": course["title"][lang],
            "description": course["description"][lang],
            "inLanguage": "en",
            "provider": {"@type": "Organization", "name": provider, "url": provider_url},
            "isAccessibleForFree": not course.get("locked", False),
            "publisher": {"@id": self.site["host"] + "/#organization"},
        }
        return self.jsonld("course", lang, route, course["title"][lang], course["description"][lang], data)

    def length_text(self, course, lang):
        if course["id"] in LENGTH_OVERRIDE:
            return LENGTH_OVERRIDE[course["id"]][lang]
        if course.get("weeks"):
            return f'{course["weeks"]} {self.ui["weeks"][lang]}'
        return course["level"][lang]

    def render_course(self, course, lang):
        route = f"courses/{course['id']}"
        title = course["title"][lang]
        description = course["description"][lang]
        if course.get("locked"):
            body = f'''<header class="masthead">
  <p class="kicker">{esc(self.provider_name(course["provider"], lang))}</p>
  <h1>{esc(title)}</h1>
  <p class="teachers">{esc(course.get("teachers", ""))}</p>
  <p class="lead">{esc(description)}</p>
  <dl class="course-meta">
    <div><dt>{esc(self.ui["provider"][lang])}</dt><dd>{esc(self.provider_name(course["provider"], lang))}</dd></div>
    <div><dt>{esc(self.ui["level"][lang])}</dt><dd>{esc(course["level"][lang])}</dd></div>
    <div><dt>{esc(self.ui["language"][lang])}</dt><dd>{esc(course["teachingLanguage"][lang])}</dd></div>
  </dl>
  <div class="notice" role="note"><p>{esc(self.site["lockNotice"][lang])}</p></div>
  <div class="actions">
    <a class="button" href="{esc(self.site["messengerApplyUrl"])}" target="_blank" rel="noopener noreferrer">{esc(self.ui["applyMessenger"][lang])}</a>
  </div>
</header>'''
        else:
            banner = ""
            if course["provider"] == "moe":
                banner = '''<div class="banner">
  <img src="/assets/moe/MOE_logo_white_official.png" alt="Mission One Eleven">
</div>'''
            blocks = "\n".join(self.render_block(block, lang, index) for index, block in enumerate(course["blocks"]))
            canvas = ""
            if course.get("canvas"):
                canvas = f'<a class="button" href="{esc(course["canvas"])}" target="_blank" rel="noopener noreferrer">{esc(self.ui["openCanvas"][lang])}</a>'
            body = f'''{banner}
<header class="masthead">
  <p class="kicker">{esc(self.provider_name(course["provider"], lang))}</p>
  <h1>{esc(title)}</h1>
  <p class="lead">{esc(description)}</p>
  <dl class="course-meta">
    <div><dt>{esc(self.ui["provider"][lang])}</dt><dd>{esc(self.provider_name(course["provider"], lang))}</dd></div>
    <div><dt>{esc(self.ui["length"][lang])}</dt><dd>{esc(self.length_text(course, lang))}</dd></div>
    <div><dt>{esc(self.ui["language"][lang])}</dt><dd>{esc(course["teachingLanguage"][lang])}</dd></div>
    <div><dt>{esc(self.ui["level"][lang])}</dt><dd>{esc(course["level"][lang])}</dd></div>
  </dl>
  <div class="actions">
    {canvas}
    <a class="button secondary" href="{href_for(lang, "enroll")}">{esc(self.ui["howEnroll"][lang])}</a>
  </div>
</header>
<div class="course">
{blocks}
</div>'''
        page = self.document(
            lang,
            route,
            title,
            description,
            body,
            self.course_schema(course, lang, route),
            "course-page",
        )
        self.emit(self.out_path(lang, route), page)

    def card(self, course, lang, level=3):
        route = f"courses/{course['id']}"
        bits = []
        if course.get("locked"):
            bits.append(f'<span class="lock-badge">{esc(self.ui["locked"][lang])}</span>')
        bits.append(f'<h{level}>{esc(course["title"][lang])}</h{level}>')
        if course.get("teachers"):
            bits.append(f'<p class="teachers">{esc(course["teachers"])}</p>')
        bits.append(f'<p>{esc(course["description"][lang])}</p>')
        meta = [
            self.provider_name(course["provider"], lang),
            self.length_text(course, lang),
            course["teachingLanguage"][lang],
            course["level"][lang],
        ]
        bits.append("<ul class=\"card-meta\">" + "".join(f"<li>{esc(item)}</li>" for item in meta) + "</ul>")
        return f'<a class="catalog-card" href="{href_for(lang, route)}">\n' + "\n".join(bits) + "\n</a>"

    def render_catalog(self, lang):
        moe = [course for course in self.courses if course["provider"] == "moe"]
        messenger = [course for course in self.courses if course["provider"] == "messenger"]
        moe_cards = "\n".join(self.card(course, lang) for course in moe)
        messenger_cards = "\n".join(self.card(course, lang) for course in messenger)
        body = f'''<header class="masthead">
  <p class="kicker">PTC</p>
  <h1>{esc(self.ui["catalogTitle"][lang])}</h1>
  <p class="lead">{esc(self.ui["catalogLead"][lang])}</p>
</header>
<div class="catalog">
  <section class="provider-block" aria-labelledby="moe-heading">
    <img class="provider-logo" src="/assets/moe/MOE_logo_red_official.png" alt="Mission One Eleven">
    <h2 id="moe-heading">{esc(self.ui["moeName"][lang])}</h2>
    <p class="lead">{esc(self.ui["moeLead"][lang])}</p>
    <div class="catalog-grid">
      {moe_cards}
    </div>
    <div class="actions">
      <a class="button" href="{esc(self.site["moeEnrollUrl"])}" target="_blank" rel="noopener noreferrer">{esc(self.ui["applyMoe"][lang])}</a>
    </div>
    <p class="hint">{esc(self.ui["moePanel"][lang])}</p>
  </section>
  <section class="provider-block" aria-labelledby="messenger-heading">
    <h2 id="messenger-heading">{esc(self.ui["messengerName"][lang])}</h2>
    <p class="lead">{esc(self.ui["messengerLead"][lang])}</p>
    <div class="catalog-grid">
      {messenger_cards}
    </div>
    <div class="actions">
      <a class="button secondary" href="{href_for(lang, "courses/messenger")}">{esc(self.ui["messengerCatalogTitle"][lang])}</a>
      <a class="button" href="{esc(self.site["messengerApplyUrl"])}" target="_blank" rel="noopener noreferrer">{esc(self.ui["applyMessenger"][lang])}</a>
    </div>
  </section>
</div>'''
        title = self.ui["catalogTitle"][lang]
        description = self.ui["catalogLead"][lang]
        page = self.document(
            lang, "courses", title, description, body,
            self.jsonld("page", lang, "courses", title, description),
            "catalog-page",
        )
        self.emit(self.out_path(lang, "courses"), page)

    def render_messenger(self, lang):
        messenger = [course for course in self.courses if course["provider"] == "messenger"]
        cards = "\n".join(self.card(course, lang, level=2) for course in messenger)
        title = self.ui["messengerCatalogTitle"][lang]
        description = self.ui["messengerCatalogLead"][lang]
        body = f'''<header class="masthead">
  <p class="kicker">{esc(self.ui["locked"][lang])}</p>
  <h1>{esc(title)}</h1>
  <p class="lead">{esc(description)}</p>
  <div class="notice" role="note"><p>{esc(self.site["lockNotice"][lang])}</p></div>
  <div class="actions">
    <a class="button" href="{esc(self.site["messengerApplyUrl"])}" target="_blank" rel="noopener noreferrer">{esc(self.ui["applyMessenger"][lang])}</a>
  </div>
</header>
<div class="catalog">
  <div class="catalog-grid">
    {cards}
  </div>
</div>'''
        page = self.document(
            lang, "courses/messenger", title, description, body,
            self.jsonld("page", lang, "courses/messenger", title, description),
            "catalog-page",
        )
        self.emit(self.out_path(lang, "courses/messenger"), page)

    def person_node(self, description):
        host = self.site["host"]
        return {
            "@type": "Person",
            "@id": host + "/about/karl-hargestam#person",
            "name": "Karl Hargestam",
            "jobTitle": "Global Missions Director",
            "description": description,
            "worksFor": {
                "@type": "Organization",
                "name": "Pentecostal Church of God",
                "alternateName": "PCG",
                "url": "https://www.pcg.org/",
            },
            "affiliation": {
                "@type": "EducationalOrganization",
                "name": "Pentecostal Theological Consortium",
                "alternateName": "PTC",
                "url": host + "/",
            },
            "url": canonical_for(self.site, "en", "about/karl-hargestam"),
            "sameAs": [
                "https://pcgmission.org",
                "https://www.pcg.org/about/leadership",
                "https://about.me/hargestam",
                "https://karlhargestam.com",
            ],
        }

    def render_prose(self, page_id, lang):
        page = self.pages[page_id]
        title = page["title"][lang]
        description = page["description"][lang]
        sections = []
        for section in page["sections"]:
            paras = "".join(f"<p>{esc(paragraph)}</p>" for paragraph in section["paragraphs"][lang])
            links = ""
            if section.get("links"):
                rendered = []
                for link in section["links"]:
                    href = link["href"]
                    if link.get("internal"):
                        route = href.strip("/")
                        if lang != "en":
                            href = f"/{lang}/{route}/"
                        else:
                            href = f"/{route}/"
                    rendered.append(
                        f'<li><a href="{esc(href)}"{anchor_attrs(href)}>{esc(link["label"][lang])}</a></li>'
                    )
                links = "<ul>" + "".join(rendered) + "</ul>"
            extra = ""
            if page_id == "copyright" and section["heading"]["en"] == "Course files":
                extra = self.hosted_files(lang)
            sections.append(f"<h2>{esc(section['heading'][lang])}</h2>{paras}{links}{extra}")
        lead = "" if page.get("lead") is False else f"<p class=\"lead\">{esc(description)}</p>"
        body = f'''<header class="masthead"><p class="kicker">PTC</p><h1>{esc(title)}</h1>{lead}</header>
<article class="prose catalog">
{''.join(sections)}
</article>'''
        if page.get("schema") == "person":
            url = canonical_for(self.site, lang, page_id)
            person = self.person_node(description)
            data = {
                "@context": "https://schema.org",
                "@graph": [
                    person,
                    {
                        "@type": "ProfilePage",
                        "@id": url + "#webpage",
                        "url": url,
                        "name": title,
                        "description": description,
                        "inLanguage": lang,
                        "isPartOf": {"@id": self.site["host"] + "/#website"},
                        "mainEntity": {"@id": person["@id"]},
                    },
                ],
            }
            linked_data = '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"
            crumbs = self.breadcrumbs(lang, page_id, title)
            if crumbs:
                linked_data += '\n<script type="application/ld+json">' + json.dumps(crumbs, ensure_ascii=False) + "</script>"
        else:
            linked_data = self.jsonld("page", lang, page_id, title, description)
        html_page = self.document(
            lang, page_id, title, description, body,
            linked_data,
            "prose-page",
        )
        self.emit(self.out_path(lang, page_id), html_page)

    def hosted_files(self, lang):
        seen = []
        for course in self.courses:
            if course.get("locked"):
                continue
            for block in course["blocks"]:
                for item in block["items"]:
                    href = item.get("href") or ""
                    if href.startswith("/assets/") and href not in [row[0] for row in seen]:
                        seen.append((href, item["title"]["en"], file_size(href)))
        items = "".join(
            f"<li><a href=\"{esc(href)}\"{anchor_attrs(href)}>{esc(title)}</a> <span class=\"file-size\">({esc(size)})</span></li>"
            for href, title, size in seen
        )
        return f'<ul class="file-list">{items}</ul>'

    def sitemap(self):
        routes = ["", "courses", "courses/messenger", "about", "about/karl-hargestam", "contact", "enroll", "privacy", "terms", "copyright"]
        routes.extend(f"courses/{course['id']}" for course in self.courses)
        urls = []
        for route in routes:
            for lang in LANGS:
                loc = canonical_for(self.site, lang, route)
                alternates = "".join(
                    f'<xhtml:link rel="alternate" hreflang="{code}" href="{canonical_for(self.site, code, route)}"/>'
                    for code in LANGS
                )
                alternates += f'<xhtml:link rel="alternate" hreflang="x-default" href="{canonical_for(self.site, "en", route)}"/>'
                urls.append(
                    f"  <url><loc>{loc}</loc><lastmod>{LASTMOD}</lastmod>{alternates}</url>"
                )
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + "\n".join(urls)
            + "\n</urlset>\n"
        )
        self.emit("sitemap.xml", xml)

    def patch_home(self, lang):
        rel = "index.html" if lang == "en" else f"{lang}/index.html"
        text = (ROOT / rel).read_text(encoding="utf-8")
        text = re.sub(
            r'\s*<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*'
            r'<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\s*'
            r'<link href="https://fonts\.googleapis\.com/css2\?[^"]+" rel="stylesheet">',
            '\n    <link rel="stylesheet" href="/assets/css/fonts.css">\n    <link rel="stylesheet" href="/assets/css/home.css">',
            text,
            count=1,
        )
        text = re.sub(r"\s*<style>.*?</style>", "", text, count=1, flags=re.S)
        if 'rel="stylesheet" href="/assets/css/fonts.css"' not in text:
            raise SystemExit(f"{rel}: font stylesheet missing")
        if "hreflang=\"x-default\"" not in text:
            text = text.replace(
                '<link rel="alternate" hreflang="pt" href="https://ptconline.global/pt">',
                '<link rel="alternate" hreflang="pt" href="https://ptconline.global/pt">'
                '<link rel="alternate" hreflang="x-default" href="https://ptconline.global/">',
                1,
            )
        if 'property="og:locale"' not in text:
            locale = self.site["locale"][lang]
            text = text.replace(
                '<meta property="og:type" content="website">',
                f'<meta property="og:type" content="website">\n    <meta property="og:locale" content="{locale}">',
                1,
            )
        if 'class="skip-link"' not in text:
            text = text.replace(
                "<body>\n",
                f'<body>\n    <a class="skip-link" href="#content">{esc(self.ui["skip"][lang])}</a>\n',
                1,
            )
        if 'id="content"' not in text:
            text = text.replace('<div class="content"', '<div class="content" id="content"', 1)
        banner = self.banner(lang, "", home=True)
        if not re.search(r'<header class="site-banner">', text):
            raise SystemExit(f"{rel}: site banner missing")
        text = re.sub(
            r"[ \t]*<header class=\"site-banner\">.*?</header>",
            banner,
            text,
            count=1,
            flags=re.S,
        )
        footer = self.footer(lang, home=True)
        text = re.sub(
            r"[ \t]*<footer class=\"footer\">.*?</footer>",
            footer,
            text,
            count=1,
            flags=re.S,
        )
        self.emit(rel, text)

    def build(self):
        for course in self.courses:
            for lang in LANGS:
                self.render_course(course, lang)
        for lang in LANGS:
            self.render_catalog(lang)
            self.render_messenger(lang)
            for page_id in self.pages:
                self.render_prose(page_id, lang)
            self.patch_home(lang)
        self.sitemap()
        if self.errors:
            print("Generated files differ from the working tree:")
            for rel in self.errors:
                print(f"  {rel}")
            raise SystemExit(1)
        if not self.check:
            print(f"Built {len(self.courses)} courses × {len(LANGS)} languages, plus catalog, messenger, prose and home pages.")


LASTMOD = "2026-10-26"  # bump when generated pages change


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    Site(check=args.check).build()


if __name__ == "__main__":
    main()
