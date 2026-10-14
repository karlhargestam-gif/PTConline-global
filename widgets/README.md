# PTC course catalog widget

A read-only `<ptc-course-catalog>` element that lists the open courses published on
ptconline.global. Paste these two lines into any page:

```html
<script src="https://ptconline.global/widgets/ptc-catalog.js" defer></script>
<ptc-course-catalog lang="en" limit="4"><a href="https://ptconline.global/courses/">Browse PTC courses</a></ptc-course-catalog>
```

The link inside the element is the no-JavaScript fallback; the widget replaces it once loaded.

## Attributes

| Attribute | Values | Effect |
|-----------|--------|--------|
| `lang`    | `en` (default), `es`, `pt` | Shows courses whose page is translated into that language, using that translation's title, description and link. |
| `limit`   | positive integer | Shows at most that many courses. |

Colours follow the visitor's light/dark preference. The accent can be overridden from the host page:
`ptc-course-catalog { --ptc-accent: #b81d25; --ptc-accent-ink: #94171d; }`.

## Data and privacy

- The only request is `catalog.json`, fetched from the same folder as the script (credentials omitted).
  No cookies, storage, analytics or third-party resources.
- `catalog.json` is generated from the course pages by `.github/scripts/build_catalog.py`.
  The languages it lists are **page translations** of each course page: nothing about
  subtitles, dubbing, credit or certificates is implied.
- After changing a course page, run `python3 .github/scripts/build_catalog.py` and commit the
  result. CI (`site-check.yml`) fails if `catalog.json` is stale.

`demo.html` is a test page: it carries `noindex`, is served with `X-Robots-Tag: noindex`
(see `vercel.json`) and is not in `sitemap.xml`.
