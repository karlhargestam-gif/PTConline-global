/*!
 * <ptc-course-catalog> — embeddable, read-only PTC course list.
 * No dependencies, no cookies, no tracking. The only request it makes is
 * catalog.json from the same origin/folder this script was loaded from.
 *
 * Attributes:
 *   lang   "en" | "es" | "pt"  show the courses whose page is translated into this language
 *   limit  positive integer     show at most this many courses
 */
(function () {
  "use strict";
  if (!window.customElements || customElements.get("ptc-course-catalog")) return;

  var script = document.currentScript ||
    document.querySelector('script[src*="ptc-catalog.js"]');
  var BASE = new URL(".", script && script.src ? script.src : "https://ptconline.global/widgets/");
  var CATALOG_URL = new URL("catalog.json", BASE).href;
  var SITE = new URL("/", BASE).href;

  var LANG_NAMES = { en: "English", es: "Español", pt: "Português" };
  var UI = {
    en: { heading: "Open courses", translations: "Page translations", all: "View all courses", loading: "Loading courses…", failed: "Browse the course catalog", label: "Pentecostal Theological Consortium courses" },
    es: { heading: "Cursos abiertos", translations: "Traducciones de la página", all: "Ver todos los cursos", loading: "Cargando cursos…", failed: "Ver el catálogo de cursos", label: "Cursos del Consorcio Teológico Pentecostal" },
    pt: { heading: "Cursos abertos", translations: "Traduções da página", all: "Ver todos os cursos", loading: "Carregando cursos…", failed: "Ver o catálogo de cursos", label: "Cursos do Consórcio Teológico Pentecostal" }
  };

  var cache = null;
  function loadCatalog() {
    if (!cache) {
      cache = fetch(CATALOG_URL, { credentials: "omit", mode: "cors" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
      cache.catch(function () { cache = null; });
    }
    return cache;
  }

  var CSS = [
    ":host{--ptc-accent:#b81d25;--ptc-accent-ink:#94171d;--ptc-ink:#111827;--ptc-body:#344454;--ptc-surface:#ffffff;--ptc-rule:#d9dde2;--ptc-chip:#eef1f4;",
    "display:block;container-type:inline-size;font-family:\"Open Sans\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;color:var(--ptc-ink);line-height:1.5}",
    "@media (prefers-color-scheme:dark){:host{--ptc-accent:#f0767c;--ptc-accent-ink:#f59ca0;--ptc-ink:#f3f4f6;--ptc-body:#c3cad3;--ptc-surface:#1b2027;--ptc-rule:#353d47;--ptc-chip:#272e37}}",
    ":host([hidden]){display:none}",
    "*{box-sizing:border-box}",
    ".wrap{background:var(--ptc-surface);border:1px solid var(--ptc-rule);border-top:4px solid var(--ptc-accent);border-radius:8px;padding:16px}",
    "h2{margin:0 0 12px;font-size:1.05rem;font-weight:700;letter-spacing:.01em}",
    "ul{list-style:none;margin:0;padding:0;display:grid;gap:12px;grid-template-columns:1fr}",
    "@container (min-width:560px){ul{grid-template-columns:1fr 1fr}}",
    "li{border:1px solid var(--ptc-rule);border-radius:6px;padding:12px 14px;min-width:0}",
    ".provider{margin:0 0 2px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ptc-body)}",
    "h3{margin:0;font-size:1rem;line-height:1.3;overflow-wrap:anywhere}",
    "a{color:var(--ptc-accent-ink);text-underline-offset:3px}",
    "a:hover{text-decoration-thickness:2px}",
    "a:focus-visible{outline:2px solid var(--ptc-accent);outline-offset:2px;border-radius:2px}",
    "h3 a{color:var(--ptc-ink);text-decoration:none}",
    "h3 a:hover,h3 a:focus-visible{text-decoration:underline;color:var(--ptc-accent-ink)}",
    ".desc{margin:6px 0 8px;font-size:.88rem;color:var(--ptc-body);overflow-wrap:anywhere}",
    ".langs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0;font-size:.75rem;color:var(--ptc-body)}",
    ".langs ul{display:flex;flex-wrap:wrap;gap:6px}",
    ".langs li{border:0;padding:0}",
    ".langs a{display:inline-block;padding:1px 8px;border-radius:999px;background:var(--ptc-chip);text-decoration:none;font-weight:600}",
    ".langs a[aria-current=true]{outline:1px solid var(--ptc-rule)}",
    ".foot{margin:14px 0 0;font-size:.88rem;font-weight:600}",
    ".status{margin:0;font-size:.9rem}"
  ].join("\n");

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function fallbackCatalogUrl(lang) {
    return new URL((lang && lang !== "en" ? lang + "/" : "") + "courses/", SITE).href;
  }

  class PtcCourseCatalog extends HTMLElement {
    static get observedAttributes() { return ["lang", "limit"]; }

    constructor() {
      super();
      this._root = this.attachShadow({ mode: "open" });
    }

    connectedCallback() { this._render(); }
    attributeChangedCallback() { if (this.isConnected) this._render(); }

    _lang() {
      var l = (this.getAttribute("lang") || "").toLowerCase().split("-")[0];
      return UI[l] ? l : "";
    }

    _render() {
      var self = this, lang = this._lang(), ui = UI[lang || "en"];
      var token = (this._token = {});
      this._paint(el("p", { class: "status", role: "status", text: ui.loading }), ui);
      loadCatalog().then(function (data) {
        if (token === self._token) self._paintCatalog(data, lang, ui);
      }).catch(function () {
        if (token !== self._token) return;
        self._paint(el("p", { class: "status" }, [
          el("a", { href: fallbackCatalogUrl(lang), text: ui.failed })
        ]), ui);
      });
    }

    _paint(body, ui) {
      var root = this._root;
      while (root.firstChild) root.removeChild(root.firstChild);
      root.appendChild(el("style", { text: CSS }));
      root.appendChild(el("section", { class: "wrap", "aria-label": ui.label }, [body]));
    }

    _paintCatalog(data, lang, ui) {
      var show = lang || "en";
      var limit = parseInt(this.getAttribute("limit"), 10);
      var courses = (data.courses || []).filter(function (c) {
        return c.pages && c.pages[show];
      });
      if (limit > 0) courses = courses.slice(0, limit);

      var items = courses.map(function (c) {
        var page = c.pages[show];
        var langLinks = (c.pageTranslations || []).filter(function (l) { return c.pages[l]; }).map(function (l) {
          var a = el("a", { href: c.pages[l].url, hreflang: l, lang: l, text: l.toUpperCase(), title: LANG_NAMES[l] || l });
          if (l === show) a.setAttribute("aria-current", "true");
          return el("li", null, [a]);
        });
        return el("li", { lang: show }, [
          c.provider ? el("p", { class: "provider", text: c.provider }) : null,
          el("h3", null, [el("a", { href: page.url, text: page.title })]),
          page.description ? el("p", { class: "desc", text: page.description }) : null,
          langLinks.length ? el("div", { class: "langs" }, [
            el("span", { text: ui.translations + ":" }),
            el("ul", { "aria-label": ui.translations }, langLinks)
          ]) : null
        ]);
      });

      var allUrl = (data.catalogPages && data.catalogPages[show]) || fallbackCatalogUrl(show);
      this._paint(el("div", null, [
        el("h2", { text: ui.heading }),
        el("ul", { role: "list" }, items),
        el("p", { class: "foot" }, [el("a", { href: allUrl, text: ui.all + " →" })])
      ]), ui);
    }
  }

  customElements.define("ptc-course-catalog", PtcCourseCatalog);
})();
