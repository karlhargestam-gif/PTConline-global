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

assert.equal(content.meta.showEkklesiaStory, true);
assert.equal(content.steps[0].story.note, "Pending confirmation with Pastor Eyan");
assert.equal(content.ui.inviteHref, null);
assert.match(content.steps.find((step) => step.id === "check").notice[0], /a reflection tool, not a validated assessment/);

const bundled = [
  read("content/ecq.json"),
  read("ecq/index.html"),
  read("assets/js/ecq.js"),
  read("assets/css/ecq.css"),
].join("\n");
for (const phrase of ["Questions for Jennifer", "Internal source map", "Notes for later", "dissertation"]) {
  assert.equal(bundled.includes(phrase), false, phrase);
}
assert.match(read("ecq/index.html"), /noindex, nofollow/);
assert.doesNotMatch(read("sitemap.xml"), /ecq/i);
const nav = read("ecq/index.html").split('id="banner-nav"')[1].split("</nav>")[0];
assert.doesNotMatch(nav, /\/ecq/);
assert.doesNotMatch(read("assets/js/ecq.js"), /localStorage|sessionStorage|indexedDB|sendBeacon|gtag|analytics/i);

console.log("ECQ bands: 11 Growing, 12 Developing, 18 Developing, 19 Strong.");
