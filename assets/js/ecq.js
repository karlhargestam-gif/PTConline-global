/* ECQ intro. Answers live in memory for this page view only.
   Nothing is written to storage, and nothing is sent except the GET for the copy file.
   TODO: Link the live "Come over and help us" form only after that page is working,
   Karl has previewed it, and he has said to publish. Never link it to a missionary application. */
(function () {
  "use strict";

  var root = document.getElementById("ecq");
  if (!root || !window.EcqScore) return;

  var content = null;
  var answers = {};
  var reflection = "";
  var lastStep = null;
  var wasComplete = false;
  var BLOCKED_INVITE = /apply|missionary|application|messengercollege|missiononeeleven|sign-up|signup|\/enroll/i;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(value) {
    var html = escapeHtml(value);
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    return html;
  }

  function fill(template, map) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return map[key] == null ? "" : String(map[key]);
    });
  }

  function paras(list) {
    return (list || []).map(function (text) {
      return "<p>" + inline(text) + "</p>";
    }).join("");
  }

  function steps() {
    return content.steps;
  }

  function stepById(id) {
    for (var i = 0; i < content.steps.length; i++) {
      if (content.steps[i].id === id) return content.steps[i];
    }
    return content.steps[0];
  }

  function currentStep() {
    var id = (location.hash || "").replace(/^#/, "");
    return stepById(id);
  }

  function indexOf(step) {
    return content.steps.indexOf(step);
  }

  function scoredCount() {
    var n = 0;
    content.check.areas.forEach(function (area) {
      area.items.forEach(function (item) {
        if (typeof answers[String(item.n)] === "number") n += 1;
      });
    });
    return n;
  }

  function results() {
    return window.EcqScore.scoreAreas(content.check.areas, answers, content.check.bands);
  }

  function allScored() {
    return results().every(function (area) { return area.complete && area.band; });
  }

  function choiceRow(item) {
    var name = "ecq-q-" + item.n;
    var html = '<fieldset class="ecq-item"><legend><span class="ecq-n">' + item.n + ".</span> " + inline(item.text) + "</legend>";
    html += '<div class="ecq-choices">';
    content.check.scale.forEach(function (point) {
      var id = name + "-" + point.value;
      var checked = answers[String(item.n)] === point.value ? " checked" : "";
      html += '<label class="ecq-choice">';
      html += '<input type="radio" id="' + id + '" name="' + name + '" value="' + point.value + '" autocomplete="off" aria-label="' + escapeHtml(point.label) + '"' + checked + ">";
      html += '<span class="ecq-choice-face"><span class="ecq-choice-num">' + point.value + '</span><span class="ecq-choice-word">' + escapeHtml(point.short) + "</span></span>";
      html += "</label>";
    });
    html += "</div></fieldset>";
    return html;
  }

  function scaleList() {
    var ui = content.ui;
    var html = '<p class="ecq-scale-hint">' + inline(ui.scaleHint) + '</p><ul class="ecq-scale">';
    content.check.scale.forEach(function (point) {
      html += '<li><span class="ecq-scale-n">' + point.value + "</span> " + escapeHtml(point.label) + "</li>";
    });
    return html + "</ul>";
  }

  function resultsInner() {
    var ui = content.ui;
    var rows = results();
    var done = rows.every(function (area) { return area.complete && area.band; });
    var count = fill(ui.answered, { n: scoredCount() });
    if (!done) {
      return '<p class="ecq-wait">' + inline(ui.needAll) + ' <strong id="ecq-answered">' + escapeHtml(count) + "</strong></p>";
    }
    var html = '<section class="ecq-results" aria-labelledby="ecq-results-heading">';
    html += '<h3 id="ecq-results-heading" tabindex="-1">' + inline(ui.resultsTitle) + "</h3>";
    html += '<p class="ecq-results-note">' + inline(ui.resultsNote) + "</p>";
    html += '<p class="ecq-answered-line" id="ecq-answered">' + escapeHtml(count) + "</p>";
    html += '<div class="ecq-scores">';
    rows.forEach(function (area) {
      html += '<article class="ecq-score">';
      html += '<p class="ecq-score-name">' + escapeHtml(area.name) + "</p>";
      html += '<p class="ecq-score-num">' + area.total + ' <span>' + escapeHtml(ui.of25) + "</span></p>";
      html += '<p class="ecq-score-band">' + escapeHtml(area.band.label) + "</p>";
      html += "</article>";
    });
    html += "</div><div class=\"ecq-nexts\">";
    rows.forEach(function (area) {
      var next = content.check.nextSteps[area.id][area.band.id];
      html += "<section>";
      html += "<h3>" + escapeHtml(area.name) + " · " + escapeHtml(area.band.label) + "</h3>";
      html += '<p class="ecq-meaning">' + inline(area.band.meaning) + "</p>";
      html += "<p><strong>" + escapeHtml(ui.nextStep) + "</strong> " + inline(next) + "</p>";
      html += "</section>";
    });
    html += "</div>";
    html += practiceSummary();
    if (reflection.trim()) {
      html += "<h3>" + inline(ui.reflectionTitle) + "</h3>";
      html += "<p>" + escapeHtml(reflection).replace(/\n/g, "<br>") + "</p>";
    }
    html += '<p class="ecq-print-row"><button type="button" class="button" data-print="results">' + escapeHtml(ui.print) + "</button></p>";
    html += "</section>";
    return html;
  }

  function practiceSummary() {
    var ui = content.ui;
    var lines = [];
    content.check.practice.forEach(function (item) {
      var value = answers[String(item.n)];
      if (typeof value !== "number") return;
      var label = "";
      content.check.scale.forEach(function (point) {
        if (point.value === value) label = point.label;
      });
      lines.push("<li><span>" + item.n + ".</span> " + inline(item.text) + " <strong>" + escapeHtml(label) + "</strong></li>");
    });
    var html = '<section class="ecq-practice-summary"><h3>' + inline(ui.unscoredTitle) + "</h3>";
    html += "<p>" + inline(ui.unscoredResults) + " " + inline(ui.unscoredNote) + "</p>";
    html += lines.length ? "<ul>" + lines.join("") + "</ul>" : "<p>" + inline(ui.unscoredEmpty) + "</p>";
    return html + "</section>";
  }

  function renderWelcome(step) {
    var html = paras(step.paragraphs);
    if (step.story) {
      html += '<section class="ecq-story">';
      html += "<h3>" + inline(step.story.title) + "</h3>";
      html += paras(step.story.paragraphs);
      if (step.story.watchHref) {
        html += '<p><a class="button" href="' + escapeHtml(step.story.watchHref) + '" target="_blank" rel="noopener">' + inline(step.story.watchLabel) + "</a></p>";
      }
      html += "</section>";
    }
    if (step.remember) {
      html += "<h3>" + inline(step.remember.title) + "</h3><ul>";
      step.remember.items.forEach(function (item) {
        html += "<li>" + inline(item) + "</li>";
      });
      html += "</ul>";
    }
    return html;
  }

  function renderArea(step) {
    var ui = content.ui;
    var html = "<h3>" + inline(ui.learn) + "</h3>" + paras(step.learn);
    html += '<aside class="ecq-picture"><h3>' + inline(ui.pictureTitle) + "</h3>";
    html += '<p class="ecq-disclaimer">' + inline(ui.pictureDisclaimer) + "</p>";
    html += "<p>" + inline(step.picture) + "</p></aside>";
    html += "<h3>" + inline(ui.promptsTitle) + "</h3><ol>";
    step.prompts.forEach(function (item) { html += "<li>" + inline(item) + "</li>"; });
    html += "</ol>";
    html += '<aside class="ecq-practice"><h3>' + inline(ui.practiceTitle) + "</h3><p>" + inline(step.practice) + "</p></aside>";
    return html;
  }

  function renderCheck(step) {
    var ui = content.ui;
    var html = '<div class="ecq-notice" role="note">' + paras(step.notice) + "</div>";
    html += '<div class="ecq-questions">' + scaleList();
    content.check.areas.forEach(function (area) {
      html += '<section class="ecq-area" id="ecq-area-' + area.id + '"><h3>' + escapeHtml(area.name) + "</h3>";
      area.items.forEach(function (item) { html += choiceRow(item); });
      html += "</section>";
    });
    html += "</div>";
    html += '<section class="ecq-unscored"><h3>' + inline(ui.unscoredTitle) + "</h3>";
    html += "<p>" + inline(ui.unscoredNote) + "</p>";
    content.check.practice.forEach(function (item) { html += choiceRow(item); });
    html += "</section>";
    html += '<section class="ecq-reflection"><h3>' + inline(ui.reflectionTitle) + "</h3>";
    html += "<p>" + inline(ui.reflectionNote) + "</p>";
    html += '<label for="ecq-reflection">' + inline(content.check.reflection) + "</label>";
    html += '<textarea id="ecq-reflection" autocomplete="off" rows="5">' + escapeHtml(reflection) + "</textarea>";
    html += "</section>";
    html += '<div id="ecq-results">' + resultsInner() + "</div>";
    return html;
  }

  function inviteHtml() {
    var ui = content.ui;
    var href = ui.inviteHref;
    var allowed = typeof href === "string" && href.length > 0 && href !== "#" && !BLOCKED_INVITE.test(href);
    if (!allowed) {
      return '<p class="ecq-invite-wrap"><button type="button" class="button ecq-invite" disabled>'
        + inline(ui.inviteLabel) + "</button><span class=\"ecq-todo\">" + inline(ui.inviteTodo) + "</span></p>";
    }
    return '<p class="ecq-invite-wrap"><a class="button" href="' + escapeHtml(href) + '">' + inline(ui.inviteLabel) + "</a></p>";
  }

  function renderClose(step) {
    var html = "";
    step.sections.forEach(function (section) {
      if (section.heading) html += "<h3>" + inline(section.heading) + "</h3>";
      html += paras(section.paragraphs);
    });
    return html + inviteHtml();
  }

  function bodyFor(step) {
    if (step.id === "welcome") return renderWelcome(step);
    if (step.id === "check") return renderCheck(step);
    if (step.id === "close") return renderClose(step);
    return renderArea(step);
  }

  function progress(step) {
    var ui = content.ui;
    var index = indexOf(step);
    var total = content.steps.length;
    var label = fill(ui.page, { n: index + 1, total: total }) + " · " + step.nav;
    var html = '<nav class="ecq-progress" id="ecq-progress" aria-label="Path">';
    html += '<p class="ecq-count">' + escapeHtml(label) + "</p>";
    html += '<div class="ecq-bar" role="progressbar" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="' + (index + 1) + '" aria-valuetext="' + escapeHtml(label) + '">';
    html += '<span style="width:' + ((index + 1) / total * 100) + '%"></span></div><ol class="ecq-steps">';
    content.steps.forEach(function (item, i) {
      var current = item.id === step.id;
      html += '<li' + (current ? ' class="is-current"' : "") + ">";
      html += '<a href="#' + item.id + '"' + (current ? ' aria-current="step"' : "") + ">" + (i + 1) + " " + escapeHtml(item.nav) + "</a></li>";
    });
    return html + "</ol></nav>";
  }

  function nav(step) {
    var ui = content.ui;
    var index = indexOf(step);
    var html = '<div class="ecq-nav">';
    if (index > 0) {
      var prev = content.steps[index - 1];
      html += '<a class="ecq-back" href="#' + prev.id + '">' + escapeHtml(ui.back) + "</a>";
    }
    if (index < content.steps.length - 1) {
      var next = content.steps[index + 1];
      html += '<a class="button" href="#' + next.id + '">' + escapeHtml(ui.next + ": " + next.nav) + "</a>";
    }
    return html + "</div>";
  }

  function render() {
    var step = currentStep();
    var changed = lastStep !== null && lastStep !== step.id;
    lastStep = step.id;
    if (step.id !== "check") wasComplete = false;
    root.innerHTML = progress(step)
      + '<div class="ecq-step"><h2 id="ecq-heading" tabindex="-1">' + inline(step.heading) + "</h2>"
      + bodyFor(step) + "</div>" + nav(step);
    if (changed) {
      var heading = document.getElementById("ecq-heading");
      if (heading) heading.focus({ preventScroll: true });
      var bar = document.getElementById("ecq-progress");
      var banner = document.querySelector(".site-banner");
      if (bar) {
        var offset = (banner ? banner.offsetHeight : 66) + 8;
        var top = bar.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo(0, Math.max(0, top));
      }
    }
  }

  function paintResults(fromAnswer) {
    var slot = document.getElementById("ecq-results");
    if (!slot) return;
    var done = allScored();
    slot.innerHTML = resultsInner();
    if (fromAnswer && done && !wasComplete) {
      var heading = document.getElementById("ecq-results-heading");
      if (heading) {
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: "start" });
      }
    }
    wasComplete = done;
  }

  root.addEventListener("change", function (event) {
    var input = event.target;
    if (!input.name || input.name.indexOf("ecq-q-") !== 0) return;
    var n = input.name.slice("ecq-q-".length);
    answers[n] = Number(input.value);
    paintResults(true);
  });

  root.addEventListener("input", function (event) {
    if (event.target.id === "ecq-reflection") reflection = event.target.value;
  });

  root.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest("[data-print]") : null;
    if (!button) return;
    document.body.classList.add("ecq-print-results");
    window.print();
  });

  window.addEventListener("afterprint", function () {
    document.body.classList.remove("ecq-print-results");
  });

  window.addEventListener("hashchange", render);

  function applyMeta() {
    var meta = content.meta;
    var kicker = document.querySelector(".masthead .kicker");
    var title = document.querySelector(".masthead h1");
    var lead = document.querySelector(".masthead .lead");
    if (kicker) kicker.textContent = meta.kicker;
    if (title) title.textContent = meta.title;
    if (lead) lead.textContent = meta.lead;
    if (meta.documentTitle) document.title = meta.documentTitle;
  }

  var url = root.getAttribute("data-content");
  fetch(url, { method: "GET", credentials: "omit", cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("load");
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.meta || !Array.isArray(data.steps) || !data.check) throw new Error("shape");
      content = data;
      applyMeta();
      render();
    })
    .catch(function () {
      root.innerHTML = "<p>This path could not be loaded. Please refresh the page.</p>";
    });
})();
