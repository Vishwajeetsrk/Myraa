/* =============================================================
   Clearpath Dental Care - DEMO WEBSITE (fictional business)
   Vanilla JS: mobile navigation, demo form handling, footer year.
   No dependencies, no network requests.
   ============================================================= */
(function () {
  'use strict';

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  function setNavOpen(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  function isMobileNav() {
    return window.matchMedia('(max-width: 899px)').matches;
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setNavOpen(!nav.classList.contains('is-open'));
    });

    // Close after choosing a destination (smooth-scroll anchor links).
    nav.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('a')) {
        setNavOpen(false);
      }
    });

    // Escape closes the menu and returns focus to the toggle.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setNavOpen(false);
        toggle.focus();
      }
    });

    // Clicking outside an open menu closes it.
    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('is-open')) return;
      var t = event.target;
      if (!nav.contains(t) && !toggle.contains(t)) {
        setNavOpen(false);
      }
    });

    // Reset state when switching to desktop layout.
    window.addEventListener('resize', function () {
      if (!isMobileNav()) setNavOpen(false);
    });
  }

  /* ---------- Demo booking form (never sends anything) ---------- */
  var form = document.getElementById('demo-booking-form');
  var statusEl = document.getElementById('form-status');

  if (form && statusEl) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (typeof form.reportValidity === 'function' && !form.checkValidity()) {
        form.reportValidity();
        return;
      }

      statusEl.textContent =
        'Demo form - not connected. Nothing was sent and no data was stored. ' +
        'This is a portfolio demo of a fictional dental practice.';
      form.reset();
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
