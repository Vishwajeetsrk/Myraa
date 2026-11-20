/* Liora Hair & Beauty Studio — DEMO SCRIPT
   Vanilla JS only: mobile nav, header shadow, footer year.
   No frameworks, no external requests, no data collection. */

(function () {
  "use strict";

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  var header = document.querySelector(".site-header");

  /* ----- Mobile hamburger navigation ----- */
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Close after choosing a destination
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setOpen(false);
      }
    });

    // Close on Escape and return focus to the toggle
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    // Reset to desktop layout if the viewport grows past the breakpoint
    var desktop = window.matchMedia("(min-width: 900px)");
    var onViewportChange = function (event) {
      if (event.matches) {
        setOpen(false);
      }
    };
    if (desktop.addEventListener) {
      desktop.addEventListener("change", onViewportChange);
    } else if (desktop.addListener) {
      desktop.addListener(onViewportChange);
    }
  }

  /* ----- Subtle header shadow once the page is scrolled ----- */
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ----- Footer year ----- */
  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
})();
