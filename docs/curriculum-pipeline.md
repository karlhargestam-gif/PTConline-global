# Curriculum pipeline

COS and the team perfect a submitted course in GitHub, then publish it only by a reviewed pull request. The public form does not write a course onto the site.

The intake repository should be a **private** repo, `karlhargestam-gif/ptc-curriculum`, because each issue contains a name and an email. Do not send offers to public issues on `PTConline-global`. This repository does include `.github/ISSUE_TEMPLATE/curriculum-submission.yml` so the same fields exist if Karl later points the token at a private repo that copies that form.

## What the form does today

The form is live. `api/submit-course.js` checks the honeypot, the field sizes, the https link (parsed, no user:password), the licence, the three consent boxes, and every file: type, extension, size, and the file's first bytes (a renamed HTML file is refused). It refuses more than 5 offers in 10 minutes from one hashed address on a warm instance (best effort only; a Vercel Firewall rate-limit rule is the stronger option and needs Karl's OK). If any environment variable below is missing, it stores nothing and the page says submissions are paused.

Failures are logged to the Vercel function log as one JSON line (`fn: submit-course`, `stage`, `error`). Logs never contain a name, an email or an IP. If the GitHub step fails after a file was stored, the file is deleted again.

Text typed into the form is written into the issue as code (inline code or a `~~~text` block). Headings, links, images, HTML, @-mentions and #-references from the public do not render or notify anyone.

When the variables are set, the function:

1. Refuses the request if `GITHUB_CURRICULUM_REPO` is not a private repository.
2. Stores up to three small files in a **private** Vercel Blob store. A long video stays as an https link. The function will not accept a body over 4 MB, which is under the Vercel request limit.
3. Opens a GitHub issue labelled `submission` and `submitted`. The issue has the course fields, the private Blob pathnames, and the consent record: the time, the licence version agreed (`ptc-nonexclusive-draft-2026-10-28` or `cc-by-nc-sa-4.0`), and a salted SHA-256 of the IP address. The raw IP is not written down.
4. Names `CURRICULUM_NOTIFY_EMAIL` inside the issue as the COS contact. This function does not send email.

**Notification gap.** The issue is opened with Karl's token, so GitHub counts Karl as the author and does not notify Karl about it. Someone else must watch the repo, or COS must check `is:open label:submitted` on a schedule (at least weekly).

## Licence text, version 2026-10-28.2

The issue records `ptc-nonexclusive-2026-10-28.2` or `cc-by-nc-sa-4.0`. The exact words the contributor agreed to are on `/submit/`, `/es/submit/` and `/pt/submit/` at the commit that set this version. When the wording changes, bump `LICENCE_TEXT_VERSION` in `api/submit-course.js`.

- **PTC licence:** the contributor keeps the copyright and gives PTC a free, worldwide, non-exclusive licence to review, edit, adapt, translate, caption and publish, and to share free with partner churches, schools and platforms for teaching. PTC credits the author (and church or organization if named), does not sell the material, and marks edits and translations as adapted. The contributor may ask PTC to stop; PTC takes it off ptconline.global within 30 days. Copies already shared may remain.
- **CC BY-NC-SA 4.0:** the contributor keeps the copyright and licenses the material to everyone on those terms. It cannot be withdrawn for copies already shared. Adaptations must stay BY-NC-SA, so PTC cannot relicense them.
- **Rights box:** 18 or older; wrote it or has the owner's permission; third-party material listed in the ownership statement; no infringement of copyright, privacy or other rights.
- **Scripture:** Biblica's NVI terms allow up to 500 verses without written permission, never a complete book, under 25% of the work, with the copyright notice. Biblica applies the limit to a website as a whole, not to each page, so PTC should track total NVI use on ptconline.global and ask Biblica for permission before it nears the limit.

## Privacy and retention

What is stored, why, where and for how long is on the submit pages and on `/privacy/`. COS keeps to it:

- An offer that is declined or never published: close the issue with `wontfix`, then delete the issue and its Blob files within 2 years of the offer.
- A published course: keep the issue (the permission record) while the course is online and for 2 years after it comes down.
- A request to see, correct or delete details, or to withdraw consent: answer within 30 days. Deleting an issue needs a repo admin; deleting a Blob file needs the Blob token. Withdrawal of the PTC licence means a pull request that takes the course off the site within 30 days.

## Stages

COS monitors the queue and moves the stage label. One stage label at a time, plus the permanent `submission` label.

| Stage | Label | Owner | Work |
|---|---|---|---|
| Submitted | `submitted` | COS | Read the new issue and route it. |
| Screening | `screening` | COS routes it. Karl or the academic lead decides theology fit. | Confirm the rights statement and whether the course belongs with PTC. |
| Formatting | `formatting` | Don implements the file. Cass handles content and style. | Turn the offer into `templates/course-submission/` shape: title, level, description, weeks, video, readings, assignments, captions. Follow `docs/course-style-guide.md`. |
| Translation | `translation` | Cass handles the wording. Don puts the three languages in the file. | English, Spanish, and Portuguese. Spanish and Portuguese scripture uses NVI. |
| Review | `review` | Dot does the independent review. A native speaker reviews Spanish and Portuguese. | Academic review plus a native-speaker read. Dot is not the person who formatted the course. |
| Ready | `ready` | Karl or the academic lead | Final approval to publish. |
| Published | `published` | Don | `scripts/import_course.py` has opened a pull request and that pull request is merged. |

A GitHub Project board can use these same column names. The label is the record if the board is not set up yet.

## Environment variables Karl must approve

Set these on the Vercel project for the `ptconline-global` team `one-chance1`. Do not commit them.

| Variable | What it is |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Token for one **private** Blob store. Create the store only after approval. Do not make it public. |
| `GITHUB_CURRICULUM_TOKEN` | A GitHub App installation token, or a fine-grained personal access token, with Issues read and write on `karlhargestam-gif/ptc-curriculum` only. |
| `GITHUB_CURRICULUM_REPO` | `karlhargestam-gif/ptc-curriculum` |
| `CURRICULUM_NOTIFY_EMAIL` | The address COS should see on each issue. |
| `CURRICULUM_IP_SALT` | A long random string, at least 16 characters, used only to hash IP addresses. |

The form stays on the “email us” message until all five are set. No store, token, or mailbox is created by this pull request.

## Publishing

After Karl or the academic lead moves the issue to `ready`, Don runs:

```bash
python3 scripts/import_course.py path/to/approved-folder
```

That writes `content/courses/<id>.json` (with `contributor`, `licence` and `licenceVersion`), copies caption files into `assets/subtitles/`, runs `scripts/build.py` so the course page, the catalog card and the sitemap are in the same commit, and opens a pull request. The course page shows “Contributed by” and the licence. Courses with `provider: ptc` get their own section in the catalog. Run it from a clean working tree; it needs PyYAML. Merging that pull request is the publish step. Then COS sets the label to `published`.
