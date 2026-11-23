import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const content = JSON.parse(read("content/ecq.json"));
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(read("assets/js/ecq-score.js"), sandbox);
const { bandFor, scoreAreas } = sandbox.EcqScore;

const bands = content.check.bands;
const areas = content.check.areas;
const label = (score) => bandFor(score, bands).label;

assert.equal(label(5), "Growing");
assert.equal(label(11), "Growing");
assert.equal(label(12), "Developing");
assert.equal(label(18), "Developing");
assert.equal(label(19), "Strong");
assert.equal(label(25), "Strong");
assert.equal(bandFor(4, bands), null);
assert.equal(bandFor(26, bands), null);

function answersFrom(values) {
  const answers = {};
  let i = 0;
  for (const area of areas) {
    for (const item of area.items) answers[String(item.n)] = values[i++];
  }
  return answers;
}

function totals(values) {
  return scoreAreas(areas, answersFrom(values), bands).map((area) => ({
    id: area.id,
    total: area.total,
    band: area.band && area.band.label,
    complete: area.complete,
  }));
}

const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

same(totals(Array(20).fill(1)).map((area) => area.total), [5, 5, 5, 5]);
same(totals(Array(20).fill(5)).map((area) => area.band), ["Strong", "Strong", "Strong", "Strong"]);

const edge = totals([
  3, 2, 2, 2, 2,
  3, 3, 2, 2, 2,
  4, 4, 4, 3, 3,
  4, 4, 4, 4, 3,
]);
same(edge.map((area) => area.total), [11, 12, 18, 19]);
same(edge.map((area) => area.band), ["Growing", "Developing", "Developing", "Strong"]);

const withPractice = answersFrom(Array(20).fill(3));
for (const item of content.check.practice) withPractice[String(item.n)] = 5;
const ignored = scoreAreas(areas, withPractice, bands);
same(ignored.map((area) => area.total), [15, 15, 15, 15]);
assert.ok(ignored.every((area) => area.band.label === "Developing"));

const missing = answersFrom(Array(20).fill(5));
delete missing["7"];
const partial = scoreAreas(areas, missing, bands);
assert.equal(partial[1].complete, false);
assert.equal(partial[1].total, null);
assert.equal(partial[0].total, 25);

assert.equal(areas.length, 4);
same(areas.map((area) => area.items.map((item) => item.n)), [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
]);
same(content.check.practice.map((item) => item.n), [21, 22, 23, 24]);
same(bands.map((band) => [band.min, band.max]), [[5, 11], [12, 18], [19, 25]]);
for (const area of areas) {
  for (const band of bands) {
    assert.equal(typeof content.check.nextSteps[area.id][band.id], "string");
  }
}

assert.equal(content.steps[0].heading, "The core stays. The form can change.");
assert.match(content.steps[0].paragraphs[5], /You will hear one church’s story, sit with each of the four areas, practice each one with someone else, and then use a brief self-check/);
const story = content.steps[0].story;
assert.equal(story.title, "One church’s story: Ekklesia, Cagayan de Oro");
assert.equal(story.paragraphs.length, 1);
assert.match(story.paragraphs[0], /^Ekklesia is a church in Cagayan de Oro, Philippines, led by Pastor Eyan Galvez, who has come out of the PCGAMI movement\./);
assert.doesNotMatch(story.paragraphs[0], /Pentecostal Church of God church/);
assert.equal(story.watchLabel, "Watch Ekklesia’s story");
assert.equal(story.watchHref, "https://www.youtube.com/watch?v=HLse_5FT1yQ");
const storyWords = story.paragraphs[0].trim().split(/\s+/);
assert.ok(storyWords.length >= 70 && storyWords.length <= 90, "story length " + storyWords.length);
assert.equal((story.paragraphs[0].match(/[.!?](?:\s|$)/g) || []).length, 4);
for (const phrase of ["G12", "Castellanos", "adopt not adapt", "one world", "Pending confirmation"]) {
  assert.equal(story.paragraphs[0].toLowerCase().includes(phrase.toLowerCase()), false, phrase);
}
assert.doesNotMatch(story.paragraphs[0], /\badapt\b/i);
assert.doesNotMatch(story.paragraphs[0], /\d+(?:\.\d+)?%/);
assert.equal(content.ui.inviteHref, "https://www.pcgmission.org/come-over-and-help-us/");
assert.equal(content.ui.inviteTodo, undefined);
assert.doesNotMatch(read("content/ecq.json") + read("assets/js/ecq.js"), /This stays off until the Come over and help us form is live/);
assert.match(content.steps.find((step) => step.id === "check").notice[0], /a reflection tool, not a validated assessment/);

const bundled = [
  read("content/ecq.json"),
  read("ecq/index.html"),
  read("assets/js/ecq.js"),
  read("assets/css/ecq.css"),
].join("\n");
for (const phrase of ["Questions for Jennifer", "Internal source map", "Notes for later", "dissertation", "Pending confirmation", "G12", "Castellanos", "adopt not adapt", "one world"]) {
  assert.equal(bundled.includes(phrase), false, phrase);
}
assert.match(read("ecq/index.html"), /name="robots" content="index, follow"/);
assert.doesNotMatch(read("ecq/index.html"), /noindex/);
assert.match(read("sitemap.xml"), /<loc>https:\/\/ptconline\.global\/ecq<\/loc>/);
const nav = read("ecq/index.html").split('id="banner-nav"')[1].split("</nav>")[0];
assert.match(nav, /href="\/ecq\/"/);
assert.doesNotMatch(read("assets/js/ecq.js"), /localStorage|sessionStorage|indexedDB|sendBeacon|gtag|analytics/i);

console.log("ECQ bands: 11 Growing, 12 Developing, 18 Developing, 19 Strong.");
