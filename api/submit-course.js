/**
 * Course offers for ptconline.global.
 *
 * Unconfigured until Karl sets COURSE_SUBMIT_URL to an https endpoint that
 * accepts a JSON POST. Optional COURSE_SUBMIT_BEARER is sent as
 * Authorization: Bearer <token>. Neither variable is set in this repository.
 *
 * The handler does not store submissions and does not accept file uploads.
 * Material belongs in materialUrl (Drive, YouTube, or another host).
 *
 * OCFEP's Pioneer Field Report posts to Jotform
 * (https://submit.jotform.com/submit/220210330864139). Do not point
 * COURSE_SUBMIT_URL at that form: its fields are a people-group report,
 * not a course offer. A new Jotform would also expect Jotform field names,
 * not this JSON body.
 */

const MAX_BODY = 24 * 1024;
const LICENCES = new Set(["ptc-nonexclusive", "cc-by-nc-sa-4.0"]);
const FORMATS = new Set(["video", "text", "slides", "other"]);

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
      rights: true,
      publish: true,
      privacy: true,
      receivedAt: new Date().toISOString(),
    },
  };
}

function langOf(data) {
  const lang = clean(data && data.lang, 5);
  return COPY[lang] ? lang : "en";
}

function htmlPage(copy, message) {
  const text = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${copy.title}</title><p>${text}</p><p><a href="${copy.contact}">${copy.contact}</a></p>`;
}

function send(req, res, status, code, data) {
  const copy = COPY[langOf(data)];
  const key = { accepted: "thanks", spam: "thanks" }[code] || code;
  const message = copy[key] || copy.invalid;
  const type = String(req.headers["content-type"] || "");
  res.setHeader("cache-control", "no-store");
  if (type.includes("application/x-www-form-urlencoded")) {
    res.status(status).setHeader("content-type", "text/html; charset=utf-8");
    res.send(htmlPage(copy, message));
    return;
  }
  res.status(status).json({ ok: status >= 200 && status < 300, code });
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    const type = String(req.headers["content-type"] || "");
    if (type.includes("application/json")) return JSON.parse(req.body);
    const params = new URLSearchParams(req.body);
    const data = {};
    for (const [key, value] of params.entries()) {
      if (data[key] === undefined) data[key] = value;
      else if (Array.isArray(data[key])) data[key].push(value);
      else data[key] = [data[key], value];
    }
    return data;
  }
  return {};
}

async function handler(req, res) {
  if (req.method === "GET") {
    const ready = typeof process.env.COURSE_SUBMIT_URL === "string" && process.env.COURSE_SUBMIT_URL.startsWith("https://");
    res.setHeader("cache-control", "no-store");
    res.status(ready ? 200 : 503).json({ ok: ready, code: ready ? "ready" : "unconfigured" });
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("allow", "GET, POST");
    res.status(405).json({ ok: false, code: "method" });
    return;
  }
  const length = Number(req.headers["content-length"] || 0);
  if (length > MAX_BODY) {
    send(req, res, 413, "invalid", {});
    return;
  }
  let data;
  try {
    data = readBody(req);
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
  const target = process.env.COURSE_SUBMIT_URL || "";
  if (!target.startsWith("https://")) {
    send(req, res, 503, "unconfigured", data);
    return;
  }
  const headers = { "content-type": "application/json" };
  if (process.env.COURSE_SUBMIT_BEARER) headers.authorization = `Bearer ${process.env.COURSE_SUBMIT_BEARER}`;
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(result.payload),
      signal: AbortSignal.timeout(8000),
    });
    send(req, res, upstream.ok ? 200 : 502, upstream.ok ? "accepted" : "failed", data);
  } catch (err) {
    send(req, res, 502, "failed", data);
  }
}

module.exports = handler;
module.exports.validate = validate;
