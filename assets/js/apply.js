(function () {
  var form = document.getElementById("ptc-apply");
  var thanks = document.getElementById("apply-thanks");
  if (location.search.indexOf("sent=1") !== -1 && form && thanks) {
    form.hidden = true;
    thanks.hidden = false;
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
      });
    }).then(function (result) {
      button.disabled = false;
      var code = result.body && result.body.code;
      if (result.ok) {
        form.hidden = true;
        thanks.hidden = false;
        thanks.focus && thanks.setAttribute("tabindex", "-1");
        thanks.focus();
        return;
      }
      if (result.status === 429) status.textContent = form.getAttribute("data-busy");
      else if (code === "invalid" || code === "spam") status.textContent = form.getAttribute("data-invalid");
      else status.textContent = form.getAttribute("data-failed");
    }).catch(function () {
      button.disabled = false;
      status.textContent = form.getAttribute("data-failed");
    });
  });
})();
