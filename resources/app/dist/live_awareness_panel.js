'use strict';
/* ===========================================================================
 * MYRAA Live Awareness — Privacy Center panel (Phase 5).
 * Zero edits to existing files: injects its own nav button + view container
 * and drives window.myraaSwitchView('awareness'). Consent state comes from
 * the Phase-1 endpoints (/api/screen-awareness/*); modes + context + events
 * from the Phase-5 router (/api/awareness/*). L4/L5 are shown as unavailable.
 * No emojis (SVG icons only).
 * ========================================================================= */
(function () {
  var VIEW = 'awareness';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function svgIcon(kind) {
    var paths = {
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
      x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    };
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (paths[kind] || paths.shield) + '</svg>';
  }

  async function api(path, method, body) {
    var opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    var res = await fetch(path, opts);
    var text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch (e) {
      return { status: res.status, data: null };
    }
  }

  async function loadStatus() {
    var banner = document.getElementById('aw-backend-banner');
    try {
      var r = await api('/api/awareness/status');
      if (r.status === 404 || !r.data) {
        if (banner) {
          banner.style.display = 'flex';
          banner.innerHTML = '<span>Live Awareness backend not detected. Run the Phase 5 apply script and restart MYRAA.</span>';
        }
        return null;
      }
      if (banner) banner.style.display = 'none';
      return r.data && r.data.ok ? r.data : null;
    } catch (e) {
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = '<span>Awareness backend unreachable.</span>';
      }
      return null;
    }
  }

  function renderStatus(s) {
    var host = document.getElementById('aw-status');
    if (!host) return;
    if (!s) { host.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Status unavailable.</div>'; return; }
    var consentBtn = s.consent && s.consent.enabled
      ? '<button class="send-btn" id="aw-btn-consent-off" style="height:32px;font-size:12px;">Pause all awareness</button>'
      : '<button class="send-btn" id="aw-btn-consent-on" style="height:32px;font-size:12px;">Enable awareness</button>';
    var modes = (s.modes || []).map(function (m) {
      var on = m === s.mode;
      return '<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--text-secondary);padding:3px 0;cursor:pointer;">'
        + '<input type="radio" name="aw-mode" value="' + esc(m) + '"' + (on ? ' checked' : '') + ' /> ' + esc(m)
        + (on ? ' <span style="color:var(--success);font-size:11px;">(active)</span>' : '') + '</label>';
    }).join('');
    var levels = (s.levels || []).map(function (lv) {
      var dot = lv.available ? 'var(--success)' : 'var(--text-muted)';
      return '<div style="display:flex;gap:8px;align-items:baseline;font-size:12px;padding:3px 0;">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:' + dot + ';flex-shrink:0;transform:translateY(-1px);"></span>'
        + '<span style="color:#fff;">L' + lv.level + ' · ' + esc(lv.name) + '</span>'
        + '<span style="color:var(--text-muted);">' + esc(lv.reason || '') + '</span></div>';
    }).join('');
    host.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">Consent: '
      + (s.consent && s.consent.enabled ? 'ON' : 'OFF') + ' · Mode: ' + esc(s.mode || '') + '</div>'
      + '<div style="display:flex;gap:8px;margin-bottom:10px;">' + consentBtn
      + '<button class="send-btn" id="aw-btn-refresh" style="height:32px;font-size:12px;background:transparent;border:1px solid var(--border-divider);">Refresh</button></div>'
      + '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:4px;">Mode</div>' + modes
      + '<div style="font-size:12px;font-weight:700;color:#fff;margin:10px 0 4px;">Perception levels</div>' + levels
      + (s.policy ? '<div style="font-size:11.5px;color:var(--text-muted);margin-top:8px;">Policy: ' + esc(s.policy.interveneOnlyWhen || '') + '</div>' : '');
    var on = document.getElementById('aw-btn-consent-on');
    if (on) on.addEventListener('click', async function () {
      await api('/api/screen-awareness/consent', 'POST', { enabled: true });
      refresh();
    });
    var off = document.getElementById('aw-btn-consent-off');
    if (off) off.addEventListener('click', async function () {
      await api('/api/screen-awareness/consent', 'POST', { enabled: false });
      refresh();
    });
    var rf = document.getElementById('aw-btn-refresh');
    if (rf) rf.addEventListener('click', refresh);
    host.querySelectorAll('input[name="aw-mode"]').forEach(function (radio) {
      radio.addEventListener('change', async function () {
        await api('/api/awareness/mode', 'POST', { mode: radio.value });
        refresh();
      });
    });
  }

  async function refreshContext() {
    var host = document.getElementById('aw-context');
    if (!host) return;
    host.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Reading context…</div>';
    try {
      var r = await api('/api/awareness/context');
      if (r.status === 403) {
        host.innerHTML = '<div style="font-size:12px;color:var(--warning);">Consent required — enable awareness above, then refresh.</div>';
        return;
      }
      if (!r.data || !r.data.ok) {
        host.innerHTML = '<div style="font-size:12px;color:var(--error);">' + esc((r.data && r.data.error) || ('HTTP ' + r.status)) + '</div>';
        return;
      }
      var ctx = r.data.context || {};
      var wins = Array.isArray(ctx.windows) ? ctx.windows.slice(0, 15) : [];
      var fg = ctx.foreground || null;
      host.innerHTML = '<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:6px;">Level 1 · '
        + wins.length + ' windows · captured ' + esc(ctx.capturedAt || '') + '</div>'
        + (fg && fg.title ? '<div style="font-size:12.5px;color:#fff;margin-bottom:8px;">Foreground: <b>' + esc(fg.title) + '</b>'
          + (fg.pid ? ' <span style="color:var(--text-muted);">(' + esc(fg.pid) + ')</span>' : '') + '</div>' : '')
        + (wins.length ? wins.map(function (w) {
          return '<div style="display:flex;gap:8px;font-size:12px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
            + '<span style="color:var(--accent-cyan);min-width:90px;">' + esc(w.process || '') + '</span>'
            + '<span style="color:var(--text-secondary);">' + esc(w.title || '') + '</span></div>';
        }).join('') : '<div style="font-size:12px;color:var(--text-muted);">No windows with titles found.</div>');
    } catch (e) {
      host.innerHTML = '<div style="font-size:12px;color:var(--error);">' + esc(String((e && e.message) || e)) + '</div>';
    }
  }

  async function refreshEvents() {
    var host = document.getElementById('aw-events');
    if (!host) return;
    try {
      var r = await api('/api/awareness/events');
      var evs = (r.data && r.data.ok && Array.isArray(r.data.events)) ? r.data.events : [];
      host.innerHTML = '<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:6px;">'
        + evs.length + ' recent events (session ring, cap 100)</div>'
        + (evs.length ? evs.map(function (e) {
          return '<div style="font-size:12px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
            + '<span style="color:var(--text-muted);">' + esc(e.at || '') + '</span> '
            + '<span style="color:#fff;">' + esc(e.type || '') + '</span> '
            + '<span style="color:var(--text-secondary);">' + esc(e.detail || '') + '</span></div>';
        }).join('') : '<div style="font-size:12px;color:var(--text-muted);">No events yet.</div>');
    } catch (e) {
      host.innerHTML = '<div style="font-size:12px;color:var(--error);">Events unavailable.</div>';
    }
  }

  async function refresh() {
    var s = await loadStatus();
    renderStatus(s);
    refreshEvents();
  }

  function buildView() {
    var nav = document.querySelector('.left-sidebar');
    var learnView = document.getElementById('view-learning');
    var viewsHost = learnView ? learnView.parentNode : null;
    if (!nav || !viewsHost) return false;

    if (!document.querySelector('[data-view="' + VIEW + '"]')) {
      var anchor = nav.querySelector('[data-view="course_studio"]') || nav.querySelector('[data-view="learning"]');
      var btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.setAttribute('data-view', VIEW);
      btn.innerHTML = svgIcon('shield') + '<span>Awareness</span>';
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling);
      else nav.appendChild(btn);
      btn.addEventListener('click', function () {
        if (typeof window.myraaSwitchView === 'function') window.myraaSwitchView(VIEW);
        refresh();
        refreshContext();
      });
    }

    if (!document.getElementById('view-' + VIEW)) {
      var cont = document.createElement('div');
      cont.className = 'app-view-container';
      cont.id = 'view-' + VIEW;
      cont.innerHTML =
        '<div class="workspace-header"><div>'
        + '<h1 class="greeting-title">Live Awareness</h1>'
        + '<p class="greeting-subtitle">Opt-in computer awareness with explicit consent and privacy controls</p>'
        + '</div></div>'
        + '<div id="aw-backend-banner" style="display:none;font-size:12px;background:rgba(180,120,20,0.12);border:1px solid var(--border-divider);border-radius:10px;padding:10px 12px;margin-bottom:12px;"></div>'
        + '<div style="display:grid;grid-template-columns:repeat(2,minmax(280px,1fr));gap:16px;flex:1;overflow-y:auto;">'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div style="font-weight:700;font-size:13px;color:var(--accent-cyan);margin-bottom:8px;">Privacy Center</div>'
        + '<div id="aw-status"></div>'
        + '</div>'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div style="font-weight:700;font-size:13px;color:var(--accent-cyan);margin-bottom:8px;">Live context (Level 1)</div>'
        + '<div style="display:flex;gap:8px;margin-bottom:10px;">'
        + '<button class="send-btn" id="aw-btn-context" style="height:32px;font-size:12px;">Read context</button>'
        + '<button class="send-btn" id="aw-btn-events" style="height:32px;font-size:12px;background:transparent;border:1px solid var(--border-divider);">Events</button>'
        + '<button class="send-btn" id="aw-btn-clear" style="height:32px;font-size:12px;background:transparent;border:1px solid var(--border-divider);">Delete context</button>'
        + '</div>'
        + '<div id="aw-context"><div style="font-size:12px;color:var(--text-muted);">No context read yet.</div></div>'
        + '<div style="font-size:13px;font-weight:700;color:#fff;margin:12px 0 6px;">Timeline</div>'
        + '<div id="aw-events"></div>'
        + '</div>'
        + '</div>';
      viewsHost.appendChild(cont);
      document.getElementById('aw-btn-context').addEventListener('click', refreshContext);
      document.getElementById('aw-btn-events').addEventListener('click', refreshEvents);
      document.getElementById('aw-btn-clear').addEventListener('click', async function () {
        try { await api('/api/awareness/events', 'DELETE'); } catch (e) {}
        refreshEvents();
      });
    }
    return true;
  }

  function boot() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      try {
        if (buildView()) { clearInterval(timer); refresh(); }
        else if (tries > 40) clearInterval(timer);
      } catch (e) {
        if (tries > 40) clearInterval(timer);
      }
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
