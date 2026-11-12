/**
 * Course intake for ptconline.global.
 *
 * Unconfigured until Karl sets every variable in docs/curriculum-pipeline.md.
 * Nothing in this file creates a Blob store, a GitHub token, or an email account.
 *
 * When those variables are set, a valid offer is stored as:
 * - private Vercel Blob objects for small files (links stay links)
 * - one GitHub issue in the private curriculum repo, labelled submission + submitted
 *
 * The issue records the consent time, the licence version, and a salted hash of
 * the IP address. The raw IP is not written to the issue.
 *
 * OCFEP's Pioneer Field Report (Jotform 220210330864139) is a people-group
 * report. Course offers are not sent there.
 */

const crypto = require("crypto");

const JSON_LIMIT = 24 * 1024;
const UPLOAD_LIMIT = 4 * 1024 * 1024;
const FILE_LIMIT = 3 * 1024 * 1024;
const MAX_FILES = 3;
const LICENCE_TEXT_VERSION = "2026-10-28.2";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const recent = new Map();
const LICENCES = new Set(["ptc-nonexclusive", "cc-by-nc-sa-4.0"]);
const FORMATS = new Set(["video", "text", "slides", "other"]);
const FILE_TYPES = new Set([
  "application/pdf",
  "text/vtt",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
// Each allowed type must also match the first bytes of the file.
const MAGIC = {
  "application/pdf": (b) => b.slice(0, 5).toString("latin1") === "%PDF-",
  "image/png": (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.slice(0, 4).toString("latin1") === "RIFF" && b.slice(8, 12).toString("latin1") === "WEBP",
  "text/vtt": (b) => /^(\ufeff)?WEBVTT/.test(b.slice(0, 16).toString("utf8")),
  "text/plain": isPlainText,
  "text/markdown": isPlainText,
};
const EXTENSIONS = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "text/vtt": [".vtt"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
};

function isPlainText(buffer) {
  const sample = buffer.slice(0, 4096);
  if (sample.includes(0)) return false;
  const text = sample.toString("utf8");
  return !/^\s*<(?:!doctype|html|script|svg)/i.test(text);
}

const STAGE_LABELS = [
  ["submission", "ededed", "A course offer, not a support ticket"],
  ["submitted", "1d76db", "COS has the new offer and will route it"],
  ["screening", "fbca04", "Rights and theology fit"],
  ["formatting", "5319e7", "Don and Cass fit it to the course template"],
  ["translation", "0e8a16", "English, Spanish, and Portuguese"],
  ["review", "d93f0b", "Dot, plus a native speaker for Spanish and Portuguese"],
  ["ready", "006b75", "Waiting for Karl or the academic lead"],
  ["published", "bfd4f2", "The import pull request is merged"],
];

const COPY = {
  en: {
    title: "Submit a course",
    unconfigured: "Submissions are paused right now. Please try again later, or reach us through the contact page.",
    thanks: "Thank you. Your offer is on its way to the PTC team for review.",
    invalid: "Check the fields marked *, the https link, the licence and the three consent boxes.",
    failed: "The offer could not be delivered. Please try again later, or reach us through the contact page.",
    file: "Each file must be a PDF, VTT, TXT, MD, PNG, JPG or WEBP of 3 MB or less, up to 3 files. Put larger material in a link.",
    material: "Add a link to the material or attach a small file.",
    busy: "Too many offers from this connection. Please wait a few minutes and try again.",
    contact: "/contact/",
  },
  es: {
    title: "Enviar un curso",
    unconfigured: "Los envíos están en pausa en este momento. Inténtelo más tarde o contáctenos desde la página de contacto.",
    thanks: "Gracias. Su oferta va en camino al equipo de PTC para su revisión.",
    invalid: "Revise los campos marcados con *, el enlace https, la licencia y las tres casillas de consentimiento.",
    failed: "No se pudo entregar la oferta. Inténtelo más tarde o contáctenos desde la página de contacto.",
    file: "Cada archivo debe ser PDF, VTT, TXT, MD, PNG, JPG o WEBP de 3 MB o menos, hasta 3 archivos. Ponga el material más grande en un enlace.",
    material: "Agregue un enlace al material o adjunte un archivo pequeño.",
    busy: "Demasiadas ofertas desde esta conexión. Espere unos minutos e inténtelo de nuevo.",
    contact: "/es/contact/",
  },
  pt: {
    title: "Enviar um curso",
    unconfigured: "Os envios estão pausados no momento. Tente mais tarde ou fale conosco pela página de contato.",
    thanks: "Obrigado. Sua oferta segue para a equipe do PTC para revisão.",
    invalid: "Confira os campos marcados com *, o link https, a licença e as três caixas de consentimento.",
    failed: "Não foi possível entregar a oferta. Tente mais tarde ou fale conosco pela página de contato.",
    file: "Cada arquivo deve ser PDF, VTT, TXT, MD, PNG, JPG ou WEBP de até 3 MB, no máximo 3 arquivos. Coloque material maior em um link.",
    material: "Adicione um link para o material ou anexe um arquivo pequeno.",
    busy: "Muitas ofertas desta conexão. Aguarde alguns minutos e tente de novo.",
    contact: "/pt/contact/",
  },
};

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

// Keeps line breaks for long text. It is shown inside a code block in the issue.
function cleanLong(value, max) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function asBool(value) {
  return value === true || value === "yes" || value === "on";
}

function validUrl(value) {
  if (!/^https:\/\/\S+$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
  } catch (err) {
    return false;
  }
}

function formatsOf(value) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return list.map((item) => clean(item, 20)).filter((item) => FORMATS.has(item));
}

function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "invalid" };
  if (clean(data.website, 200)) return { error: "spam" };
  const name = clean(data.name, 120);
  const email = clean(data.email, 200);
  const country = clean(data.country, 80);
  const title = clean(data.title, 200);
  const description = cleanLong(data.description, 4000);
  const materialUrl = clean(data.materialUrl, 500);
  const licence = clean(data.licence, 40);
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "invalid" };
  if (!/^[A-Z]{2}$/.test(country) || !title || !description) return { error: "invalid" };
  if (!asBool(data.rights) || !asBool(data.publish) || !asBool(data.privacy)) return { error: "invalid" };
  if (!LICENCES.has(licence)) return { error: "invalid" };
  if (materialUrl && !validUrl(materialUrl)) return { error: "invalid" };
  return {
    payload: {
      name,
      email,
      organization: clean(data.organization, 200),
      country,
      languages: clean(data.languages, 200),
      title,
      level: clean(data.level, 200),
      description,
      audience: clean(data.audience, 500),
      formats: formatsOf(data.formats),
      materialUrl,
      ownership: cleanLong(data.ownership, 1000),
      licence,
      licenceVersion: licence === "cc-by-nc-sa-4.0"
        ? "cc-by-nc-sa-4.0"
        : `ptc-nonexclusive-${LICENCE_TEXT_VERSION}`,
      rights: true,
      publish: true,
      privacy: true,
    },
  };
}

function configured() {
  const repo = process.env.GITHUB_CURRICULUM_REPO || "";
  const email = process.env.CURRICULUM_NOTIFY_EMAIL || "";
  const salt = process.env.CURRICULUM_IP_SALT || "";
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN &&
    process.env.GITHUB_CURRICULUM_TOKEN &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    salt.length >= 16
  );
}

function langOf(data) {
  const lang = clean(data && data.lang, 5);
  return COPY[lang] ? lang : "en";
}

function htmlPage(copy, message, lang) {
  const text = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><title>${copy.title}</title><p>${text}</p><p><a href="${copy.contact}">${copy.contact}</a></p>`;
}

function send(req, res, status, code, data, receipt) {
  const lang = langOf(data);
  const copy = COPY[lang];
  // A filled honeypot gets the same answer as a real offer, so a bot learns nothing.
  if (code === "spam") code = "accepted";
  const key = { accepted: "thanks" }[code] || code;
  const message = copy[key] || copy.invalid;
  const accept = String((req.headers && req.headers.accept) || "");
  res.setHeader("cache-control", "no-store");
  // A plain HTML form post (no JavaScript) gets a short HTML page back.
  if (!accept.includes("application/json") && accept.includes("text/html")) {
    res.status(status).setHeader("content-type", "text/html; charset=utf-8");
    res.send(htmlPage(copy, message, lang));
    return;
  }
  res.status(status).json({ ok: status >= 200 && status < 300, code, ...(receipt ? { receipt } : {}) });
}

function ipHash(req) {
  const header = String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "");
  const ip = header.split(",")[0].trim() || "unknown";
  return crypto.createHash("sha256").update(`${process.env.CURRICULUM_IP_SALT}\n${ip}`).digest("hex");
}

function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!match) throw new Error("boundary");
  const boundary = `--${(match[1] || match[2]).trim()}`;
  const text = buffer.toString("latin1");
  const chunks = text.split(boundary).slice(1, -1);
  const fields = {};
  const files = [];
  for (const chunk of chunks) {
    const body = chunk.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const splitAt = body.indexOf("\r\n\r\n");
    if (splitAt < 0) continue;
    const head = body.slice(0, splitAt);
    const content = body.slice(splitAt + 4);
    const nameMatch = /name="([^"]+)"/i.exec(head);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const fileMatch = /filename="([^"]*)"/i.exec(head);
    if (fileMatch && fileMatch[1]) {
      const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(head);
      files.push({
        field: name,
        filename: fileMatch[1].replace(/[^\w.\- ]+/g, "_").slice(0, 120),
        type: (typeMatch ? typeMatch[1].trim() : "application/octet-stream").toLowerCase(),
        bytes: Buffer.from(content, "latin1"),
      });
    } else if (fields[name] === undefined) {
      fields[name] = Buffer.from(content, "latin1").toString("utf8");
    } else if (Array.isArray(fields[name])) {
      fields[name].push(Buffer.from(content, "latin1").toString("utf8"));
    } else {
      fields[name] = [fields[name], Buffer.from(content, "latin1").toString("utf8")];
    }
  }
  return { fields, files };
}

function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return req.body;
  return null;
}

function githubHeaders() {
  return {
    authorization: `Bearer ${process.env.GITHUB_CURRICULUM_TOKEN}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
    "user-agent": "ptconline-curriculum",
    "x-github-api-version": "2022-11-28",
  };
}

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { ...githubHeaders(), ...(options.headers || {}) },
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch (err) { body = { message: text.slice(0, 300) }; }
  }
  return { status: response.status, body };
}

async function assertPrivateRepo() {
  const repo = process.env.GITHUB_CURRICULUM_REPO;
  const info = await github(`/repos/${repo}`);
  if (info.status !== 200 || !info.body || info.body.private !== true) {
    throw new Error("curriculum repo must be private");
  }
}

async function ensureLabels() {
  const repo = process.env.GITHUB_CURRICULUM_REPO;
  for (const [name, color, description] of STAGE_LABELS) {
    const existing = await github(`/repos/${repo}/labels/${encodeURIComponent(name)}`);
    if (existing.status === 404) {
      const created = await github(`/repos/${repo}/labels`, {
        method: "POST",
        body: JSON.stringify({ name, color, description }),
      });
      if (created.status !== 201) {
        const check = await github(`/repos/${repo}/labels/${encodeURIComponent(name)}`);
        if (check.status !== 200) throw new Error("intake labels unavailable");
      }
    } else if (existing.status !== 200) {
      throw new Error("intake labels unavailable");
    }
  }
}

function filesOk(files) {
  if (files.length > MAX_FILES) return false;
  return files.every((file) => {
    const name = file.filename.toLowerCase();
    return FILE_TYPES.has(file.type) &&
      file.bytes.length > 0 &&
      file.bytes.length <= FILE_LIMIT &&
      (EXTENSIONS[file.type] || []).some((ext) => name.endsWith(ext)) &&
      MAGIC[file.type](file.bytes);
  });
}

async function removeFiles(stored, receipt) {
  if (!stored.length) return;
  try {
    const { del } = require("@vercel/blob");
    await del(stored.map((file) => file.url), { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    log("blob-cleanup", err, { receipt, recoveryRequired: true });
  }
}

function log(stage, err, extra) {
  // Upstream messages can echo submitted text or secret-bearing URLs. Never log them.
  console.error(JSON.stringify({ fn: "submit-course", stage, ...(extra || {}) }));
}

function rateLimited(hash) {
  // Best effort: each warm function instance keeps its own window.
  const now = Date.now();
  for (const [key, times] of recent) {
    if (times.every((time) => now - time > RATE_WINDOW_MS)) recent.delete(key);
  }
  const times = (recent.get(hash) || []).filter((time) => now - time <= RATE_WINDOW_MS);
  times.push(now);
  recent.set(hash, times);
  return times.length > RATE_MAX;
}

async function storeFiles(files, stored, receipt) {
  if (!files.length) return stored;
  const { put } = require("@vercel/blob");
  for (const file of files) {
    if (!filesOk([file])) throw new Error("file check");
    const pathname = `curriculum/${receipt}/${file.filename}`;
    const blob = await put(pathname, file.bytes, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
      addRandomSuffix: true,
    });
    stored.push({ filename: file.filename, pathname: blob.pathname, url: blob.url, sha256: crypto.createHash("sha256").update(file.bytes).digest("hex"), size: file.bytes.length });
  }
  return stored;
}

// A private receipt survives an uncertain GitHub response. No automatic retry can
// create a duplicate issue; an authorized reviewer reconciles by receipt first.
async function storeReceipt(payload, files, hash) {
  const { put } = require("@vercel/blob");
  const receipt = { schemaVersion: 1, receipt: payload.receipt, payload, files, ipHash: hash };
  return put(`curriculum/${payload.receipt}/receipt.json`, JSON.stringify(receipt), {
    access: "private", token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: "application/json", addRandomSuffix: false,
  });
}

// Text from the public form is shown as code in the issue. That stops headings,
// links, images, HTML, @-mentions and #-references from rendering or notifying.
function inline(value) {
  const text = String(value || "").replace(/[`\r\n]/g, "'").trim();
  return text ? `\`${text}\`` : "(none)";
}

function block(value) {
  const text = String(value || "").replace(/~{3,}/g, "~~");
  return ["~~~text", text, "~~~"].join("\n");
}

function issueBody(payload, files, hash) {
  const lines = [
    "## Course offer",
    `Receipt: ${payload.receipt || "legacy"}`,
    "",
    `- Title: ${inline(payload.title)}`,
    `- Level or topic: ${inline(payload.level)}`,
    `- Country: ${payload.country}`,
    `- Languages: ${inline(payload.languages)}`,
    `- Audience: ${inline(payload.audience)}`,
    `- Formats: ${payload.formats.join(", ") || "(none)"}`,
    `- Organization or church: ${inline(payload.organization)}`,
    "",
    "Description:",
    "",
    block(payload.description),
    "",
    "## Contact",
    "",
    `- Name: ${inline(payload.name)}`,
    `- Email: ${inline(payload.email)}`,
    `- COS contact: ${process.env.CURRICULUM_NOTIFY_EMAIL}`,
    "",
    "## Material",
    "",
    `- Link (open with care, not checked): ${inline(payload.materialUrl)}`,
    "",
    "Ownership statement:",
    "",
    block(payload.ownership || "(none)"),
  ];
  if (files.length) {
    lines.push("", "Private Blob files (not public):");
    for (const file of files) lines.push(`- ${inline(file.filename)}: \`${file.pathname}\``);
  } else {
    lines.push("", "No file was uploaded. The link above is the material.");
  }
  lines.push(
    "",
    "## Consent",
    "",
    `- Agreed at: ${payload.receivedAt}`,
    `- Licence chosen: ${payload.licence}`,
    `- Licence version: ${payload.licenceVersion}`,
    `- Licence text version: ${LICENCE_TEXT_VERSION}`,
    "- Rights checkbox: yes",
    "- Contributor permission checkbox: yes (not academic or publication approval)",
    "- Academic approval: NOT RECORDED",
    "- Explicit publication authorization: NOT RECORDED",
    "- Privacy checkbox: yes",
    `- IP hash (salted SHA-256, not the raw address): ${hash}`,
    "",
    "The licence text for this version is in docs/curriculum-pipeline.md (PTConline-global).",
    "",
    "Stage: submitted. COS monitors and routes. See docs/curriculum-pipeline.md in PTConline-global.",
  );
  return lines.join("\n");
}

async function openIssue(payload, files, hash) {
  const repo = process.env.GITHUB_CURRICULUM_REPO;
  const created = await github(`/repos/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `Course offer: ${payload.title.replace(/[@#`<>]/g, "")} (${payload.country})`.slice(0, 240),
      body: issueBody(payload, files, hash),
      labels: ["submission", "submitted"],
    }),
  });
  if (created.status !== 201) {
    const error = new Error("issue rejected or uncertain");
    error.definitive = created.status >= 400 && created.status < 500 && created.status !== 408;
    throw error;
  }
  return created.body && created.body.html_url;
}

async function handler(req, res) {
  if (req.method === "GET") {
    const ready = configured();
    res.setHeader("cache-control", "no-store");
    res.status(ready ? 200 : 503).json({ ok: ready, code: ready ? "ready" : "unconfigured" });
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("allow", "GET, POST");
    res.status(405).json({ ok: false, code: "method" });
    return;
  }
  if (!configured()) {
    send(req, res, 503, "unconfigured", {});
    return;
  }
  const length = Number((req.headers && req.headers["content-length"]) || 0);
  const type = String((req.headers && req.headers["content-type"]) || "");
  const limit = type.includes("multipart/form-data") ? UPLOAD_LIMIT : JSON_LIMIT;
  if (length > limit) {
    send(req, res, 413, type.includes("multipart/form-data") ? "file" : "invalid", {});
    return;
  }
  let data;
  let files = [];
  try {
    let raw = readIncoming(req);
    if (raw == null) raw = await readStream(req, limit);
    const actualSize = Buffer.isBuffer(raw) ? raw.length
      : Buffer.byteLength(typeof raw === "string" ? raw : JSON.stringify(raw ?? null));
    if (actualSize > limit) throw new Error("too-large");
    if (type.includes("multipart/form-data")) {
      const parsed = parseMultipart(raw, type);
      data = parsed.fields;
      files = parsed.files;
    } else if (Buffer.isBuffer(raw)) {
      const text = raw.toString("utf8");
      data = type.includes("application/x-www-form-urlencoded")
        ? Object.fromEntries(new URLSearchParams(text))
        : JSON.parse(text);
    } else if (typeof raw === "string") {
      data = type.includes("application/json") ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
    } else {
      data = raw;
    }
  } catch (err) {
    const tooLarge = err && err.message === "too-large";
    send(req, res, tooLarge ? 413 : 400, tooLarge ? "file" : "invalid", {});
    return;
  }
  const result = validate(data);
  if (result.error === "spam") {
    send(req, res, 200, "spam", data);
    return;
  }
  if (result.error) {
    send(req, res, 400, "invalid", data);
    return;
  }
  if (!result.payload.materialUrl && files.length === 0) {
    send(req, res, 400, "material", data);
    return;
  }
  if (!filesOk(files)) {
    send(req, res, 400, "file", data);
    return;
  }
  const hash = ipHash(req);
  if (rateLimited(hash)) {
    log("rate-limit", "too many offers");
    send(req, res, 429, "busy", data);
    return;
  }
  result.payload.receivedAt = new Date().toISOString();
  result.payload.receipt = crypto.randomUUID();
  const stored = [];
  // Verify the destination before storing any contributor file.
  try {
    await assertPrivateRepo();
    await ensureLabels();
  } catch (err) {
    log("intake-preflight", err);
    send(req, res, 502, "failed", data);
    return;
  }
  try {
    await storeFiles(files, stored, result.payload.receipt);
  } catch (err) {
    log("blob", err, { files: files.length, receipt: result.payload.receipt, recoveryRequired: true });
    await removeFiles(stored, result.payload.receipt);
    send(req, res, 502, "failed", data);
    return;
  }
  let receiptBlob;
  try {
    receiptBlob = await storeReceipt(result.payload, stored, hash);
  } catch (err) {
    log("receipt-store", err, { receipt: result.payload.receipt, recoveryRequired: true });
    // A timed-out receipt write can have succeeded. Preserve files for reconciliation.
    send(req, res, 502, "failed", data, result.payload.receipt);
    return;
  }
  try {
    await openIssue(result.payload, stored, hash);
  } catch (err) {
    log("github", err, { receipt: result.payload.receipt, recoveryRequired: !err.definitive });
    if (err.definitive) await removeFiles([...stored, receiptBlob], result.payload.receipt);
    // A timeout/5xx can occur after GitHub created the issue: do not destroy its files.
    send(req, res, 502, "failed", data, result.payload.receipt);
    return;
  }
  send(req, res, 200, "accepted", data, result.payload.receipt);
}

function readIncoming(req) {
  if (Buffer.isBuffer(req.body) || typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return req.body;
  return null;
}

async function readStream(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("too-large");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
module.exports.validate = validate;
module.exports.configured = configured;
module.exports.parseMultipart = parseMultipart;
module.exports.ipHash = ipHash;
module.exports.issueBody = issueBody;
module.exports.filesOk = filesOk;
module.exports.validUrl = validUrl;
