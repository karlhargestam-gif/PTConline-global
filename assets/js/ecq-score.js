/* ECQ area scoring. Pure arithmetic. No network, no storage, no grade. */
var EcqScore = (function () {
  "use strict";

  function bandFor(score, bands) {
    if (typeof score !== "number" || !isFinite(score)) return null;
    for (var i = 0; i < bands.length; i++) {
      var band = bands[i];
      if (score >= band.min && score <= band.max) return band;
    }
    return null;
  }

  function areaResult(area, answers, bands) {
    var total = 0;
    for (var i = 0; i < area.items.length; i++) {
      var value = answers[String(area.items[i].n)];
      if (typeof value !== "number" || value < 1 || value > 5) {
        return { id: area.id, name: area.name, total: null, band: null, complete: false };
      }
      total += value;
    }
    return {
      id: area.id,
      name: area.name,
      total: total,
      band: bandFor(total, bands),
      complete: true
    };
  }

  function scoreAreas(areas, answers, bands) {
    var out = [];
    for (var i = 0; i < areas.length; i++) out.push(areaResult(areas[i], answers, bands));
    return out;
  }

  return { bandFor: bandFor, scoreAreas: scoreAreas };
})();
