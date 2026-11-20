/**
 * Proves a PTC application never claims the office received it for test or dry-run.
 * Fetch is mocked. This file does not contact Resend or the live site.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(root, "api/apply.js"));
const handler = require("./apply.js");

const OFFICE = "wm@pcg.org";
const PRIMARY = ["globalmissions.ea@pcg.org", OFFICE];
const MAIL_TO = PRIMARY.join(",");
const BACKUP = "khargestam@pcg.org";
const APPLICANT = "applicant@example.com";
const OFFICE_SENTENCE = "Your application is in. The PTC team will review it.";
const DRY_RUN_SENTENCE = "Thank you. This preview checked your application. Email is not turned on yet, so nothing was sent to PCG. Use Email my application to send the same copy from your email app.";
const TEST_SENTENCE = "Thank you. This was a test copy only. It did not go to the office. Use Email my application to send the same copy from your email app.";
const FAILED_SENTENCE = "We could not send it automatically. Use Email my application to send the same copy from your email app.";
const LIVE = {
  PTC_APPLY_EMAIL_API_KEY: "test-key-not-real",
  PTC_APPLY_EMAIL_FROM: "applications@notifications.ptconline.global",
};
const ENV_KEYS = [
  "PTC_APPLY_EMAIL_API_KEY",
  "PTC_APPLY_EMAIL_FROM",
  "PTC_APPLY_EMAIL_TO",
  "PTC_APPLY_EMAIL_CC",
  "PTC_APPLY_TEST_MODE",
];
const TYPES = ["college", "country", "school", "student"];
const EN = {
  office: OFFICE_SENTENCE,
  dryRun: DRY_RUN_SENTENCE,
  test: TEST_SENTENCE,
  sendFailed: FAILED_SENTENCE,
  thanksTitle: "Thank you",
  failedTitle: "Application not sent",
};

let serial = 0;
console.log = () => {};
console.error = () => {};

function ip() {
  serial += 1;
  return `198.51.100.${(serial % 200) + 1}`;
}

function payload(type, lang) {
  return {
    company: "",
    applicantType: type,
    organization: type === "student" ? "" : "Sample organization",
    country: "Kenya",
    city: "Nairobi",
    contactName: "Sample Applicant",
    role: type === "student" ? "" : "Dean",
    email: APPLICANT,
    phone: "555-0100",
    language: "English",
    heard: "site",
    training: "Theology",
    message: "Please review this application.",
    consent: "yes",
    lang: lang || "en",
  };
}

async function post(type, env, queue, extra) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url) !== "https://api.resend.com/emails") throw new Error("blocked " + url);
    if (!queue) throw new Error("email send attempted");
    calls.push(JSON.parse(init.body));
    const status = queue.shift();
    if (status === undefined) throw new Error("unexpected extra send");
    return {
      ok: status >= 200 && status < 300,
      status,
      async text() { return "{}"; },
    };
  };
  const previous = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, env || {});
  try {
    const body = extra && extra.body ? extra.body : payload(type, extra && extra.lang);
    let recorded = null;
    const res = {
      statusCode: 0,
      headers: {},
      status(code) { this.statusCode = code; return this; },
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; return this; },
      json(data) { recorded = { status: this.statusCode, body: data, headers: this.headers }; },
      end() { recorded = recorded || { status: this.statusCode, body: null, headers: this.headers }; },
    };
    await handler({
      method: "POST",
      headers: {
        accept: extra && extra.html ? "text/html" : "application/json",
        "content-type": "application/json",
        "x-forwarded-for": ip(),
      },
      body,
    }, res);
    assert.ok(recorded, "handler did not reply");
    return { result: recorded, calls };
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function assertMode(result, mode, status) {
  assert.equal(result.status, status);
  assert.equal(result.body.mode, mode);
  assert.equal(result.body.code, mode);
  assert.notEqual(result.body.code, "ok");
  assert.notEqual(result.body.code, "sent");
  assert.notEqual(result.body.mode, "sent");
  assert.notEqual(result.body.mode, "sent-test");
  assert.notEqual(result.body.mode, "sent-backup");
}

function wentToOffice(calls) {
  return calls.some((call) => Array.isArray(call.to) && call.to.includes(OFFICE));
}

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

function attr(html, name) {
  const match = html.match(new RegExp(`\\bdata-${name}="([^"]*)"`));
  assert.ok(match, `missing data-${name}`);
  return match[1]
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

async function checkApi() {
  for (const type of TYPES) {
    const dry = await post(type);
    assertMode(dry.result, "dry-run", 200);
    assert.equal(dry.result.body.ok, true);
    assert.equal(dry.calls.length, 0);
    assert.equal(dry.result.body.mail.to, MAIL_TO);
    assert.equal(dry.result.body.mail.cc, BACKUP);
    assert.equal(dry.result.body.mail.subject, `PTC application: ${type} (Kenya)`);
    assert.match(dry.result.body.mail.text, /Sample Applicant/);
    assert.match(dry.result.body.mail.text, /Please review this application\./);
    assert.equal(dry.result.body.mail.text.includes("JSON record"), false);
    assert.equal(dry.result.body.mail.text.includes("[TEST]"), false);
    assert.equal(dry.result.body.mail.text.includes(OFFICE_SENTENCE), false);

    const tested = await post(type, { ...LIVE, PTC_APPLY_TEST_MODE: "on" }, [200, 200]);
    assertMode(tested.result, "test", 200);
    assert.equal(wentToOffice(tested.calls), false);
    assert.equal(tested.calls.length, 2);
    for (const call of tested.calls) {
      assert.deepEqual(call.to, [BACKUP]);
      assert.equal(call.cc, undefined);
      assert.equal(call.to.includes(APPLICANT), false);
    }

    const sent = await post(type, LIVE, [200, 200]);
    assertMode(sent.result, "sent-to", 200);
    assert.deepEqual(sent.calls[0].to, PRIMARY);
    assert.deepEqual(sent.calls[0].cc, [BACKUP]);
    assert.deepEqual(sent.calls[1].to, [APPLICANT]);
    assert.equal(sent.calls[0].from, LIVE.PTC_APPLY_EMAIL_FROM);

    const fallback = await post(type, LIVE, [500, 200, 200, 200]);
    assertMode(fallback.result, "fallback-copy", 200);
    assert.equal(wentToOffice(fallback.calls), true);
    assert.equal(fallback.calls[1].cc, undefined);
    assert.deepEqual(fallback.calls[1].to, PRIMARY);
    assert.deepEqual(fallback.calls[2].to, [BACKUP]);
    assert.match(fallback.calls[2].subject, /\(backup copy\)$/);

    const alone = await post(type, LIVE, [500, 200, 500, 200]);
    assertMode(alone.result, "to-only", 200);
    assert.deepEqual(alone.calls[1].to, PRIMARY);

    const failed = await post(type, LIVE, [500, 500]);
    assertMode(failed.result, "send-failed", 502);
    assert.equal(failed.result.body.ok, false);
    assert.equal(failed.calls.length, 2);
    assert.equal(failed.calls.some((call) => call.to.includes(APPLICANT)), false);
    assert.equal(failed.result.body.mail.to, MAIL_TO);

    const replyFailed = await post(type, LIVE, [200, 500]);
    assertMode(replyFailed.result, "sent-to", 200);
    assert.equal(wentToOffice(replyFailed.calls), true);
  }

  for (const flag of ["1", "true", "yes", " ON "]) {
    const tested = await post("college", { ...LIVE, PTC_APPLY_TEST_MODE: flag }, [200, 200]);
    assertMode(tested.result, "test", 200);
    assert.equal(wentToOffice(tested.calls), false);
  }
  for (const flag of [undefined, "", "0", "false", "off", "no", "maybe"]) {
    delete process.env.PTC_APPLY_TEST_MODE;
    if (flag !== undefined) process.env.PTC_APPLY_TEST_MODE = flag;
    assert.equal(handler.testMode(), false, `flag ${JSON.stringify(flag)} must be off`);
    delete process.env.PTC_APPLY_TEST_MODE;
    const sent = await post("school", { ...LIVE, ...(flag === undefined ? {} : { PTC_APPLY_TEST_MODE: flag }) }, [200, 200]);
    assertMode(sent.result, "sent-to", 200);
    assert.deepEqual(sent.calls[0].to, PRIMARY);
  }

  const custom = await post("country", {
    ...LIVE,
    PTC_APPLY_TEST_MODE: "yes",
    PTC_APPLY_EMAIL_CC: "reviewer@example.com",
  }, [200, 200]);
  assertMode(custom.result, "test", 200);
  for (const call of custom.calls) assert.deepEqual(call.to, ["reviewer@example.com"]);
  assert.equal(wentToOffice(custom.calls), false);

  const customLive = await post("college", {
    ...LIVE,
    PTC_APPLY_EMAIL_TO: "first@example.com, second@example.com, FIRST@example.com",
    PTC_APPLY_EMAIL_CC: "second@EXAMPLE.com, reviewer@example.com, REVIEWER@example.com",
  }, [200, 200]);
  assertMode(customLive.result, "sent-to", 200);
  assert.deepEqual(customLive.calls[0].to, ["first@example.com", "second@example.com"]);
  assert.deepEqual(customLive.calls[0].cc, ["reviewer@example.com"]);
  assert.deepEqual(customLive.calls[1].to, [APPLICANT]);
  assert.equal(customLive.calls[1].cc, undefined);

  const single = await post("college", {
    ...LIVE,
    PTC_APPLY_EMAIL_TO: "office@example.com",
    PTC_APPLY_EMAIL_CC: "reviewer@example.com",
  }, [200, 200]);
  assert.deepEqual(single.calls[0].to, ["office@example.com"]);
  assert.deepEqual(single.calls[0].cc, ["reviewer@example.com"]);

  const overlap = await post("college", {
    ...LIVE,
    PTC_APPLY_EMAIL_TO: "office@example.com",
    PTC_APPLY_EMAIL_CC: "OFFICE@example.com",
  }, [500]);
  assertMode(overlap.result, "send-failed", 502);
  assert.equal(overlap.calls.length, 1, "no duplicate retry when CC is already primary");
  assert.equal(overlap.calls[0].cc, undefined);

  for (const invalidList of [
    "valid@example.com, invalid",
    "valid@example.com,",
    "valid@example.com,,other@example.com",
    "Name <valid@example.com>",
    "valid@example.com;other@example.com",
    "valid@example.com\r\nBcc:other@example.com",
    "a".repeat(201) + "@example.com",
  ]) {
    const invalid = await post("school", {
      ...LIVE,
      PTC_APPLY_EMAIL_TO: invalidList,
      PTC_APPLY_EMAIL_CC: invalidList,
    }, [200, 200]);
    assertMode(invalid.result, "sent-to", 200);
    assert.deepEqual(invalid.calls[0].to, PRIMARY);
    assert.deepEqual(invalid.calls[0].cc, [BACKUP]);
  }

  const testedList = await post("college", {
    ...LIVE,
    PTC_APPLY_TEST_MODE: "true",
    PTC_APPLY_EMAIL_TO: "office@example.com, other-office@example.com",
    PTC_APPLY_EMAIL_CC: "reviewer@example.com, another-reviewer@example.com",
  }, [200, 200]);
  assertMode(testedList.result, "test", 200);
  for (const call of testedList.calls) {
    assert.deepEqual(call.to, ["reviewer@example.com", "another-reviewer@example.com"]);
    assert.equal(call.cc, undefined);
    assert.match(call.subject, /^\[TEST/);
  }

  const multiFallback = await post("school", {
    ...LIVE,
    PTC_APPLY_EMAIL_TO: "first@example.com, second@example.com",
    PTC_APPLY_EMAIL_CC: "reviewer@example.com, another-reviewer@example.com",
  }, [500, 200, 200, 200]);
  assertMode(multiFallback.result, "fallback-copy", 200);
  assert.deepEqual(multiFallback.calls[1].to, ["first@example.com", "second@example.com"]);
  assert.equal(multiFallback.calls[1].cc, undefined);
  assert.deepEqual(multiFallback.calls[2].to, ["reviewer@example.com", "another-reviewer@example.com"]);
  assert.deepEqual(multiFallback.calls[3].to, [APPLICANT]);
  assert.equal(multiFallback.calls[3].cc, undefined);

  const named = await post("college", {
    PTC_APPLY_EMAIL_API_KEY: "test-key-not-real",
    PTC_APPLY_EMAIL_FROM: "PTC <applications@notifications.ptconline.global>",
  });
  assertMode(named.result, "dry-run", 200);
  assert.equal(named.calls.length, 0);

  const multipleFrom = await post("college", {
    ...LIVE,
    PTC_APPLY_EMAIL_FROM: "first@example.com,second@example.com",
  });
  assertMode(multipleFrom.result, "dry-run", 200);
  assert.equal(multipleFrom.calls.length, 0);

  const spamCalls = [];
  globalThis.fetch = async () => { spamCalls.push("sent"); throw new Error("email send attempted"); };
  Object.assign(process.env, LIVE);
  let spam = null;
  await handler({
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-forwarded-for": ip() },
    body: { ...payload("college"), company: "Spam Co" },
  }, {
    statusCode: 0,
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    json(data) { spam = data; },
    end() {},
  });
  for (const key of ENV_KEYS) delete process.env[key];
  assert.equal(spam.code, "ok");
  assert.equal(spam.mode, undefined);
  assert.equal(spamCalls.length, 0);

  let bad = null;
  await handler({
    method: "POST",
    headers: { accept: "application/json", "x-forwarded-for": ip() },
    body: { applicantType: "college" },
  }, {
    statusCode: 0,
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    json(data) { bad = data; },
    end() {},
  });
  assert.equal(bad.code, "invalid");
  assert.equal(bad.mode, undefined);

  const html = await post("student", {}, null, { html: true, lang: "es" });
  assert.equal(html.result.status, 303);
  assert.equal(html.result.headers.location, "/es/apply/?mode=dry-run");
  assert.equal(String(html.result.headers.location).includes("sent=1"), false);
  assert.equal(html.calls.length, 0);
}

function checkPage() {
  const source = readFileSync(join(root, "api/apply.js"), "utf8");
  const client = readFileSync(join(root, "assets/js/apply.js"), "utf8");
  assert.ok(client.includes(`var OFFICE = "${MAIL_TO}";`));
  assert.ok(client.includes(`var BACKUP = "${BACKUP}";`));
  assert.equal(source.includes('code: "sent"'), false);
  assert.equal(source.includes("sent-test"), false);
  assert.equal(source.includes("sent-backup"), false);
  assert.equal(source.includes("sent=1"), false);
  assert.equal(client.includes("sent=1"), false);
  assert.equal(source.includes("defaults to on"), false);

  const applicationResult = vm.runInNewContext(
    `"use strict";\n${extractFunction(client, "applicationResult")}\napplicationResult;`,
  );
  const mailtoFor = vm.runInNewContext(
    `"use strict";\n${extractFunction(client, "mailtoFor")}\nmailtoFor;`,
    { encodeURIComponent, OFFICE: MAIL_TO, BACKUP },
  );
  const officeModes = ["sent-to", "fallback-copy", "to-only"];
  const otherModes = ["dry-run", "test", "send-failed", "busy", "invalid", "sent", "sent-test", "sent-backup", "cc", ""];
  for (const mode of officeModes) {
    const view = applicationResult(mode, EN);
    assert.equal(view.detail, OFFICE_SENTENCE, mode);
    assert.equal(view.office, true, mode);
    assert.equal(view.showEmail, false, mode);
    assert.equal(view.heading, "Thank you", mode);
  }
  for (const mode of otherModes) {
    const view = applicationResult(mode, EN);
    assert.notEqual(view.detail, OFFICE_SENTENCE, mode);
    assert.equal(view.detail.includes(OFFICE_SENTENCE), false, mode);
    assert.equal(view.office, false, mode);
  }
  assert.equal(applicationResult("dry-run", EN).detail, DRY_RUN_SENTENCE);
  assert.equal(applicationResult("dry-run", EN).showEmail, true);
  assert.equal(applicationResult("test", EN).detail, TEST_SENTENCE);
  assert.equal(applicationResult("test", EN).showEmail, true);
  assert.equal(applicationResult("send-failed", EN).detail, FAILED_SENTENCE);
  assert.equal(applicationResult("send-failed", EN).showEmail, true);
  assert.equal(applicationResult("send-failed", EN).heading, "Application not sent");
  assert.equal(applicationResult("busy", EN).showEmail, false);
  assert.equal(applicationResult("invalid", EN).showEmail, false);
  assert.equal(applicationResult("ok", EN).detail, OFFICE_SENTENCE);
  assert.equal(applicationResult("ok", EN).showEmail, false);
  assert.equal(applicationResult("ok", EN).office, false);

  const pages = {
    "apply/index.html": {
      office: OFFICE_SENTENCE,
      dry: DRY_RUN_SENTENCE,
      test: TEST_SENTENCE,
      failed: FAILED_SENTENCE,
      button: "Email my application",
      failedTitle: "Application not sent",
    },
    "es/apply/index.html": {
      office: "Recibimos su solicitud. El equipo de PTC la revisará.",
      dry: "Gracias. Esta vista previa revisó su solicitud. El correo aún no está activado, así que no se envió nada a PCG. Use Enviar mi solicitud para enviar la misma copia desde su aplicación de correo.",
      test: "Gracias. Esta fue solo una copia de prueba. No llegó a la oficina. Use Enviar mi solicitud para enviar la misma copia desde su aplicación de correo.",
      failed: "No pudimos enviarla de forma automática. Use Enviar mi solicitud para enviar la misma copia desde su aplicación de correo.",
      button: "Enviar mi solicitud",
      failedTitle: "Solicitud no enviada",
    },
    "pt/apply/index.html": {
      office: "Recebemos sua candidatura. A equipe do PTC vai analisá-la.",
      dry: "Obrigado. Esta prévia conferiu sua candidatura. O e-mail ainda não está ativado, então nada foi enviado à PCG. Use Enviar minha candidatura para enviar a mesma cópia pelo seu aplicativo de e-mail.",
      test: "Obrigado. Esta foi apenas uma cópia de teste. Ela não foi para o escritório. Use Enviar minha candidatura para enviar a mesma cópia pelo seu aplicativo de e-mail.",
      failed: "Não conseguimos enviá-la automaticamente. Use Enviar minha candidatura para enviar a mesma cópia pelo seu aplicativo de e-mail.",
      button: "Enviar minha candidatura",
      failedTitle: "Candidatura não enviada",
    },
  };
  for (const [rel, expected] of Object.entries(pages)) {
    const html = readFileSync(join(root, rel), "utf8");
    const copy = {
      office: attr(html, "office"),
      dryRun: attr(html, "dry-run"),
      test: attr(html, "test"),
      sendFailed: attr(html, "send-failed"),
      thanksTitle: attr(html, "thanks-title"),
      failedTitle: attr(html, "failed-title"),
    };
    assert.equal(copy.office, expected.office, rel);
    assert.equal(copy.dryRun, expected.dry, rel);
    assert.equal(copy.test, expected.test, rel);
    assert.equal(copy.sendFailed, expected.failed, rel);
    assert.equal(copy.failedTitle, expected.failedTitle, rel);
    assert.match(html, new RegExp(`<p id="apply-thanks-detail">${expected.office.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</p>`));
    assert.match(html, new RegExp(`id="apply-email-link"[^>]*>${expected.button}</a>`));
    assert.match(html, /href="mailto:globalmissions\.ea@pcg\.org,wm@pcg\.org\?cc=khargestam%40pcg\.org"/);
    assert.equal(applicationResult("dry-run", copy).detail, expected.dry);
    assert.equal(applicationResult("dry-run", copy).detail.includes(expected.office), false);
    assert.equal(applicationResult("test", copy).detail.includes(expected.office), false);
    assert.equal(applicationResult("send-failed", copy).detail.includes(expected.office), false);
    assert.equal(applicationResult("sent-to", copy).detail, expected.office);
    const link = mailtoFor({ subject: "PTC application: college (Kenya)", text: "Contact: Sample Applicant" });
    assert.equal(link.startsWith(`mailto:${MAIL_TO}?`), true);
    assert.equal(link.includes(`cc=${encodeURIComponent(BACKUP)}`), true);
    assert.equal(link.includes(`body=${encodeURIComponent("Contact: Sample Applicant")}`), true);
    assert.equal(link.includes("reviewer@example.com"), false);
  }
  assert.match(readFileSync(join(root, "apply/index.html"), "utf8"), /value="college"/);
  assert.match(readFileSync(join(root, "apply/index.html"), "utf8"), /value="country"/);
  assert.match(readFileSync(join(root, "apply/index.html"), "utf8"), /value="school"/);
  assert.match(readFileSync(join(root, "apply/index.html"), "utf8"), /value="student"/);
}

await checkApi();
checkPage();
console.info("application delivery check: ok");
