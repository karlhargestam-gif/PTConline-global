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
const LICENCE_TEXT_VERSION = "2026-10-28";
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
    unconfigured: "Submissions open soon. Email us from the contact page.",
    thanks: "Thank you. If submissions are open, the offer is on its way for review.",
    invalid: "Check the required fields, the https link, and the three consent boxes.",
    failed: "The offer could not be delivered. Email us from the contact page.",
    contact: "/contact/",
  },
  es: {
    title: "Enviar un curso",
    unconfigured: "Los envíos se abrirán pronto. Escríbanos desde la página de contacto.",
    thanks: "Gracias. Si los envíos están abiertos, la oferta va en camino para su revisión.",
    invalid: "Revise los campos obligatorios, el enlace https y las tres casillas de consentimiento.",
    failed: "No se pudo entregar la oferta. Escríbanos desde la página de contacto.",
    contact: "/es/contact/",
  },
  pt: {
    title: "Enviar um curso",
    unconfigured: "Os envios abrem em breve. Escreva para nós pela página de contato.",
    thanks: "Obrigado. Se os envios estiverem abertos, a oferta segue para revisão.",
    invalid: "Confira os campos obrigatórios, o link https e as três caixas de consentimento.",
    failed: "Não foi possível entregar a oferta. Escreva para nós pela página de contato.",
    contact: "/pt/contact/",
  },
};

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function asBool(value) {
  return value === true || value === "yes" || value === "on";
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
  const description = clean(data.description, 4000);
  const materialUrl = clean(data.materialUrl, 500);
  const licence = clean(data.licence, 40);
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "invalid" };
  if (!/^[A-Z]{2}$/.test(country) || !title || !description) return { error: "invalid" };
  if (!asBool(data.rights) || !asBool(data.publish) || !asBool(data.privacy)) return { error: "invalid" };
  if (!LICENCES.has(licence)) return { error: "invalid" };
  if (materialUrl && !/^https:\/\/\S+$/i.test(materialUrl)) return { error: "invalid" };
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
      ownership: clean(data.ownership, 1000),
      licence,
      licenceVersion: licence === "cc-by-nc-sa-4.0"
        ? "cc-by-nc-sa-4.0"
        : `ptc-nonexclusive-draft-${LICENCE_TEXT_VERSION}`,
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

function htmlPage(copy, message) {
  const text = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${copy.title}</title><p>${text}</p><p><a href="${copy.contact}">${copy.contact}</a></p>`;
}

function send(req, res, status, code, data) {
  const copy = COPY[langOf(data)];
  const key = { accepted: "thanks", spam: "thanks" }[code] || code;
  const message = copy[key] || copy.invalid;
  const type = String((req.headers && req.headers["content-type"]) || "");
  res.setHeader("cache-control", "no-store");
  if (type.includes("application/x-www-form-urlencoded")) {
    res.status(status).setHeader("content-type", "text/html; charset=utf-8");
    res.send(htmlPage(copy, message));
    return;
  }
  res.status(status).json({ ok: status >= 200 && status < 300, code });
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
      fields[name] = content;
    } else if (Array.isArray(fields[name])) {
      fields[name].push(content);
    } else {
      fields[name] = [fields[name], content];
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
      await github(`/repos/${repo}/labels`, {
        method: "POST",
        body: JSON.stringify({ name, color, description }),
      });
    }
  }
}

async function storeFiles(files) {
  if (!files.length) return [];
  const { put } = require("@vercel/blob");
  const stored = [];
  for (const file of files) {
    if (!FILE_TYPES.has(file.type)) throw new Error("file type");
    if (file.bytes.length > FILE_LIMIT) throw new Error("file size");
    const pathname = `curriculum/${Date.now()}-${file.filename}`;
    const blob = await put(pathname, file.bytes, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
      addRandomSuffix: true,
    });
    stored.push({ filename: file.filename, pathname: blob.pathname, url: blob.url });
  }
  return stored;
}

function issueBody(payload, files, hash) {
  const lines = [
    "## Course offer",
    "",
    `- Title: ${payload.title}`,
    `- Level or topic: ${payload.level || "(none)"}`,
    `- Country: ${payload.country}`,
    `- Languages: ${payload.languages || "(none)"}`,
    `- Audience: ${payload.audience || "(none)"}`,
    `- Formats: ${payload.formats.join(", ") || "(none)"}`,
    `- Organization or church: ${payload.organization || "(none)"}`,
    "",
    payload.description,
    "",
    "## Contact",
    "",
    `- Name: ${payload.name}`,
    `- Email: ${payload.email}`,
    `- Notify: ${process.env.CURRICULUM_NOTIFY_EMAIL}`,
    "",
    "## Material",
    "",
    payload.materialUrl ? `- Link: ${payload.materialUrl}` : "- Link: (none)",
    payload.ownership ? `- Ownership: ${payload.ownership}` : "- Ownership: (none)",
  ];
  if (files.length) {
    lines.push("", "Private Blob files (not public):");
    for (const file of files) lines.push(`- ${file.filename}: \`${file.pathname}\``);
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
    "- Permission to publish: yes",
    "- Privacy checkbox: yes",
    `- IP hash (salted SHA-256, not the raw address): ${hash}`,
    "",
    "Draft for legal review. Do not treat this consent as a finished licence until Karl approves the wording.",
    "",
    "Stage: submitted. COS monitors and routes. See docs/curriculum-pipeline.md in PTConline-global.",
  );
  return lines.join("\n");
}

async function openIssue(payload, files, hash) {
  await assertPrivateRepo();
  await ensureLabels();
  const repo = process.env.GITHUB_CURRICULUM_REPO;
  const created = await github(`/repos/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `Course offer: ${payload.title} (${payload.country})`.slice(0, 240),
      body: issueBody(payload, files, hash),
      labels: ["submission", "submitted"],
    }),
  });
  if (created.status !== 201) throw new Error("issue");
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
    send(req, res, 413, "invalid", {});
    return;
  }
  let data;
  let files = [];
  try {
    let raw = readIncoming(req);
    if (raw == null) raw = await readStream(req);
    if (type.includes("multipart/form-data")) {
      const parsed = parseMultipart(raw, type);
      data = parsed.fields;
      files = parsed.files;
      if (files.length > MAX_FILES) throw new Error("too many files");
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
    send(req, res, 400, "invalid", {});
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
    send(req, res, 400, "invalid", data);
    return;
  }
  result.payload.receivedAt = new Date().toISOString();
  try {
    const stored = await storeFiles(files);
    await openIssue(result.payload, stored, ipHash(req));
    send(req, res, 200, "accepted", data);
  } catch (err) {
    send(req, res, 502, "failed", data);
  }
}

function readIncoming(req) {
  if (Buffer.isBuffer(req.body) || typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return req.body;
  return null;
}

async function readStream(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > UPLOAD_LIMIT) throw new Error("too-large");
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
