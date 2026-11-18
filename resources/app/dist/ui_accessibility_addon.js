(function () {
  'use strict';
  // Phase 14/17: readable text + accessible icon controls. DOM-only overlay;
  // does not touch the 3D avatar, its meshes, shaders, eyes or camera.
  var stats = { tinyTextFixed: 0, tooltipsAdded: 0, labelsAdded: 0 };
  var MIN_PX = 11;

  function raiseTinyText(root) {
    var nodes = root.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.style || !el.style.fontSize) continue;
      var m = /^(\d+(?:\.\d+)?)px$/.exec(el.style.fontSize.trim());
      if (!m) continue;
      var size = parseFloat(m[1]);
      if (size < MIN_PX) {
        el.style.fontSize = MIN_PX + 'px';
        stats.tinyTextFixed++;
      }
    }
  }

  function nameFor(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.getAttribute('title')) return el.getAttribute('title');
    if (el.getAttribute('data-tip')) return el.getAttribute('data-tip');
    var svgTitle = el.querySelector('svg title');
    if (svgTitle && svgTitle.textContent.trim()) return svgTitle.textContent.trim();
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return text || '';
  }

  function labelControls(root) {
    var nodes = root.querySelectorAll('button, a[role="button"], [role="button"]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var name = nameFor(el);
      if (!name && el.id) name = el.id.replace(/^myraa-/, '').replace(/[-_]/g, ' ');
      if (!name) continue;
      if (!el.getAttribute('aria-label')) {
        el.setAttribute('aria-label', name);
        stats.labelsAdded++;
      }
      if (!el.getAttribute('title')) {
        el.setAttribute('title', name);
        stats.tooltipsAdded++;
      }
    }
  }

  function pass() {
    try {
      raiseTinyText(document.body);
      labelControls(document.body);
    } catch (e) {}
  }

  pass();
  if (window.MutationObserver) {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; pass(); }, 250);
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.__myraaUiPolish = stats;
  document.dispatchEvent(new CustomEvent('myraa:ui-polish', { detail: stats }));
})();
