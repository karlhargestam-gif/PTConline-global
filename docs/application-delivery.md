# Application email routing

The staff application notice defaults to:

- **To:** Laiza at `globalmissions.ea@pcg.org` and `wm@pcg.org`.
- **CC:** `khargestam@pcg.org`, kept in place until Karl verifies delivery.
- The applicant confirmation goes only to the applicant.

The manual **Email my application** fallback uses those same addresses in all
three page languages. It opens the applicant's mail app; it does not send mail
by itself.

## Existing deployment settings must be checked

Code defaults do not replace existing environment overrides. For this routing,
any deployed overrides must match:

```text
PTC_APPLY_EMAIL_TO=globalmissions.ea@pcg.org,wm@pcg.org
PTC_APPLY_EMAIL_CC=khargestam@pcg.org
```

Both settings accept one or more comma-separated bare addresses. Whitespace
around addresses is allowed, duplicates are removed case-insensitively, and
addresses already in To are omitted from CC. An unset, empty, or invalid list
uses that setting's complete default list; it never keeps just the valid part.
In particular, an old valid single-address override still replaces the new
default and must be reviewed before release.

When `PTC_APPLY_TEST_MODE` is `1`, `true`, `on`, or `yes`, both sample messages go
only to the configured CC list (Karl by default). That test does **not** prove
delivery to Laiza, WM, or an applicant. The test flag is otherwise off.
Without the API key and a valid bare From address, the handler remains dry-run
and sends nothing. This change does not configure a key, sender or deployment.

After the reviewed version is deployed, verify the actual recipient overrides
and test-mode setting, then use one authorized, clearly marked synthetic
application to check the primary notice, Karl's copy and applicant confirmation.
Do not repeat a submission while its outcome is uncertain. Provider acceptance
and a success page do not establish inbox delivery. Keep Karl's CC until he
confirms verification; the code does not remove it automatically.

## Offline checks

```bash
node .github/scripts/application_delivery_check.mjs
python3 scripts/build.py --check
python3 .github/scripts/site_check.py --host ptconline.global --max-page-kb 1024
```

The delivery check mocks every provider request. It sends no email.
