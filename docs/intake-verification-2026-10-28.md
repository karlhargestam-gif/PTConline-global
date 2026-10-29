# PTC course intake verification — October 28, 2026

Status: technical changes proposed in this branch; production verification below applies to main `e89b3c9fde7ef33aa58ad85cfa91fb5f997050a5`. No course was published or approved by this audit. Time displayed to Karl is America/Chicago; API timestamps are UTC.

## Production and governance evidence

- PR #18 merged at 2026-10-28 10:45:08Z. PR #20 merged at 11:19:58Z, recorded under `karlhargestam-gif`.
- PR #20 explicitly requires Karl's approval. Its timeline has a deployment-bot comment, deployment, merge and close, but no explicit approval or submitted review. Retrieved conversation context also did not establish approval. This is an evidence gap, not a conclusion that the action was unauthorized. Shared-account actor attribution cannot identify the human or agent instruction behind it.
- Main's GitHub Vercel status succeeded at 11:20:10Z: https://vercel.com/one-chance1/ptconline-global/3573bs7fwTDEWa2ZenL8XS74eurY.
- Live `/submit/`, `/es/submit/`, `/pt/submit/` returned 200 and exactly matched the corresponding main files. `GET /api/submit-course` returned 200 `ready`; that endpoint proves configuration presence, not full dependency health.
- GitHub reports main `protected: false` and no repository rulesets. The written approval gate is not enforced by branch protection. The connector cannot inspect administrative settings beyond these observations.
- The Vercel connector listed both expected teams but could not resolve this project or its deployment; environment metadata and firewall reads returned not found. Do not interpret that as absence of the live deployment. Direct administrative inspection, credential-scope verification, Blob access checks and cleanup remain blocked.

## Synthetic production test

Using only a synthetic identity and `example.invalid` email on October 28 evening local time (2026-10-29 02:19Z):

| Test | Observed result |
|---|---|
| Missing material | 400 `material` |
| HTML bytes presented as PDF | 400 `file`; no intake issue |
| Honeypot | 200 `accepted`; no intake issue |
| Valid 78-byte text attachment | 200 `accepted`; private issue and private Blob pathname recorded |
| Markdown/HTML description | Stayed inside inert code fence; injected fence shortened |
| Private queue progression | Synthetic issue moved submitted → screening → review, never ready/published |
| Multilingual punctuation | Multipart UTF-8 decoded as Latin-1: defect reproduced and fixed in this branch |

The private audit record contains the issue number, request references and file paths. No contributor data or private attachment path is copied here. Legacy tests predated PR #20. The current test establishes intake and review-queue mechanics; it does not establish academic approval, legal approval, file restore, anonymous Blob denial, email delivery or human acknowledgment.

## Technical changes in this branch

- Remove the public contributor issue form; route the issue chooser to existing private web intake.
- Decode multipart text as UTF-8 and enforce actual/streamed request-size limits without trusting Content-Length.
- Confirm private repository and label access before storing files.
- Save a private recovery receipt, checksums and opaque receipt ID; preserve files when a GitHub response is uncertain. Clean up definite rejections and log cleanup failures without upstream messages or IP hashes.
- Provide a read-only recovery utility. It never publishes, follows source links or executes attachments.
- Scope anti-framing, object/base/form CSP protections to submission pages and API; add nosniff and referrer policy. Existing course media and content are unchanged.
- Make imports draft PRs requiring a private approval reference; reject dangerous links, caption traversal and overwriting existing main content. Human review still must verify the referenced approval.
- Add regression tests to CI. Private intake PR #6 is merged: its event-driven bot handoff and hourly reconciliation are active. Two issue-event runs succeeded (40807090506 and 40807252190); exactly one bot comment remained after the repeated trigger. This verifies GitHub handoff and duplicate suppression, not email receipt or human acknowledgment.

## Required acceptance and decisions

1. Establish the source of Karl's PR #20 approval, or record that prior approval remains unverified. Do not manufacture retroactive approval.
2. Global Education/authorized PTC leadership must name a monitored privacy/deletion mailbox and accountable operator. The current site offers a department link, not a dedicated address. Do not invent a mailbox or publish an unconfirmed address.
3. The institutional authority must accept or revise licence version `2026-10-28.2`, withdrawal/retention promises, rights declarations and cross-border storage notice, with its chosen legal review. Academic reviewers retain theology/curriculum authority. This technical audit does not provide institutional legal approval.
4. Restore authorized Vercel project visibility; check production-only credential targets, fine-grained token scope/expiry, private store configuration, direct unauthenticated denial, and checksum restore. Remove verified synthetic files referenced in the private audit, then confirm absence. Token expiry is documented as 2027-10-28 but not independently verified.
5. Review a durable firewall limit scoped to POST `/api/submit-course`. Do not blindly apply a low per-IP limit: shared church/school connections can have legitimate submissions. The existing five-per-ten-minute memory limit resets across instances. Inspect current rules and plan before activating a rule.
6. Use a distinct approved human GitHub identity for enforceable reviews; configure main's protection/checks and appropriate bypass policy after the institution chooses its approver. A shared Karl credential cannot distinguish human authorization from agent execution.
7. Confirm recipient email/web notification receipt and human acknowledgment. Bot handoff and repeat suppression have passed on the production-generated synthetic issue; that issue is closed without publication. Deploy this branch only after its review and preview checks; rerun production UTF-8/file/recovery tests on the released commit.

## Final technical validation

18 Node intake/recovery regressions and 4 Python importer tests pass. Generated-page consistency and all 57 static page checks pass. GitHub site-check and Vercel preview build succeeded for code head `3ddc0eac3d4c31475f4d6fca6c20daae17242f87`; protected-preview access remains blocked through the connected Vercel account. Notification PR #6 separately passed six tests and its two live handoff runs. Anonymous access to the private repository returns 404. None of these observations verifies private Blob restore or deletion.

References: [PR #18](https://github.com/karlhargestam-gif/PTConline-global/pull/18), [PR #20](https://github.com/karlhargestam-gif/PTConline-global/pull/20), [GitHub notification reasons](https://docs.github.com/en/rest/activity/notifications), [GitHub schedule limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Vercel private Blob](https://vercel.com/docs/vercel-blob/private-storage).
