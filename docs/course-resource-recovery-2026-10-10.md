# Course resource recovery — October 10, 2026

Draft PR #2 only. No production release or merge authorized. Portuguese translations and English teaching content are retained. Resource URLs and unavailable-video labels are corrected consistently in English, Spanish, and Portuguese.

## Restored originals

| Course | Page locations (under each of `/courses/`, `/pt/courses/`, `/es/courses/`) | Restored site asset | Original source |
|---|---|---|---|
| Book of Acts | `acts/`, Welcome → Syllabus | `/assets/syllabi/acts-syllabus.pdf` (13 pages, 201123 bytes) | Dropbox `MOE Teaching Materials/4.Acts/Syllabus/Book of Acts Syllabus.pdf` |
| Methods of Orality | `orality/`, Welcome → Syllabus | `/assets/syllabi/orality-syllabus.pdf` (17 pages, 232368 bytes) | Dropbox `MOE Teaching Materials/2.Methods of Orality/Syllabus/Methods of Orality Syllabus.pdf` |
| Missiology of Unreached People Groups | `missiology/`, Welcome → Syllabus | `/assets/syllabi/missiology-syllabus.pdf` (15 pages, 235479 bytes) | Dropbox `MOE Teaching Materials/1.Missiology of Unreached People Groups/Syllabus/Missiology of Unreached People Groups Syllabus.pdf` |

These are recovered English originals, not new or translated syllabi. They were downloaded unchanged and parsed successfully with `pdfinfo` and `pdftotext`; title, course, six-week content and PDF structure were checked. SHA-256, source IDs and byte counts are recorded in `assets/course-resources.json`. The two existing .pdf assets contained Dropbox HTML error pages; their bytes are now actual source PDFs. Acts is a new local asset. The original PDFs were created June 26, 2024; the source metadata reports December 4, 2025 server modification. Recovery does not certify that historic grading or dates are current policy.

## Precise missing originals

| Original | Exact Drive ID | Locations | Evidence / current handling |
|---|---|---|---|
| Welcome Video / Orientation Video | `1hQ7A1ArpNsPl369BzIJcI4rTQ1UaBxHK` | `mentoring/` Welcome; `practicum/` Welcome, all three languages | HTTP 404 anonymously and through connected Drive metadata read. Position/title preserved; unavailable notice replaces the clickable broken URL. |
| Gospel Map Talk | `13GwryTMXt2LztszSwKymAIg5qfX8IJOl` | `missiology/` Week 2, all three languages | Same anonymous and authenticated 404 result; exact recording not recovered. Position/title preserved with unavailable notice. |

A 404 does not distinguish deletion from an account-access restriction. Recover these exact recordings or obtain owner-confirmed equivalents and verify anonymous playback before enabling their links. MOE Orientation 2021 exists in Dropbox but was not substituted: its identity as the missing welcome recording is unproven. No new video, lesson, or syllabus content was invented. Portuguese video keys and all existing English URL entries remain in `video-map.pt.json`. Adding a verified Portuguese replacement still activates that video link and removes its unavailable notice.

## Search and provenance

- Reused October 4 MOE curriculum inventory. Located the 12 original Canvas exports in Drive folder `1glhpp3b9uihq00eCRJab3YnG8wNpqRlx`.
- Inspected read-only copies of packages 01, 02, 04, 05, 06, 07 and 11: IMS manifests, embedded files, course syllabus pages and external resource records. Both large Missiology exports were accessible with the current transfer route. These packages retain the broken video IDs as external references, not embedded recordings. Package 10 transfer was incomplete and is not counted as inspected in this recovery.
- Canvas syllabus pages offered alternate Dropbox folders, an Acts Word link, and another Missiology Drive ID (`1GfrzwDW3vVracizWwdMnWUmeONav-QI9`, also inaccessible). The three exact original PDFs were ultimately found through authenticated Dropbox search and metadata/content inspection in MOE Teaching Materials.
- Connected Drive searches for syllabi, Orality, Missiology, Welcome, Orientation and Gospel did not locate the missing videos. Scoped Dropbox title search found no Welcome file; Gospel Map search did not find the exact recording. No live Canvas connector was available; exported Canvas records were inspected.
- Repository history contains only the invalid Orality/Missiology PDF assets, not recovered originals.
- No Drive/Dropbox master archive was modified and no sharing permission was broadened.

## Checks and preview

- Anonymous original-link GETs: all three old Dropbox syllabus URLs return HTTP 200 HTML with “File Deleted”; both Drive video URLs return HTTP 404.
- Existing 30-page site checks pass. Resource checks verify original hashes, byte lengths, PDF signature/trailer, all 15 affected course pages, unavailable slots, and `pt-BR` metadata. Regression tests reject HTML masquerading as PDFs, corrupted/truncated originals, and reintroduced deleted links.
- `python3 .github/scripts/course_resource_check.py --base-url https://PREVIEW-HOST` checks actual anonymous HTTP document bytes and course links; no credentials/cookies are sent.
- Resolved the existing conflict with main in the Portuguese course index, retaining the Portuguese metadata plus main's canonical/structured-data and CI work.
- Vercel project: `prj_6dWan46TvirlneWSo3bOqcBKABAV`, team `team_9ZcwXjk9QXaA0Vs1ccdUrmI0`, preview branch `i18n/pt-content`. Direct deployment inspection currently returns a team-scope 403; the CLI is not installed. Use the existing Git-integrated preview from the branch push and verify its reported result. Do not promote to production.

## Verified preview result

The existing Git integration recovered successfully at commit `c04e6be0489a5d6ea540465d4cb266804a243fc4`. Vercel reported **Ready**, deployment `dpl_GxPmBPgYAPcjQu8nYne7bxBe6s7J`; GitHub Site check run `38090188101` passed. PR #2 remains draft, unmerged, and mergeable. The GitHub tree matches the locally verified tree byte-for-byte.

Review: https://ptconline-global-git-i18n-pt-content-karlhargestam-gif.vercel.app/pt/courses/

Anonymous GET checks for all three recovered PDFs and the five affected Portuguese course pages returned HTTP 302 to Vercel SSO. These checks establish that the preview is protected, not that the deployed document bodies are publicly accessible. The supported authenticated Vercel fetch also returned 403 because the current connection lacks access to this project/team. No protection was disabled. A reviewer with Vercel access can use the preview; completing hosted body/browser verification requires an authorized Vercel connection.

An anonymous local HTTP server using the exact deployed tree passed all 3 PDF content-type/byte/hash checks and all 15 course-page checks. The Portuguese video hook was also exercised for absent translations, activating a verified replacement, clearing its unavailable label, and preserving English behavior. Production was not changed.
