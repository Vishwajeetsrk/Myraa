(function () {
  'use strict';
  // P1 shell: one status strip, one Capability Center, one command palette.
  // All data comes from real backend APIs; unavailable data says so.
  var API = {
    capabilities: '/api/capabilities',
    health: '/api/health-manager/last',
    skills: '/api/skills-v2/summary',
    connectors: '/api/connectors-v2/list',
    agents: '/api/agents-v2/agents',
    tasks: '/api/tasks/summary',
    actions: '/api/actions/list?limit=500',
    presets: '/api/mcp-v2/presets',
    version: '/api/health',
  };

  async function json(path) {
    try {
      var r = await fetch(path, { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // --- real status strip -----------------------------------------------------
  function statusStrip() {
    var bar = document.getElementById('myraa-unified-status');
    if (!bar) {
      bar = el('div');
      bar.id = 'myraa-unified-status';
      document.body.appendChild(bar);
      bar.addEventListener('click', function () { openCapabilityCenter(); });
    }
    Promise.all([
      json(API.version), json(API.skills), json(API.connectors),
      json(API.agents), json(API.tasks), json(API.presets),
    ]).then(function (a) {
      var v = a[0] || {};
      var sk = a[1] || {};
      var cn = a[2] || {};
      var ag = a[3] || {};
      var tk = a[4] || {};
      var mp = a[5] || {};
      bar.innerHTML = '';
      bar.appendChild(el('span', 'dot'));
      bar.appendChild(el('span', '', 'MYRAA ' + (v.version || 'UNAVAILABLE')));
      bar.appendChild(el('span', 'sep', '|'));
      bar.appendChild(el('span', '', 'Skills ' + (sk.installed != null ? sk.installed + ' verified' : 'UNAVAILABLE')));
      bar.appendChild(el('span', 'sep', '|'));
      var connected = Array.isArray(cn.connectors) ? cn.connectors.filter(function (c) { return c.status === 'READY'; }).length : 0;
      bar.appendChild(el('span', '', 'Connectors ' + connected + ' ready / ' + (Array.isArray(cn.connectors) ? cn.connectors.length : '?')));
      bar.appendChild(el('span', 'sep', '|'));
      bar.appendChild(el('span', '', 'Agents ' + (ag.count != null ? ag.count : 'UNAVAILABLE')));
      bar.appendChild(el('span', 'sep', '|'));
      bar.appendChild(el('span', '', 'Tasks ' + (tk.total != null ? tk.total : 'UNAVAILABLE')));
      bar.appendChild(el('span', 'sep', '|'));
      bar.appendChild(el('span', '', 'MCP presets ' + (mp.count != null ? mp.count : 'UNAVAILABLE')));
      bar.title = 'Click for the Capability Center. All numbers come from live backend state.';
    });
  }

  // --- Capability Center -----------------------------------------------------
  function openCapabilityCenter() {
    var root = document.getElementById('myraa-capability-center');
    if (!root) {
      root = el('div');
      root.id = 'myraa-capability-center';
      var box = el('div', 'box');
      var input = el('input');
      input.placeholder = 'What can MYRAA do? Try "make an Excel report" or "GitHub issues"';
      input.id = 'myraa-capability-input';
      var results = el('div');
      results.id = 'myraa-capability-results';
      var hint = el('div', 'meta', 'Searches real skills, actions and connectors. Press ESC to close.');
      box.appendChild(input); box.appendChild(hint); box.appendChild(results);
      root.appendChild(box);
      root.addEventListener('click', function (e) { if (e.target === root) close(); });
      input.addEventListener('input', function () { searchCapabilities(input.value, results); });
      document.body.appendChild(root);
    }
    root.classList.add('open');
    var field = document.getElementById('myraa-capability-input');
    if (field) { field.focus(); searchCapabilities('', document.getElementById('myraa-capability-results')); }
  }

  function addResult(container, kind, title, meta) {
    var row = el('div', 'result');
    var left = el('div');
    left.appendChild(el('div', 'kind', kind));
    left.appendChild(el('div', '', title));
    row.appendChild(left);
    row.appendChild(el('div', 'meta', meta || ''));
    container.appendChild(row);
  }

  function searchCapabilities(query, container) {
    if (!container) return;
    container.innerHTML = '';
    var q = (query || '').trim().toLowerCase();
    var words = q.split(/\s+/).filter(Boolean);
    Promise.all([json(API.skills), json(API.actions), json(API.connectors)]).then(function (a) {
      var sk = (a[0] && a[0].installed) || 0;
      if (!words.length) {
        addResult(container, 'truth', 'Skills', sk + ' manifests verified, 0 executable via this UI (execution NOT IMPLEMENTED)');
        addResult(container, 'truth', 'Connectors', 'Status from real auth/health checks only');
        return;
      }
      var actions = (a[1] && a[1].actions) || [];
      var connectors = (a[2] && a[2].connectors) || [];
      var matches = actions.filter(function (x) {
        var text = ((x.id || '') + ' ' + (x.description || '')).toLowerCase();
        return words.some(function (w) { return text.indexOf(w) !== -1; });
      }).slice(0, 10);
      matches.forEach(function (m) { addResult(container, 'action', m.id, m.risk + ' / ' + (m.confirmationRequired ? 'approval required' : 'no approval')); });
      connectors.filter(function (c) {
        var text = ((c.id || '') + ' ' + (c.name || '') + ' ' + (c.summary || '')).toLowerCase();
        return words.some(function (w) { return text.indexOf(w) !== -1; });
      }).slice(0, 6).forEach(function (c) { addResult(container, 'connector', c.name || c.id, c.status); });
      if (!matches.length && !container.children.length) addResult(container, 'none', 'No matching capability', 'Searched real action and connector registries');
    });
  }

  // --- command palette -------------------------------------------------------
  function openPalette() {
    var root = document.getElementById('myraa-command-palette');
    if (!root) {
      root = el('div');
      root.id = 'myraa-command-palette';
      var box = el('div', 'box');
      var input = el('input');
      input.placeholder = 'Search memories, projects, tasks, agents, skills, connectors...';
      var results = el('div');
      results.id = 'myraa-command-results';
      box.appendChild(input); box.appendChild(results);
      root.appendChild(box);
      root.addEventListener('click', function (e) { if (e.target === root) close(); });
      input.addEventListener('input', function () { searchPalette(input.value, results); });
      document.body.appendChild(root);
    }
    root.classList.add('open');
    var field = root.querySelector('input');
    if (field) { field.focus(); searchPalette('', root.querySelector('#myraa-command-results')); }
  }

  function searchPalette(query, container) {
    if (!container) return;
    container.innerHTML = '';
    var q = (query || '').trim().toLowerCase();
    var targets = [
      ['Capability Center', 'find what MYRAA can do', openCapabilityCenter],
      ['Health report', 'open real diagnostics', function () { window.open('/api/diagnostics-center/report', '_blank'); }],
      ['Design Doctor', 'evidence-based UI critique from real source files', function () { window.open('/api/design-doctor/report', '_blank'); }],
      ['Tasks', 'open task registry', function () { window.open('/api/tasks/list', '_blank'); }],
    ];
    targets.filter(function (t) { return !q || (t[0] + ' ' + t[1]).toLowerCase().indexOf(q) !== -1; })
      .forEach(function (t) {
        var row = el('div', 'result');
        var left = el('div');
        left.appendChild(el('div', 'kind', 'command'));
        left.appendChild(el('div', '', t[0]));
        row.appendChild(left);
        row.appendChild(el('div', 'meta', t[1]));
        row.addEventListener('click', function () { close(); t[2](); });
        container.appendChild(row);
      });
    if (q) {
      Promise.all([json(API.skills), json(API.connectors), json(API.tasks)]).then(function (a) {
        var sk = ((a[0] && a[0].installed) || 0);
        if (('skill skills'.indexOf(q) !== -1)) addResult(container, 'state', 'Skills verified', String(sk));
        var cn = Array.isArray(a[1] && a[1].connectors) ? a[1].connectors.length : 0;
        if (('connector connectors'.indexOf(q) !== -1)) addResult(container, 'state', 'Connectors catalogued', String(cn));
        var tk = a[2] && a[2].total;
        if (('task tasks'.indexOf(q) !== -1)) addResult(container, 'state', 'Tasks persisted', tk == null ? 'UNAVAILABLE' : String(tk));
      });
    }
  }

  function close() {
    ['myraa-command-palette', 'myraa-capability-center'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.classList.remove('open');
    });
  }

  // --- truthful badge pass ---------------------------------------------------
  function truthfulBadges() {
    var nodes = document.querySelectorAll('[class*="badge"]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.textContent.trim() === 'VERIFIED') n.textContent = 'UNVERIFIED';
      if (n.textContent.trim() === 'ACTIVE' && /skill/i.test(n.parentElement ? n.parentElement.textContent : '')) {
        n.textContent = 'MANIFEST VERIFIED';
      }
    }
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    if (e.key === 'Escape') close();
  });
  statusStrip();
  truthfulBadges();
  if (window.MutationObserver) {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; truthfulBadges(); }, 400);
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.__myraaShell = { openPalette: openPalette, openCapabilityCenter: openCapabilityCenter, api: API };
})();
