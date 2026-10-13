#!/usr/bin/env python3
"""One-time migration: read the legacy course HTML into content/courses/*.json.

Run from the repository root before scripts/build.py replaces those pages.
After the JSON exists, edit the JSON. Do not re-run this script against
generated pages.
"""

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "es", "pt")
IDS = [
    "missiology",
    "orality",
    "formation",
    "acts",
    "mentoring",
    "practicum",
    "level2",
]

WEEK_HEAD = re.compile(
    r"^(?:Week|Semana)\s+(\d+)\s*(?:[-:–—]\s*(.*))?$",
    re.I,
)
MENTOR_ITEM = re.compile(
    r"^(?:Mentoring Week|Mentoreo\s*-\s*Semana|Mentoria\s*-\s*Semana)\s+(\d+)$",
    re.I,
)

# Visible titles that are still file names. Human titles, same in every language
# when the legacy page left the file name untranslated.
FILENAME_TITLES = {
    "2016GSECpresentation.pptx": "GSEC presentation, 2016",
    "Telling My Story.pdf": "Telling My Story",
    "Great World Religions.pptx": "Great World Religions",
    "EXAMPLE Religion Christianity.pptx": "Example: Christianity",
    "Glossary of Terms.xlsx": "Glossary of terms",
    "The Whole World and the Unreached - Lausanne Movement.pdf": "The Whole World and the Unreached (Lausanne Movement)",
    "why-include-religion-when-defining-south-asia-peoples.pdf": "Why include religion when defining South Asia peoples",
    "Least Reached Peoples - Lausanne Movement.pdf": "Least Reached Peoples (Lausanne Movement)",
    "are-people-groups-the-same-as-language-groups.pdf": "Are people groups the same as language groups?",
    "Josefsson_Understanding_Unreached_Slutversion.pdf": "Josefsson, Understanding Unreached",
    "Mission One Eleven Overseas Practicum Syllabus.pdf": "Mission One Eleven overseas practicum syllabus",
    "MOE Gospel Stories.pdf": "MOE Gospel Stories",
    "Shorthand Gospel.pdf": "Shorthand Gospel",
}

ACTS_CHAPTERS = {
    1: {"en": "Chapters 1–2", "es": "Capítulos 1–2", "pt": "Capítulos 1–2"},
    2: {"en": "Chapters 3–4", "es": "Capítulos 3–4", "pt": "Capítulos 3–4"},
    3: {"en": "Chapters 5–7", "es": "Capítulos 5–7", "pt": "Capítulos 5–7"},
    4: {"en": "Chapters 8–9", "es": "Capítulos 8–9", "pt": "Capítulos 8–9"},
    5: {"en": "Chapters 10–11", "es": "Capítulos 10–11", "pt": "Capítulos 10–11"},
    6: {"en": "Chapters 12–13", "es": "Capítulos 12–13", "pt": "Capítulos 12–13"},
}

DEAD_SYLLABI = {
    "/assets/syllabi/missiology-syllabus.pdf",
    "/assets/syllabi/orality-syllabus.pdf",
}

TYPE_MAP = {
    "assignment": "assignment",
    "discussion": "discussion",
    "quiz": "quiz",
    "attachment": "attachment",
    "tarea": "assignment",
    "discusión": "discussion",
    "cuestionario": "quiz",
    "archivo adjunto": "attachment",
    "tarefa": "assignment",
    "discussão": "discussion",
    "questionário": "quiz",
    "anexo": "attachment",
}

META = {
    "missiology": {
        "provider": "moe",
        "order": 1,
        "canvas": "https://canvaslite.instructure.com/courses/15690",
        "teachingLanguage": {"en": "English", "es": "Inglés", "pt": "Inglês"},
        "level": {"en": "Open courseware", "es": "Curso abierto", "pt": "Curso aberto"},
    },
    "orality": {
        "provider": "moe",
        "order": 2,
        "canvas": "https://canvaslite.instructure.com/courses/15693",
        "teachingLanguage": {"en": "English", "es": "Inglés", "pt": "Inglês"},
        "level": {"en": "Open courseware", "es": "Curso abierto", "pt": "Curso aberto"},
    },
    "formation": {
        "provider": "moe",
        "order": 3,
        "canvas": "https://canvaslite.instructure.com/courses/15695",
        "teachingLanguage": {"en": "English", "es": "Inglés", "pt": "Inglês"},
        "level": {"en": "Open courseware", "es": "Curso abierto", "pt": "Curso aberto"},
    },
    "acts": {
        "provider": "moe",
        "order": 4,
        "canvas": "https://canvaslite.instructure.com/courses/15697",
        "teachingLanguage": {"en": "English", "es": "Inglés", "pt": "Inglês"},
        "level": {"en": "Open courseware", "es": "Curso abierto", "pt": "Curso aberto"},
    },
    "mentoring": {
        "provider": "moe",
        "order": 5,
        "canvas": "https://canvaslite.instructure.com/courses/15699",
        "teachingLanguage": {"en": "English", "es": "Inglés", "pt": "Inglês"},
        "level": {"en": "Open courseware", "es": "Curso abierto", "pt": "Curso aberto"},
    },
    "practicum": {
        "provider": "moe",
        "order": 6,
        "canvas": "https://canvaslite.instructure.com/courses/15701",
        "teachingLanguage": {"en": "English", "es": "Inglés", "pt": "Inglês"},
        "level": {"en": "Open courseware", "es": "Curso abierto", "pt": "Curso aberto"},
    },
    "level2": {
        "provider": "moe",
        "order": 7,
        "canvas": "https://canvaslite.instructure.com/courses/15702",
        "teachingLanguage": {"en": "English", "es": "Inglés", "pt": "Inglês"},
        "level": {"en": "Level 2", "es": "Nivel 2", "pt": "Nível 2"},
    },
}


def text_of(fragment, tag):
    match = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", fragment, re.S)
    if not match:
        return ""
    raw = re.sub(r"<[^>]+>", "", match.group(1))
    return " ".join(html.unescape(raw).split())


def parse_page(path):
    raw = path.read_text(encoding="utf-8")
    title = text_of(raw, "h1")
    description = ""
    desc = re.search(r'<meta name="description" content="(.*?)"', raw)
    if desc:
        description = html.unescape(desc.group(1))
    blocks = []
    for block_html in re.findall(r'<section class="module">(.*?)</section>', raw, re.S):
        heading = text_of(block_html, "h2")
        items = []
        for item_html in re.findall(
            r'<(?:div|article) class="item[^"]*">(.*?)</(?:div|article)>',
            block_html,
            re.S,
        ):
            video = re.search(r'<video\s+src="([^"]+)"', item_html)
            link = re.search(
                r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                item_html,
                re.S,
            )
            tracks = [
                {"src": src, "srclang": lang, "label": label}
                for src, lang, label in re.findall(
                    r'<track[^>]*src="([^"]+)"[^>]*srclang="([^"]+)"[^>]*label="([^"]+)"',
                    item_html,
                )
            ]
            page_text = ""
            pt = re.search(r'<p class="page-text">(.*?)</p>', item_html, re.S)
            if pt:
                page_text = html.unescape(pt.group(1)).strip()
            kind = text_of(item_html, "span").lower()
            items.append(
                {
                    "title": text_of(item_html, "h3"),
                    "type": TYPE_MAP.get(kind, kind),
                    "href": html.unescape(link.group(1)) if link else "",
                    "linkText": " ".join(html.unescape(re.sub(r"<[^>]+>", "", link.group(2))).split())
                    if link
                    else "",
                    "video": html.unescape(video.group(1)) if video else "",
                    "tracks": tracks,
                    "text": page_text,
                }
            )
        blocks.append({"heading": heading, "items": items})
    return {"title": title, "description": description, "blocks": blocks}


def host_for(url):
    if "dropbox.com" in url:
        return "Dropbox, MP4"
    if "youtube.com" in url or "youtu.be" in url:
        return "YouTube"
    if "vimeo.com" in url:
        return "Vimeo"
    return ""


def format_for(href, title):
    name = (href or title or "").lower()
    if name.endswith(".pdf"):
        return "PDF"
    if name.endswith(".pptx") or name.endswith(".ppt"):
        return "PowerPoint"
    if name.endswith(".xlsx"):
        return "Excel"
    if name.endswith(".docx") or name.endswith(".doc"):
        return "Word"
    return ""


def classify(item):
    href = item["href"]
    title = item["title"] or item["linkText"]
    video = item["video"]
    if href in DEAD_SYLLABI or any_dead(title):
        return "syllabus", ""
    if video:
        return "video", host_for(video)
    if href:
        host = host_for(href)
        if host:
            return "video", host
        fmt = format_for(href, title)
        low = f"{href} {title}".lower()
        if "syllabus" in low or "programa" in low or "ementa" in low:
            return "syllabus", fmt
        if "workbook" in low or "cuaderno" in low or "caderno" in low:
            return "workbook", fmt or "PDF"
        if fmt == "PowerPoint":
            return "slides", fmt
        if fmt:
            return "reading", fmt
        return "reading", "web"
    if item["type"] in ("assignment", "discussion", "quiz", "attachment"):
        fmt = format_for("", title)
        if item["type"] == "attachment" and fmt == "PowerPoint":
            return "slides", fmt
        if item["type"] == "attachment" and fmt == "PDF":
            return "reading", fmt
        return item["type"] or "attachment", fmt
    if item["type"]:
        return item["type"], ""
    return "note", ""


def any_dead(title):
    return False


def human_title(title, link_text):
    raw = title or link_text
    if raw in FILENAME_TITLES:
        return FILENAME_TITLES[raw]
    return raw


def split_heading(heading):
    match = WEEK_HEAD.match(heading.strip())
    if not match:
        return None, heading.strip()
    number = int(match.group(1))
    title = (match.group(2) or "").strip()
    return number, title


def merge_course(course_id):
    parsed = {}
    for lang in LANGS:
        prefix = "" if lang == "en" else f"{lang}/"
        parsed[lang] = parse_page(ROOT / prefix / "courses" / course_id / "index.html")
    en_blocks = parsed["en"]["blocks"]
    for lang in ("es", "pt"):
        if len(parsed[lang]["blocks"]) != len(en_blocks):
            raise SystemExit(
                f"{course_id}: {lang} has {len(parsed[lang]['blocks'])} blocks, en has {len(en_blocks)}"
            )
        for index, block in enumerate(en_blocks):
            if len(parsed[lang]["blocks"][index]["items"]) != len(block["items"]):
                raise SystemExit(
                    f"{course_id} block {index} ({block['heading']}): "
                    f"{lang} has {len(parsed[lang]['blocks'][index]['items'])} items, "
                    f"en has {len(block['items'])}"
                )

    blocks = []
    for index, en_block in enumerate(en_blocks):
        number, en_title = split_heading(en_block["heading"])
        titles = {"en": en_title}
        for lang in ("es", "pt"):
            lang_number, lang_title = split_heading(parsed[lang]["blocks"][index]["heading"])
            if lang_number != number:
                raise SystemExit(f"{course_id} block {index}: week number mismatch {lang}")
            titles[lang] = lang_title
        items = []
        for item_index, en_item in enumerate(en_block["items"]):
            kind, fmt = classify(en_item)
            titles_item = {}
            texts = {}
            tracks = list(en_item["tracks"])
            seen = {track["src"] for track in tracks}
            href = en_item["href"]
            for lang in LANGS:
                src = parsed[lang]["blocks"][index]["items"][item_index]
                label = human_title(src["title"], src["linkText"])
                if not label:
                    label = human_title(en_item["title"], en_item["linkText"])
                # File-name titles are identical across languages; use the human form.
                if (src["title"] or src["linkText"]) in FILENAME_TITLES:
                    label = FILENAME_TITLES[src["title"] or src["linkText"]]
                titles_item[lang] = label
                if src["text"]:
                    texts[lang] = src["text"]
                for track in src["tracks"]:
                    if track["src"] not in seen:
                        tracks.append(track)
                        seen.add(track["src"])
                if src["href"] and src["href"] != href and not en_item["video"]:
                    # Language pages share the same targets. Prefer the English URL.
                    pass
            if href in DEAD_SYLLABI:
                kind = "syllabus"
                href = ""
                fmt = "PDF"
                item = {
                    "kind": "syllabus",
                    "format": "PDF",
                    "status": "unavailable",
                    "title": titles_item,
                }
            else:
                item = {"kind": kind, "title": titles_item}
                if fmt:
                    item["format"] = fmt
                if href:
                    item["href"] = href
                elif kind == "video" and en_item["video"]:
                    item["src"] = en_item["video"]
                elif kind == "syllabus":
                    item["status"] = "unavailable"
                if en_item["video"]:
                    item["src"] = en_item["video"]
                    if tracks:
                        item["tracks"] = tracks
                elif tracks and kind == "video":
                    item["tracks"] = tracks
                if texts:
                    item["text"] = texts
            if kind == "video" and en_item["video"] and tracks:
                item["tracks"] = tracks
            items.append(item)
        block = {"title": titles, "items": items}
        if number is not None:
            block["kind"] = "week"
            block["n"] = number
        else:
            block["kind"] = "section"
        blocks.append(block)

    blocks = expand_mentoring(course_id, blocks)
    blocks = title_acts(course_id, blocks)
    week_count = sum(1 for block in blocks if block["kind"] == "week")
    course = {
        "id": course_id,
        "provider": META[course_id]["provider"],
        "order": META[course_id]["order"],
        "canvas": META[course_id]["canvas"],
        "title": {lang: parsed[lang]["title"] for lang in LANGS},
        "description": {lang: parsed[lang]["description"] for lang in LANGS},
        "teachingLanguage": META[course_id]["teachingLanguage"],
        "level": META[course_id]["level"],
        "blocks": blocks,
    }
    if week_count:
        course["weeks"] = week_count
    return course


def expand_mentoring(course_id, blocks):
    if course_id != "mentoring":
        return blocks
    expanded = []
    for block in blocks:
        week_items = []
        kept = []
        for item in block["items"]:
            match = MENTOR_ITEM.match(item["title"]["en"])
            if match and block["kind"] == "section":
                week_items.append((int(match.group(1)), item))
            else:
                kept.append(item)
        if week_items and not kept:
            for number, item in week_items:
                expanded.append(
                    {
                        "kind": "week",
                        "n": number,
                        "title": {
                            "en": "Mentoring",
                            "es": "Mentoreo",
                            "pt": "Mentoria",
                        },
                        "items": [item],
                    }
                )
        elif week_items:
            block["items"] = kept
            expanded.append(block)
            for number, item in week_items:
                expanded.append(
                    {
                        "kind": "week",
                        "n": number,
                        "title": {
                            "en": "Mentoring",
                            "es": "Mentoreo",
                            "pt": "Mentoria",
                        },
                        "items": [item],
                    }
                )
        else:
            expanded.append(block)
    return expanded


def title_acts(course_id, blocks):
    if course_id != "acts":
        return blocks
    for block in blocks:
        if block["kind"] == "week" and not any(block["title"].values()):
            block["title"] = dict(ACTS_CHAPTERS[block["n"]])
    return blocks


def ethics():
    return {
        "id": "ethics",
        "provider": "messenger",
        "order": 1,
        "locked": True,
        "title": {
            "en": "Church and Contemporary Moral Issues",
            "es": "La iglesia y los dilemas morales contemporáneos",
            "pt": "A igreja e as questões morais contemporâneas",
        },
        "teachers": "Doug Petersen and Jennifer Hargestam",
        "description": {
            "en": "A Christian ethics course for contemporary church leaders: ethical reasoning frameworks, five core principles, Old and New Testament ethics, and case-study analysis.",
            "es": "Un curso de ética cristiana para líderes de iglesia: marcos de razonamiento ético, cinco principios fundamentales, ética del Antiguo y del Nuevo Testamento, y análisis de casos.",
            "pt": "Um curso de ética cristã para líderes de igreja: estruturas de raciocínio ético, cinco princípios fundamentais, ética do Antigo e do Novo Testamento, e análise de casos.",
        },
        "teachingLanguage": {"en": "English", "es": "Inglés", "pt": "Inglês"},
        "level": {
            "en": "College credit",
            "es": "Crédito universitario",
            "pt": "Crédito universitário",
        },
        "blocks": [],
    }


def main():
    out = ROOT / "content" / "courses"
    out.mkdir(parents=True, exist_ok=True)
    for course_id in IDS:
        course = merge_course(course_id)
        path = out / f"{course_id}.json"
        path.write_text(json.dumps(course, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)} weeks={course.get('weeks', 0)} blocks={len(course['blocks'])}")
    ethics_path = out / "ethics.json"
    ethics_path.write_text(json.dumps(ethics(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {ethics_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
