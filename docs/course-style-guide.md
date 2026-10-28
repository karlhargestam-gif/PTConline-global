# Course style guide

A course on ptconline.global is a week-by-week catalog page. The shape is the one already used in `content/courses/*.json`: a title, a level, a description, and blocks for each week or lesson. Each week can hold a video, readings, and an assignment or quiz. Captions are WebVTT tracks on the video.

The starter file is `templates/course-submission/course.md`. `scripts/import_course.py` turns an approved copy of that file into a course JSON file and opens a pull request. It does not publish by itself.

## Voice

Write the way the rest of the site writes. Short sentences. Concrete people and places: a local church, a local mentor, a course a leader can use. Say “local to global”: training starts in the local church with a local mentor and is offered so another church can use it.

Do not use a stock slogan, a countdown, or a claim about enrolment numbers. Do not invent a partner, a date, or an accreditation.

## One lesson

One lesson is one week block (`kind: week`). Give it:

- one main video, as an `https` link
- the reading for that week
- one assignment or quiz

The existing open courses are built this way (see Book of Acts and Mentoring in Missions). Keep a lesson to what a local mentor can walk through in one sitting. Do not add a second lecture to the same week.

## Scripture

Spanish and Portuguese quotations use **NVI** (Nueva Versión Internacional / Nova Versão Internacional). The import script refuses a course whose `bible.es` or `bible.pt` is not `NVI`.

English quotations stay in the wording the author supplies. Do not label an English text as NVI.

## Captions

Every video needs an English, a Spanish, and a Portuguese WebVTT file. The import script copies them to `assets/subtitles/` and refuses the course if any language is missing.

A caption cue is at most **2 lines**, and each line is at most **42 characters**. The script checks the files and stops on a longer cue. That matches the rule for this catalog: two lines, 42 characters.

## Pictures

No crusade imagery. Do not use a field-crusade photograph, a rally crowd, or a filename with “crusade” in it. A conference still is a different thing and is already the home hero. A lesson image, if one is needed, shows the teaching setting: a class, a book, a local church. The import script rejects a file whose name contains “crusade”.

## Licence line

Keep the consent that arrived with the offer. The JSON records `licence` and `licenceVersion`. The wording on the form is still a draft for Karl’s legal review. Do not describe it as a finished licence in the course page.
