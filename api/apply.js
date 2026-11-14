/**
 * PTC application intake.
 *
 * Sends with Resend when PTC_APPLY_EMAIL_API_KEY and PTC_APPLY_EMAIL_FROM are set.
 * PTC_APPLY_TEST_MODE defaults to on. While it is on, both the staff notice and
 * the applicant confirmation go only to globalmissions.ea@pcg.org.
 * When it is off, the notice goes to wm@pcg.org with globalmissions.ea@pcg.org
 * as backup, and the confirmation goes to the applicant.
 * Without the API key this handler validates, logs a redacted summary, and
 * does not send. No credentials belong in this file. Wording lives in
 * apply-email-templates.js.
 */

const crypto = require("crypto");
const templates = require("./apply-email-templates");

const TYPES = new Set(["college", "country", "school", "student"]);
const HEARD = new Set(["church", "site", "messenger", "moe", "person", "other"]);
const ORG_REQUIRED = new Set(["college", "country", "school"]);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const recent = new Map();
const DEFAULT_TO = "wm@pcg.org";
const DEFAULT_CC = "globalmissions.ea@pcg.org";

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanLong(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function asBool(value) {
  return value === true || value === "yes" || value === "on";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "invalid" };
  if (clean(data.company, 200)) return { error: "spam" };
  const applicantType = clean(data.applicantType, 20);
  if (!TYPES.has(applicantType)) return { error: "invalid" };
  const organization = clean(data.organization, 200);
  const role = clean(data.role, 120);
  if (ORG_REQUIRED.has(applicantType) && !organization) return { error: "invalid" };
  if (ORG_REQUIRED.has(applicantType) && !role) return { error: "invalid" };
  const country = clean(data.country, 80);
  const city = clean(data.city, 80);
  const contactName = clean(data.contactName, 120);
  const email = clean(data.email, 200);
  const phone = clean(data.phone, 40);
  const language = clean(data.language, 80);
  const heard = clean(data.heard, 20);
  const training = clean(data.training, 300);
  const message = cleanLong(data.message, 1000);
  const lang = clean(data.lang, 5);
  if (!country || !city || !contactName || !validEmail(email) || !phone || !language || !training) {
    return { error: "invalid" };
  }
  if (!HEARD.has(heard) || !asBool(data.consent)) return { error: "invalid" };
  return {
    value: {
      applicantType,
      organization,
      country,
      city,
      contactName,
      role,
      email,
      phone,
      language,
      heard,
      training,
      message,
      consent: true,
      lang: lang === "es" || lang === "pt" ? lang : "en",
      receivedAt: new Date().toISOString(),
    },
  };
}

function redact(value) {
  return {
    applicantType: value.applicantType,
    hasOrganization: Boolean(value.organization),
    country: value.country,
    city: value.city,
    language: value.language,
    heard: value.heard,
    trainingLength: value.training.length,
    messageLength: value.message.length,
    lang: value.lang,
  };
}

function clientHash(req) {
  const forwarded = String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "");
  const ip = forwarded.split(",")[0].trim() || "unknown";
  const salt = process.env.PTC_APPLY_IP_SALT || "ptc-apply";
  return crypto.createHash("sha256").update(salt + "\n" + ip).digest("hex").slice(0, 16);
}

function rateLimited(hash) {
  const now = Date.now();
  for (const [key, times] of recent) {
    if (times.every((time) => now - time > RATE_WINDOW_MS)) recent.delete(key);
  }
  const times = (recent.get(hash) || []).filter((time) => now - time <= RATE_WINDOW_MS);
  times.push(now);
  recent.set(hash, times);
  return times.length > RATE_MAX;
}

function mailReady() {
  return Boolean(process.env.PTC_APPLY_EMAIL_API_KEY && process.env.PTC_APPLY_EMAIL_FROM);
}

function testMode() {
  const raw = process.env.PTC_APPLY_TEST_MODE;
  if (raw == null || String(raw).trim() === "") return true;
  return !["0", "false", "off", "no"].includes(String(raw).trim().toLowerCase());
}

function routes(applicantEmail) {
  const laiza = templates.TEST_INBOX;
  if (testMode()) {
    return {
      test: true,
      notice: { to: laiza, cc: "" },
      reply: { to: laiza, cc: "" },
    };
  }
  return {
    test: false,
    notice: {
      to: process.env.PTC_APPLY_EMAIL_TO || DEFAULT_TO,
      cc: process.env.PTC_APPLY_EMAIL_CC || DEFAULT_CC,
    },
    reply: { to: applicantEmail, cc: "" },
  };
}

async function sendMail(mail, to, cc) {
  const body = {
    from: process.env.PTC_APPLY_EMAIL_FROM,
    to: [to],
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  };
  if (cc && cc !== to) body.cc = [cc];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.PTC_APPLY_EMAIL_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`resend ${response.status} ${detail.slice(0, 180)}`);
  }
}

async function sendNotice(payload, route) {
  const mail = templates.renderNotice(payload, { test: route.test });
  try {
    await sendMail(mail, route.notice.to, route.notice.cc);
    return "sent";
  } catch (err) {
    console.error(JSON.stringify({ fn: "apply", stage: "notice", error: String(err.message || err).slice(0, 300) }));
    if (!route.test && route.notice.cc && route.notice.cc !== route.notice.to) {
      await sendMail(mail, route.notice.cc, "");
      return "sent-backup";
    }
    throw err;
  }
}

async function deliver(payload) {
  const route = routes(payload.email);
  if (!mailReady()) {
    console.log(JSON.stringify({
      fn: "apply",
      mode: "dry-run",
      testMode: route.test,
      noticeTo: route.notice.to,
      replyTo: route.reply.to,
      summary: redact(payload),
    }));
    return { mode: "dry-run", testMode: route.test };
  }
  const noticeMode = await sendNotice(payload, route);
  const reply = templates.renderReply(payload, { test: route.test });
  await sendMail(reply, route.reply.to, route.reply.cc);
  return { mode: route.test ? "sent-test" : noticeMode, testMode: route.test };
}

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      const type = String((req.headers && req.headers["content-type"]) || "");
      try {
        if (type.includes("application/json")) resolve(text ? JSON.parse(text) : {});
        else resolve(Object.fromEntries(new URLSearchParams(text)));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function thanksLocation(lang) {
  if (lang === "es") return "/es/apply/?sent=1";
  if (lang === "pt") return "/pt/apply/?sent=1";
  return "/apply/?sent=1";
}

async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    res.status(405).json({ ok: false, code: "method" });
    return;
  }
  let data;
  try {
    data = await readBody(req);
  } catch (err) {
    res.status(400).json({ ok: false, code: "invalid" });
    return;
  }
  const checked = validate(data);
  if (checked.error === "spam") {
    res.status(200).json({ ok: true, code: "ok" });
    return;
  }
  if (checked.error) {
    res.status(400).json({ ok: false, code: "invalid" });
    return;
  }
  if (rateLimited(clientHash(req))) {
    res.status(429).json({ ok: false, code: "busy" });
    return;
  }
  const wantsHtml = !String((req.headers && req.headers.accept) || "").includes("application/json");
  try {
    const result = await deliver(checked.value);
    if (wantsHtml) {
      res.status(303).setHeader("location", thanksLocation(checked.value.lang)).end();
      return;
    }
    res.status(200).json({ ok: true, code: "ok", mode: result.mode });
  } catch (err) {
    console.error(JSON.stringify({ fn: "apply", stage: "send", error: String(err.message || err).slice(0, 300) }));
    res.status(502).json({ ok: false, code: "failed" });
  }
}

module.exports = handler;
module.exports.validate = validate;
module.exports.redact = redact;
module.exports.deliver = deliver;
module.exports.mailReady = mailReady;
module.exports.testMode = testMode;
module.exports.routes = routes;
