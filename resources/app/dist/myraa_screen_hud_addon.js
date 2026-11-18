(function () {
  'use strict';
  // Screen Awareness HUD + Activity Center (additive overlay). Every value is
  // fetched from real backend state; unavailable data says so. 3D untouched.
  var HUD_ID = 'myraa-screen-hud';
  var hud, body, collapsed = false;

  function ensure() {
    if (document.getElementById(HUD_ID)) return;
    hud = document.createElement('section');
    hud.id = HUD_ID;
    hud.setAttribute('aria-label', 'MYRAA screen awareness and activity');
    hud.innerHTML =
      '<button id="myraa-hud-toggle" aria-expanded="true" title="Collapse Screen HUD">MYRAA SCREEN</button>'
      + '<div id="myraa-hud-body"></div>';
    document.body.appendChild(hud);
    document.getElementById('myraa-hud-toggle').addEventListener('click', function () {
      collapsed = !collapsed;
      document.getElementById('myraa-hud-body').style.display = collapsed ? 'none' : '';
      this.setAttribute('aria-expanded', String(!collapsed));
      this.title = collapsed ? 'Expand Screen HUD' : 'Collapse Screen HUD';
    });
    body = document.getElementById('myraa-hud-body');
  }

  function row(label, value) {
    return '<div class="myraa-hud-row"><span>' + label + '</span><b>' + (value == null ? 'UNAVAILABLE' : value) + '</b></div>';
  }

  function render(d) {
    if (!body) return;
    var s = d.screen || {};
    var a = d.activity || {};
    var tasks = a.tasks || {};
    var caps = d.capabilities || {};
    var html = '';
    html += row('Screen', s.consent === true ? 'CONSENT ON' : (s.consent === false ? 'PAUSED (consent off)' : null));
    html += row('Tasks', tasks.total == null ? null : tasks.total);
    html += row('Approvals', d.approvals && d.approvals.waiting != null ? d.approvals.waiting + ' waiting' : null);
    html += row('Skills verified', caps.installed == null ? null : caps.installed);
    html += row('Health', d.health && d.health.byStatus ? JSON.stringify(d.health.byStatus) : null);
    var events = Array.isArray(a.events) ? a.events.slice(0, 4) : [];
    if (events.length) {
      html += '<div class="myraa-hud-events">';
      events.forEach(function (e) {
        var type = e.type || e.event || 'event';
        var detail = e.payload && (e.payload.taskId || e.payload.error || e.payload.status) || '';
        html += '<div class="myraa-hud-event"><span>' + String(type).slice(0, 48) + '</span><span>' + String(detail).slice(0, 60) + '</span></div>';
      });
      html += '</div>';
    }
    body.innerHTML = html;
  }

  async function refresh() {
    try {
      var r = await fetch('/api/activity-center/summary', { cache: 'no-store' });
      if (r.ok) render(await r.json());
    } catch (e) {}
  }

  ensure();
  refresh();
  setInterval(refresh, 4000);
  window.__myraaScreenHud = { refresh: refresh };
})();
