# Snippets for pcgmission.org

Notes for the PCG Global Missions webmaster. The biography below is the canonical text for LinkedIn and about.me. It uses Karl Hargestam’s current roles and the figure of about 110 nations. It does not copy older profile copy that says 78 nations, and it does not add personal history that is not part of this canonical text.

Public pages checked on 14 October 2026: [pcgmission.org](https://www.pcgmission.org/), [about.me/hargestam](https://about.me/hargestam), and the LinkedIn profile returned for “Karl Hargestam LinkedIn”.

## Person JSON-LD

Paste this in the `<head>` of the page that should be Karl Hargestam’s canonical URL on pcgmission.org. `image` points at the portrait already on the site (the file whose alt text is “Karl & Jennifer Hargestam, PCG missionary”). After the rename in the alt-text section, change `image` to the new filename and redirect the old URL.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Karl Hargestam",
  "jobTitle": "Director, PCG Global Missions",
  "worksFor": {
    "@type": "Organization",
    "name": "Pentecostal Church of God",
    "alternateName": "PCG Global Missions",
    "url": "https://pcgmission.org"
  },
  "url": "https://www.pcgmission.org/",
  "image": "https://www.pcgmission.org/assets/asset-77.jpg",
  "sameAs": [
    "https://ptconline.global/about/karl-hargestam",
    "https://www.linkedin.com/in/karl-hargestam-72327034",
    "https://about.me/hargestam",
    "https://missiononeeleven.com"
  ]
}
</script>
```

The LinkedIn URL is the profile public search returns for Karl Hargestam, Global Missions Director at Pentecostal Church of God: `https://www.linkedin.com/in/karl-hargestam-72327034`. about.me is included because `https://about.me/hargestam` is the same person and names the same directorship. If `url` later becomes a dedicated biography on pcgmission.org, point `url` at that page and keep this block’s `sameAs` list.

## One H1

The homepage title is “PCG Global Missions | One Mission. One Movement. One Chance.” The page currently publishes 15 `<h1>` elements. Keep a single `<h1>` for the primary heading, the first “ONE CHANCE”, and change every later `<h1>` to `<h2>`:

- ONE CHANCE (second instance)
- The last mile becomes visible.
- KUMZARI
- FROM CALLING TO DEPLOYMENT.
- FIVE DEPARTMENTS. ONE SHARED MISSION.
- COMMITTED TO THE HARVEST UNTIL THE WHOLE WORLD HEARS.
- FORM LEADERS. BUILD CAPACITY. SEND TOWARD THE FRONTIER.
- SEE THE PERSON. STAY NEAR. SERVE WITH DIGNITY.
- WHEN DISASTER STRIKES THE LAST MILE, WE ARE ALREADY THERE.
- HONOR THE STORY. CELEBRATE THE PEOPLE. CONTINUE THE MISSION.
- PEOPLE WHO SAID YES.
- FINDING THE FRONTIER. INFORMING THE MISSION.
- FRONTIER BRIEF
- FUND THE NEXT FAITHFUL STEP.

## Alt text

Describe the people and the ministry in the picture: nations, training leaders, or discipleship. Do not leave a repeated label such as “Department ministry field photograph”, and do not use an empty alt on the flame logo when that image is the brand mark.

| File | Replace the alt with |
|---|---|
| `assets/asset-77.jpg` | Karl Hargestam, Director of PCG Global Missions, and Jennifer Hargestam, serving the Pentecostal Church of God among the nations |
| `assets/departments/DSC06125 copy.jpg` | A congregation gathered for worship with PCG World Missions, discipleship among the nations |
| `assets/asset-52.jpg` | People meeting in a home during PCG ministry, care and discipleship close to the community |
| `assets/departments/Great Commission.jpg` | A group gathered outdoors with PCG Global Education, training leaders for discipleship |
| `assets/departments/One Chance.jpg` | A crowd gathered outside a church for worship and witness, the One Chance call to the nations |
| `assets/asset-26.svg` and `assets/asset-94.svg` | Pentecostal Church of God, when the flame is the logo and the name is not already beside it. Leave `alt=""` only when the name is already in the link text. |

`asset-52.jpg` shows people in a home. Confirm which department card uses it before publishing that sentence, and keep the alt matched to the frame.

Filenames that are safe to change, once every reference is updated and the old path redirects:

- `assets/asset-77.jpg` to `assets/karl-jennifer-hargestam.jpg`
- `assets/departments/DSC06125 copy.jpg` to `assets/departments/world-missions-worship-nations.jpg` (the current name has a space and a camera number)

Leave a filename alone when other sites already request that exact URL and a redirect is not in place.

Missionary portraits that only say “Name, PCG missionary” can add the field or the work already printed on that card (nations, training leaders, discipleship). Do not add a place or a role the card does not state.

## Canonical bio, 120 words

Karl Hargestam is Director of PCG (Pentecostal Church of God) Global Missions. He leads One Chance and Operation Uttermost, a global ministry and leadership effort spanning about 110 nations.

He is connected with the Pentecostal Theological Consortium (PTC) and with Mission One Eleven. PTC is an initiative of PCG Global Missions and is taking shape as a global learning network. Its aim is trusted Pentecostal teaching that can travel, while the language, mentors and ministry of each place stay intact. Mission One Eleven prepares pioneer missionaries, and seven of its courses are open courseware there.

Level 2 includes leadership sessions with Karl Hargestam, Tamara Gutel, Eman Hernandez, Mikael Boman and Marie Vanderwal on discipleship, multiplication and the church circle tool.

## Canonical bio, 300 words

Karl Hargestam is Director of PCG (Pentecostal Church of God) Global Missions. He leads One Chance and Operation Uttermost, a global ministry and leadership effort spanning about 110 nations. He is connected with the Pentecostal Theological Consortium (PTC) and with Mission One Eleven.

PTC is an initiative of PCG Global Missions, Pentecostal Church of God. It is taking shape as a global learning network whose aim is trusted Pentecostal teaching that can travel, while the language, mentors and ministry of each place stay intact. The pathway starts with one course, in a language a leader understands, walked through with a local mentor and applied in real ministry. ptconline.global is the catalog for that network, published in English, Spanish and Portuguese. It does not enroll a student, record progress or issue a certificate. Those steps stay with the partner that owns the course.

PTC is connected with the Global Education department at PCG Global Missions and with an academic pathway through Messenger College. Messenger College keeps the full materials and the admission decision for its credit courses, which the catalog lists as overviews. Mission One Eleven prepares pioneer missionaries. Its seven courses on the site are open courseware and can be studied without an account. Karl is connected with both. This biography does not give him another office inside either partner.

Level 2 is a leadership development track with sessions by Karl Hargestam, Tamara Gutel, Eman Hernandez, Mikael Boman and Marie Vanderwal. It covers discipleship, multiplication and the church circle tool. Sessions named with him include an unreached presentation and “Remaining Faithful to What God Has Called Us To.”

The only roles to state are these: Director of PCG Global Missions; leader of One Chance and Operation Uttermost across about 110 nations; connected with PTC and Mission One Eleven.
