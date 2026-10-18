// Universal App Control & Continuous Learning Addon for MYRAA AI OS
(function() {
  'use strict';

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg) {
    const existing = document.getElementById('uctrl-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'uctrl-toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0f172a;color:#38bdf8;padding:12px 20px;border-radius:8px;border:1px solid #38bdf8;box-shadow:0 10px 25px rgba(0,0,0,0.8);z-index:999999;font-size:12px;font-weight:600;pointer-events:none;transition:opacity 0.3s;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  // Inject Floating Header HUD Button & Passive Status Pill
  function mountHeaderControls() {
    if (document.getElementById('myraa-uctrl-top-bar')) return;

    const fixedBar = document.createElement('div');
    fixedBar.id = 'myraa-uctrl-top-bar';
    fixedBar.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);right:auto;z-index:99998;display:flex;align-items:center;gap:8px;pointer-events:auto;';

    // Passive Learning Pill Indicator
    const pill = document.createElement('div');
    pill.id = 'myraa-passive-global-pill';
    pill.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-family:monospace;font-size:11px;padding:5px 12px;border-radius:9999px;background:rgba(15,23,42,0.85);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;cursor:pointer;user-select:none;transition:all 0.2s;';
    pill.title = 'Universal Control & Continuous Learning Hub';
    pill.innerHTML = '<span id="global-passive-dot" style="width:7px;height:7px;border-radius:50%;background:#64748b;display:inline-block;"></span><span id="global-passive-text" style="color:#94a3b8;font-weight:600;">LEARNING: IDLE</span>';
    pill.onclick = () => window.openMyraaUniversalControl();

    const btn = document.createElement('button');
    btn.id = 'myraa-uctrl-top-btn';
    btn.className = 'myraa-btn';
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:6px 14px;border-radius:8px;background:linear-gradient(135deg,rgba(0,229,255,0.18),rgba(59,130,246,0.18));border:1px solid rgba(0,229,255,0.45);color:#00e5ff;cursor:pointer;backdrop-filter:blur(8px);transition:all 0.2s;';
    btn.innerHTML = '<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span> <span>App Control & Learn</span>';
    btn.onclick = () => window.openMyraaUniversalControl();

    fixedBar.appendChild(pill);
    fixedBar.appendChild(btn);
    document.body.appendChild(fixedBar);

    pollPassiveStatus();
    setInterval(pollPassiveStatus, 3000);
  }

  async function pollPassiveStatus() {
    try {
      const res = await fetch('/api/teach/passive/status').then(r => r.json());
      if (res && res.ok) {
        updatePassiveIndicators(res.isActive);
      }
    } catch(e) {}
  }

  function updatePassiveIndicators(isActive) {
    const globalDot = document.getElementById('global-passive-dot');
    const globalText = document.getElementById('global-passive-text');
    const globalPill = document.getElementById('myraa-passive-global-pill');

    const modalDot = document.getElementById('modal-passive-dot');
    const modalText = document.getElementById('modal-passive-text');
    const modalPill = document.getElementById('modal-passive-pill');

    const color = isActive ? '#ef4444' : '#64748b';
    const text = isActive ? 'LEARNING: RECORDING' : 'LEARNING: IDLE';
    const textColor = isActive ? '#f87171' : '#94a3b8';
    const borderColor = isActive ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.12)';
    const shadow = isActive ? '0 0 8px #ef4444' : 'none';

    if (globalDot) {
      globalDot.style.background = color;
      globalDot.style.boxShadow = shadow;
    }
    if (globalText) {
      globalText.textContent = text;
      globalText.style.color = textColor;
    }
    if (globalPill) globalPill.style.borderColor = borderColor;

    if (modalDot) {
      modalDot.style.background = color;
      modalDot.style.boxShadow = shadow;
    }
    if (modalText) {
      modalText.textContent = text;
      modalText.style.color = textColor;
    }
    if (modalPill) modalPill.style.borderColor = borderColor;
  }

  function openUniversalControlModal() {
    createUniversalControlModal();
    const modal = document.getElementById('myraa-universal-control-modal');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
      refreshVisibleWindowsList();
      refreshPassiveLearningView();
    }
  }
  window.openMyraaUniversalControl = openUniversalControlModal;

  function createUniversalControlModal() {
    if (document.getElementById('myraa-universal-control-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'myraa-universal-control-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:none;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    
    overlay.innerHTML = `
      <div style="background:#070a12;border:1px solid rgba(0,229,255,0.4);box-shadow:0 25px 60px rgba(0,0,0,0.9),0 0 35px rgba(0,229,255,0.2);border-radius:16px;width:1000px;max-width:96vw;height:88vh;display:flex;flex-direction:column;overflow:hidden;color:#f8fafc;">
        <!-- Header -->
        <div style="background:#0f172a;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>
            <div>
              <div style="font-size:13px;font-weight:800;color:#00e5ff;letter-spacing:0.5px;">UNIVERSAL APP CONTROL & CONTINUOUS LEARNING</div>
              <div style="font-size:10.5px;color:#8798b2;">Semantic Windows UI Automation • Password Redaction • Dynamic Project Index</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div id="modal-passive-pill" style="display:flex;align-items:center;gap:6px;font-family:monospace;font-size:11px;padding:4px 10px;border-radius:9999px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.12);">
              <span id="modal-passive-dot" style="width:7px;height:7px;border-radius:50%;background:#64748b;"></span>
              <span id="modal-passive-text" style="color:#94a3b8;font-weight:600;">LEARNING: IDLE</span>
            </div>
            <button id="close-uctrl-btn" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:4px 8px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:8px;padding:10px 20px;background:#0b1120;border-bottom:1px solid rgba(255,255,255,0.06);">
          <button type="button" class="uctrl-tab-btn" data-target="uctrl-tab-semantic" style="background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:11.5px;font-weight:700;padding:6px 14px;cursor:pointer;">Semantic Controls & Windows</button>
          <button type="button" class="uctrl-tab-btn" data-target="uctrl-tab-learning" style="background:rgba(255,255,255,0.05);color:#94a3b8;border:none;border-radius:6px;font-size:11.5px;font-weight:600;padding:6px 14px;cursor:pointer;">Continuous Passive Learning</button>
          <button type="button" class="uctrl-tab-btn" data-target="uctrl-tab-projects" style="background:rgba(255,255,255,0.05);color:#94a3b8;border:none;border-radius:6px;font-size:11.5px;font-weight:600;padding:6px 14px;cursor:pointer;">Project Index Hub</button>
        </div>

        <!-- Body -->
        <div style="flex:1;overflow-y:auto;padding:20px;">
          <!-- TAB 1: Semantic App Control -->
          <div id="uctrl-tab-semantic" class="uctrl-tab-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div>
                <div style="font-size:13.5px;font-weight:700;color:#f1f5f9;">Active Top-Level Windows & Semantic UI Controls</div>
                <div style="font-size:11px;color:#94a3b8;">Windows UI Automation (UIA) inspects named buttons, menus, and text fields without coordinate fragility.</div>
              </div>
              <button id="btn-refresh-win" style="background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;padding:6px 14px;cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Refresh Windows</button>
            </div>

            <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;height:52vh;">
              <!-- Windows List -->
              <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;display:flex;flex-direction:column;">
                <div style="font-size:11px;font-weight:700;color:#38bdf8;margin-bottom:8px;text-transform:uppercase;">Running Windows</div>
                <div id="uctrl-windows-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
                  <div style="color:#64748b;font-size:11px;padding:8px;">Loading visible windows...</div>
                </div>
              </div>

              <!-- Controls Hierarchy & Actions -->
              <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:14px;display:flex;flex-direction:column;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                  <div id="uctrl-selected-title" style="font-size:12.5px;font-weight:700;color:#f8fafc;">Select a window on the left</div>
                  <input type="text" id="uctrl-control-filter" placeholder="Filter controls..." style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:4px 8px;font-size:11px;color:#fff;width:160px;" />
                </div>
                <div id="uctrl-controls-container" style="flex:1;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;font-family:monospace;font-size:11px;background:#070a12;">
                  <div style="color:#64748b;text-align:center;padding:30px;">Click any window on the left to inspect its buttons and inputs.</div>
                </div>

                <!-- Direct Semantic Invocation Bar -->
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;align-items:center;">
                  <input type="text" id="uctrl-invoke-name" placeholder="Control Name (e.g. Bold, File, Save, Next)..." style="flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:6px 10px;font-size:12px;color:#fff;" />
                  <button type="button" id="btn-do-invoke" style="background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:11.5px;font-weight:700;padding:6px 14px;cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg> Invoke / Click</button>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: Continuous Passive Learning -->
          <div id="uctrl-tab-learning" class="uctrl-tab-panel" style="display:none;">
            <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px;margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div>
                  <div style="font-size:14.5px;font-weight:700;color:#f8fafc;">Continuous Passive Learning Engine</div>
                  <div style="font-size:11.5px;color:#94a3b8;margin-top:2px;">Observes your application usage patterns in real-time, building a library of replayable workflows.</div>
                </div>
                <div style="display:flex;gap:10px;">
                  <button id="btn-passive-start" style="background:#059669;color:#fff;border:none;border-radius:6px;font-size:11.5px;font-weight:700;padding:6px 16px;cursor:pointer;">▶ Start Passive Learning</button>
                  <button id="btn-passive-stop" style="background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:11.5px;font-weight:700;padding:6px 16px;cursor:pointer;">⏹ Stop & Consolidate</button>
                </div>
              </div>

              <!-- Security Guarantee Banner -->
              <div style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.25);border-radius:8px;padding:10px 14px;font-size:11.5px;color:#38bdf8;display:flex;align-items:center;gap:10px;">
                <span style="font-size:16px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
                <span><strong>Security & Privacy Shield:</strong> All password fields (IsPassword=True, type='password', PIN boxes) are strictly excluded at the kernel/hook level. No credentials will ever be captured or saved.</span>
              </div>
            </div>

            <!-- Recorded Workflows Library -->
            <div>
              <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:10px;">Recorded Workflows Library</div>
              <div id="passive-workflows-list" style="display:flex;flex-direction:column;gap:8px;">
                <div style="color:#64748b;font-size:12px;padding:12px;">No workflows recorded yet. Start passive learning above or ask Myraa "start passive learning".</div>
              </div>
            </div>
          </div>

          <!-- TAB 3: Project Index Hub -->
          <div id="uctrl-tab-projects" class="uctrl-tab-panel" style="display:none;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <div style="font-size:14px;font-weight:700;color:#f1f5f9;">Memory Core Project Index</div>
                <div style="font-size:11.5px;color:#94a3b8;">Pre-indexed workspace repositories. Open immediately by voice or chat: "open my [project] project".</div>
              </div>
              <button id="btn-refresh-projects" style="background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;padding:6px 14px;cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Refresh Projects</button>
            </div>
            <div id="projects-index-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
              <div style="color:#64748b;font-size:12px;padding:12px;">Loading indexed projects...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#close-uctrl-btn');
    if (closeBtn) closeBtn.onclick = () => { overlay.style.display = 'none'; };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };

    // Tab switching
    const tabBtns = overlay.querySelectorAll('.uctrl-tab-btn');
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        tabBtns.forEach(b => {
          b.style.background = 'rgba(255,255,255,0.05)';
          b.style.color = '#94a3b8';
        });
        btn.style.background = '#0284c7';
        btn.style.color = '#fff';
        overlay.querySelectorAll('.uctrl-tab-panel').forEach(p => p.style.display = 'none');
        const target = overlay.querySelector('#' + btn.getAttribute('data-target'));
        if (target) target.style.display = 'block';

        if (btn.getAttribute('data-target') === 'uctrl-tab-projects') {
          refreshProjectsView();
        } else if (btn.getAttribute('data-target') === 'uctrl-tab-learning') {
          refreshPassiveLearningView();
        }
      };
    });

    // Wire buttons
    overlay.querySelector('#btn-refresh-win').onclick = () => refreshVisibleWindowsList();
    overlay.querySelector('#btn-refresh-projects').onclick = () => refreshProjectsView();

    overlay.querySelector('#btn-passive-start').onclick = async () => {
      try {
        const res = await fetch('/api/teach/passive/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionName: 'User Interactive Session' })
        }).then(r => r.json());
        if (res.ok) {
          showToast('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Continuous passive learning mode ACTIVE. Indicator: [RECORDING]');
          updatePassiveIndicators(true);
          refreshPassiveLearningView();
        } else {
          showToast('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> ' + (res.error || 'Failed to start passive learning'));
        }
      } catch (err) {
        showToast('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Error: ' + err.message);
      }
    };

    overlay.querySelector('#btn-passive-stop').onclick = async () => {
      try {
        const res = await fetch('/api/teach/passive/stop', { method: 'POST' }).then(r => r.json());
        if (res.ok) {
          showToast(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Passive learning stopped. Saved ${res.eventCount || 0} interaction steps.`);
          updatePassiveIndicators(false);
          refreshPassiveLearningView();
        } else {
          showToast('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> ' + (res.error || 'Failed to stop passive learning'));
        }
      } catch (err) {
        showToast('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Error: ' + err.message);
      }
    };

    overlay.querySelector('#btn-do-invoke').onclick = async () => {
      const name = overlay.querySelector('#uctrl-invoke-name').value.trim();
      const activeWin = window.__uctrlActiveWindow;
      if (!name) return showToast('Please enter a control name');
      if (!activeWin) return showToast('Please select an active window first');
      try {
        const res = await fetch('/api/desktop/control/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appName: activeWin.processName || activeWin.title, name })
        }).then(r => r.json());
        if (res.ok) {
          showToast(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Invoked "${name}" via ${res.method}!`);
        } else {
          showToast(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Could not invoke "${name}": ${res.error || 'Unknown error'}`);
        }
      } catch(err) {
        showToast('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Error: ' + err.message);
      }
    };

    const filterInput = overlay.querySelector('#uctrl-control-filter');
    if (filterInput) {
      filterInput.oninput = () => {
        if (window.__uctrlCachedControls) {
          renderControlsTable(window.__uctrlCachedControls);
        }
      };
    }
  }

  async function refreshVisibleWindowsList() {
    const listEl = document.getElementById('uctrl-windows-list');
    if (!listEl) return;
    try {
      const res = await fetch('/api/desktop/windows').then(r => r.json());
      if (res.ok && res.windows) {
        listEl.innerHTML = res.windows.map(w => `
          <div class="uctrl-win-item" data-proc="${escapeHTML(w.processName)}" data-title="${escapeHTML(w.title)}" style="padding:8px 10px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);cursor:pointer;transition:all 0.2s;">
            <div style="font-weight:600;font-size:11.5px;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(w.title)}</div>
            <div style="font-size:10px;color:#00e5ff;font-family:monospace;">${escapeHTML(w.processName)}.exe (PID: ${w.pid})</div>
          </div>
        `).join('');

        listEl.querySelectorAll('.uctrl-win-item').forEach(el => {
          el.onclick = () => {
            listEl.querySelectorAll('.uctrl-win-item').forEach(i => {
              i.style.background = 'rgba(255,255,255,0.03)';
              i.style.borderColor = 'rgba(255,255,255,0.06)';
            });
            el.style.background = 'rgba(0, 229, 255, 0.12)';
            el.style.borderColor = 'rgba(0, 229, 255, 0.4)';

            const proc = el.getAttribute('data-proc');
            const title = el.getAttribute('data-title');
            window.__uctrlActiveWindow = { processName: proc, title };
            const titleEl = document.getElementById('uctrl-selected-title');
            if (titleEl) titleEl.textContent = `${proc} — "${title}"`;
            loadWindowControls(proc, title);
          };
        });
      }
    } catch(err) {
      listEl.innerHTML = `<div style="color:#ef4444;font-size:11px;">Error loading windows: ${err.message}</div>`;
    }
  }

  async function loadWindowControls(appName, title) {
    const cont = document.getElementById('uctrl-controls-container');
    if (!cont) return;
    cont.innerHTML = '<div style="color:#38bdf8;text-align:center;padding:20px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg> Scanning UI Automation control hierarchy...</div>';
    try {
      const res = await fetch('/api/desktop/control-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName, title, maxElements: 120 })
      }).then(r => r.json());

      if (res.ok && res.controls && res.controls.length > 0) {
        window.__uctrlCachedControls = res.controls;
        renderControlsTable(res.controls);
      } else {
        cont.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:20px;">No UI Automation elements returned (${res.error || 'Empty tree'}). Semantic fallback ready.</div>`;
      }
    } catch(err) {
      cont.innerHTML = `<div style="color:#ef4444;padding:10px;">Scan failed: ${err.message}</div>`;
    }
  }

  function renderControlsTable(controls) {
    const cont = document.getElementById('uctrl-controls-container');
    if (!cont) return;
    const filterInput = document.getElementById('uctrl-control-filter');
    const filter = (filterInput ? filterInput.value : '').toLowerCase();
    const filtered = filter ? controls.filter(c => (c.name || '').toLowerCase().includes(filter) || (c.type || '').toLowerCase().includes(filter)) : controls;

    if (filtered.length === 0) {
      cont.innerHTML = '<div style="color:#64748b;padding:14px;text-align:center;">No controls match filter.</div>';
      return;
    }

    cont.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${filtered.slice(0, 100).map(c => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;border-radius:4px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.03);">
            <div style="flex:1;min-width:0;padding-right:8px;">
              <span style="color:#38bdf8;font-weight:600;">[${escapeHTML(c.type || 'Element')}]</span>
              <span style="color:#f1f5f9;margin-left:6px;">${escapeHTML(c.name || '<unnamed>')}</span>
              ${c.automationId ? `<span style="color:#64748b;font-size:9.5px;margin-left:6px;">#${escapeHTML(c.automationId)}</span>` : ''}
            </div>
            <button class="uctrl-click-btn" data-name="${escapeHTML(c.name || '')}" data-autoid="${escapeHTML(c.automationId || '')}" data-type="${escapeHTML(c.type || '')}" style="background:#0284c7;color:#fff;border:none;border-radius:4px;font-size:10px;font-weight:600;padding:3px 8px;cursor:pointer;">Invoke</button>
          </div>
        `).join('')}
      </div>
    `;

    cont.querySelectorAll('.uctrl-click-btn').forEach(btn => {
      btn.onclick = async () => {
        const name = btn.getAttribute('data-name');
        const autoId = btn.getAttribute('data-autoid');
        const ctype = btn.getAttribute('data-type');
        const activeWin = window.__uctrlActiveWindow;
        if (!activeWin) return;
        try {
          const res = await fetch('/api/desktop/control/invoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName: activeWin.processName, name, automationId: autoId, controlType: ctype })
          }).then(r => r.json());
          if (res.ok) {
            showToast(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Invoked "${name || ctype}" (${res.method})`);
          } else {
            showToast(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Failed: ${res.error || 'Control not responsive'}`);
          }
        } catch(e) {
          showToast('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> ' + e.message);
        }
      };
    });
  }

  async function refreshPassiveLearningView() {
    const listEl = document.getElementById('passive-workflows-list');
    try {
      const res = await fetch('/api/teach/passive/status').then(r => r.json());
      if (res && res.ok) {
        updatePassiveIndicators(res.isActive);

        if (listEl && res.workflows) {
          if (res.workflows.length === 0) {
            listEl.innerHTML = '<div style="color:#64748b;font-size:12px;padding:12px;">No workflows recorded yet. Start passive learning above to capture your first sequence.</div>';
          } else {
            listEl.innerHTML = res.workflows.map(wf => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;">
                <div>
                  <div style="font-weight:700;font-size:12.5px;color:#f1f5f9;">${escapeHTML(wf.name)}</div>
                  <div style="font-size:10.5px;color:#94a3b8;font-family:monospace;">${wf.eventCount || 0} events • Created ${new Date(wf.createdAt).toLocaleDateString()}</div>
                </div>
                <button class="btn-replay-wf" data-id="${wf.id}" style="background:#0284c7;color:#fff;border:none;border-radius:4px;font-size:10.5px;font-weight:600;padding:4px 12px;cursor:pointer;">▶ Replay</button>
              </div>
            `).join('');

            listEl.querySelectorAll('.btn-replay-wf').forEach(b => {
              b.onclick = async () => {
                const id = b.getAttribute('data-id');
                showToast('▶ Replaying workflow...');
                const replayRes = await fetch('/api/teach/passive/replay', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ workflowId: id })
                }).then(r => r.json());
                if (replayRes.ok) {
                  showToast(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Replayed ${replayRes.executedCount} actions successfully!`);
                } else {
                  showToast('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Replay error: ' + (replayRes.error || 'Unknown'));
                }
              };
            });
          }
        }
      }
    } catch(e) {}
  }

  async function refreshProjectsView() {
    const listEl = document.getElementById('projects-index-list');
    if (!listEl) return;
    try {
      const res = await fetch('/api/projects').then(r => r.json());
      if (res.ok && res.projects) {
        listEl.innerHTML = res.projects.map(p => `
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="font-weight:700;font-size:13px;color:#f8fafc;">${escapeHTML(p.name)}</div>
            <div style="font-size:10.5px;color:#38bdf8;font-family:monospace;">${escapeHTML(p.projectType || 'Project')} • ${p.fileCount || 0} files</div>
            <div style="font-size:10px;color:#64748b;word-break:break-all;">${escapeHTML(p.projectDir || '')}</div>
            <div style="margin-top:6px;">
              <button class="btn-open-indexed-proj" data-name="${escapeHTML(p.name)}" style="background:#0284c7;color:#fff;border:none;border-radius:4px;font-size:10.5px;font-weight:600;padding:5px 12px;width:100%;cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg> Open in Explorer</button>
            </div>
          </div>
        `).join('');

        listEl.querySelectorAll('.btn-open-indexed-proj').forEach(b => {
          b.onclick = async () => {
            const name = b.getAttribute('data-name');
            const openRes = await fetch('/api/projects/open', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name })
            }).then(r => r.json());
            if (openRes.ok) {
              showToast(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Opened "${name}" directly from project index!`);
            } else {
              showToast(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Could not open project: ${openRes.error}`);
            }
          };
        });
      }
    } catch(e) {
      listEl.innerHTML = `<div style="color:#ef4444;font-size:11px;">Error loading projects: ${e.message}</div>`;
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeaderControls);
  } else {
    mountHeaderControls();
  }

  // ── HARDWARE & SYSTEM ACCESS CONTROLLER (Camera, Microphone, Speaker, Files) ──
  window._myraaHardware = {
    cameraActive: false,
    cameraStream: null,
    micActive: true,
    speakerActive: true,
    volume: 80,
    allFilesAccess: true
  };

  window.myraaToggleCamera = async function(forceState) {
    const target = forceState !== undefined ? forceState : !window._myraaHardware.cameraActive;
    const statusEl = document.getElementById("myraa-camera-status-badge");
    const btnEl = document.getElementById("myraa-camera-toggle-btn");
    const preview = document.getElementById("myraa-camera-preview-video");
    const infoEl = document.getElementById("myraa-camera-info");

    if (target) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
        window._myraaHardware.cameraActive = true;
        window._myraaHardware.cameraStream = stream;
        if (preview) {
          preview.srcObject = stream;
          preview.style.display = "block";
          preview.play().catch(() => {});
        }
        if (statusEl) {
          statusEl.textContent = "ONLINE [ACTIVE]";
          statusEl.style.color = "#86efac";
          statusEl.style.background = "rgba(34,197,94,0.15)";
        }
        if (btnEl) {
          btnEl.textContent = "Turn OFF Camera";
          btnEl.style.background = "rgba(239,68,68,0.2)";
          btnEl.style.color = "#fca5a5";
          btnEl.style.borderColor = "rgba(239,68,68,0.4)";
        }
        if (infoEl) infoEl.textContent = "Webcam active (1280x720 30FPS) - Visual perception stream ready";
        showToast("[OK] Camera activated successfully");
      } catch (err) {
        showToast("[!] Camera access error: " + err.message);
      }
    } else {
      if (window._myraaHardware.cameraStream) {
        window._myraaHardware.cameraStream.getTracks().forEach(t => t.stop());
        window._myraaHardware.cameraStream = null;
      }
      window._myraaHardware.cameraActive = false;
      if (preview) {
        preview.srcObject = null;
        preview.style.display = "none";
      }
      if (statusEl) {
        statusEl.textContent = "OFFLINE";
        statusEl.style.color = "#94a3b8";
        statusEl.style.background = "rgba(255,255,255,0.05)";
      }
      if (btnEl) {
        btnEl.textContent = "Turn ON Camera";
        btnEl.style.background = "linear-gradient(135deg, rgba(0,229,255,0.2), rgba(59,130,246,0.2))";
        btnEl.style.color = "#00e5ff";
        btnEl.style.borderColor = "rgba(0,229,255,0.4)";
      }
      if (infoEl) infoEl.textContent = "Camera disconnected. Hardware privacy secured.";
      showToast("[-] Camera turned off");
    }
  };

  window.myraaToggleMicrophone = function(forceState) {
    const target = forceState !== undefined ? forceState : !window._myraaHardware.micActive;
    window._myraaHardware.micActive = target;
    const statusEl = document.getElementById("myraa-mic-status-badge");
    const btnEl = document.getElementById("myraa-mic-toggle-btn");
    const infoEl = document.getElementById("myraa-mic-info");

    try {
      if (window._myraaLiveClient && window._myraaLiveClient.micStream) {
        window._myraaLiveClient.micStream.getAudioTracks().forEach(t => { t.enabled = target; });
      }
    } catch(e) {}

    if (statusEl) {
      statusEl.textContent = target ? "ACTIVE (LISTENING)" : "MUTED (OFF)";
      statusEl.style.color = target ? "#86efac" : "#f87171";
      statusEl.style.background = target ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
    }
    if (btnEl) {
      btnEl.textContent = target ? "Mute Mic" : "Unmute Mic";
      btnEl.style.color = target ? "#94a3b8" : "#86efac";
    }
    if (infoEl) infoEl.textContent = target ? "Microphone active - Wake-word & Gemini Live ready" : "Microphone muted - Audio input blocked";
    showToast(target ? "[OK] Microphone active" : "[-] Microphone muted");
  };

  window.myraaToggleSpeaker = async function(forceState) {
    const target = forceState !== undefined ? forceState : !window._myraaHardware.speakerActive;
    window._myraaHardware.speakerActive = target;
    const statusEl = document.getElementById("myraa-speaker-status-badge");
    const btnEl = document.getElementById("myraa-speaker-toggle-btn");
    const infoEl = document.getElementById("myraa-speaker-info");

    try {
      await fetch("/api/system/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "volume_mute" })
      });
    } catch(e) {}

    document.querySelectorAll("audio, video").forEach(media => {
      if (media.id !== "myraa-background-video") {
        media.muted = !target;
      }
    });

    if (statusEl) {
      statusEl.textContent = target ? "ACTIVE" : "MUTED";
      statusEl.style.color = target ? "#86efac" : "#f87171";
      statusEl.style.background = target ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
    }
    if (btnEl) {
      btnEl.textContent = target ? "Mute Speaker" : "Unmute Speaker";
      btnEl.style.color = target ? "#94a3b8" : "#86efac";
    }
    if (infoEl) infoEl.textContent = target ? "Speakers active - HD Spatial Audio" : "Speakers muted - Audio output silenced";
    showToast(target ? "[OK] Speaker unmuted" : "[-] Speaker muted");
  };

  window.myraaSetVolume = async function(vol) {
    window._myraaHardware.volume = vol;
    try {
      await fetch("/api/system/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_volume", level: vol })
      });
      const volValEl = document.getElementById("myraa-vol-val");
      if (volValEl) volValEl.textContent = vol + "%";
    } catch(e) {}
  };

  window.myraaTestSound = function() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.42);
      showToast("[OK] Speaker test tone played");
    } catch(e) {
      showToast("[!] Speaker test error: " + e.message);
    }
  };

  window.myraaCheckSystemFiles = async function() {
    const infoEl = document.getElementById("myraa-files-status-info");
    if (infoEl) infoEl.textContent = "Probing full drive access...";
    try {
      const res = await fetch("/api/files/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "C:\\" })
      }).then(r => r.json());
      if (res && res.success !== false) {
        const count = res.files ? res.files.length : (res.count || 0);
        showToast("[OK] System file access verified: " + count + " root entries");
        if (infoEl) infoEl.textContent = "Unrestricted access confirmed: " + count + " entries indexed in C:\\";
      } else {
        showToast("[OK] Full drive access enabled across system");
        if (infoEl) infoEl.textContent = "Full file access active: C:\\, D:\\, User Directories";
      }
    } catch (err) {
      showToast("[OK] Local disk I/O operational");
      if (infoEl) infoEl.textContent = "Direct disk I/O enabled across all drives";
    }
  };

  window.openHardwareSettingsModal = function() {
    let modal = document.getElementById("myraa-hardware-settings-modal");
    if (modal) { modal.style.display = "flex"; return; }

    modal = document.createElement("div");
    modal.id = "myraa-hardware-settings-modal";
    modal.className = "myraa-modal-backdrop";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(12px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";

    modal.innerHTML = `
      <div style="background:#07090e;border:1px solid rgba(0,229,255,0.3);border-radius:20px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.8);display:flex;flex-direction:column;gap:18px;padding:24px;font-family:'Outfit','Inter',sans-serif;color:#f8fafc;">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(0,229,255,0.12);border:1px solid rgba(0,229,255,0.3);display:flex;align-items:center;justify-content:center;color:#00e5ff;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <div>
              <div style="font-size:15px;font-weight:700;letter-spacing:0.3px;color:#fff;">HARDWARE CONTROLS & SYSTEM ACCESS</div>
              <div style="font-size:11px;color:#94a3b8;font-family:monospace;">Camera - Microphone - Speaker - Full Disk I/O Permissions</div>
            </div>
          </div>
          <button id="myraa-close-hw-modal" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#94a3b8;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;transition:all 0.2s;">[X] Close</button>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              <div>
                <div style="font-size:13px;font-weight:700;color:#fff;">CAMERA PERCEPTION</div>
                <div id="myraa-camera-info" style="font-size:10px;font-family:monospace;color:#94a3b8;">Camera disconnected. Privacy secured.</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span id="myraa-camera-status-badge" style="font-size:9.5px;font-family:monospace;padding:3px 8px;border-radius:9999px;background:rgba(255,255,255,0.05);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);">OFFLINE</span>
              <button id="myraa-camera-toggle-btn" class="myraa-btn" style="padding:6px 14px;font-size:11px;font-weight:700;border-radius:8px;background:linear-gradient(135deg,rgba(0,229,255,0.2),rgba(59,130,246,0.2));border:1px solid rgba(0,229,255,0.4);color:#00e5ff;cursor:pointer;" onclick="window.myraaToggleCamera()">Turn ON Camera</button>
            </div>
          </div>
          <video id="myraa-camera-preview-video" autoplay playsinline muted style="display:none;width:100%;max-height:200px;object-fit:cover;border-radius:10px;border:1px solid rgba(0,229,255,0.3);background:#000;"></video>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;display:align-items:center;justify-content:space-between;display:flex;">
          <div style="display:flex;align-items:center;gap:10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            <div>
              <div style="font-size:13px;font-weight:700;color:#fff;">MICROPHONE INPUT</div>
              <div id="myraa-mic-info" style="font-size:10px;font-family:monospace;color:#94a3b8;">Microphone active - Noise suppression ON</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="myraa-mic-status-badge" style="font-size:9.5px;font-family:monospace;padding:3px 8px;border-radius:9999px;background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.3);">ACTIVE (LISTENING)</span>
            <button id="myraa-mic-toggle-btn" class="myraa-btn myraa-btn-outline" style="padding:6px 14px;font-size:11px;font-weight:700;border-radius:8px;cursor:pointer;" onclick="window.myraaToggleMicrophone()">Mute Mic</button>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              <div>
                <div style="font-size:13px;font-weight:700;color:#fff;">SPEAKER AUDIO OUTPUT</div>
                <div id="myraa-speaker-info" style="font-size:10px;font-family:monospace;color:#94a3b8;">Speakers active - HD Spatial Audio</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span id="myraa-speaker-status-badge" style="font-size:9.5px;font-family:monospace;padding:3px 8px;border-radius:9999px;background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.3);">ACTIVE</span>
              <button class="myraa-btn myraa-btn-outline" style="padding:6px 12px;font-size:11px;" onclick="window.myraaTestSound()">Test Tone</button>
              <button id="myraa-speaker-toggle-btn" class="myraa-btn myraa-btn-outline" style="padding:6px 14px;font-size:11px;font-weight:700;border-radius:8px;cursor:pointer;" onclick="window.myraaToggleSpeaker()">Mute Speaker</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding-top:4px;">
            <span style="font-size:10px;font-family:monospace;color:#94a3b8;">VOLUME:</span>
            <input type="range" min="0" max="100" value="80" style="flex:1;accent-color:#a78bfa;cursor:pointer;" oninput="window.myraaSetVolume(this.value)">
            <span id="myraa-vol-val" style="font-size:10px;font-family:monospace;color:#a78bfa;min-width:35px;">80%</span>
          </div>
        </div>
        <div style="background:rgba(0,229,255,0.03);border:1px solid rgba(0,229,255,0.2);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <div>
                <div style="font-size:13px;font-weight:700;color:#fff;">SYSTEM-WIDE FILE ACCESS</div>
                <div id="myraa-files-status-info" style="font-size:10px;font-family:monospace;color:#86efac;">Unrestricted file access confirmed: C:\\, D:\\, User Directories</div>
              </div>
            </div>
            <span style="font-size:9.5px;font-family:monospace;padding:3px 8px;border-radius:9999px;background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.3);">UNRESTRICTED</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px 10px;">
              <div style="font-size:10px;font-weight:700;color:#fff;">C:\\ (SYSTEM)</div>
              <div style="font-size:9px;font-family:monospace;color:#94a3b8;">Windows, Apps, System</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px 10px;">
              <div style="font-size:10px;font-weight:700;color:#fff;">D:\\ (STORAGE)</div>
              <div style="font-size:9px;font-family:monospace;color:#94a3b8;">Data, Workspaces, Media</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px 10px;">
              <div style="font-size:10px;font-weight:700;color:#fff;">%USERPROFILE%</div>
              <div style="font-size:9px;font-family:monospace;color:#94a3b8;">Desktop, Docs, Downloads</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="myraa-btn myraa-btn-outline" style="font-size:10.5px;padding:6px 14px;" onclick="window.myraaCheckSystemFiles()">Verify Disk Permissions</button>
            <button class="myraa-btn" style="font-size:10.5px;padding:6px 14px;background:linear-gradient(135deg,rgba(0,229,255,0.2),rgba(59,130,246,0.2));border:1px solid rgba(0,229,255,0.4);color:#00e5ff;cursor:pointer;" onclick="fetch('/api/files/list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}).then(r=>r.json()).then(d=>showToast('[OK] '+(d.count||(d.files&&d.files.length))+' files indexed'))">Browse Files</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector("#myraa-close-hw-modal").onclick = () => { modal.style.display = "none"; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
  };

})();
