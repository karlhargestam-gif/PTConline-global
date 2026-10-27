(function () {
  var reel = document.querySelector("[data-hero-reel]");
  var button = document.querySelector("[data-hero-pause]");
  if (!reel) return;
  var slides = Array.prototype.slice.call(reel.querySelectorAll(".hero-slide"));
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || slides.length < 2) return;

  var index = 0;
  var timer = 0;
  var paused = false;

  function hydrate(slide) {
    if (slide.getAttribute("data-ready") === "1") return;
    var img = slide.querySelector("img");
    if (!img || img.getAttribute("src")) {
      slide.setAttribute("data-ready", "1");
      return;
    }
    var avif = slide.getAttribute("data-avif");
    var webp = slide.getAttribute("data-webp");
    if (avif) {
      var sourceAvif = document.createElement("source");
      sourceAvif.type = "image/avif";
      sourceAvif.srcset = avif;
      sourceAvif.sizes = "100vw";
      slide.insertBefore(sourceAvif, img);
    }
    if (webp) {
      var sourceWebp = document.createElement("source");
      sourceWebp.type = "image/webp";
      sourceWebp.srcset = webp;
      sourceWebp.sizes = "100vw";
      slide.insertBefore(sourceWebp, img);
    }
    img.decoding = "async";
    img.loading = "lazy";
    img.src = slide.getAttribute("data-fallback");
    slide.setAttribute("data-ready", "1");
  }

  function show(next) {
    slides[index].classList.remove("is-active");
    slides[index].setAttribute("aria-hidden", "true");
    index = next;
    hydrate(slides[index]);
    slides[index].classList.add("is-active");
    slides[index].removeAttribute("aria-hidden");
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = 0;
  }

  function start() {
    stop();
    timer = window.setInterval(function () {
      show((index + 1) % slides.length);
    }, 7500);
  }

  if (button) {
    button.hidden = false;
    button.addEventListener("click", function () {
      paused = !paused;
      button.setAttribute("aria-pressed", paused ? "true" : "false");
      button.textContent = paused
        ? button.getAttribute("data-label-play")
        : button.getAttribute("data-label-pause");
      reel.classList.toggle("is-paused", paused);
      if (paused) stop();
      else start();
    });
  }

  var loadRest = function () {
    slides.slice(1).forEach(hydrate);
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(loadRest, { timeout: 1200 });
  else window.setTimeout(loadRest, 400);
  start();
})();
