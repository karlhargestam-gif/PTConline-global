(function () {
  var CODES = "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");

  var FILE_TYPES = /\.(pdf|vtt|txt|md|png|jpe?g|webp)$/i;
  var FILE_LIMIT = 3 * 1024 * 1024;
  var MAX_FILES = 3;

  var form = document.getElementById("course-offer");
  if (!form) return;
  var status = document.getElementById("submit-status");
  var select = form.querySelector("[name=country]");
  var lang = document.documentElement.lang || "en";
  var names = null;
  try {
    names = new Intl.DisplayNames([lang], { type: "region" });
  } catch (err) {
    names = null;
  }
  var options = CODES.map(function (code) {
    var label = names ? names.of(code) : code;
    return { code: code, label: label || code };
  }).sort(function (a, b) {
    return a.label.localeCompare(b.label, lang);
  });
  options.forEach(function (item) {
    var option = document.createElement("option");
    option.value = item.code;
    option.textContent = item.label;
    select.appendChild(option);
  });

  function show(kind) {
    var text = form.getAttribute("data-" + kind) || "";
    var contact = form.getAttribute("data-contact");
    status.hidden = false;
    status.setAttribute("role", kind === "thanks" ? "status" : "alert");
    status.textContent = "";
    status.appendChild(document.createTextNode(text + " "));
    if (kind !== "thanks" && contact) {
      var link = document.createElement("a");
      link.href = contact;
      link.textContent = form.getAttribute("data-contact-label") || contact;
      status.appendChild(link);
    }
  }

  fetch("/api/submit-course", { headers: { accept: "application/json" } })
    .then(function (response) { return response.json().then(function (body) { return { response: response, body: body }; }); })
    .then(function (result) {
      if (!result.body || result.body.code !== "ready") show("unconfigured");
    })
    .catch(function () { show("unconfigured"); });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    var fields = form.elements;
    if (fields.website && fields.website.value) {
      show("thanks");
      form.reset();
      return;
    }
    var fileInput = form.querySelector("[name=files]");
    var hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    if (!hasFile && !fields.materialUrl.value.trim()) {
      show("material");
      fields.materialUrl.focus();
      return;
    }
    if (hasFile) {
      var list = Array.prototype.slice.call(fileInput.files);
      var bad = list.length > MAX_FILES || list.some(function (file) {
        return file.size > FILE_LIMIT || file.size === 0 || !FILE_TYPES.test(file.name);
      });
      if (bad) {
        show("file");
        fileInput.focus();
        return;
      }
    }
    var button = form.querySelector("button");
    button.disabled = true;
    var request;
    if (hasFile) {
      request = fetch("/api/submit-course", { method: "POST", body: new FormData(form), headers: { accept: "application/json" } });
    } else {
      var data = {
        lang: lang,
        name: fields.name.value,
        email: fields.email.value,
        organization: fields.organization.value,
        country: fields.country.value,
        languages: fields.languages.value,
        title: fields.title.value,
        level: fields.level.value,
        description: fields.description.value,
        audience: fields.audience.value,
        formats: Array.prototype.map.call(form.querySelectorAll("[name=formats]:checked"), function (box) { return box.value; }),
        materialUrl: fields.materialUrl.value,
        ownership: fields.ownership.value,
        licence: (form.querySelector("[name=licence]:checked") || {}).value || "",
        rights: fields.rights.checked,
        publish: fields.publish.checked,
        privacy: fields.privacy.checked,
        website: fields.website.value
      };
      request = fetch("/api/submit-course", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(data)
      });
    }
    request.then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        return { ok: response.ok, status: response.status, body: body };
      });
    }).then(function (result) {
      var code = result.body && result.body.code;
      if (!code && result.status === 413) code = "file";
      if (code === "accepted") {
        show("thanks");
        form.reset();
      } else if (code === "unconfigured") {
        show("unconfigured");
      } else if (code === "failed" || code === "file" || code === "material" || code === "busy") {
        show(code);
      } else {
        show("invalid");
      }
    }).catch(function () {
      show("failed");
    }).then(function () {
      button.disabled = false;
    });
  });
})();
