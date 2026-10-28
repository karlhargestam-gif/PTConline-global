#!/usr/bin/env python3
"""Turn an approved course folder into content/courses/<id>.json and open a PR.

The folder needs course.md with YAML front matter, as in
templates/course-submission/. Requires PyYAML (pip install pyyaml).
Publishing still needs a person to merge the pull request.

    python3 scripts/import_course.py templates/course-submission --dry-run
    python3 scripts/import_course.py path/to/approved-folder
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is required: pip install pyyaml")

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "es", "pt")
ITEM_KINDS = {"video", "reading", "workbook", "slides", "assignment", "discussion", "quiz", "syllabus", "note"}
CAPTION_LINE = 42
CAPTION_LINES = 2


def fail(message: str) -> None:
    raise SystemExit(message)


def load_course(folder: Path) -> dict:
    path = folder / "course.md"
    if not path.is_file():
        fail(f"{path} is missing")
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail("course.md must start with YAML front matter")
    end = text.find("\n---\n", 4)
    if end < 0:
        fail("course.md front matter is not closed")
    data = yaml.safe_load(text[4:end])
    if not isinstance(data, dict):
        fail("front matter must be a mapping")
    return data


def text_block(value, label: str) -> dict:
    if not isinstance(value, dict) or any(lang not in value or not str(value[lang]).strip() for lang in LANGS):
        fail(f"{label} needs en, es, and pt text")
    return {lang: str(value[lang]).strip() for lang in LANGS}


def check_captions(folder: Path, relative: str) -> None:
    path = folder / relative
    if not path.is_file():
        fail(f"missing caption file {relative}")
    raw = path.read_text(encoding="utf-8")
    if not raw.startswith("WEBVTT"):
        fail(f"{relative} must be a WebVTT file")
    cue = []
    for line in raw.splitlines()[1:]:
        if "-->" in line or not line.strip():
            if cue:
                check_cue(relative, cue)
                cue = []
            continue
        if cue or (line.strip() and "-->" not in line):
            cue.append(line)
    if cue:
        check_cue(relative, cue)
    name = path.name.lower()
    if "crusade" in name:
        fail(f"{relative} uses a crusade filename")


def check_cue(relative: str, lines: list[str]) -> None:
    if len(lines) > CAPTION_LINES:
        fail(f"{relative} has a cue longer than {CAPTION_LINES} lines")
    for line in lines:
        if len(line) > CAPTION_LINE:
            fail(f"{relative} has a caption line over {CAPTION_LINE} characters")


def build(folder: Path, data: dict) -> tuple[dict, list[tuple[Path, Path]]]:
    course_id = str(data.get("id") or "")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", course_id):
        fail("id must be a lowercase slug")
    if data.get("provider") != "ptc":
        fail("provider must be ptc")
    bible = data.get("bible") or {}
    if bible.get("es") != "NVI" or bible.get("pt") != "NVI":
        fail("bible.es and bible.pt must be NVI")
    if not data.get("licence") or not data.get("licenceVersion"):
        fail("licence and licenceVersion are required")
    if data["licence"] not in ("ptc-nonexclusive", "cc-by-nc-sa-4.0"):
        fail("licence must be ptc-nonexclusive or cc-by-nc-sa-4.0, as agreed on the form")
    contributor = str(data.get("contributor") or "").strip()
    if not contributor:
        fail("contributor is required: the credit line the author asked for")
    course = {
        "id": course_id,
        "provider": "ptc",
        "order": int(data.get("order") or 0),
        "weeks": int(data.get("weeks") or 0),
        "title": text_block(data.get("title"), "title"),
        "description": text_block(data.get("description"), "description"),
        "teachingLanguage": text_block(data.get("teachingLanguage"), "teachingLanguage"),
        "level": text_block(data.get("level"), "level"),
        "licence": data["licence"],
        "licenceVersion": data["licenceVersion"],
        "contributor": contributor,
        "blocks": [],
    }
    copies = []
    blocks = data.get("blocks") or []
    if not blocks:
        fail("at least one week block is required")
    if len(blocks) != course["weeks"]:
        fail("weeks must match the number of week blocks")
    for block in blocks:
        if block.get("kind") != "week":
            fail("each block kind must be week")
        number = int(block.get("n") or 0)
        built_items = []
        for item in block.get("items") or []:
            kind = item.get("kind")
            if kind not in ITEM_KINDS:
                fail(f"unknown item kind {kind}")
            built = {"kind": kind, "title": text_block(item.get("title"), f"week {number} item")}
            if item.get("format"):
                built["format"] = str(item["format"])
            if item.get("src"):
                src = str(item["src"])
                if not src.startswith("https://"):
                    fail(f"video src must be an https link ({src})")
                built["src"] = src
            if item.get("href"):
                href = str(item["href"])
                if href.startswith("http") and not href.startswith("https://"):
                    fail(f"href must be https ({href})")
                built["href"] = href
            if "crusade" in json.dumps(built).lower():
                fail("crusade imagery or wording is not accepted in a course file")
            if kind == "video":
                captions = item.get("captions") or {}
                tracks = []
                labels = {"en": "English", "es": "Español", "pt": "Português"}
                for lang in LANGS:
                    relative = captions.get(lang)
                    if not relative:
                        fail(f"week {number} video needs a {lang} caption file")
                    check_captions(folder, relative)
                    dest = Path("assets/subtitles") / f"{course_id}_w{number}_{lang}.vtt"
                    copies.append((folder / relative, ROOT / dest))
                    tracks.append({"src": "/" + dest.as_posix(), "srclang": lang, "label": labels[lang]})
                built["tracks"] = tracks
            built_items.append(built)
        course["blocks"].append({
            "kind": "week",
            "n": number,
            "title": text_block(block.get("title"), f"week {number}"),
            "items": built_items,
        })
    return course, copies


def open_pr(course_id: str, course_path: Path, rendered: str, copies: list[tuple[Path, Path]]) -> None:
    branch = f"curriculum/{course_id}"
    if subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True).stdout.strip():
        fail("the working tree has changes; commit or stash them first")
    subprocess.run(["git", "fetch", "origin", "main"], cwd=ROOT, check=True)
    subprocess.run(["git", "checkout", "-b", branch, "origin/main"], cwd=ROOT, check=True)
    course_path.parent.mkdir(parents=True, exist_ok=True)
    course_path.write_text(rendered, encoding="utf-8")
    for source, dest in copies:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, dest)
    # The site is static: the generated pages must be in the same pull request.
    subprocess.run([sys.executable, "scripts/build.py"], cwd=ROOT, check=True)
    subprocess.run([sys.executable, "scripts/build.py", "--check"], cwd=ROOT, check=True)
    subprocess.run(["git", "add", "-A", "content", "assets/subtitles", "courses", "es", "pt", "sitemap.xml"], cwd=ROOT, check=True)
    subprocess.run(["git", "commit", "-m", f"Add the {course_id} course from an approved submission."], cwd=ROOT, check=True)
    subprocess.run(["git", "push", "-u", "origin", branch], cwd=ROOT, check=True)
    subprocess.run([
        "gh", "pr", "create",
        "--base", "main",
        "--head", branch,
        "--title", f"Publish {course_id}",
        "--body", "Imported from an approved curriculum folder. Merging this pull request publishes the course.\n",
    ], cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    folder = args.folder.resolve()
    data = load_course(folder)
    course, copies = build(folder, data)
    course_path = ROOT / "content" / "courses" / f"{course['id']}.json"
    if course_path.exists() and not data.get("example"):
        fail(f"{course_path} already exists")
    rendered = json.dumps(course, ensure_ascii=False, indent=2) + "\n"
    if args.dry_run or data.get("example"):
        print(rendered)
        if data.get("example") and not args.dry_run:
            fail("the example template cannot be published")
        return
    open_pr(course["id"], course_path, rendered, copies)


if __name__ == "__main__":
    main()
