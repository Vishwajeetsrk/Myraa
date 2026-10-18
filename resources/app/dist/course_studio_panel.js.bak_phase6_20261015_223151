'use strict';
/* ===========================================================================
 * MYRAA Course Studio — panel UI (Phase 3).
 * Zero edits to existing files: injects its own nav button + view container
 * into the legacy desktop shell at runtime and drives the existing
 * window.myraaSwitchView('course_studio') routing (containers toggle by id
 * `view-<name>`, queried live at click time).
 * If the shell or the Phase-2 backend is absent, it degrades to an honest
 * status message instead of failing silently.
 * Voice: reuses the existing speechSynthesis path (rate 1.02, pitch 1.25).
 * No new TTS. No emojis (SVG icons only).
 * ========================================================================= */
(function () {
  var VIEW = 'course_studio';
  var POLL_MS = 2000;

  var state = {
    ready: false,
    backend: 'unknown', // unknown | ok | missing
    courses: [],
    activeCourseId: null,
    activeLesson: null,
    activeJobId: null,
    pollTimer: null,
    speaking: false,
    speakQueue: [],
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function svgIcon(kind) {
    var paths = {
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
      play: '<polygon points="6 3 20 12 6 21 6 3"/>',
      stop: '<rect x="6" y="6" width="12" height="12"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
      chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    };
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (paths[kind] || paths.book) + '</svg>';
  }

  async function api(path, method, body) {
    var opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    var res = await fetch(path, opts);
    var text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch (e) {
      return { status: res.status, data: null, raw: text.slice(0, 200) };
    }
  }

  function setBackendStatus() {
    var host = document.getElementById('cs-backend-banner');
    if (!host) return;
    if (state.backend === 'ok') { host.style.display = 'none'; return; }
    host.style.display = 'block';
    host.innerHTML = '<span style="color: var(--warning);">' + svgIcon('x') + '</span>'
      + '<span>Course Studio backend not detected. Run the Phase 2 apply script and restart MYRAA, then reopen this view.</span>';
  }

  // ── narration via the EXISTING voice path ──────────────────────────────────
  function speakText(text, onend) {
    try {
      if (!('speechSynthesis' in window)) { if (onend) onend(); return; }
      var u = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
      u.rate = 1.02;
      u.pitch = 1.25;
      u.onend = function () { if (onend) onend(); };
      u.onerror = function () { if (onend) onend(); };
      window.speechSynthesis.speak(u);
    } catch (e) { if (onend) onend(); }
  }

  function stopSpeaking() {
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
    state.speaking = false;
    state.speakQueue = [];
    refreshSpeakButtons();
  }

  function playSegments(segments, startIdx) {
    stopSpeaking();
    state.speaking = true;
    var idx = startIdx || 0;
    function next() {
      if (!state.speaking || idx >= segments.length) { state.speaking = false; refreshSpeakButtons(); return; }
      refreshSpeakButtons();
      speakText(segments[idx].text, function () { idx++; next(); });
    }
    next();
  }

  function refreshSpeakButtons() {
    document.querySelectorAll('[data-cs-speak]').forEach(function (btn) {
      btn.innerHTML = (state.speaking ? svgIcon('stop') : svgIcon('play'))
        + '<span>' + (state.speaking ? 'Stop' : 'Narrate') + '</span>';
    });
  }

  // ── data loading ───────────────────────────────────────────────────────────
  async function loadCourses() {
    try {
      var r = await api('/api/course-studio/courses');
      if (r.status === 404 || !r.data) { state.backend = 'missing'; setBackendStatus(); return; }
      if (r.data && r.data.ok) {
        state.backend = 'ok';
        state.courses = Array.isArray(r.data.courses) ? r.data.courses : [];
      } else {
        state.backend = 'missing';
      }
    } catch (e) {
      state.backend = 'missing';
    }
    setBackendStatus();
    renderCourseList();
  }

  async function openCourse(id) {
    state.activeCourseId = id;
    state.activeLesson = null;
    try {
      var r = await api('/api/course-studio/courses/' + encodeURIComponent(id));
      if (r.data && r.data.ok) renderCourseDetail(r.data.course, r.data.lessons || []);
      else renderCourseDetail(null, []);
    } catch (e) {
      renderCourseDetail(null, []);
    }
  }

  async function openLesson(id) {
    try {
      var r = await api('/api/course-studio/lessons/' + encodeURIComponent(id));
      if (r.data && r.data.ok) { state.activeLesson = r.data.lesson; renderLesson(); }
    } catch (e) { /* keep current view */ }
  }

  // ── job monitor (real backend state, polled) ───────────────────────────────
  function stopPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  function pollJob(jobId, after, monitorId) {
    stopPolling();
    state.activeJobId = jobId;
    state.monitorId = monitorId || 'cs-job-monitor';
    async function tick() {
      try {
        var r = await api('/api/course-studio/jobs/' + encodeURIComponent(jobId));
        if (!r.data || !r.data.ok) { renderJobMonitor(null, 'Job lookup failed.', state.monitorId); stopPolling(); return; }
        renderJobMonitor(r.data.job, '', state.monitorId);
        if (['completed', 'failed', 'cancelled'].indexOf(r.data.job.status) >= 0) {
          stopPolling();
          if (after) after(r.data.job);
        }
      } catch (e) {
        renderJobMonitor(null, 'Job poll failed: ' + String((e && e.message) || e), state.monitorId);
        stopPolling();
      }
    }
    tick();
    state.pollTimer = setInterval(tick, POLL_MS);
  }

  async function cancelJob() {
    if (!state.activeJobId) return;
    try { await api('/api/course-studio/jobs/' + encodeURIComponent(state.activeJobId) + '/cancel', 'POST', {}); } catch (e) {}
  }

  async function saveProgress(mastery) {
    if (!state.activeCourseId) return;
    try {
      await api('/api/course-studio/progress', 'POST', {
        courseId: state.activeCourseId,
        lessonId: state.activeLesson ? state.activeLesson.id : '',
        mastery: mastery || {},
      });
    } catch (e) {}
  }

  // ── rendering ──────────────────────────────────────────────────────────────
  function shell() {
    return {
      nav: document.querySelector('.left-sidebar'),
      viewsHost: (function () {
        var v = document.getElementById('view-learning');
        return v ? v.parentNode : null;
      })(),
    };
  }

  function renderCourseList() {
    var host = document.getElementById('cs-course-list');
    if (!host) return;
    if (!state.courses.length) {
      host.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">No courses yet. Create one above.</div>';
      return;
    }
    host.innerHTML = state.courses.map(function (c) {
      var active = c.id === state.activeCourseId ? ' cs-active' : '';
      return '<button class="cs-course-card' + active + '" data-cs-open-course="' + esc(c.id) + '">'
        + '<div style="font-weight:700;font-size:13px;color:#fff;">' + esc(c.title) + '</div>'
        + '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + esc(c.status || '') + ' · ' + esc(c.sourceKind || '') + '</div>'
        + '</button>';
    }).join('');
    host.querySelectorAll('[data-cs-open-course]').forEach(function (btn) {
      btn.addEventListener('click', function () { openCourse(btn.getAttribute('data-cs-open-course')); });
    });
  }

  function renderJobMonitor(job, error, monitorId) {
    var host = document.getElementById(monitorId || state.monitorId || 'cs-job-monitor');
    if (!host) return;
    if (error) {
      host.innerHTML = '<div style="font-size:12px;color:var(--error);">' + esc(error) + '</div>';
      return;
    }
    if (!job) { host.innerHTML = ''; return; }
    var pct = Math.round((job.progress || 0) * 100);
    var steps = (job.steps || []).map(function (s) {
      var dot = s.status === 'DONE' ? 'var(--success)' : (s.status === 'ACTIVE' ? 'var(--accent-cyan)' : (s.status === 'FAILED' ? 'var(--error)' : 'var(--text-muted)'));
      return '<div style="display:flex;gap:8px;align-items:baseline;font-size:12px;padding:3px 0;">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:' + dot + ';flex-shrink:0;transform:translateY(-1px);"></span>'
        + '<span style="color:#fff;">' + esc(s.name) + '</span>'
        + '<span style="color:var(--text-muted);">' + esc(s.status || '') + '</span>'
        + (s.detail ? '<span style="color:var(--text-muted);">· ' + esc(s.detail) + '</span>' : '')
        + '</div>';
    }).join('');
    var running = (job.status === 'running' || job.status === 'queued');
    host.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--accent-cyan);margin-bottom:6px;">'
      + esc(job.kind) + ' · ' + esc(job.status) + ' · ' + pct + '%</div>'
      + '<div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;margin-bottom:8px;">'
      + '<div style="height:100%;width:' + pct + '%;background:var(--accent-cyan);border-radius:3px;transition:width 0.4s;"></div></div>'
      + steps
      + (job.error ? '<div style="font-size:12px;color:var(--error);margin-top:6px;">' + esc(job.error) + '</div>' : '')
      + (running ? '<button class="send-btn" data-cs-cancel style="margin-top:8px;height:30px;font-size:12px;">Cancel job</button>' : '');
    var cancelBtn = host.querySelector('[data-cs-cancel]');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelJob);
  }

  function renderCourseDetail(course, lessons) {
    var host = document.getElementById('cs-course-detail');
    if (!host) return;
    stopSpeaking();
    if (!course) {
      host.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Select a course to see its outline and lessons.</div>';
      return;
    }
    var lessonBtns = (lessons || []).map(function (l) {
      return '<button class="cs-lesson-row" data-cs-open-lesson="' + esc(l.id) + '">'
        + '<span style="color:#fff;font-size:12.5px;">' + esc(l.title) + '</span>'
        + '<span style="font-size:11px;color:var(--text-muted);">' + esc(l.status || '') + '</span>'
        + '</button>';
    }).join('') || '<div style="font-size:12px;color:var(--text-muted);">No lessons yet — generate the outline.</div>';
    host.innerHTML = '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:2px;">' + esc(course.title) + '</div>'
      + '<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px;">' + esc(course.objective || '') + '</div>'
      + '<div style="display:flex;gap:8px;margin-bottom:10px;">'
      + '<button class="send-btn" id="cs-btn-outline" style="height:32px;font-size:12px;">Generate outline</button>'
      + '<button class="send-btn" id="cs-btn-refresh-course" style="height:32px;font-size:12px;background:transparent;border:1px solid var(--border-divider);">Refresh</button>'
      + '</div>'
      + '<div id="cs-job-monitor" style="margin-bottom:10px;"></div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;">' + lessonBtns + '</div>'
      + '<div id="cs-review-box" style="margin-top:4px;"></div>';
    document.getElementById('cs-btn-outline').addEventListener('click', async function () {
      try {
        var r = await api('/api/course-studio/courses/' + encodeURIComponent(course.id) + '/outline', 'POST', {});
        if (r.data && r.data.ok) pollJob(r.data.jobId, function () { openCourse(course.id); });
        else renderJobMonitor(null, (r.data && r.data.error) || ('HTTP ' + r.status));
      } catch (e) { renderJobMonitor(null, String((e && e.message) || e)); }
    });
    document.getElementById('cs-btn-refresh-course').addEventListener('click', function () { openCourse(course.id); });
    host.querySelectorAll('[data-cs-open-lesson]').forEach(function (btn) {
      btn.addEventListener('click', function () { openLesson(btn.getAttribute('data-cs-open-lesson')); });
    });
    loadReviewBox(course.id);
  }

  async function loadReviewBox(courseId) {
    var host = document.getElementById('cs-review-box');
    if (!host) return;
    try {
      var r = await api('/api/course-studio/reviews/' + encodeURIComponent(courseId));
      if (!r.data || !r.data.ok) { host.innerHTML = ''; return; }
      var due = r.data.due || [];
      var weak = r.data.weak || [];
      if (!due.length && !weak.length) { host.innerHTML = ''; return; }
      var html = '';
      if (due.length) {
        html += '<div style="font-size:12.5px;font-weight:700;color:#fff;margin:10px 0 6px;">Review due (' + due.length + ')</div>'
          + due.map(function (c) {
            return '<div class="cs-lesson-row"><span style="font-size:12.5px;color:#fff;">' + esc(c.concept) + '</span>'
              + '<span style="display:flex;gap:8px;align-items:center;"><span style="font-size:11px;color:var(--text-muted);">mastery ' + esc(c.mastery) + ' · streak ' + esc(c.streak) + '</span>'
              + (c.lessonId ? '<button class="send-btn" data-cs-practice="' + esc(c.lessonId) + '" style="height:26px;font-size:11px;">Practice</button>' : '') + '</span></div>';
          }).join('');
      }
      if (weak.length) {
        html += '<div style="font-size:12.5px;font-weight:700;color:#fff;margin:10px 0 6px;">Needs work</div>'
          + '<div style="font-size:12px;color:var(--text-secondary);">' + weak.map(function (c) { return esc(c.concept) + ' (' + esc(c.mastery) + ')'; }).join(' · ') + '</div>';
      }
      host.innerHTML = html;
      host.querySelectorAll('[data-cs-practice]').forEach(function (btn) {
        btn.addEventListener('click', function () { openLesson(btn.getAttribute('data-cs-practice')); });
      });
    } catch (e) { host.innerHTML = ''; }
  }

  function sceneHtml(s, i) {
    var inner = '<div style="font-size:12.5px;font-weight:700;color:var(--accent-cyan);margin-bottom:6px;">Scene ' + (i + 1) + ' · ' + esc(s.type || '') + '</div>'
      + '<div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:6px;">' + esc(s.heading || '') + '</div>';
    if (s.body) inner += '<div style="font-size:12.5px;color:var(--text-secondary);line-height:1.55;">' + esc(s.body) + '</div>';
    if (Array.isArray(s.points) && s.points.length) {
      inner += '<ul style="font-size:12.5px;color:var(--text-secondary);line-height:1.55;margin:6px 0 0 18px;">'
        + s.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>';
    }
    if (s.code) inner += '<pre style="font-size:11.5px;background:rgba(0,0,0,0.45);border:1px solid var(--border-divider);border-radius:8px;padding:10px;overflow-x:auto;margin-top:8px;color:#d6e2f0;">' + esc(s.code) + '</pre>';
    return '<div class="cs-scene">' + inner + '</div>';
  }

  function renderLesson() {
    var host = document.getElementById('cs-lesson-view');
    if (!host) return;
    stopSpeaking();
    var l = state.activeLesson;
    if (!l) { host.innerHTML = ''; return; }
    var scenes = Array.isArray(l.scenes) ? l.scenes : [];
    var narration = Array.isArray(l.narration) ? l.narration : [];
    var quiz = Array.isArray(l.quiz) ? l.quiz : [];
    var scenesHtml = scenes.map(sceneHtml).join('') || '<div style="font-size:12px;color:var(--text-muted);">No scenes yet — build this lesson.</div>';
    var quizHtml = quiz.map(function (q, i) {
      var body = '<div style="font-size:12.5px;color:#fff;margin-bottom:6px;">Q' + (i + 1) + '. ' + esc(q.prompt) + '</div>';
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        body += q.options.map(function (opt, oi) {
          return '<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--text-secondary);padding:3px 0;cursor:pointer;">'
            + '<input type="radio" name="cs-q' + i + '" value="' + oi + '" /> ' + esc(opt) + '</label>';
        }).join('');
      } else {
        body += '<input type="text" id="cs-short-' + i + '" placeholder="Your answer" style="width:100%;padding:7px 10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;font-size:12.5px;" />';
      }
      return '<div class="cs-quiz-q" data-cs-qtype="' + esc(q.type || '') + '" data-cs-answer="' + esc(q.answerIndex != null ? q.answerIndex : '') + '" data-cs-sample="' + esc(q.sampleAnswer || '') + '" data-cs-explain="' + esc(q.explanation || '') + '" data-cs-concept="' + esc(q.concept || '') + '">'
        + body + '<div class="cs-quiz-feedback" style="font-size:12px;margin-top:4px;"></div></div>';
    }).join('');
    host.innerHTML = '<div style="font-size:13px;font-weight:700;color:#fff;">' + esc(l.title) + '</div>'
      + (l.objective ? '<div style="font-size:11.5px;color:var(--text-muted);margin:2px 0 10px;">' + esc(l.objective) + '</div>' : '<div style="margin-bottom:10px;"></div>')
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
      + '<button class="send-btn" id="cs-btn-build" style="height:32px;font-size:12px;">' + (l.status === 'ready' ? 'Rebuild lesson' : 'Build lesson') + '</button>'
      + (narration.length ? '<button class="send-btn" id="cs-btn-narrate" data-cs-speak style="height:32px;font-size:12px;background:transparent;border:1px solid var(--border-divider);display:flex;align-items:center;gap:6px;"></button>' : '')
      + (l.status === 'ready' ? '<button class="send-btn" id="cs-btn-complete" style="height:32px;font-size:12px;background:transparent;border:1px solid var(--border-divider);">Mark complete</button>' : '')
      + '</div>'
      + '<div id="cs-job-monitor-lesson"></div>'
      + '<div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">' + scenesHtml + '</div>'
      + (l.summary ? '<div class="cs-scene"><div style="font-size:12.5px;font-weight:700;color:var(--accent-cyan);margin-bottom:6px;">Summary</div><div style="font-size:12.5px;color:var(--text-secondary);line-height:1.55;">' + esc(l.summary) + '</div></div>' : '')
      + (quiz.length ? '<div style="font-size:13px;font-weight:700;color:#fff;margin:12px 0 6px;">Knowledge check</div><div style="display:flex;flex-direction:column;gap:10px;">' + quizHtml + '</div>'
        + '<button class="send-btn" id="cs-btn-check-quiz" style="height:32px;font-size:12px;margin-top:10px;">Check answers</button>' : '');
    document.getElementById('cs-btn-build').addEventListener('click', async function () {
      try {
        var r = await api('/api/course-studio/lessons/' + encodeURIComponent(l.id) + '/build', 'POST', {});
        if (r.data && r.data.ok) pollJob(r.data.jobId, function () { openLesson(l.id); if (state.activeCourseId) openCourse(state.activeCourseId); }, 'cs-job-monitor-lesson');
        else renderJobMonitor(null, (r.data && r.data.error) || ('HTTP ' + r.status), 'cs-job-monitor-lesson');
      } catch (e) { renderJobMonitor(null, String((e && e.message) || e), 'cs-job-monitor-lesson'); }
    });
    var narrateBtn = document.getElementById('cs-btn-narrate');
    if (narrateBtn) {
      refreshSpeakButtons();
      narrateBtn.addEventListener('click', function () {
        if (state.speaking) stopSpeaking();
        else playSegments(narration, 0);
      });
    }
    var completeBtn = document.getElementById('cs-btn-complete');
    if (completeBtn) completeBtn.addEventListener('click', function () {
      saveProgress({ completedLessons: [l.id], completedAt: new Date().toISOString() });
      completeBtn.innerHTML = svgIcon('check') + '<span>Saved</span>';
    });
    var checkBtn = document.getElementById('cs-btn-check-quiz');
    if (checkBtn) checkBtn.addEventListener('click', function () {
      var correct = 0, total = 0;
      host.querySelectorAll('.cs-quiz-q').forEach(function (qEl, qi) {
        total++;
        var fb = qEl.querySelector('.cs-quiz-feedback');
        var type = qEl.getAttribute('data-cs-qtype');
        var explain = qEl.getAttribute('data-cs-explain') || '';
        var good = false;
        if (type === 'mcq') {
          var sel = qEl.querySelector('input[type="radio"]:checked');
          good = !!sel && sel.value === qEl.getAttribute('data-cs-answer');
        } else {
          var inp = document.getElementById('cs-short-' + qi);
          var sample = qEl.getAttribute('data-cs-sample') || '';
          good = !!inp && inp.value.trim().length > 0;
          fb.textContent = 'Sample answer: ' + sample + (explain ? ' — ' + explain : '');
          fb.style.color = 'var(--text-muted)';
        }
        if (type === 'mcq') {
          fb.textContent = (good ? 'Correct. ' : 'Not quite. ') + (explain || '');
          fb.style.color = good ? 'var(--success)' : 'var(--error)';
        }
        if (good) correct++;
        qEl.setAttribute('data-cs-good', good ? '1' : '0');
      });
      saveProgress({ quizScore: { correct: correct, total: total, at: new Date().toISOString() } });
      checkBtn.textContent = 'Score: ' + correct + '/' + total + ' (saved)';
      try {
        host.querySelectorAll('.cs-quiz-q').forEach(function (qEl) {
          api('/api/course-studio/attempts', 'POST', {
            courseId: state.activeCourseId,
            lessonId: l.id,
            concept: qEl.getAttribute('data-cs-concept') || l.title,
            correct: qEl.getAttribute('data-cs-good') === '1',
          }).catch(function () {});
        });
      } catch (e) {}
    });
  }

  // ── view construction (no existing files touched) ──────────────────────────
  function buildView() {
    var s = shell();
    if (!s.nav || !s.viewsHost) return false;

    if (!document.querySelector('[data-view="' + VIEW + '"]')) {
      var learnBtn = s.nav.querySelector('[data-view="learning"]');
      var btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.setAttribute('data-view', VIEW);
      btn.innerHTML = svgIcon('book') + '<span>Course Studio</span>';
      if (learnBtn && learnBtn.parentNode) learnBtn.parentNode.insertBefore(btn, learnBtn.nextSibling);
      else s.nav.appendChild(btn);
      btn.addEventListener('click', function () {
        if (typeof window.myraaSwitchView === 'function') window.myraaSwitchView(VIEW);
        loadCourses();
        if (state.activeCourseId) openCourse(state.activeCourseId);
      });
    }

    if (!document.getElementById('view-' + VIEW)) {
      var cont = document.createElement('div');
      cont.className = 'app-view-container';
      cont.id = 'view-' + VIEW;
      cont.innerHTML =
        '<div class="workspace-header"><div>'
        + '<h1 class="greeting-title">Course Studio</h1>'
        + '<p class="greeting-subtitle">Topic to course to narrated lesson — generated live by MYRAA</p>'
        + '</div></div>'
        + '<div id="cs-backend-banner" style="display:none;font-size:12px;background:rgba(180,120,20,0.12);border:1px solid var(--border-divider);border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;gap:8px;align-items:center;"></div>'
        + '<div style="display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:16px;flex:1;overflow:hidden;">'
        + '<div style="overflow-y:auto;display:flex;flex-direction:column;gap:12px;">'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div style="font-weight:700;font-size:13px;color:var(--accent-cyan);margin-bottom:8px;">New course</div>'
        + '<input type="text" id="cs-input-title" placeholder="Course title" style="width:100%;padding:8px 10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;margin-bottom:8px;font-size:12.5px;" />'
        + '<input type="text" id="cs-input-objective" placeholder="Objective (optional)" style="width:100%;padding:8px 10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;margin-bottom:8px;font-size:12.5px;" />'
        + '<textarea id="cs-input-source" placeholder="Topic, notes, or paste source text" style="width:100%;min-height:64px;padding:8px 10px;background:rgba(7,11,20,0.6);border:1px solid var(--border-divider);border-radius:8px;color:#fff;margin-bottom:8px;font-size:12.5px;resize:vertical;"></textarea>'
        + '<button class="send-btn" id="cs-btn-create" style="width:100%;height:34px;font-size:12.5px;">Create course</button>'
        + '</div>'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div style="font-weight:700;font-size:13px;color:var(--accent-cyan);margin-bottom:8px;">Courses</div>'
        + '<div id="cs-course-list" style="display:flex;flex-direction:column;gap:8px;"></div>'
        + '</div>'
        + '</div>'
        + '<div style="overflow-y:auto;display:flex;flex-direction:column;gap:12px;">'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div id="cs-course-detail"><div style="font-size:12px;color:var(--text-muted);">Select a course to see its outline and lessons.</div></div>'
        + '</div>'
        + '<div style="background:rgba(16,24,39,0.6);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;">'
        + '<div id="cs-lesson-view"><div style="font-size:12px;color:var(--text-muted);">Select a lesson to read scenes, narrate, and take the quiz.</div></div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<style>'
        + '.cs-course-card{text-align:left;background:rgba(7,11,20,0.5);border:1px solid var(--border-divider);border-radius:10px;padding:10px 12px;cursor:pointer;}'
        + '.cs-course-card:hover{border-color:var(--accent-cyan);}'
        + '.cs-course-card.cs-active{border-color:var(--accent-cyan);}'
        + '.cs-lesson-row{display:flex;justify-content:space-between;align-items:center;background:rgba(7,11,20,0.5);border:1px solid var(--border-divider);border-radius:10px;padding:8px 12px;cursor:pointer;}'
        + '.cs-lesson-row:hover{border-color:var(--accent-cyan);}'
        + '.cs-scene{background:rgba(7,11,20,0.5);border:1px solid var(--border-divider);border-radius:10px;padding:12px;}'
        + '.cs-quiz-q{background:rgba(7,11,20,0.5);border:1px solid var(--border-divider);border-radius:10px;padding:12px;}'
        + '</style>';
      s.viewsHost.appendChild(cont);

      document.getElementById('cs-btn-create').addEventListener('click', async function () {
        var title = document.getElementById('cs-input-title').value.trim();
        var objective = document.getElementById('cs-input-objective').value.trim();
        var source = document.getElementById('cs-input-source').value.trim();
        if (!title) return;
        try {
          var r = await api('/api/course-studio/courses', 'POST', {
            title: title, objective: objective, sourceKind: 'topic', sourceText: source,
          });
          if (r.data && r.data.ok) {
            document.getElementById('cs-input-title').value = '';
            document.getElementById('cs-input-objective').value = '';
            document.getElementById('cs-input-source').value = '';
            await loadCourses();
            openCourse(r.data.course.id);
          }
        } catch (e) {}
      });
    }
    return true;
  }

  function boot() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      try {
        if (buildView()) {
          clearInterval(timer);
          state.ready = true;
          loadCourses();
        } else if (tries > 40) {
          clearInterval(timer);
        }
      } catch (e) {
        if (tries > 40) clearInterval(timer);
      }
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
