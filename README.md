# ptconline.global

Multilingual catalog for the Pentecostal Theological Consortium. The public site is static HTML in English, Spanish and Portuguese. Vercel serves the files at the repository root. There is no application server.

Mission One Eleven courses are open courseware. Messenger College courses are overviews only. Enrollment, progress and certificates belong in a learning system, described in `ARCHITECTURE.md`.

## Edit content, then build

```bash
python3 scripts/build.py
python3 .github/scripts/site_check.py --host ptconline.global
```

`scripts/build.py --check` exits with an error when a generated page does not match the content model. The site-check workflow runs that before the link check.

| Path | What it controls |
|---|---|
| `content/site.json` | Shared UI strings, the Messenger lock notice, and partner URLs |
| `content/pages.json` | About, Contact, How to enroll, Privacy, Terms, Copyright |
| `content/courses/*.json` | One file per course |
| `src/partials/*.tpl` | Head, home and course banners, footers, and week-block markup |
| `assets/css/` | Fonts, site chrome, home page, course pages |

The lock sentence is `lockNotice` in `content/site.json`. Change it there and rebuild. Every locked page and the Messenger catalog read that field.

## Course file

```json
{
  "id": "missiology",
  "provider": "moe",
  "order": 1,
  "canvas": "https://canvaslite.instructure.com/courses/15690",
  "title": { "en": "", "es": "", "pt": "" },
  "description": { "en": "", "es": "", "pt": "" },
  "teachingLanguage": { "en": "English", "es": "Inglés", "pt": "Inglês" },
  "level": { "en": "Open courseware", "es": "Curso abierto", "pt": "Curso aberto" },
  "weeks": 6,
  "blocks": []
}
```

`provider` is `moe` or `messenger`. A Messenger course sets `"locked": true` and leaves `blocks` empty. The build will not print readings, videos or files for a locked course.

A block is either a week or a section:

```json
{ "kind": "week", "n": 1, "title": { "en": "The Assignment", "es": "", "pt": "" }, "items": [] }
{ "kind": "section", "title": { "en": "Welcome", "es": "", "pt": "" }, "items": [] }
```

Week blocks render as `Week N: Title`. An item is a `video`, `reading`, `workbook`, `slides`, `assignment`, `discussion`, `quiz`, `syllabus` or `note`. Give it `href` or `src` when a file or recording exists. `"status": "unavailable"` prints Unavailable and does not link a file. Local files under `/assets/` get their size from the file on disk at build time.

To add a course, add `content/courses/<id>.json` and run the build. The catalog, sitemap and language switcher pick it up from that file.

`scripts/extract_courses.py` was the one-time migration from the old hand-written pages. Do not run it again. It would read the generated HTML and overwrite the JSON.

## Brand

Mission One Eleven course pages use red `#B2242E`, espresso `#332D26` and cream `#F6F3EE`, with Lato for headings and Open Sans for text. The white wordmark is `assets/moe/MOE_logo_white_official.png` and is used only on the espresso banner. The red wordmark is `assets/moe/MOE_logo_red_official.png` and is used on the cream catalog. Do not recolor either file.

Lato, Open Sans and Crimson Text are under the SIL Open Font License. See `assets/fonts/OFL.txt`.

## What is not in this repo

Student accounts, grades, quizzes and certificates are not implemented. Canvas remains the place cohorts turn work in. Messenger College credit stays on the college site.
