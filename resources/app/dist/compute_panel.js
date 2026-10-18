'use strict';
/* ===========================================================================
 * MYRAA Compute Center panel (Phase 7).
 * Zero edits to existing files: injects nav button + view, drives
 * window.myraaSwitchView('compute'). All GPU/worker/quota states come from
 * the live /api/compute/* backend. UNKNOWN stays UNKNOWN. No emojis.
 * ========================================================================= */
(function () {
  var VIEW = 'compute';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function svgIcon(kind) {
    var paths = {
      chip: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
      x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    };
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (paths[kind] || paths.chip) + '</svg>';
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

  var state = { jobs: [], activeJobId: null };

  function banner(show, msg) {
    var host = document.getElementById('cp-backend-banner');
    if (!host) return;
    host.style.display = show ? 'block' : 'none';
    if (show) host.textContent = msg;
  }

  function fmtVram(v) {
    return (v === null || v === undefined || v === 'UNKNOWN') ? 'UNKNOWN' : String(v);
  }

  async function refresh() {
    try {
      var caps = await api('/api/compute/capabilities');
      if (caps.status === 404 || !caps.data) { banner(true, 'Compute backend not detected. Run the Phase 7 apply script and restart MYRAA.'); return; }
      banner(false);
      if (caps.data && caps.data.ok) renderCaps(caps.data);
      var jobs = await api('/api/compute/jobs');
      if (jobs.data && jobs.data.ok) { state.jobs = jobs.data.jobs || []; renderJobs(); }
      var quota = await api('/api/compute/quota');
      if (quota.data && quota.data.ok) renderQuota(quota.data.quota);
    } catch (e) {
      banner(true, 'Compute backend unreachable.');
    }
  }

  function renderCaps(d) {
    var host = document.getElementById('cp-providers');
    if (!host) return;
    var cards = (d.providers || []).map(function (p) {
      var gpuLine = p.gpu_count
        ? p.gpus.map(function (g) { return esc(g.model) + ' ' + fmtVram(g.vram_gb) + 'GB'; }).join(' + ')
        : 'no GPU (CPU only)';
      return '<div style="background:rgba(7,11,20,0.5);border:1px solid var(--border-divider);border-radius:10px;padding:10px 12px;margin-bottom:8px;">'
        + '<div style="font-size:12.5px;font-weight:700;color:#fff;">' + esc(p.provider) + ' <span style="font-size:11px;color:var(--text-muted);">' + esc(p.status || '') + '</span></div>'
        + '<div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px;">' + gpuLine + '</div>'
        + (p.detail ? '<div style="font-size:11px;color:var(--text-muted);">' + esc(p.detail) + '</div>' : '') + '</div>';
    }).join('');
    var workers = (d.workers || []).map(function (w) {
      var c = w.caps || {};
      return '<div style="background:rgba(7,11,20,0.5);border:1px solid var(--border-divider);border-radius:10px;padding:10px 12px;margin-bottom:8px;">'
        + '<div style="font-size:12.5px;font-weight:700;color:#fff;">' + esc(w.id) + ' <span style="font-size:11px;color:' + (w.online ? 'var(--success)' : 'var(--text-muted)') + ';">' + (w.online ? 'online' : 'offline/stale') + '</span></div>'
        + '<div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px;">'
        + 'GPUs: ' + esc(c.gpu_count != null ? c.gpu_count : 'UNKNOWN')
        + ' · single: ' + fmtVram(c.single_gpu_vram_gb) + 'GB · aggregate: ' + fmtVram(c.aggregate_vram_gb) + 'GB'
        + ' · seen: ' + esc(w.last_seen || '') + '</div></div>';
    }).join('') || '<div style="font-size:12px;color:var(--text-muted);">No Kaggle workers registered. Import a heartbeat from the worker notebook.</div>';
    host.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--accent-cyan);margin-bottom:6px;">Providers (kaggle enabled: ' + (d.kaggleEnabled ? 'yes' : 'no') + ')</div>'
      + cards + '<div style="font-size:12px;font-weight:700;color:var(--accent-cyan);margin:10px 0 6px;">Kaggle workers</div>' + workers;
  }

  function renderQuota(q) {
    var host = document.getElementById('cp-quota');
    if (!host || !q) return;
    host.innerHTML = 'Used: ' + fmtVram(q.gpu_hours_used) + ' · Remaining: ' + fmtVram(q.gpu_hours_remaining)
      + ' · Reset: ' + fmtVram(q.quota_reset) + ' <span style="color:var(--text-muted);">(checked ' + esc(q.last_checked || '') + ')</span>';
  }

  function renderJobs() {
    var host = document.getElementById('cp-job-list');
    if (!host) return;
    host.innerHTML = state.jobs.length ? state.jobs.map(function (j) {
      var active = j.id === state.activeJobId ? ' cs-active' : '';
      return '<button class="cs-lesson-row' + active + '" data-cp-open-job="' + esc(j.id) + '">'
        + '<span style="color:#fff;font-size:12.5px;">' + esc(j.id) + '</span>'
        + '<span style="font-size:11px;color:var(--text-muted);">' + esc(j.jobType || '') + ' · ' + esc(j.status || '') + '</span>'
        + '</button>';
    }).join('') : '<div style="font-size:12px;color:var(--text-muted);">No compute jobs yet.</div>';
    host.querySelectorAll('[data-cp-open-job]').forEach(function (btn) {
      btn.addEventListener('click', function () { openJob(btn.getAttribute('data-cp-open-job')); });
    });
  }

  async function openJob(id) {
    state.activeJobId = id;
    renderJobs();
    var host = document.getElementById('cp-job-detail');
    if (!host) return;
    try {
      var r = await api('/api/compute/jobs/' + encodeURIComponent(id));
      if (!r.data || !r.data.ok) { host.innerHTML = '<div style="font-size:12px;color:var(--error);">Job not found.</div>'; return; }
      var j = r.data.job;
      var evs = r.data.events || [];
      var est = j.estimate || {};
      host.innerHTML = '<div style="font-size:13px;font-weight:700;color:#fff;">' + esc(j.id) + '</div>'
        + '<div style="font-size:11.5px;color:var(--text-muted);margin:2px 0 8px;">' + esc(j.jobType || '') + ' · ' + esc(j.route || '') + ' · ' + esc(j.status || '')
        + ' · progress: ' + esc(j.progress != null ? j.progress : 'UNKNOWN') + '</div>'
        + '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">Estimate: '
        + (est.estimatedGB != null ? esc(est.estimatedGB) + ' GB' : 'uncertain')
        + (est.placement ? ' · placement: ' + esc(est.placement.place || est.placement) : '') + '</div>'
        + (j.error && j.error.message ? '<div style="font-size:12px;color:var(--error);margin-bottom:8px;">[' + esc(j.error.code || '') + '] ' + esc(j.error.message) + (j.error.action ? ' Action: ' + esc(j.error.action) : '') + '</div>' : '')
        + '<div style="display:flex;gap:8px;margin-bottom:10px;">'
        + '<button class="send-btn" id="cp-btn-cancel" style="height:30px;font-size:12px;">Cancel</button>'
        + '<button class="send-btn" id="cp-btn-export" style="height:30px;font-size:12px;background:transparent;border:1px solid var(--border-divider);">Export job JSON</button>'
        + '<button class="send-btn" id="cp-btn-refresh-job" style="height:30px;font-size:12px;background:transparent;border:1px solid var(--border-divider);">Refresh</button>'
        + '</div>'
        + '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:4px;">Events</div>'
        + (evs.length ? evs.map(function (e) {
          return '<div style="font-size:12px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
            + '<span style="color:var(--text-muted);">' + esc(e.createdAt || '') + '</span> <span style="color:#fff;">' + esc(e.type || '') + '</span> '
            + '<span style="color:var(--text-secondary);">' + esc(e.detail || '') + '</span></div>';
        }).join('') : '<div style="font-size:12px;color:var(--text-muted);">No events.</div>');
      document.getElementById('cp-btn-cancel').addEventListener('click', async function () {
        await api('/api/compute/jobs/' + encodeURIComponent(id) + '/cancel', 'POST', {});
        refresh(); openJob(id);
      });
      document.getElementById('cp-btn-export').addEventListener('click', function () {
        window.open('/api/compute/jobs/' + encodeURIComponent(id) + '/export', '_blank');
      });
      document.getElementById('cp-btn-refresh-job').addEventListener('click', function () { openJob(id); });
    } catch (e) {
      host.innerHTML = '<div style="font-size:12px;color:var(--error);">Load failed.</div>';
    }
  }

  function buildView() {
    var nav = document.querySelector('.left-sidebar');
    var learnView = document.getElementById('view-learning');
    var viewsHost = learnView ? learnView.parentNode : null;
    if (!nav || !viewsHost) return false;

    if (!document.querySelector('[data-view="' + VIEW + '"]')) {
      var anchor = nav.querySelector('[data-view="awareness"]') || nav.querySelector('[data-view="course_studio"]') || nav.querySelector('[data-view="learning"]');
      var btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.setAttribute('data-view', VIEW);
      btn.innerHTML = svgIcon('chip') + '<span>Compute</span>';
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling);
      else nav.appendChild(btn);
      btn.addEventListener('click', function () {
        if (typeof window.myraaSwitchView === 'function') window.myraaSwitchView(VIEW);
        refresh();
      });
    }

    if (!document.getElementById('view-' + VIEW)) {
      var cont = document.createElement('div');
      cont.className = 'app-view-container';
      cont.id = 'view-' + VIEW;
      cont.innerHTML =
        '<div class="workspace-header"><div>'
        + '<h1 class="greeting-title">Compute Center</h1>'
        + '<p class="greeting-subtitle">Local, cloud API, and ephemeral Kaggle GPU workers</p>'
        + '</div></div>'
        + '<div id="cp-backend-banner" style="display:none;font-size:12px;background:rgba(180,120,20,0.12);border:1px solid var(--border-divider);border-radius:10px;padding:10px 12px;margin-bottom:12px;"></div>'
        + '<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px;" id="cp-quota"></div>'
        + '<div style="display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:16px;flex:1;overflow:hidden;">'
        + '<div style="overflow-y:auto;display:flex;flex-direction:column;gap:12px;">'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div style="font-weight:700;font-size:13px;color:var(--accent-cyan);margin-bottom:8px;">Providers & workers</div>'
        + '<div id="cp-providers"></div>'
        + '</div>'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div style="font-weight:700;font-size:13px;color:var(--accent-cyan);margin-bottom:8px;">Submit GPU job</div>'
        + '<select id="cp-input-type" style="width:100%;padding:8px 10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;margin-bottom:8px;font-size:12.5px;">'
        + ['LLM_INFERENCE', 'EMBEDDING', 'RERANKING', 'DOCUMENT_BATCH', 'IMAGE_INFERENCE', 'AUDIO_PROCESSING', 'MODEL_EVALUATION', 'BATCH_INFERENCE', 'TRANSCRIPTION', 'COURSE_ASSET_GENERATION', 'TRAINING', 'QLORA_TRAINING'].map(function (t) { return '<option>' + t + '</option>'; }).join('')
        + '</select>'
        + '<select id="cp-input-route" style="width:100%;padding:8px 10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;margin-bottom:8px;font-size:12.5px;">'
        + ['AUTO', 'LOCAL', 'CLOUD', 'KAGGLE', 'MANUAL'].map(function (t) { return '<option>' + t + '</option>'; }).join('')
        + '</select>'
        + '<input type="text" id="cp-input-model" placeholder="Model id, e.g. llama-3-8b (optional)" style="width:100%;padding:8px 10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;margin-bottom:8px;font-size:12.5px;" />'
        + '<textarea id="cp-input-prompt" placeholder="Job input text / prompt" style="width:100%;min-height:56px;padding:8px 10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;margin-bottom:8px;font-size:12.5px;resize:vertical;"></textarea>'
        + '<button class="send-btn" id="cp-btn-submit" style="width:100%;height:34px;font-size:12.5px;">Submit</button>'
        + '<div id="cp-submit-result" style="font-size:12px;margin-top:8px;"></div>'
        + '</div>'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div style="font-weight:700;font-size:13px;color:var(--accent-cyan);margin-bottom:8px;">Jobs</div>'
        + '<div id="cp-job-list" style="display:flex;flex-direction:column;gap:8px;"></div>'
        + '</div>'
        + '</div>'
        + '<div style="overflow-y:auto;background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div id="cp-job-detail"><div style="font-size:12px;color:var(--text-muted);">Select a job.</div></div>'
        + '</div>'
        + '</div>';
      viewsHost.appendChild(cont);
      document.getElementById('cp-btn-submit').addEventListener('click', async function () {
        var out = document.getElementById('cp-submit-result');
        var spec = {
          jobType: document.getElementById('cp-input-type').value,
          route: document.getElementById('cp-input-route').value,
          priority: 'normal',
          input: { prompt: document.getElementById('cp-input-prompt').value },
        };
        var model = document.getElementById('cp-input-model').value.trim();
        if (model) spec.model = { id: model, quantization: 'fp16', gpuRequired: true };
        try {
          var r = await api('/api/compute/jobs', 'POST', spec);
          if (r.data && (r.data.ok || r.data.jobId)) {
            out.innerHTML = '<span style="color:var(--success);">Submitted: ' + esc(r.data.jobId) + ' (' + esc(r.data.route || '') + ')</span>'
              + (r.data.detail ? '<div style="color:var(--text-muted);">' + esc(r.data.detail) + '</div>' : '');
            refresh();
          } else {
            out.innerHTML = '<span style="color:var(--error);">[' + esc((r.data && r.data.code) || r.status) + '] ' + esc((r.data && r.data.error) || 'failed') + '</span>';
          }
        } catch (e) {
          out.innerHTML = '<span style="color:var(--error);">' + esc(String((e && e.message) || e)) + '</span>';
        }
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
