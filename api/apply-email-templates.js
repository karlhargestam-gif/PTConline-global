/**
 * PTC application emails. This is the one file to edit.
 *
 * Laiza: comment on the wording in this pull request. Do not add phone
 * numbers or web addresses here. Where a detail is not decided, the text
 * already says TO BE SUPPLIED.
 *
 * These messages are from PCG / PTC. They do not link to a missionary application.
 * Course and start links are pages that already exist on ptconline.global.
 */

const HOST = "https://ptconline.global";

const LINKS = {
  en: {
    home: `${HOST}/`,
    courses: `${HOST}/courses/`,
    enroll: `${HOST}/enroll/`,
    messenger: `${HOST}/courses/messenger/`,
  },
  es: {
    home: `${HOST}/es/`,
    courses: `${HOST}/es/courses/`,
    enroll: `${HOST}/es/enroll/`,
    messenger: `${HOST}/es/courses/messenger/`,
  },
  pt: {
    home: `${HOST}/pt/`,
    courses: `${HOST}/pt/courses/`,
    enroll: `${HOST}/pt/enroll/`,
    messenger: `${HOST}/pt/courses/messenger/`,
  },
};

const TYPE_LABEL = {
  en: { college: "College", country: "Country", school: "School", student: "Student" },
  es: { college: "Universidad", country: "País", school: "Escuela", student: "Estudiante" },
  pt: { college: "Faculdade", country: "País", school: "Escola", student: "Estudante" },
};

const COPY = {
  en: {
    replySubject: "We received your PTC application",
    thanks: "Thank you, {{name}}. PTC has your application.",
    fromLine: "This message is from PCG / PTC.",
    phone: "A phone number for questions about this application is TO BE SUPPLIED.",
    coursesLabel: "PTC courses",
    enrollLabel: "How to start and how live cohorts work",
    messengerLabel: "Messenger College course overviews on PTC",
    homeLabel: "PTC home",
    next: {
      college: "What happens next: the PTC team reviews college applications and writes back to this email address. This email does not grant admission or credit. College credit stays with the college.",
      country: "What happens next: the PTC team reviews country applications and writes back to this email address. PTC training is open worldwide.",
      school: "What happens next: the PTC team reviews school applications and writes back to this email address. PTC training is open worldwide.",
      student: "What happens next: you can start the open courses on PTC now, at your own pace, with no login. The PTC team also reviews your application and writes back to this email address.",
    },
  },
  es: {
    replySubject: "Recibimos su solicitud a PTC",
    thanks: "Gracias, {{name}}. PTC recibió su solicitud.",
    fromLine: "Este mensaje es de PCG / PTC.",
    phone: "Un número de teléfono para preguntas sobre esta solicitud: TO BE SUPPLIED.",
    coursesLabel: "Cursos de PTC",
    enrollLabel: "Cómo empezar y cómo funcionan los grupos en vivo",
    messengerLabel: "Resúmenes de cursos de Messenger College en PTC",
    homeLabel: "Inicio de PTC",
    next: {
      college: "Qué sigue: el equipo de PTC revisa las solicitudes de universidades y responde a este correo. Este mensaje no otorga admisión ni crédito. El crédito universitario permanece en la universidad.",
      country: "Qué sigue: el equipo de PTC revisa las solicitudes de países y responde a este correo. La formación de PTC está abierta en todo el mundo.",
      school: "Qué sigue: el equipo de PTC revisa las solicitudes de escuelas y responde a este correo. La formación de PTC está abierta en todo el mundo.",
      student: "Qué sigue: puede empezar ahora los cursos abiertos de PTC, a su ritmo y sin iniciar sesión. El equipo de PTC también revisa su solicitud y responde a este correo.",
    },
  },
  pt: {
    replySubject: "Recebemos sua candidatura ao PTC",
    thanks: "Obrigado, {{name}}. O PTC recebeu sua candidatura.",
    fromLine: "Esta mensagem é da PCG / PTC.",
    phone: "Um número de telefone para perguntas sobre esta candidatura: TO BE SUPPLIED.",
    coursesLabel: "Cursos do PTC",
    enrollLabel: "Como começar e como funcionam as turmas ao vivo",
    messengerLabel: "Resumos dos cursos do Messenger College no PTC",
    homeLabel: "Início do PTC",
    next: {
      college: "O que acontece agora: a equipe do PTC revisa candidaturas de faculdades e responde a este e-mail. Esta mensagem não concede admissão nem crédito. O crédito universitário permanece na faculdade.",
      country: "O que acontece agora: a equipe do PTC revisa candidaturas de países e responde a este e-mail. A formação do PTC está aberta no mundo todo.",
      school: "O que acontece agora: a equipe do PTC revisa candidaturas de escolas e responde a este e-mail. A formação do PTC está aberta no mundo todo.",
      student: "O que acontece agora: você pode começar agora os cursos abertos do PTC, no seu ritmo e sem login. A equipe do PTC também revisa sua candidatura e responde a este e-mail.",
    },
  },
};

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fill(template, fields) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key] == null ? "" : String(fields[key]));
}

function langOf(application) {
  return application.lang === "es" || application.lang === "pt" ? application.lang : "en";
}

function shell(inner) {
  return `<!doctype html>
<html>
<body style="margin:0;background:#f7f4ee;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;">
    <div style="background:#000000;color:#ffffff;padding:16px 20px;border-bottom:2px solid #ee3626;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:12px;letter-spacing:0.08em;">PENTECOSTAL CHURCH OF GOD</div>
      <div style="font-family:Georgia,serif;font-size:22px;margin-top:4px;">Pentecostal Theological Consortium</div>
    </div>
    <div style="padding:20px;color:#1c1917;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;">
      ${inner}
    </div>
  </div>
</body>
</html>`;
}

function linkList(copy, links, type) {
  const items = [
    `<li><a href="${links.courses}">${escapeHtml(copy.coursesLabel)}</a></li>`,
    `<li><a href="${links.enroll}">${escapeHtml(copy.enrollLabel)}</a></li>`,
    `<li><a href="${links.home}">${escapeHtml(copy.homeLabel)}</a></li>`,
  ];
  if (type === "college") {
    items.splice(2, 0, `<li><a href="${links.messenger}">${escapeHtml(copy.messengerLabel)}</a></li>`);
  }
  return `<ul>${items.join("")}</ul>`;
}

function renderReply(application, options = {}) {
  const lang = langOf(application);
  const copy = COPY[lang];
  const links = LINKS[lang];
  const type = application.applicantType;
  const name = application.contactName || "";
  const test = Boolean(options.test);
  const subjectBase = copy.replySubject;
  const subject = test ? `[TEST – would go to applicant] ${subjectBase}` : subjectBase;
  const testBanner = test
    ? `<p style="background:#fff3cd;padding:12px;"><strong>[TEST – would go to applicant]</strong><br>Would have been sent to ${escapeHtml(application.email)}</p>`
    : "";
  const html = shell(`
    ${testBanner}
    <p>${escapeHtml(fill(copy.thanks, { name }))}</p>
    <p><strong>${escapeHtml(TYPE_LABEL[lang][type] || type)}</strong>${application.organization ? `: ${escapeHtml(application.organization)}` : ""}</p>
    <p>${escapeHtml(copy.next[type])}</p>
    <p>${escapeHtml(copy.phone)}</p>
    ${linkList(copy, links, type)}
    <p>${escapeHtml(copy.fromLine)}</p>
  `);
  const text = [
    test ? `[TEST – would go to applicant]\nWould have been sent to ${application.email}\n` : "",
    fill(copy.thanks, { name }),
    "",
    TYPE_LABEL[lang][type] || type,
    application.organization || "",
    "",
    copy.next[type],
    "",
    copy.phone,
    "",
    `${copy.coursesLabel}: ${links.courses}`,
    `${copy.enrollLabel}: ${links.enroll}`,
    type === "college" ? `${copy.messengerLabel}: ${links.messenger}` : "",
    `${copy.homeLabel}: ${links.home}`,
    "",
    copy.fromLine,
  ].filter((line) => line !== "").join("\n");
  return { subject, html, text, lang, kind: "reply", test };
}

function renderNotice(application, options = {}) {
  const test = Boolean(options.test);
  const subjectBase = `PTC application: ${application.applicantType} (${application.country})`;
  const subject = (test ? `[TEST] ${subjectBase}` : subjectBase).slice(0, 180);
  const rows = [
    ["Type", application.applicantType],
    ["Organization", application.organization || "(none)"],
    ["Country", application.country],
    ["City", application.city],
    ["Contact", application.contactName],
    ["Role", application.role || "(none)"],
    ["Email", application.email],
    ["Phone or WhatsApp", application.phone],
    ["Language", application.language],
    ["Heard", application.heard],
    ["Training", application.training],
    ["Message", application.message || "(none)"],
    ["Consent", "yes"],
    ["Page language", application.lang],
    ["Received", application.receivedAt],
  ];
  const table = rows.map(([label, value]) =>
    `<tr><td style="padding:4px 12px 4px 0;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
  ).join("");
  const testBanner = test
    ? `<p style="background:#fff3cd;padding:12px;"><strong>[TEST]</strong> This notification was sent only to the test inbox.</p>`
    : "";
  const html = shell(`
    ${testBanner}
    <p>New PTC application. This message is from PCG / PTC.</p>
    <table style="border-collapse:collapse;">${table}</table>
    <h2 style="font-size:16px;">JSON record</h2>
    <pre style="white-space:pre-wrap;font-size:13px;background:#f7f4ee;padding:12px;">${escapeHtml(JSON.stringify(application, null, 2))}</pre>
  `);
  const text = [
    test ? "[TEST] This notification was sent only to the test inbox.\n" : "",
    "New PTC application. This message is from PCG / PTC.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "JSON record:",
    JSON.stringify(application, null, 2),
  ].join("\n");
  return { subject, html, text, kind: "notice", test };
}

function sampleApplication(type, lang) {
  return {
    applicantType: type,
    organization: type === "student" ? "" : "Sample organization",
    country: "Kenya",
    city: "Nairobi",
    contactName: "Sample Applicant",
    role: type === "student" ? "" : "Sample role",
    email: "applicant@example.edu",
    phone: "Sample phone",
    language: lang === "es" ? "Español" : lang === "pt" ? "Português" : "English",
    heard: "site",
    training: "Sample training request",
    message: "Sample message",
    consent: true,
    lang,
    receivedAt: "2026-11-14T00:00:00.000Z",
  };
}

function previewDocument() {
  const blocks = [];
  blocks.push({ title: "Staff notification, test mode", mail: renderNotice(sampleApplication("college", "en"), { test: true }) });
  blocks.push({ title: "Staff notification, live mode", mail: renderNotice(sampleApplication("college", "en"), { test: false }) });
  for (const lang of ["en", "es", "pt"]) {
    for (const type of ["college", "country", "school", "student"]) {
      blocks.push({
        title: `Auto-reply ${lang} ${type}, test mode`,
        mail: renderReply(sampleApplication(type, lang), { test: true }),
      });
      blocks.push({
        title: `Auto-reply ${lang} ${type}, live mode`,
        mail: renderReply(sampleApplication(type, lang), { test: false }),
      });
    }
  }
  const parts = blocks.map((block) => `
    <section style="margin:32px 0;padding-top:16px;border-top:4px solid #111;">
      <h2 style="font-family:Arial,sans-serif;">${escapeHtml(block.title)}</h2>
      <p style="font-family:Arial,sans-serif;"><strong>Subject:</strong> ${escapeHtml(block.mail.subject)}</p>
      ${block.mail.html}
    </section>
  `);
  return `<!doctype html><html><head><meta charset="utf-8"><title>PTC application email previews</title></head><body style="margin:24px;background:#fff;">${parts.join("")}</body></html>`;
}

module.exports = {
  COPY,
  LINKS,
  renderReply,
  renderNotice,
  previewDocument,
  TEST_INBOX: "globalmissions.ea@pcg.org",
};
