/**
 * PTC application intake.
 *
 * Sends with Resend when PTC_APPLY_EMAIL_API_KEY and PTC_APPLY_EMAIL_FROM are set.
 * PTC_APPLY_EMAIL_FROM must be a bare address. A display name stays in dry-run.
 * PTC_APPLY_TEST_MODE is opt-in. Only 1, true, on, or yes turns it on.
 * Unset, empty, or anything else means off, so a future key cannot keep mail
 * on the backup inbox. While test mode is on, both the staff notice and the
 * applicant confirmation go only to PTC_APPLY_EMAIL_CC, or
 * khargestam@pcg.org when that variable is unset.
 * When test mode is off, Laiza (globalmissions.ea@pcg.org) and wm@pcg.org are
 * primary recipients, with khargestam@pcg.org copied until Karl verifies
 * delivery. PTC_APPLY_EMAIL_TO and PTC_APPLY_EMAIL_CC override these defaults
 * with comma-separated bare addresses. Invalid lists use the full defaults.
 * The confirmation goes only to the applicant. Its failure does not change
 * the mode. Provider acceptance does not verify inbox delivery or remove CC.
 * Without the API key or a bare From address this handler validates, logs a
 * redacted summary, and does not send.
 * The JSON mode is dry-run, test, sent-to, fallback-copy, to-only, or
 * send-failed. The same value is returned as code. No credentials belong in
 * this file. Wording lives in apply-email-templates.js.
 */

const crypto = require("crypto");
const templates = require("./apply-email-templates");

const TYPES = new Set(["college", "country", "school", "student"]);
const HEARD = new Set(["church", "site", "messenger", "moe", "person", "other"]);
const ORG_REQUIRED = new Set(["college", "country", "school"]);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const recent = new Map();
const DEFAULT_TO = ["globalmissions.ea@pcg.org", "wm@pcg.org"];
const DEFAULT_CC = ["khargestam@pcg.org"];

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

function bareEmail(value) {
  const text = clean(typeof value === "string" ? value : "", 200);
  if (!text || /[<>,;\s]/.test(text) || !validEmail(text)) return "";
  return text;
}

function mailReady() {
  return Boolean(process.env.PTC_APPLY_EMAIL_API_KEY && bareEmail(process.env.PTC_APPLY_EMAIL_FROM));
}

function testMode() {
  const raw = process.env.PTC_APPLY_TEST_MODE;
  if (raw == null || String(raw).trim() === "") return false;
  return ["1", "true", "on", "yes"].includes(String(raw).trim().toLowerCase());
}

function addresses(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== "string" || !raw.trim()) return [...fallback];
  const parts = raw.split(",").map((part) => part.trim());
  // Reject a whole malformed list rather than silently dropping a recipient.
  if (parts.some((part) => !part || part !== bareEmail(part))) return [...fallback];
  const seen = new Set();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function routes(applicantEmail) {
  const to = addresses("PTC_APPLY_EMAIL_TO", DEFAULT_TO);
  const cc = addresses("PTC_APPLY_EMAIL_CC", DEFAULT_CC);
  if (testMode()) {
    return {
      test: true,
      notice: { to: cc, cc: [] },
      reply: { to: cc, cc: [] },
    };
  }
  const primary = new Set(to.map((value) => value.toLowerCase()));
  return {
    test: false,
    notice: { to, cc: cc.filter((value) => !primary.has(value.toLowerCase())) },
    reply: { to: applicantEmail ? [applicantEmail] : [], cc: [] },
  };
}

function mailDraft(application) {
  const mail = templates.renderNotice(application, { test: false });
  const marker = "\nJSON record:";
  const cut = mail.text.indexOf(marker);
  return {
    to: DEFAULT_TO.join(","),
    cc: DEFAULT_CC.join(","),
    subject: mail.subject,
    text: (cut === -1 ? mail.text : mail.text.slice(0, cut)).trim(),
  };
}

async function sendOne(mail, to, cc, subject) {
  const body = {
    from: bareEmail(process.env.PTC_APPLY_EMAIL_FROM),
    to,
    subject: subject || mail.subject,
    text: mail.text,
    html: mail.html,
  };
  if (cc.length) body.cc = cc;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.PTC_APPLY_EMAIL_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error(JSON.stringify({
        fn: "apply",
        stage: "resend",
        status: response.status,
        error: detail.slice(0, 180),
      }));
      return false;
    }
    return true;
  } catch (err) {
    console.error(JSON.stringify({
      fn: "apply",
      stage: "resend",
      error: String(err.message || err).slice(0, 180),
    }));
    return false;
  }
}

async function deliver(payload) {
  const route = routes(payload.email);
  if (!mailReady()) {
    console.log(JSON.stringify({
      fn: "apply",
      mode: "dry-run",
      testMode: route.test,
      summary: redact(payload),
    }));
    return { ok: true, mode: "dry-run" };
  }
  const notice = templates.renderNotice(payload, { test: route.test });
  let noticeOk = false;
  let mode = route.test ? "test" : "sent-to";
  if (route.test) {
    noticeOk = await sendOne(notice, route.notice.to, []);
  } else {
    noticeOk = await sendOne(notice, route.notice.to, route.notice.cc);
    if (!noticeOk && route.notice.cc.length) {
      console.error(JSON.stringify({ fn: "apply", stage: "cc-failed" }));
      noticeOk = await sendOne(notice, route.notice.to, []);
      if (noticeOk) {
        const backupSubject = `${notice.subject} (backup copy)`.slice(0, 180);
        const backup = await sendOne(notice, route.notice.cc, [], backupSubject);
        mode = backup ? "fallback-copy" : "to-only";
        if (!backup) console.error(JSON.stringify({ fn: "apply", stage: "backup-failed" }));
      }
    }
  }
  if (!noticeOk) {
    console.error(JSON.stringify({ fn: "apply", stage: "send-failed", testMode: route.test }));
    return { ok: false, mode: "send-failed" };
  }
  const reply = templates.renderReply(payload, { test: route.test });
  if (!route.reply.to.length) return { ok: true, mode };
  const replyOk = await sendOne(reply, route.reply.to, route.reply.cc);
  if (!replyOk) {
    console.error(JSON.stringify({ fn: "apply", stage: "reply-failed", mode, testMode: route.test }));
  }
  return { ok: true, mode };
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

function thanksLocation(lang, mode) {
  const allowed = new Set(["dry-run", "test", "sent-to", "fallback-copy", "to-only", "send-failed"]);
  const safe = allowed.has(mode) ? mode : "send-failed";
  const query = `mode=${encodeURIComponent(safe)}`;
  if (lang === "es") return `/es/apply/?${query}`;
  if (lang === "pt") return `/pt/apply/?${query}`;
  return `/apply/?${query}`;
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
  const mail = mailDraft(checked.value);
  try {
    const result = await deliver(checked.value);
    if (!result.ok) {
      if (wantsHtml) {
        res.status(303).setHeader("location", thanksLocation(checked.value.lang, "send-failed")).end();
        return;
      }
      res.status(502).json({ ok: false, code: "send-failed", mode: "send-failed", mail });
      return;
    }
    if (wantsHtml) {
      res.status(303).setHeader("location", thanksLocation(checked.value.lang, result.mode)).end();
      return;
    }
    res.status(200).json({ ok: true, code: result.mode, mode: result.mode, mail });
  } catch (err) {
    console.error(JSON.stringify({ fn: "apply", stage: "send", error: String(err.message || err).slice(0, 300) }));
    if (wantsHtml) {
      res.status(303).setHeader("location", thanksLocation(checked.value.lang, "send-failed")).end();
      return;
    }
    res.status(502).json({ ok: false, code: "send-failed", mode: "send-failed", mail });
  }
}

module.exports = handler;
module.exports.validate = validate;
module.exports.redact = redact;
module.exports.deliver = deliver;
module.exports.mailReady = mailReady;
module.exports.mailDraft = mailDraft;
module.exports.testMode = testMode;
module.exports.routes = routes;
