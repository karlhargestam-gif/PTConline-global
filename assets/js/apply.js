(function () {
  var OFFICE = "wm@pcg.org";
  var BACKUP = "globalmissions.ea@pcg.org";
  var form = document.getElementById("ptc-apply");
  var thanks = document.getElementById("apply-thanks");

  function applicationResult(mode, copy) {
    var office = mode === "sent-to" || mode === "fallback-copy" || mode === "to-only";
    var honeypot = mode === "ok" || mode === "accepted";
    var messages = {
      "dry-run": copy.dryRun,
      "test": copy.test,
      "send-failed": copy.sendFailed
    };
    var honest = Object.prototype.hasOwnProperty.call(messages, mode);
    var heading = copy.thanksTitle;
    var detail = copy.sendFailed;
    var showEmail = true;
    if (office || honeypot) {
      detail = copy.office;
      showEmail = false;
      heading = copy.thanksTitle;
    } else if (honest) {
      detail = messages[mode];
      showEmail = true;
      heading = mode === "send-failed" ? copy.failedTitle : copy.thanksTitle;
    } else if (mode === "busy" || mode === "invalid") {
      detail = "";
      showEmail = false;
      heading = copy.failedTitle;
    } else {
      detail = copy.sendFailed;
      showEmail = true;
      heading = copy.failedTitle;
    }
    if (!office && !honeypot && detail === copy.office) {
      detail = copy.sendFailed;
      showEmail = true;
      heading = copy.failedTitle;
    }
    return {
      heading: heading,
      detail: detail,
      showEmail: showEmail,
      office: office && detail === copy.office
    };
  }

  function mailtoFor(mail) {
    var subject = mail && mail.subject ? mail.subject : "PTC application";
    var text = mail && mail.text ? mail.text : "";
    return "mailto:" + OFFICE
      + "?cc=" + encodeURIComponent(BACKUP)
      + "&subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(text);
  }

  function mailFromFields(data) {
    var rows = [
      ["Type", data.applicantType || ""],
      ["Organization", data.organization || "(none)"],
      ["Country", data.country || ""],
      ["City", data.city || ""],
      ["Contact", data.contactName || ""],
      ["Role", data.role || "(none)"],
      ["Email", data.email || ""],
      ["Phone or WhatsApp", data.phone || ""],
      ["Language", data.language || ""],
      ["Heard", data.heard || ""],
      ["Training", data.training || ""],
      ["Message", data.message || "(none)"],
      ["Consent", "yes"],
      ["Page language", data.lang || "en"]
    ];
    var lines = ["New PTC application. This message is from PCG / PTC.", ""];
    for (var i = 0; i < rows.length; i++) lines.push(rows[i][0] + ": " + rows[i][1]);
    return {
      subject: "PTC application: " + (data.applicantType || "") + " (" + (data.country || "") + ")",
      text: lines.join("\n")
    };
  }

  function showResult(mode, mail) {
    if (!form || !thanks) return;
    var copy = {
      office: thanks.getAttribute("data-office"),
      dryRun: thanks.getAttribute("data-dry-run"),
      test: thanks.getAttribute("data-test"),
      sendFailed: thanks.getAttribute("data-send-failed"),
      thanksTitle: thanks.getAttribute("data-thanks-title"),
      failedTitle: thanks.getAttribute("data-failed-title")
    };
    var view = applicationResult(mode, copy);
    var title = document.getElementById("apply-thanks-title");
    var detail = document.getElementById("apply-thanks-detail");
    var emailRow = document.getElementById("apply-email-row");
    var email = document.getElementById("apply-email-link");
    if (title) title.textContent = view.heading;
    if (detail) detail.textContent = view.detail;
    if (emailRow) emailRow.hidden = !view.showEmail;
    if (email && view.showEmail) email.href = mailtoFor(mail);
    form.hidden = true;
    thanks.hidden = false;
    thanks.setAttribute("tabindex", "-1");
    if (thanks.focus) thanks.focus();
  }

  if (form && thanks) {
    var queryMode = "";
    try {
      queryMode = new URLSearchParams(window.location.search).get("mode") || "";
    } catch (err) {
      queryMode = "";
    }
    if (queryMode && queryMode !== "busy" && queryMode !== "invalid") showResult(queryMode, null);
  }
  if (!form) return;
  var orgLabel = document.getElementById("apply-org-label");
  var org = document.getElementById("apply-organization");
  var role = document.getElementById("apply-role");
  var roleLabel = document.getElementById("apply-role-label");
  var status = document.getElementById("apply-status");

  function selectedType() {
    var chosen = form.querySelector('input[name="applicantType"]:checked');
    return chosen ? chosen.value : "";
  }

  function sync() {
    var type = selectedType();
    if (!type || !orgLabel) return;
    var text = orgLabel.getAttribute("data-" + type) || "";
    var mark = ' <span class="req" aria-hidden="true">*</span>';
    var student = type === "student";
    orgLabel.innerHTML = text + (student ? "" : mark);
    org.required = !student;
    role.required = !student;
    if (roleLabel) {
      var roleText = roleLabel.textContent.replace(/\s*\*$/, "").trim();
      roleLabel.innerHTML = roleText + (student ? "" : mark);
    }
  }

  form.addEventListener("change", function (event) {
    if (event.target && event.target.name === "applicantType") sync();
  });

  form.addEventListener("submit", function (event) {
    if (!window.fetch) return;
    event.preventDefault();
    status.textContent = "";
    var data = {};
    var fields = form.querySelectorAll("input, select, textarea");
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (!field.name || field.disabled) continue;
      if (field.type === "radio" && !field.checked) continue;
      if (field.type === "checkbox") data[field.name] = field.checked ? "yes" : "";
      else data[field.name] = field.value;
    }
    var button = form.querySelector("button");
    button.disabled = true;
    fetch("/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json().then(function (body) {
        return { ok: response.ok, status: response.status, body: body };
      }, function () {
        return { ok: false, status: response.status, body: { mode: "send-failed" } };
      });
    }).then(function (result) {
      button.disabled = false;
      var body = result.body || {};
      var mode = body.mode || body.code || "send-failed";
      if (result.status === 429 || mode === "busy") {
        status.textContent = form.getAttribute("data-busy");
        return;
      }
      if (mode === "invalid") {
        status.textContent = form.getAttribute("data-invalid");
        return;
      }
      if (!result.ok && mode !== "send-failed") mode = "send-failed";
      showResult(mode, body.mail || mailFromFields(data));
    }).catch(function () {
      button.disabled = false;
      showResult("send-failed", mailFromFields(data));
    });
  });
})();
