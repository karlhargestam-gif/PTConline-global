        <header class="site-banner">
          <a class="banner-brand" href="{{home_href}}" aria-label="{{name}}">
            <span class="banner-name">Theological Consortium</span>
          </a>
          <nav class="banner-nav" aria-label="{{nav_label}}">
            <a href="{{courses_href}}">{{courses_label}}</a>
            <a href="{{submit_href}}">{{submit_label}}</a>
            <a href="{{pcg_url}}" target="_blank" rel="noopener noreferrer">{{pcg_label}}</a>
          </nav>
          <span class="lang-switch" aria-label="Language">{{lang_switch}}</span>
          <script>
            (function () {
              var bar = document.currentScript.parentElement;
              if (!bar || !bar.classList.contains("site-banner")) return;
              var sync = function () { bar.classList.toggle("is-shrunk", window.scrollY > 8); };
              sync();
              window.addEventListener("scroll", sync, { passive: true });
            })();
          </script>
        </header>
