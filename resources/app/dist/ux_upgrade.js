'use strict';
/* ===========================================================================
 * MYRAA UX upgrade — performance + navigation + settings (Phase 12).
 * Zero edits to existing files. Progressive enhancement only:
 *  1. Skeleton shimmer for views while their content loads.
 *  2. Sidebar nav grouped into collapsible sections.
 *  3. Settings long page transformed into tabs (Identity / Keys / Prefs / ...).
 *  4. Alt+1..9 keyboard navigation between views.
 * Respects prefers-reduced-motion. No emojis (SVG only).
 * ========================================================================= */
(function () {
  var GROUP_DEFS = [
    { label: 'MYRAA', views: ['home', 'chat'] },
    { label: 'Studios', views: ['app_studio', 'learning', 'course_studio', 'awareness', 'compute'] },
    { label: 'System', views: ['capabilities', 'skills', 'integrations', 'memory', 'files', 'automation', 'activity', 'settings'] },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function reducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function injectCss() {
    if (document.getElementById('ux-upgrade-css')) return;
    var st = document.createElement('style');
    st.id = 'ux-upgrade-css';
    st.textContent =
      '.ux-sk{position:relative;overflow:hidden;background:rgba(255,255,255,0.06);border-radius:8px;min-height:14px;}'
      + '.ux-sk::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.09),transparent);animation:uxsh 1.2s infinite;}'
      + '@keyframes uxsh{from{transform:translateX(-100%);}to{transform:translateX(100%);}}'
      + '@media (prefers-reduced-motion: reduce){.ux-sk::after{animation:none;}}'
      + '.ux-nav-group{font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);padding:10px 12px 4px;cursor:pointer;user-select:none;}'
      + '.ux-nav-group .ux-caret{display:inline-block;margin-right:6px;transition:transform 0.15s;}'
      + '.ux-nav-collapsed .ux-caret{transform:rotate(-90deg);}'
      + '.ux-nav-collapsed + .ux-nav-items{display:none;}'
      + '.ux-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}'
      + '.ux-tab{padding:6px 14px;border-radius:8px;border:1px solid var(--border-divider);background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;}'
      + '.ux-tab.ux-tab-active{background:rgba(34,211,238,0.12);border-color:var(--accent-cyan);color:#fff;}';
    document.head.appendChild(st);
  }

  // ── 1. skeletons ─────────────────────────────────────────────────────────
  var skTimers = {};
  function skeletonFor(container) {
    if (!container || container.querySelector(':scope > .ux-sk-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'ux-sk-wrap';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:4px 0;';
    for (var i = 0; i < 4; i++) {
      var b = document.createElement('div');
      b.className = 'ux-sk';
      b.style.height = (i === 0 ? 22 : 14) + 'px';
      b.style.width = (i === 0 ? '40%' : (92 - i * 8) + '%');
      wrap.appendChild(b);
    }
    container.appendChild(wrap);
    var key = container.id || Math.random();
    skTimers[key] = setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 4000);
  }

  function watchViews() {
    var host = document.getElementById('view-learning');
    var parent = host ? host.parentNode : null;
    if (!parent || parent.__uxWatched) return;
    parent.__uxWatched = true;
    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.target.classList && m.target.classList.contains('app-view-container') && m.target.classList.contains('active')) {
          var hasReal = m.target.querySelector('h1, input, button, table, pre, ul');
          if (!hasReal && !reducedMotion()) skeletonFor(m.target);
        }
      });
    });
    obs.observe(parent, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // ── 2. nav grouping ──────────────────────────────────────────────────────
  function groupNav() {
    var sidebar = document.querySelector('.left-sidebar');
    if (!sidebar || sidebar.__uxGrouped) return false;
    var btns = Array.prototype.slice.call(sidebar.querySelectorAll('.nav-item[data-view]'));
    if (!btns.length) return false;
    sidebar.__uxGrouped = true;
    GROUP_DEFS.forEach(function (g) {
      var groupBtns = btns.filter(function (b) { return g.views.indexOf(b.getAttribute('data-view')) >= 0; });
      if (!groupBtns.length) return;
      var first = groupBtns[0];
      var header = document.createElement('div');
      header.className = 'ux-nav-group';
      header.innerHTML = '<span class="ux-caret">▾</span>' + esc(g.label);
      header.addEventListener('click', function () { header.classList.toggle('ux-nav-collapsed'); });
      var wrap = document.createElement('div');
      wrap.className = 'ux-nav-items';
      first.parentNode.insertBefore(header, first);
      first.parentNode.insertBefore(wrap, header.nextSibling);
      groupBtns.forEach(function (b) { wrap.appendChild(b); });
    });
    return true;
  }

  // ── 3. settings tabs ─────────────────────────────────────────────────────
  function tabifySettings(box) {
    if (!box || box.__uxTabbed) return;
    var sections = Array.prototype.slice.call(box.children).filter(function (el) {
      return el.querySelector && el.querySelector('h3');
    });
    if (sections.length < 2) return;
    box.__uxTabbed = true;
    var search = document.createElement('input');
    search.className = 'ux-search';
    search.setAttribute('placeholder', 'Search settings…');
    search.style.cssText = 'width:100%;max-width:320px;padding:7px 12px;margin-bottom:10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;font-size:12.5px;';
    var activeTab = 0;
    search.addEventListener('input', function () {
      var q = search.value.toLowerCase();
      if (!q) {
        sections.forEach(function (sec, j) { sec.style.display = j === activeTab ? '' : 'none'; });
        return;
      }
      sections.forEach(function (sec) {
        var hit = ((sec.textContent || '').toLowerCase().indexOf(q) >= 0);
        sec.style.display = hit ? '' : 'none';
      });
    });
    var bar = document.createElement('div');
    bar.className = 'ux-tabs';
    sections.forEach(function (sec, i) {
      var h = sec.querySelector('h3');
      var tab = document.createElement('button');
      tab.className = 'ux-tab' + (i === 0 ? ' ux-tab-active' : '');
      tab.textContent = h ? h.textContent : ('Section ' + (i + 1));
      tab.addEventListener('click', function () {
        activeTab = i;
        bar.querySelectorAll('.ux-tab').forEach(function (t) { t.classList.remove('ux-tab-active'); });
        tab.classList.add('ux-tab-active');
        sections.forEach(function (s, j) { s.style.display = j === i ? '' : 'none'; });
      });
      bar.appendChild(tab);
      if (i > 0) sec.style.display = 'none';
    });
    box.insertBefore(bar, box.firstChild);
    box.insertBefore(search, bar);
  }

  function watchSettings() {
    var box = document.getElementById('settings-content-box');
    if (!box || box.__uxSettingsWatched) return;
    box.__uxSettingsWatched = true;
    tabifySettings(box);
    new MutationObserver(function () { tabifySettings(box); }).observe(box, { childList: true });
  }

  // ── 4. keyboard nav ──────────────────────────────────────────────────────
  function bindKeys() {
    if (document.__uxKeys) return;
    document.__uxKeys = true;
    document.addEventListener('keydown', function (e) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var n = parseInt(e.key, 10);
      if (!(n >= 1 && n <= 9)) return;
      var btns = document.querySelectorAll('.left-sidebar .nav-item[data-view]');
      var vis = Array.prototype.slice.call(btns).filter(function (b) { return b.offsetParent !== null; });
      var target = vis[n - 1];
      if (target && typeof window.myraaSwitchView === 'function') {
        e.preventDefault();
        window.myraaSwitchView(target.getAttribute('data-view'));
      }
    });
  }

  function boot() {
    injectCss();
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      try {
        watchViews();
        watchSettings();
        bindKeys();
        if (groupNav() || tries > 40) clearInterval(timer);
      } catch (e) {
        if (tries > 40) clearInterval(timer);
      }
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
