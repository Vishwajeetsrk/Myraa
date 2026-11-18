(function () {
  'use strict';
  // Settings Workspace: a wide, searchable surface fed ONLY by real backend APIs.
  // No fake toggles: only the screen-awareness consent control is actionable.
  var ID = 'myraa-settings-workspace';

  var SECTIONS = [
    { id: 'general', label: 'General', api: '/api/health', note: 'Runtime version from version.json' },
    { id: 'voice', label: 'Voice', api: '/api/live/status', note: 'Live WebSocket state' },
    { id: 'intelligence', label: 'Intelligence', api: '/api/providers/adapters', note: 'Real provider adapters' },
    { id: 'screen', label: 'Screen Intelligence', api: '/api/screen-awareness/status', note: 'Consent-gated observation' },
    { id: 'skills', label: 'Skills', api: '/api/skills-v2/summary', note: 'Manifests verified on disk' },
    { id: 'connectors', label: 'Connectors', api: '/api/connectors-v2/list', note: 'Auth/health truth only' },
    { id: 'memory', label: 'Memory', api: '/api/projects-v2/memory-overview', note: 'Real store counts' },
    { id: 'security', label: 'Security', api: '/api/permissions', note: 'Permission engine state' },
    { id: 'diagnostics', label: 'Diagnostics', api: '/api/diagnostics-center/last', note: 'Last real health run' },
  ];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  async function json(path) {
    try {
      var r = await fetch(path, { cache: 'no-store' });
      if (!r.ok) return { ok: false, code: 'HTTP_' + r.status };
      return await r.json();
    } catch (e) { return { ok: false, code: 'UNAVAILABLE' }; }
  }

  function renderSection(section, data) {
    var h = '<div class="myraa-set-head"><h3>' + esc(section.label) + '</h3><span>' + esc(section.note) + '</span></div>';
    if (!data || data.ok === false) {
      return h + '<p class="myraa-set-muted">UNAVAILABLE' + (data && data.code ? ' (' + esc(data.code) + ')' : '') + '</p>';
    }
    if (section.id === 'screen') {
      h += '<div class="myraa-set-row"><span>Screen awareness</span><b>' + (data.enabled ? 'ON' : 'OFF') + '</b></div>';
      h += '<div class="myraa-set-row"><span>Last changed</span><b>' + esc(data.updatedAt || 'never') + '</b></div>';
      h += '<button id="myraa-consent-toggle" data-enabled="' + (data.enabled ? 'true' : 'false') + '">'
        + (data.enabled ? 'Disable screen awareness' : 'Enable screen awareness') + '</button>';
      h += '<p class="myraa-set-muted">Consent is stored in screen_awareness_consent.json. No capture occurs while OFF.</p>';
      return h;
    }
    if (section.id === 'general') return h + '<div class="myraa-set-row"><span>MYRAA version</span><b>' + esc(data.version) + '</b></div><div class="myraa-set-row"><span>Status</span><b>' + esc(data.status) + '</b></div>';
    if (section.id === 'voice') return h + '<div class="myraa-set-row"><span>Live state</span><b>' + esc(data.status) + '</b></div><div class="myraa-set-row"><span>Source</span><b>' + esc(data.statusSource) + '</b></div><div class="myraa-set-row"><span>Connections</span><b>' + esc(data.activeConnections) + '</b></div>';
    if (section.id === 'skills') return h + '<div class="myraa-set-row"><span>Catalogued</span><b>' + esc(data.catalogued) + '</b></div><div class="myraa-set-row"><span>Verified SKILL.md</span><b>' + esc(data.installed) + '</b></div><p class="myraa-set-muted">Manifest verification is not execution. Run support is NOT_IMPLEMENTED.</p>';
    if (section.id === 'intelligence') {
      var adapters = data.adapters || [];
      return h + '<div class="myraa-set-grid">' + adapters.map(function (a) {
        return '<div class="myraa-set-card"><b>' + esc(a.label) + '</b><div>' + (a.configured ? 'Configured' : 'Not configured') + '</div><div>' + esc(a.keyEnv || 'local') + '</div><div>' + (a.implemented && a.implemented.chat ? 'chat READY' : 'chat NOT_IMPLEMENTED') + '</div></div>';
      }).join('') + '</div><p class="myraa-set-muted">Keys are never displayed. READ ONLY - configure via provider credentials flow (to be built).</p>';
    }
    if (section.id === 'connectors') {
      var list = data.connectors || [];
      return h + '<div class="myraa-set-grid">' + list.map(function (c) {
        return '<div class="myraa-set-card"><b>' + esc(c.name) + '</b><div>' + esc(c.status) + '</div><div>' + esc(c.authType) + '</div></div>';
      }).join('') + '</div><p class="myraa-set-muted">Status comes from real auth/health checks. OAuth is NOT_IMPLEMENTED.</p>';
    }
    if (section.id === 'memory') {
      return h + (data.sources || []).map(function (s) {
        return '<div class="myraa-set-row"><span>' + esc(s.name) + '</span><b>' + (s.count == null ? 'NULL (unreadable)' : esc(s.count)) + '</b></div>';
      }).join('');
    }
    if (section.id === 'security') return h + '<div class="myraa-set-row"><span>Permission engine</span><b>' + (data.ok ? 'READY' : 'UNAVAILABLE') + '</b></div><p class="myraa-set-muted">Risk rules are enforced by the approval broker; this view is READ ONLY.</p>';
    if (section.id === 'diagnostics') return h + '<div class="myraa-set-row"><span>Last run</span><b>' + esc(data.generatedAt || 'never') + '</b></div><div class="myraa-set-row"><span>Checks</span><b>' + esc(data.checks == null ? 'UNAVAILABLE' : data.checks) + '</b></div>';
    return h + '<pre class="myraa-set-muted">' + esc(JSON.stringify(data).slice(0, 1200)) + '</pre>';
  }

  function ensure() {
    if (document.getElementById(ID)) return;
    var root = document.createElement('section');
    root.id = ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'MYRAA Settings Workspace');
    root.innerHTML = '<div class="myraa-set-box"><header><h2>MYRAA Settings</h2>'
      + '<input id="myraa-set-search" placeholder="Search settings sections..." aria-label="Search settings">'
      + '<button id="myraa-set-close" aria-label="Close settings">Close</button></header>'
      + '<div class="myraa-set-main"><nav id="myraa-set-nav"></nav><div id="myraa-set-content"></div></div></div>';
    document.body.appendChild(root);
    document.getElementById('myraa-set-close').addEventListener('click', close);
    root.addEventListener('click', function (e) { if (e.target === root) close(); });
    var search = document.getElementById('myraa-set-search');
    search.addEventListener('input', function () { buildNav(search.value); });
    buildNav('');
    show('screen');
  }

  function buildNav(query) {
    var nav = document.getElementById('myraa-set-nav');
    var q = (query || '').trim().toLowerCase();
    nav.innerHTML = SECTIONS.filter(function (s) { return !q || s.label.toLowerCase().indexOf(q) !== -1 || s.id.indexOf(q) !== -1; })
      .map(function (s) { return '<button data-section="' + s.id + '">' + esc(s.label) + '</button>'; }).join('');
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-section')); });
    });
  }

  async function show(id) {
    var section = SECTIONS.find(function (s) { return s.id === id; });
    if (!section) return;
    var content = document.getElementById('myraa-set-content');
    content.innerHTML = '<p class="myraa-set-muted">Loading ' + esc(section.label) + ' from real backend state...</p>';
    var data = await json(section.api);
    content.innerHTML = renderSection(section, data);
    var toggle = document.getElementById('myraa-consent-toggle');
    if (toggle) {
      toggle.addEventListener('click', async function () {
        var enabled = toggle.getAttribute('data-enabled') !== 'true';
        toggle.disabled = true;
        var r = await fetch('/api/screen-awareness/consent', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: enabled }),
        });
        if (r.ok) show('screen'); else { toggle.disabled = false; toggle.textContent = 'FAILED - retry'; }
      });
    }
  }

  function open() {
    ensure();
    document.getElementById(ID).classList.add('open');
    document.getElementById('myraa-set-search').focus();
    show('screen');
  }
  function close() {
    var root = document.getElementById(ID);
    if (root) root.classList.remove('open');
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.__myraaSettings = { open: open, close: close, sections: SECTIONS };
})();
