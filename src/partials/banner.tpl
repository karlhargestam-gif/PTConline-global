    <header class="site-banner">
      <a class="banner-brand" href="{{home_href}}" aria-label="{{name}}">
        <span class="banner-name">Theological Consortium</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="banner-nav">Explore</button>
      <nav class="banner-nav" id="banner-nav" aria-label="{{nav_label}}">
        <a href="{{home_href}}">{{home_label}}</a>
        <a href="{{courses_href}}">{{courses_label}}</a>
        <a href="{{submit_href}}">{{submit_label}}</a>
        <details class="resources-menu">
          <summary>{{resources_label}}</summary>
          <div class="resources-panel">
            <a class="nav-gospel" href="{{gospel_href}}">{{gospel_label}}</a>
            <a class="nav-cq" href="{{cq_href}}">{{cq_label}}</a>
          </div>
        </details>
      </nav>
      <span class="lang-switch" aria-label="Language">{{lang_switch}}</span>
      <a class="give-button" href="https://www.pcgmission.org/give/" target="_blank" rel="noopener noreferrer">GIVE</a>
      <script>
        (function () {
          var bar = document.currentScript.parentElement;
          if (!bar || !bar.classList.contains("site-banner")) return;
          var sync = function () { bar.classList.toggle("is-shrunk", window.scrollY > 8); };
          sync();
          window.addEventListener("scroll", sync, { passive: true });
          var toggle = bar.querySelector(".nav-toggle");
          var nav = bar.querySelector(".banner-nav");
          if (!toggle || !nav) return;
          toggle.addEventListener("click", function () {
            var open = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", open ? "false" : "true");
            nav.classList.toggle("is-open", !open);
          });
          var resources = nav.querySelector(".resources-menu");
          var mobileResources = window.matchMedia("(max-width: 819px)");
          var syncResources = function () {
            if (!resources) return;
            resources.open = mobileResources.matches;
          };
          syncResources();
          if (mobileResources.addEventListener) mobileResources.addEventListener("change", syncResources);
        })();
      </script>
    </header>
