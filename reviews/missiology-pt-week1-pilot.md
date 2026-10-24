# Portuguese Missiology Week 1 pilot — review record
Date: 2026-10-24. Status: HOLD; not approved for student publication.
No voice-over files, translated instructional text, or Drive sharing changes are introduced by this review record.

## Evidence and scope
Inspected PR #8 at b24ec855da2295e33cff1b8b82c8fa2679c5f7ce (open draft), its course JSON, build script, subtitle files, syllabus, copyright policy, and the supplied Drive folder. PR description is stale: all six Missiology weeks already have EN/ES/PT subtitle assets and track mappings on that branch. Reuse that work; do not regenerate it blindly.

Source folder: https://drive.google.com/drive/folders/10Kk0F9zurEgFgPpYGI39PxEyLB5FrQdw
Existing implementation: https://github.com/karlhargestam-gif/PTConline-global/pull/8

## Existing course structure
- content/courses/missiology.json owns the six-week course; scripts/build.py generates /pt/courses/missiology/ plus EN/ES equivalents.
- Week 1 is "The Assignment" / "A tarefa", anchor week-1.
- Original recording is the existing Dropbox Missiology of Unreached.Week 1.mp4 source.
- Welcome contains the orientation video, English syllabus, The Core, The Assignment, workbook, Gospel Stories and shorthand gospel PDFs. Portuguese labels do not prove Portuguese document contents.
- Week 1 reading/workbook/discussion entries refer students to Canvas; activity content was not inspected inside Canvas.
- Week 1 GSEC presentation 2016 has no linked file.
- Course teaching language correctly remains English. This pilot must not relabel all six weeks as Portuguese.
- Static catalog has no student accounts, completion tracking, grading or certificates; Canvas remains the activity system.

## Voice-over inventory
All three files were created October 23 and listed as not shared.
- Part 1, advertised 0–60.5 min, 80,105,827 bytes; Drive ID 1kwd8JoNAmMT55MjatUmYxZgH0gI7KLn1.
- Part 2, advertised 60–121 min, 91,968,219 bytes; Drive ID 1cLgUE7bes9J4yWteGn5EU-K5hN-FXkoq. Metadata read lists only owner permission.
- Sample, advertised 10–13 min, 5,302,699 bytes; Drive ID 1Tcja11pw0pU2_QexBZVhxtG_cI0ltuoP.
Names identify Piper TTS; production script, exact voice/model, licenses and translation source version were not supplied.

## Technical results (not language approval)
- Sample fetched and completely decoded with ffmpeg without reported errors.
- Sample: 180.146 s video / 180.011 s audio; H.264 High, 960x540, yuv420p; AAC-LC stereo 48 kHz. Both streams begin at zero. Stream duration difference 0.135 s is not a speech synchronization measurement.
- No embedded subtitle stream or closed captions; language tags are und.
- Original MP4 container reports 7253.179271 s (2:00:53.179). Source download was bounded and partial, so this is metadata evidence, not a full decode pass.
- Source frame at 10:00 and sample opening show the same recording setting but differing framing/pose. This supports a coarse source relationship only; exact edit/time alignment remains unverified.
- Full Part 1 / Part 2 raw fetch attempts failed with connector "Transport closed"; no complete decoding, duration, audio quality, seam or synchronization verdict is available.
- Filenames suggest a 30-second overlap (60:00–60:30); verify actual source offsets before trimming or joining.
- PR #8 Week 1 PT VTT has 1326 parsed cues, EN 1327, ES 1345. All start at 00:00:03.260 and end at 02:00:52.910; no nonpositive durations or adjacent overlaps in this check.
- Each track has 18 gaps greater than 30 s. Longest 01:27:06.130–01:28:39.040. These may include silence or missing speech; timestamps alone cannot distinguish them.
- Other priority gaps: 00:43:51.950–00:44:49.070; 00:53:31.190–00:54:19.450; 01:37:09.350–01:38:29.250; 01:41:39.570–01:42:54.450.
- python3 scripts/build.py --check passed at the reviewed PR head.
- python3 .github/scripts/site_check.py --host ptconline.global passed: 54 pages, zero errors. This is static validation, not live link or media playback certification.

## Concrete instructional review blockers
- At 00:01:04.020–00:01:11.940 the English transcript garbles the Acts 1:8 reference and sentence; Portuguese inherits the error ("Um oito" and a malformed Samaria phrase). Correct from the actual source audio, then have a Portuguese theological reviewer approve it. Do not simply substitute an assumed quotation.
- At 00:00:20.480 "ESRA" needs source verification and an approved Portuguese Scripture reference.
- The Assignment book is variously rendered as "A tarefa", "atribuição", and "designação"; distinguish a book title from the theological concept.
- Approve a glossary covering unreached/unengaged peoples, pioneer mission, Great Commission, Holy Spirit and Scripture/book names.
- Do not assume the new VTT was the input to the October 23 voice-over. Obtain the exact script and generation manifest, compare it with reviewed text, and regenerate affected speech if necessary.
- A qualified native/fluent Portuguese reviewer with theological teaching competence must hear the entire lesson against the original, including pronunciation, omissions, pacing, questions and doctrinal meaning. Record timestamped corrections and reviewer sign-off.

## Accessibility and permissions
- Voice-over does not replace captions. Prepare captions matching the actual Portuguese audio, including meaningful sounds/speaker changes, plus a readable transcript.
- Existing full-length source-timed VTT cannot simply be attached to Part 2: verify the edit map and retime to each part's local clock. Account for overlap and any TTS timing changes.
- Check keyboard access, focus visibility, caption controls, fullscreen, playback speed, text contrast, small-screen wrapping and required visual information not spoken aloud.
- Copyright page explicitly says hosting is not republication permission and rights review remains open. No asset-specific translation/dubbing/publication clearance was found in inspected materials.
- Institutional approver must document source lecture reuse/translation rights, speaker/participant permissions where applicable, third-party visuals/readings and the actual TTS voice/model license. Drive ownership is not such clearance.
- Specify authorized pilot audience and approved hosting/access controls. Do not make Drive files public merely to fix playback.

## Integration after approval
1. Correct source transcript, Portuguese text and audio; retain revision IDs/checksums and exact source offsets for each part.
2. Have Portuguese instructional reviewer and PTC institutional/rights approver sign off on those exact revisions.
3. Coordinate with PR #8 owner; consume its current Missiology mappings and corrected tracks.
4. Extend the existing content model/build renderer for per-page-language alternate media. Add the approved two-part Portuguese option within Week 1, retaining original English access and existing Week 2–6 organization.
5. Provide explicit Part 1 / Part 2 navigation, accurate ranges and a transcript. Do not include the sample as a third required lesson.
6. Use approved media delivery with range requests, suitable MIME types and tested access. Private Drive view URLs are not HTML video sources.
7. Keep review builds authenticated; do not rely on noindex or an unlisted URL as access control. Do not merge PR #8 or this pilot as instructional approval.
8. Test the exact final preview before release and record reviewer, date, commit and media versions.

## Remaining test matrix
Desktop Chrome and Safari; mobile Safari/iOS and Chrome/Android:
- Catalog -> Portuguese Missiology -> Week 1; return navigation and EN/ES/PT switching preserve the course.
- Authorized playback starts; seeking, speed, fullscreen and reload work.
- Both parts play to completion; seam has no lost or unintended repeated instruction.
- Captions load, toggle, stay aligned after seeks and use correct per-part timing.
- Transcript and learning activities are accessible; small-screen layout has no horizontal overflow.
- Unauthorized visitor cannot access review assets.

The current Vercel preview redirects this browser to sign-in. No authenticated Vercel CLI is available. Local Playwright could not start because its browser binary is absent, and browser installation failed. Therefore desktop/mobile visual checks, live playback, navigation and caption interaction have NOT passed. Do not describe this as a functioning student pilot yet.

## Human decisions still needed
Name the qualified Portuguese instructional reviewer and the PTC institutional publication approver. Obtain the exact voice-over script/manifest and clearance evidence. No person is assigned or claimed to have approved by this document.
