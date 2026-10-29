# Curriculum pipeline

COS and the team perfect a submitted course in GitHub, then publish it only by a reviewed pull request. The public form does not write a course onto the site.

The intake repository should be a **private** repo, `karlhargestam-gif/ptc-curriculum`, because each issue contains a name and an email. Do not send offers to public issues on `PTConline-global`. The public repository issue chooser links to the existing private web intake; it must not offer a contributor-data issue form.

## What the form does today

The production form was verified accepting synthetic submissions on October 28, 2026 (America/Chicago). Code changes in this branch are not production verification; see `docs/intake-verification-2026-10-28.md`. `api/submit-course.js` checks the honeypot, the field sizes, the https link (parsed, no user:password), the licence, the three consent boxes, and every file: type, extension, size, and the file's first bytes (a renamed HTML file is refused). It refuses more than 5 offers in 10 minutes from one hashed address on a warm instance (best effort only; a Vercel Firewall rate-limit rule is the stronger option and needs Karl's OK). If any environment variable below is missing, it stores nothing and the page says submissions are paused.

Failures are logged as fixed stage identifiers and an opaque receipt where recovery is needed. Upstream error messages and IP hashes are not logged because they can expose submitted data. A definite GitHub rejection triggers cleanup. A timeout or server error preserves the private receipt and files: GitHub may already have created the issue. Reconcile by receipt before retrying or deleting.

Text typed into the form is written into the issue as code (inline code or a `~~~text` block). Headings, links, images, HTML, @-mentions and #-references from the public do not render or notify anyone.

When the variables are set, the function:

1. Refuses the request if `GITHUB_CURRICULUM_REPO` is not a private repository.
2. Stores up to three small files in a **private** Vercel Blob store. A long video stays as an https link. The function will not accept a body over 4 MB, which is under the Vercel request limit.
3. Opens a GitHub issue labelled `submission` and `submitted`. The issue has the course fields, the private Blob pathnames, and the consent record: the time, the licence version agreed (`ptc-nonexclusive-2026-10-28.2` or `cc-by-nc-sa-4.0`), and a salted SHA-256 of the IP address. The raw IP is not written down.
4. Stores a private `curriculum/<receipt>/receipt.json` recovery record with the validated payload, salted IP hash and attachment checksums. The receipt has the same access and retention requirements as the issue and files.
5. Names `CURRICULUM_NOTIFY_EMAIL` inside the issue as the COS contact. This function does not send email.

**Notification handoff.** The intake token names Karl as the issue author. The private repository notification change uses a separate GitHub Actions bot to mention the existing owner once, on intake events with an hourly retry scan. Verify that change is merged and a bot handoff comment exists before claiming notifications are enabled. A posted bot comment is not proof of email delivery or human acknowledgment. COS or a designated reviewer must record acknowledgment and next action in the private issue. Schedules may be delayed; monitor failed runs and stale unacknowledged intake.

## Licence text currently served, version 2026-10-28.2

Institutional approval of these terms has not been established by the verification. Recording a contributor checkbox does not approve the institutional licence, academic suitability, translation, or publication. Do not mark a course ready or publish until the relevant human authorities record their decisions.

The issue records `ptc-nonexclusive-2026-10-28.2` or `cc-by-nc-sa-4.0`. The exact words the contributor agreed to are on `/submit/`, `/es/submit/` and `/pt/submit/` at the commit that set this version. When the wording changes, bump `LICENCE_TEXT_VERSION` in `api/submit-course.js`.

- **PTC licence:** the contributor keeps the copyright and gives PTC a free, worldwide, non-exclusive licence to review, edit, adapt, translate, caption and publish, and to share free with partner churches, schools and platforms for teaching. PTC credits the author (and church or organization if named), does not sell the material, and marks edits and translations as adapted. The contributor may ask PTC to stop; PTC takes it off ptconline.global within 30 days. Copies already shared may remain.
- **CC BY-NC-SA 4.0:** the contributor keeps the copyright and licenses the material to everyone on those terms. It cannot be withdrawn for copies already shared. Adaptations must stay BY-NC-SA, so PTC cannot relicense them.
- **Rights box:** 18 or older; wrote it or has the owner's permission; third-party material listed in the ownership statement; no infringement of copyright, privacy or other rights.
- **Scripture:** Biblica's NVI terms allow up to 500 verses without written permission, never a complete book, under 25% of the work, with the copyright notice. Biblica applies the limit to a website as a whole, not to each page, so PTC should track total NVI use on ptconline.global and ask Biblica for permission before it nears the limit.

## Privacy and retention

What is stored, why, where and for how long is on the submit pages and on `/privacy/`. COS keeps to it:

- An offer that is declined or never published: close the issue with `wontfix`, then delete the issue, its recovery receipt and its Blob files within 2 years of the offer.
- A published course: keep the issue (the permission record) while the course is online and for 2 years after it comes down.
- A request to see, correct or delete details, or to withdraw consent: the currently published wording promises an answer within 30 days. Institutional acceptance and an accountable mailbox owner still need confirmation. Deleting an issue needs a repo admin; deleting a Blob file needs the Blob token. Withdrawal of the PTC licence means a pull request that takes the course off the site within 30 days.

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
python3 scripts/import_course.py path/to/approved-folder --approval-reference https://github.com/karlhargestam-gif/ptc-curriculum/issues/NUMBER
```

That writes `content/courses/<id>.json` (with `contributor`, `licence` and `licenceVersion`), copies caption files into `assets/subtitles/`, runs `scripts/build.py` so the course page, the catalog card and the sitemap are in the same commit, and opens a draft pull request. The course page shows “Contributed by” and the licence. Courses with `provider: ptc` get their own section in the catalog. Run it from a clean working tree; it needs PyYAML. Merging that pull request is the publish step. Then COS sets the label to `published`.


## Recovery without publication

Run `node scripts/recover_intake.js RECEIPT /secure/new-output-directory` with the existing private Blob credential in the environment. This reads the private receipt and attachments, verifies sizes and SHA-256 checksums, and writes restricted local files. It never executes attachments, follows submitted links, recreates an issue, deletes data, or publishes. Test restore against the real store remains required when authorized Vercel access is restored.

For `recoveryRequired` logs, inspect only the matching `curriculum/<receipt>/` prefix. Search private issues for the receipt before doing anything else. If an issue exists, retain its attachments. If not, recover the receipt, have the responsible reviewer reconcile the failure privately, and record the outcome. Do not blindly resubmit or delete. A failed upload may leave an object even if the response was lost; include the receipt prefix in reconciliation. Legacy tests predate receipt support and must be reconciled by their private issue paths.

File type checks are not malware scanning. Review attachments in a safe viewer; never execute them. HTTPS material links are untrusted and are not fetched by the intake function. Keep download tokens, private file contents and contact details out of the public website repository and build artifacts.

## Publication evidence

An importer `--approval-reference` identifies where reviewers must check evidence; the script does not authenticate the approval. It creates a draft PR and cannot merge it. Before public import, confirm the material and attribution are cleared for a public PR. Before merging, confirm academic approval, language review, the approved licence version, and explicit publication authorization. A `ready` label or contributor consent alone is insufficient. Existing course or caption destinations are never overwritten by the importer.
