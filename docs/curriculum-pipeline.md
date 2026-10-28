# Curriculum pipeline

COS and the team perfect a submitted course in GitHub, then publish it only by a reviewed pull request. The public form does not write a course onto the site.

The intake repository should be a **private** repo, `karlhargestam-gif/ptc-curriculum`, because each issue contains a name and an email. Do not send offers to public issues on `PTConline-global`. This repository does include `.github/ISSUE_TEMPLATE/curriculum-submission.yml` so the same fields exist if Karl later points the token at a private repo that copies that form.

## What the form does today

`api/submit-course.js` checks the honeypot, the field sizes, the https link, and the three consent boxes. Until the environment variables below are set, it stores nothing and the page says submissions open soon. “Email us” links to the contact page. This site still has no PTC email address.

When the variables are set, the function:

1. Refuses the request if `GITHUB_CURRICULUM_REPO` is not a private repository.
2. Stores up to three small files in a **private** Vercel Blob store. A long video stays as an https link. The function will not accept a body over 4 MB, which is under the Vercel request limit.
3. Opens a GitHub issue labelled `submission` and `submitted`. The issue has the course fields, the private Blob pathnames, and the consent record: the time, the licence version agreed (`ptc-nonexclusive-draft-2026-10-28` or `cc-by-nc-sa-4.0`), and a salted SHA-256 of the IP address. The raw IP is not written down.
4. Names `CURRICULUM_NOTIFY_EMAIL` inside the issue. GitHub then notifies people who watch that private repo. This function does not call an email service.

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

That writes `content/courses/<id>.json`, copies caption files into `assets/subtitles/`, and opens a pull request. Merging that pull request is the publish step. Then COS sets the label to `published`.
