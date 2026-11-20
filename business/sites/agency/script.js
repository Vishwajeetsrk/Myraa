/* =========================================================
   Vishwajeet Side Income — landing page behaviour
   Vanilla JS, no dependencies. Works from file://
   ========================================================= */
(function () {
  'use strict';

  var SUPPORT_EMAIL = 'support.learnifyai@gmail.com';

  /* ---------- Dynamic copyright year ---------- */
  function setYear() {
    var year = String(new Date().getFullYear());
    var nodes = document.querySelectorAll('[data-year]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = year;
    }
  }

  /* ---------- Mobile navigation ---------- */
  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    // Close after choosing a destination.
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    // Close on Escape and return focus to the toggle.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Reset state when switching to desktop layout.
    var desktop = window.matchMedia('(min-width: 900px)');
    var onChange = function (event) { if (event.matches) setOpen(false); };
    if (typeof desktop.addEventListener === 'function') {
      desktop.addEventListener('change', onChange);
    } else if (typeof desktop.addListener === 'function') {
      desktop.addListener(onChange);
    }
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('is-visible');
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    for (var j = 0; j < items.length; j++) observer.observe(items[j]);
  }

  /* ---------- Contact form -> mailto ---------- */
  function initContactForm() {
    var form = document.getElementById('contact-form');
    var status = document.getElementById('form-status');
    if (!form) return;

    function say(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-error', Boolean(isError));
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        say('Please fill in your name, a valid email and a message.', true);
        if (typeof form.reportValidity === 'function') form.reportValidity();
        return;
      }

      var name = (form.elements.namedItem('name').value || '').trim();
      var business = (form.elements.namedItem('business').value || '').trim();
      var email = (form.elements.namedItem('email').value || '').trim();
      var message = (form.elements.namedItem('message').value || '').trim();

      var subject = business
        ? 'Website idea request - ' + business + ' (' + name + ')'
        : 'Website idea request - ' + name;

      var body = [
        'Name: ' + name,
        'Business: ' + (business || '-'),
        'Email: ' + email,
        '',
        'Message:',
        message,
        '',
        '---',
        'Sent from the Vishwajeet Side Income website contact form.'
      ].join('\n');

      var href = 'mailto:' + SUPPORT_EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      say('Opening your email app... If nothing happens, write to ' + SUPPORT_EMAIL + ' directly.');

      // Let the status message paint before the mail client takes over.
      window.setTimeout(function () {
        window.location.href = href;
      }, 60);
    });
  }

  /* ---------- Boot ---------- */
  function init() {
    setYear();
    initNav();
    initReveal();
    initContactForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
