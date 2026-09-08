/**
 * =============================================================================
 * MYRAA AI OS — FUTURISTIC CYBERPUNK HUD CLIENT ENGINE & ANIMATIONS
 * Derived from AURELIA / AGON-AGENT ARCHITECTURE (MK-VII / APEX v5.2)
 * Features:
 * - Real-time Tactical Sweep Radar Canvas (RadarCanvas)
 * - Multi-layer Audio Waveform Oscilloscope Canvas (WaveCanvas)
 * - Animated Audio Equalizer Bars (EqBars)
 * - SVG Arc Reactor Gauge & Thermal Meter (ArcGauge)
 * - SVG Sparkline History Charts (Spark)
 * - Rotating Gyroscope Chamber with Pedestal Neon Glow around 3D Avatar
 * - Cyberpunk Navigation Menu & Continuous Scrolling Ticker Tape
 * - 100% Non-Breaking: Retains 3D Avatar, Real Modules, Real Settings & Tools
 * =============================================================================
 */

(function () {
  'use strict';

  // ── 1. AUDIO SYNTHESIS ENGINE (BEBER & SOUND FX) ───────────────────────────
  let sfxMuted = false;
  function beep(freq = 880, dur = 0.06, vol = 0.04) {
    if (sfxMuted) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
      setTimeout(() => ctx.close(), dur * 1000 + 100);
    } catch (e) {
      /* silent fallback */
    }
  }

  // ── 2. HUD STATE ───────────────────────────────────────────────────────────
  const hudState = {
    reactor: 78,
    threat: 14,
    thermal: 36.4,
    panelsCollapsed: false,
    activeTab: 'holo',
    tasks: [
      { id: 't1', label: 'Monitor neural cognition lattice', priority: 'high', done: false, tag: 'CORE' },
      { id: 't2', label: 'Graft impact blast radius verified', priority: 'med', done: true, tag: 'GRAFT' },
      { id: 't3', label: 'Brahma computer vision bridge armed', priority: 'high', done: false, tag: 'VISION' },
      { id: 't4', label: 'Skill orchestrator sync: 139 loaded', priority: 'low', done: true, tag: 'SKILLS' }
    ],
    contacts: [
      { id: 'c1', name: 'Chief of Staff', role: 'Executive Dispatch', status: 'online' },
      { id: 'c2', name: 'Cognitive Memory', role: 'Vector Recall', status: 'online' },
      { id: 'c3', name: 'Graft Analyzer', role: 'Blast Radii & Diff', status: 'online' },
      { id: 'c4', name: 'Brahma Vision', role: 'Desktop OCR & Clicks', status: 'online' },
      { id: 'c5', name: 'Gemini Supervisor', role: 'Multimodal Live', status: 'standby' }
    ],
    tickerItems: [
      'AUTONOMOUS AGENTS FLEET: 28 NODES ACTIVE',
      '3D COMPANION ENGINE: 60 FPS VRM/MMD RENDERED',
      'WINDOWS DESKTOP AUTOMATION: ARMED & CALIBRATED',
      'GRAFT BLAST RADIUS ENGINE: NOMINAL',
      'BRAHMA COMPUTER ACCESS: LEVEL 4 GRANTED',
      'GEMINI 2.5 FLASH AUDIO SUPERVISOR: ONLINE',
      'SKILL REGISTRY: 139 SPECIALIZED CAPABILITIES',
      'DATA VAULT: AES-512 SECURED & ZERO-DRIFT'
    ],
    logs: [
      { t: new Date().toLocaleTimeString(), src: 'MYRAA', msg: 'Cyberpunk HUD interface bound to operator. All systems nominal.', kind: 'ok' },
      { t: new Date().toLocaleTimeString(), src: 'REACTOR', msg: 'Core thermal output stable — 3.1 GJ/s.', kind: 'info' },
      { t: new Date().toLocaleTimeString(), src: '3D COMP', msg: 'Holographic projection chamber initialized.', kind: 'ok' }
    ],
    powerHist: [72, 74, 73, 76, 78, 77, 79, 78, 77, 80, 78, 79],
    audioLevel: 0.15,
    isSpeaking: false,
    isListening: false
  };

  // ── 3. CANVAS COMPONENTS: RADAR & WAVEFORM ─────────────────────────────────
  let radarRaf = 0;
  let waveRaf = 0;

  function initRadarCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let ang = 0;
    const blips = [
      { r: 0.32, a: 0.8, c: '#22d3ee', s: 1 },
      { r: 0.55, a: 2.4, c: '#22d3ee', s: 0.8 },
      { r: 0.70, a: 4.4, c: '#ff2d4d', s: 1.2 },
      { r: 0.44, a: 5.3, c: '#e8c15a', s: 0.9 },
      { r: 0.82, a: 1.5, c: '#22d3ee', s: 0.6 }
    ];

    function draw() {
      ang += 0.024;
      const S = (canvas.width = canvas.offsetWidth * 2);
      const H = (canvas.height = canvas.offsetHeight * 2);
      if (S === 0 || H === 0) {
        radarRaf = requestAnimationFrame(draw);
        return;
      }
      const cx = S / 2, cy = H / 2;
      const R = Math.min(S, H) / 2 - 10;
      ctx.clearRect(0, 0, S, H);

      // Radar Concentric Rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Crosshairs
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

      // Sweeping Sector Beam
      for (let i = 0; i < 40; i++) {
        const a = ang - i * 0.022;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a - 0.022, a);
        ctx.closePath();
        ctx.fillStyle = `rgba(34, 211, 238, ${0.22 * (1 - i / 40)})`;
        ctx.fill();
      }

      // Sweep Leading Edge
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
      ctx.strokeStyle = 'rgba(165, 243, 252, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Target Blips with Fade Decay
      blips.forEach((b) => {
        const bx = cx + Math.cos(b.a) * R * b.r;
        const by = cy + Math.sin(b.a) * R * b.r;
        let d = (ang - b.a) % (Math.PI * 2);
        if (d < 0) d += Math.PI * 2;
        const fade = Math.max(0.18, 1 - d / (Math.PI * 1.3));
        ctx.beginPath();
        ctx.arc(bx, by, 5 * b.s + 2, 0, Math.PI * 2);
        ctx.fillStyle = b.c;
        ctx.globalAlpha = fade;
        ctx.shadowColor = b.c;
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });

      radarRaf = requestAnimationFrame(draw);
    }

    draw();
  }

  function initWaveCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let t = 0;

    function draw() {
      t += 0.07;
      const W = (canvas.width = canvas.offsetWidth * 2);
      const H = (canvas.height = canvas.offsetHeight * 2);
      if (W === 0 || H === 0) {
        waveRaf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, W, H);

      const level = hudState.isSpeaking ? 0.85 : hudState.isListening ? 0.6 : hudState.audioLevel;
      const color = '#22d3ee';
      const lines = 3;

      for (let l = 0; l < lines; l++) {
        ctx.beginPath();
        const amp = (7 + level * 28) * (1 - l * 0.28);
        for (let x = 0; x <= W; x += 5) {
          const p = x / W;
          const env = Math.sin(p * Math.PI);
          const y = H / 2 +
            Math.sin(p * 9 + t * (2.2 + l * 0.6) + l) * amp * env * 2.1 +
            Math.sin(p * 21 - t * 3.2) * amp * 0.4 * env;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = l === 0 ? color : color + '55';
        ctx.lineWidth = l === 0 ? 2.8 : 1.4;
        ctx.shadowColor = color;
        ctx.shadowBlur = l === 0 ? 14 : 4;
        ctx.stroke();
      }

      waveRaf = requestAnimationFrame(draw);
    }

    draw();
  }

  // ── 4. SVG ARC GAUGE & SPARKLINE HELPERS ────────────────────────────────────
  function renderArcGaugeSVG(value, size = 130, tone = 'cyan') {
    const r = 52;
    const c = 2 * Math.PI * r;
    const frac = Math.max(0, Math.min(1, value / 100));
    const stroke = tone === 'red' ? '#ff2d4d' : tone === 'gold' ? '#e8c15a' : '#22d3ee';
    const offset = c * 0.78 * (1 - frac);

    return `
      <svg viewBox="0 0 140 92" style="width: 100%; height: auto; max-width: ${size}px;">
        <path d="M 16 80 A 52 52 0 0 1 124 80" fill="none" stroke="rgba(34,211,238,0.12)" stroke-width="8" stroke-linecap="round" />
        <path d="M 16 80 A 52 52 0 0 1 124 80" fill="none" stroke="${stroke}" stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${c * 0.78}"
          stroke-dashoffset="${offset}"
          style="transition: stroke-dashoffset 0.6s ease; filter: drop-shadow(0 0 8px ${stroke});" />
        <line x1="20" y1="80" x2="26" y2="80" stroke="rgba(165,243,252,0.6)" stroke-width="1.5" />
        <line x1="70" y1="28" x2="70" y2="34" stroke="rgba(165,243,252,0.6)" stroke-width="1.5" />
        <line x1="120" y1="80" x2="114" y2="80" stroke="rgba(165,243,252,0.6)" stroke-width="1.5" />
      </svg>
    `;
  }

  function renderSparklineSVG(data, w = 120, h = 32, stroke = '#22d3ee') {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const id = 'spark_' + Math.random().toString(36).slice(2, 7);

    return `
      <svg width="${w}" height="${h}" style="overflow: visible;">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${stroke}" stop-opacity="0.45" />
            <stop offset="100%" stop-color="${stroke}" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon points="0,${h} ${pts} ${w},${h}" fill="url(#${id})" />
        <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px ${stroke});" />
      </svg>
    `;
  }

  // ── 5. DOM INJECTION & MASTER HUD SHELL ─────────────────────────────────────
  function mountMyraaHUD() {
    if (document.getElementById('myraa-hud-master')) return;

    const master = document.createElement('div');
    master.id = 'myraa-hud-master';

    master.innerHTML = `
      <!-- ================= 1. CYBERPUNK TOP NAVIGATION BAR ================= -->
      <header class="hud-topbar" style="
        background: rgba(3, 10, 15, 0.92);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(34, 211, 238, 0.22);
        box-shadow: 0 4px 25px rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        z-index: 40;
      ">
        <div style="
          max-width: 1780px;
          width: 100%;
          margin: 0 auto;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <!-- Left Brand & Gyroscope Core -->
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <div style="position: relative; width: 38px; height: 38px; flex-shrink: 0;">
              <div class="ring-spin" style="position: absolute; inset: 0; border-radius: 9999px; border: 1.5px solid rgba(34,211,238,0.6);"></div>
              <div class="ring-spin-rev" style="position: absolute; inset: 4px; border-radius: 9999px; border: 1.5px dashed rgba(232,193,90,0.5);"></div>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
                <div style="width: 10px; height: 10px; border-radius: 9999px; background: #22d3ee; box-shadow: 0 0 14px #22d3ee;"></div>
              </div>
            </div>
            <div style="display: flex; flex-direction: column;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="font-hud-display text-glow-cyan" style="font-size: 16px; font-weight: 900; letter-spacing: 0.24em; color: #ffffff;">MIRA <span style="color: #22d3ee;">AI OS</span></span>
                <span class="font-hud-mono" style="font-size: 9.5px; padding: 1px 6px; border: 1px solid rgba(255,45,77,0.5); color: #fecdd3; background: rgba(255,45,77,0.15); letter-spacing: 0.15em;">MK-VII APEX</span>
              </div>
              <div class="font-hud-mono" style="font-size: 10px; color: rgba(34,211,238,0.65); letter-spacing: 0.16em;">OPERATOR: VISHWAJEET · SECURE GRID</div>
            </div>
          </div>

          <!-- Center Navigation Actions -->
          <nav style="display: flex; align-items: center; gap: 6px; margin: 0 auto;" aria-label="HUD Cockpit Navigation">
            <button class="btn-hud active" id="hud-nav-holo" style="padding: 6px 12px; font-size: 10.5px;" title="Focus 3D Holographic Companion">
              ⬡ HOLO DECK
            </button>
            <button class="btn-hud" id="hud-nav-reactor" style="padding: 6px 12px; font-size: 10.5px;" title="Reactor Power & System Telemetry">
              ⚡ REACTOR
            </button>
            <button class="btn-hud" id="hud-nav-tactical" style="padding: 6px 12px; font-size: 10.5px;" title="Tactical Radar Scope">
              🎯 TACTICAL
            </button>
            <button class="btn-hud" id="hud-nav-workforce" style="padding: 6px 12px; font-size: 10.5px;" title="Autonomous 28-Agent Workforce">
              🤖 AGENTS
            </button>
            <button class="btn-hud" id="hud-nav-skills" style="padding: 6px 12px; font-size: 10.5px;" title="Cognitive Skills & MCP Tools (139 Skills)">
              💡 SKILLS
            </button>
            <button class="btn-hud" id="hud-nav-workspace" style="padding: 6px 12px; font-size: 10.5px;" title="Workspace Console & App Studio">
              📁 WORKSPACE
            </button>
            <button class="btn-hud btn-hud-gold" id="hud-nav-settings" style="padding: 6px 12px; font-size: 10.5px;" title="Settings, Plugins & Vault">
              ⚙️ SETTINGS
            </button>
            <button class="btn-hud btn-hud-red" id="hud-nav-livevoice" style="padding: 6px 12px; font-size: 10.5px;" title="Toggle Gemini Live Voice Mode">
              🎙️ LIVE VOICE
            </button>
          </nav>

          <!-- Right Telemetry, Clock & Operator -->
          <div style="display: flex; align-items: center; gap: 14px; font-family: var(--hud-font-mono); font-size: 11px;">
            <div style="display: flex; align-items: center; gap: 6px; color: #34d399;">
              <span class="blink" style="width: 7px; height: 7px; border-radius: 9999px; background: #34d399; box-shadow: 0 0 8px #34d399;"></span>
              <span>GRID STABLE</span>
            </div>
            <div style="color: rgba(34,211,238,0.8);">⚡ 4.2ms</div>
            <div style="color: #fecdd3; border: 1px solid rgba(255,45,77,0.4); padding: 2px 7px; background: rgba(255,45,77,0.12);">THREAT <span id="hud-threat-val">14</span></div>

            <!-- Digital Clock -->
            <div style="text-align: right; line-height: 1.1;">
              <div class="font-hud-display text-glow-cyan" id="hud-clock-time" style="font-size: 15px; font-weight: 800; color: #ffffff;">00:00:00</div>
              <div style="font-size: 9px; color: rgba(34,211,238,0.5); letter-spacing: 0.15em;">LOCAL · UTC+05:30</div>
            </div>

            <!-- Panel Collapse / Sound FX Controls -->
            <div style="display: flex; align-items: center; gap: 6px; border-left: 1px solid rgba(34,211,238,0.2); padding-left: 12px;">
              <button id="hud-toggle-sound" class="btn-hud" style="padding: 5px 8px; font-size: 10px;" title="Toggle Audio Feedback Sounds">
                🔊 SFX
              </button>
              <button id="hud-toggle-layout" class="btn-hud" style="padding: 5px 8px; font-size: 10px;" title="Toggle Cockpit Panels / Cinema Companion View">
                ◫ PANELS
              </button>
            </div>
          </div>
        </div>

        <!-- Continuous Ticker Tape -->
        <div style="border-top: 1px solid rgba(34, 211, 238, 0.12); background: rgba(0, 0, 0, 0.5); overflow: hidden; white-space: nowrap; padding: 3px 0;">
          <div class="ticker-track font-hud-mono" style="font-size: 10px; letter-spacing: 0.18em; color: rgba(34, 211, 238, 0.75);">
            ${[...hudState.tickerItems, ...hudState.tickerItems].map(item => `
              <span style="display: inline-flex; align-items: center; gap: 8px;">
                <span style="color: #22d3ee;">◆</span>
                <span>${item}</span>
              </span>
            `).join('')}
          </div>
        </div>
      </header>

      <!-- ================= 2. THREE-COLUMN COCKPIT BODY ================= -->
      <div style="
        flex: 1;
        display: grid;
        grid-template-columns: 310px 1fr 310px;
        gap: 12px;
        padding: 12px 16px;
        max-width: 1780px;
        width: 100%;
        margin: 0 auto;
        overflow: hidden;
        position: relative;
      " id="hud-cockpit-grid">

        <!-- ============ LEFT COLUMN: REACTOR, CORE SYSTEMS, DIRECTIVES ============ -->
        <aside class="hud-col" id="hud-left-col" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto;" class="thin-scroll">
          <!-- Arc Reactor Panel -->
          <div class="hud-panel hud-corner scanlines" style="padding: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div class="font-hud-display" style="font-size: 11px; letter-spacing: 0.24em; color: #22d3ee; display: flex; align-items: center; gap: 6px;">
                <span>⚡</span> ARC REACTOR
              </div>
              <span class="font-hud-mono" style="font-size: 9.5px; color: #34d399; display: flex; align-items: center; gap: 5px;">
                <span style="width: 6px; height: 6px; border-radius: 9999px; background: #34d399; box-shadow: 0 0 6px #34d399;"></span> ONLINE
              </span>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-around;">
              <div id="gauge-reactor-container" style="width: 120px; text-align: center;">
                ${renderArcGaugeSVG(hudState.reactor, 120, 'cyan')}
                <div class="font-hud-display text-glow-cyan" style="font-size: 20px; font-weight: 800; color: #ffffff; margin-top: -12px;">
                  <span id="hud-reactor-num">${hudState.reactor}</span><span style="font-size: 11px; color: #22d3ee;">%</span>
                </div>
                <div class="font-hud-mono" style="font-size: 9.5px; color: rgba(34,211,238,0.7); letter-spacing: 0.16em;">OUTPUT · 3.1 GJ/s</div>
              </div>

              <div id="gauge-thermal-container" style="width: 90px; text-align: center;">
                ${renderArcGaugeSVG(hudState.thermal, 90, 'gold')}
                <div class="font-hud-display text-glow-gold" style="font-size: 16px; font-weight: 800; color: #ffffff; margin-top: -10px;">
                  <span id="hud-thermal-num">${hudState.thermal}</span><span style="font-size: 9.5px; color: #e8c15a;">°C</span>
                </div>
                <div class="font-hud-mono" style="font-size: 9px; color: rgba(232,193,90,0.7); letter-spacing: 0.14em;">THERMAL</div>
              </div>
            </div>

            <div style="margin-top: 10px;">
              <div style="display: flex; justify-content: space-between; font-family: var(--hud-font-mono); font-size: 9.5px; color: rgba(34,211,238,0.7); margin-bottom: 4px;">
                <span>THROTTLE PRESET</span>
                <span id="hud-throttle-label" style="color: #ffffff;">CRUISE (78%)</span>
              </div>
              <input type="range" min="10" max="100" value="${hudState.reactor}" id="hud-reactor-slider" class="hud-range" style="width: 100%; --fill: ${hudState.reactor}%;">
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 8px;">
                <button class="btn-hud" data-throttle="32" style="padding: 4px 6px; font-size: 9px;">ECO 32%</button>
                <button class="btn-hud active" data-throttle="65" style="padding: 4px 6px; font-size: 9px;">CRUISE 65%</button>
                <button class="btn-hud btn-hud-red" data-throttle="97" style="padding: 4px 6px; font-size: 9px;">BOOST 97%</button>
              </div>
            </div>

            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(34,211,238,0.12); display: flex; align-items: center; justify-content: space-between;">
              <span class="font-hud-mono" style="font-size: 9.5px; color: rgba(34,211,238,0.6);">POWER CURVE</span>
              <div id="hud-power-spark">${renderSparklineSVG(hudState.powerHist, 140, 26, '#22d3ee')}</div>
            </div>
          </div>

          <!-- Real MYRAA Core Systems -->
          <div class="hud-panel" style="padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div class="font-hud-display" style="font-size: 11px; letter-spacing: 0.22em; color: #22d3ee;">CORE ENGINES · 8 ACTIVE</div>
              <span class="font-hud-mono" style="font-size: 9px; color: rgba(34,211,238,0.5);">NOMINAL</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;" class="thin-scroll">
              ${[
                { id: 'desktop_auto', name: 'Desktop Automation', code: 'SYS-01', load: 38, desc: 'Real Windows keyboard, mouse & volume' },
                { id: 'skills_mcp', name: 'Skill & MCP Engine', code: 'SKL-02', load: 52, desc: '139 Dynamic tool catalog modules' },
                { id: 'brahma_vis', name: 'Brahma Computer Control', code: 'BRH-03', load: 44, desc: 'Vision OCR & screen perception' },
                { id: 'graft_diff', name: 'Graft Impact Engine', code: 'GRF-04', load: 26, desc: 'Graph blast radius & code auditor' },
                { id: 'memory_core', name: 'Cognitive Memory Core', code: 'MEM-05', load: 60, desc: 'Long-term vectors & structured recall' },
                { id: 'app_studio', name: 'App Studio & Office', code: 'APP-06', load: 34, desc: 'Enterprise Word, Excel & Web generators' }
              ].map(s => `
                <div style="
                  border: 1px solid rgba(34,211,238,0.18);
                  background: rgba(34,211,238,0.04);
                  padding: 7px 10px;
                  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
                ">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="width: 6px; height: 6px; border-radius: 9999px; background: #34d399; box-shadow: 0 0 6px #34d399;"></span>
                      <span style="font-weight: 700; font-size: 12px; color: #ffffff;">${s.name}</span>
                    </div>
                    <span class="font-hud-mono" style="font-size: 9px; color: rgba(34,211,238,0.5);">${s.code}</span>
                  </div>
                  <div class="font-hud-mono" style="font-size: 9px; color: rgba(34,211,238,0.5); margin-top: 2px;">${s.desc}</div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
                    <div style="flex: 1; height: 3px; background: rgba(34,211,238,0.1); border-radius: 99px; overflow: hidden;">
                      <div style="width: ${s.load}%; height: 100%; background: linear-gradient(90deg, #22d3ee, #a5f3fc); box-shadow: 0 0 6px #22d3ee;"></div>
                    </div>
                    <span class="font-hud-mono" style="font-size: 9px; color: rgba(34,211,238,0.8);">${s.load}%</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Directives / Mission Log -->
          <div class="hud-panel" style="padding: 12px; flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div class="font-hud-display" style="font-size: 11px; letter-spacing: 0.22em; color: #22d3ee;">DIRECTIVES</div>
              <span class="font-hud-mono" style="font-size: 9px; color: rgba(34,211,238,0.5);">OPEN 2</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;" id="hud-task-list">
              ${hudState.tasks.map(t => `
                <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid rgba(34,211,238,0.12); background: rgba(0,0,0,0.3);">
                  <input type="checkbox" ${t.done ? 'checked' : ''} style="accent-color: #22d3ee; cursor: pointer;">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 11.5px; color: ${t.done ? '#64748b' : '#f1f5f9'}; text-decoration: ${t.done ? 'line-through' : 'none'};" class="truncate">${t.label}</div>
                    <div class="font-hud-mono" style="font-size: 8.5px; color: ${t.priority === 'high' ? '#f43f5e' : '#e8c15a'};">${t.tag} · ${t.priority.toUpperCase()}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </aside>

        <!-- ============ CENTER COLUMN: THE GRAND HOLOGRAPHIC PROJECTION CHAMBER ============ -->
        <main style="display: flex; flex-direction: column; gap: 10px; position: relative; overflow: hidden;">
          <!-- Hologram Framing Area (Wraps around #root avatar) -->
          <div class="hud-panel hud-corner scanlines" style="
            flex: 1;
            position: relative;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border-color: rgba(34, 211, 238, 0.3);
            background: linear-gradient(180deg, rgba(7, 20, 27, 0.85) 0%, rgba(3, 8, 12, 0.92) 100%);
          ">
            <!-- Chamber Top Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid rgba(34,211,238,0.15);">
              <div class="font-hud-mono" style="font-size: 10px; letter-spacing: 0.25em; color: rgba(34,211,238,0.85); display: flex; align-items: center; gap: 6px;">
                <span>⬢</span> HOLO-PROJECTION · CHAMBER 01
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="font-hud-mono" style="
                  font-size: 9.5px;
                  padding: 2px 8px;
                  border: 1px solid rgba(34,211,238,0.4);
                  background: rgba(34,211,238,0.1);
                  color: #22d3ee;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                ">
                  <span class="blink" style="width: 5px; height: 5px; border-radius: 9999px; background: #22d3ee; box-shadow: 0 0 6px #22d3ee;"></span>
                  ATTENTIVE
                </span>
                <span class="font-hud-mono" style="font-size: 9.5px; color: rgba(34,211,238,0.5);">SYNC 98.4%</span>
              </div>
            </div>

            <!-- Avatar Holographic Chamber Overlay (Positioned directly over the 3D canvas) -->
            <div style="
              flex: 1;
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
            ">
              <!-- Ambient Spinning Gyroscope Rings Behind Model -->
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; opacity: 0.65;">
                <div class="ring-spin" style="position: absolute; width: min(440px, 80vw); aspect-ratio: 1; border-radius: 9999px; border: 1.5px dashed rgba(34, 211, 238, 0.2);"></div>
                <div class="ring-spin-rev" style="position: absolute; width: min(360px, 68vw); aspect-ratio: 1; border-radius: 9999px; border: 1.5px solid rgba(34, 211, 238, 0.28);"></div>
                <div class="ring-spin-fast" style="position: absolute; width: min(280px, 55vw); aspect-ratio: 1; border-radius: 9999px; border: 1px dashed rgba(232, 193, 90, 0.25);"></div>
              </div>

              <!-- Animated Moving Hologram Scanline Beam -->
              <div class="holo-scan"></div>

              <!-- Face Scan Bracket & Crosshair -->
              <div style="position: absolute; top: 12%; left: 50%; transform: translateX(-50%); width: 140px; height: 160px; pointer-events: none;">
                <span style="position: absolute; top: 0; left: 0; width: 16px; height: 16px; border-top: 2px solid #22d3ee; border-left: 2px solid #22d3ee; box-shadow: -2px -2px 8px rgba(34,211,238,0.5);"></span>
                <span style="position: absolute; top: 0; right: 0; width: 16px; height: 16px; border-top: 2px solid #22d3ee; border-right: 2px solid #22d3ee; box-shadow: 2px -2px 8px rgba(34,211,238,0.5);"></span>
                <span style="position: absolute; bottom: 0; left: 0; width: 16px; height: 16px; border-bottom: 2px solid #22d3ee; border-left: 2px solid #22d3ee;"></span>
                <span style="position: absolute; bottom: 0; right: 0; width: 16px; height: 16px; border-bottom: 2px solid #22d3ee; border-right: 2px solid #22d3ee;"></span>
                <span class="font-hud-mono" style="position: absolute; -top: 22px; left: 50%; transform: translateX(-50%); font-size: 8.5px; letter-spacing: 0.18em; color: #22d3ee; white-space: nowrap;">
                  ID: OPERATOR ✓
                </span>
              </div>

              <!-- Left & Right Telemetry Rails on Hologram Glass -->
              <div style="position: absolute; left: 16px; top: 20%; display: flex; flex-direction: column; gap: 8px;">
                ${[['PWR', '78%', '#22d3ee'], ['SYNC', '98.4%', '#34d399'], ['CORE', '36.4°C', '#e8c15a']].map(([k, v, c]) => `
                  <div style="
                    border: 1px solid rgba(34,211,238,0.22);
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(8px);
                    padding: 4px 10px;
                    clip-path: polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
                    min-width: 80px;
                  ">
                    <div class="font-hud-mono" style="font-size: 8px; color: rgba(34,211,238,0.5); letter-spacing: 0.15em;">${k}</div>
                    <div class="font-hud-display" style="font-size: 13px; font-weight: 700; color: ${c};">${v}</div>
                  </div>
                `).join('')}
              </div>

              <div style="position: absolute; right: 16px; top: 20%; display: flex; flex-direction: column; gap: 8px; text-align: right;">
                ${[['THREAT', '14', '#22d3ee'], ['SUITS', '35 RDY', '#e8c15a'], ['UPLINK', '4.2ms', '#34d399']].map(([k, v, c]) => `
                  <div style="
                    border: 1px solid rgba(34,211,238,0.22);
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(8px);
                    padding: 4px 10px;
                    clip-path: polygon(6px 0, 100% 0, 100% 100%, 0 100%);
                    min-width: 80px;
                  ">
                    <div class="font-hud-mono" style="font-size: 8px; color: rgba(34,211,238,0.5); letter-spacing: 0.15em;">${k}</div>
                    <div class="font-hud-display" style="font-size: 13px; font-weight: 700; color: ${c};">${v}</div>
                  </div>
                `).join('')}
              </div>

              <!-- Holographic Pedestal Glow at Avatar Feet -->
              <div style="
                position: absolute;
                bottom: 8%;
                width: 75%;
                height: 35px;
                border-radius: 100%;
                background: radial-gradient(closest-side, rgba(34,211,238,0.45), rgba(34,211,238,0.12), transparent);
                filter: blur(4px);
              "></div>
            </div>

            <!-- Model Identity Plate -->
            <div style="text-align: center; padding: 4px 0 6px 0; z-index: 2;">
              <div class="font-hud-display text-glow-cyan" style="font-size: 24px; font-weight: 900; letter-spacing: 0.3em; color: #ffffff;">MIRA</div>
              <div class="font-hud-mono" style="font-size: 10px; letter-spacing: 0.24em; color: rgba(232,193,90,0.8);">AUTONOMOUS COMPANION · NEURAL CORE · INTEL ARRAY</div>
            </div>

            <!-- Interactive Live Audio Waveform & Equalizer Bar -->
            <div style="
              margin: 0 16px 12px 16px;
              border: 1px solid rgba(34, 211, 238, 0.25);
              background: rgba(3, 12, 18, 0.75);
              backdrop-filter: blur(12px);
              padding: 8px 14px;
              display: flex;
              align-items: center;
              gap: 14px;
              z-index: 3;
            ">
              <div style="
                width: 36px;
                height: 36px;
                border-radius: 9999px;
                border: 1px solid rgba(34,211,238,0.5);
                background: rgba(34,211,238,0.12);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 0 12px rgba(34,211,238,0.4);
              ">
                <span style="font-size: 15px; color: #22d3ee;">⚡</span>
              </div>
              <div style="flex: 1; height: 38px; position: relative;">
                <canvas id="hud-wave-canvas" style="width: 100%; height: 100%;"></canvas>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
                <div style="display: flex; align-items: flex-end; gap: 2px; height: 18px;" id="hud-eq-bars">
                  ${[0.8, 0.5, 1.0, 0.7, 1.2, 0.6, 0.9, 0.7].map(d => `
                    <span style="
                      width: 3px;
                      height: 100%;
                      background: #22d3ee;
                      box-shadow: 0 0 6px #22d3ee;
                      border-radius: 99px;
                      transform-origin: bottom;
                      animation: eqBar ${d}s ease-in-out infinite;
                    "></span>
                  `).join('')}
                </div>
                <span class="font-hud-mono" style="font-size: 8.5px; letter-spacing: 0.18em; color: #22d3ee;">● LISTENING</span>
              </div>
            </div>
          </div>

          <!-- Real-Time Voice & Chat Interaction Dock -->
          <div class="hud-panel" style="padding: 12px;">
            <!-- Quick Command Prompt Chips -->
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
              ${['Status report', 'Run deep scan', 'Audit skills', 'Raise shields', 'Launch workspace', 'Voice reconnect'].map(q => `
                <button class="btn-hud hud-quick-chip" data-query="${q}" style="padding: 3px 8px; font-size: 9.5px; letter-spacing: 0.1em;">
                  › ${q}
                </button>
              `).join('')}
            </div>

            <div style="display: flex; gap: 8px;">
              <button id="hud-mic-btn" class="btn-hud" style="width: 42px; flex-shrink: 0; font-size: 14px;" title="Voice Dictation">
                🎤
              </button>
              <input type="text" id="hud-chat-input" placeholder="Transmit directive to Mira... (e.g. 'Mira, status report' or 'hey mira')" style="
                flex: 1;
                background: rgba(0, 0, 0, 0.65);
                border: 1px solid rgba(34, 211, 238, 0.3);
                padding: 8px 14px;
                color: #ffffff;
                font-family: var(--hud-font-body);
                font-size: 13.5px;
                outline: none;
                transition: all 0.2s ease;
              ">
              <button id="hud-send-btn" class="btn-hud" style="padding: 0 18px; font-size: 11px; background: linear-gradient(90deg, #0284c7, #22d3ee); color: #020507;" title="Send Message">
                SEND ❯
              </button>
            </div>
          </div>
        </main>

        <!-- ============ RIGHT COLUMN: TACTICAL SCOPE, VITALS, AGENTS, PROTOCOLS ============ -->
        <aside class="hud-col" id="hud-right-col" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto;" class="thin-scroll">
          <!-- Tactical Scope with Radar Canvas -->
          <div class="hud-panel hud-red" style="padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div class="font-hud-display" style="font-size: 11px; letter-spacing: 0.24em; color: #ff2d4d; display: flex; align-items: center; gap: 6px;">
                <span>🎯</span> TACTICAL SCOPE
              </div>
              <span class="font-hud-mono" style="font-size: 9px; color: rgba(255,45,77,0.85);">GRID K-9</span>
            </div>

            <div style="height: 160px; border: 1px solid rgba(255,45,77,0.2); background: rgba(0,0,0,0.5); position: relative;">
              <canvas id="hud-radar-canvas" style="width: 100%; height: 100%;"></canvas>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 8px; text-align: center;">
              <div style="border: 1px solid rgba(255,45,77,0.25); background: rgba(0,0,0,0.4); padding: 4px;">
                <div class="font-hud-display text-glow-red" style="font-size: 15px; font-weight: 800; color: #ff2d4d;">14</div>
                <div class="font-hud-mono" style="font-size: 8px; color: rgba(255,45,77,0.7); letter-spacing: 0.16em;">THREAT</div>
              </div>
              <div style="border: 1px solid rgba(34,211,238,0.2); background: rgba(0,0,0,0.4); padding: 4px;">
                <div class="font-hud-display" style="font-size: 15px; font-weight: 800; color: #22d3ee;">04</div>
                <div class="font-hud-mono" style="font-size: 8px; color: rgba(34,211,238,0.7); letter-spacing: 0.16em;">TARGETS</div>
              </div>
              <div style="border: 1px solid rgba(52,211,153,0.25); background: rgba(0,0,0,0.4); padding: 4px;">
                <div class="font-hud-display" style="font-size: 15px; font-weight: 800; color: #34d399;">CLEAN</div>
                <div class="font-hud-mono" style="font-size: 8px; color: rgba(52,211,153,0.7); letter-spacing: 0.16em;">DEFENSE</div>
              </div>
            </div>
          </div>

          <!-- Hardware Telemetry & Operator Vitals -->
          <div class="hud-panel" style="padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div class="font-hud-display" style="font-size: 11px; letter-spacing: 0.22em; color: #22d3ee;">HARDWARE VITALS</div>
              <span class="font-hud-mono" style="font-size: 9px; color: #34d399;">STABLE</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              ${[
                { label: 'CPU LOAD', val: '24%', color: '#22d3ee', data: [18, 22, 24, 21, 25, 24, 23, 24] },
                { label: 'RAM USAGE', val: '5.8 GB', color: '#34d399', data: [5.2, 5.4, 5.5, 5.7, 5.8, 5.8] },
                { label: 'NETWORK', val: '12 MB/s', color: '#e8c15a', data: [8, 11, 14, 10, 13, 12] },
                { label: 'AGENT SYNC', val: '98.4%', color: '#60a5fa', data: [96, 97, 98, 98, 99, 98] }
              ].map(v => `
                <div style="border: 1px solid rgba(34,211,238,0.14); background: rgba(0,0,0,0.35); padding: 6px;">
                  <div class="font-hud-mono" style="font-size: 8px; color: rgba(34,211,238,0.5); letter-spacing: 0.15em;">${v.label}</div>
                  <div class="font-hud-display" style="font-size: 13px; font-weight: 700; color: #ffffff; margin-top: 1px;">${v.val}</div>
                  <div style="margin-top: 3px;">${renderSparklineSVG(v.data, 96, 20, v.color)}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Autonomous Agent Comms -->
          <div class="hud-panel" style="padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div class="font-hud-display" style="font-size: 11px; letter-spacing: 0.22em; color: #22d3ee;">AGENT WORKFORCE</div>
              <span class="font-hud-mono" style="font-size: 9px; color: rgba(34,211,238,0.5);">5 CH</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px;">
              ${hudState.contacts.map(c => `
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 5px 8px;
                  border: 1px solid rgba(34,211,238,0.12);
                  background: rgba(34,211,238,0.03);
                  cursor: pointer;
                  transition: background 0.2s ease;
                " class="hud-agent-contact" data-agent="${c.id}">
                  <span style="
                    width: 22px;
                    height: 22px;
                    border-radius: 9999px;
                    border: 1px solid rgba(34,211,238,0.35);
                    background: rgba(34,211,238,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 9px;
                    font-weight: 700;
                    color: #22d3ee;
                  ">${c.name.slice(0, 2).toUpperCase()}</span>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 11.5px; font-weight: 600; color: #ffffff;" class="truncate">${c.name}</div>
                    <div class="font-hud-mono" style="font-size: 8.5px; color: rgba(34,211,238,0.5);">${c.role}</div>
                  </div>
                  <span style="width: 5px; height: 5px; border-radius: 9999px; background: ${c.status === 'online' ? '#34d399' : '#e8c15a'};"></span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Tactical Armed Protocols -->
          <div class="hud-panel hud-gold" style="padding: 12px; flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div class="font-hud-display" style="font-size: 11px; letter-spacing: 0.22em; color: #e8c15a;">TACTICAL PROTOCOLS</div>
              <span class="font-hud-mono" style="font-size: 9px; color: rgba(232,193,90,0.8);">ARMED</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              ${[
                { name: 'Self Diagnosis', code: 'PRT-01', risk: 'LOW' },
                { name: 'Memory Consolidation', code: 'PRT-02', risk: 'LOW' },
                { name: 'Graft Blast Audit', code: 'PRT-03', risk: 'MED' },
                { name: 'Purge Transient Cache', code: 'PRT-04', risk: 'LOW' }
              ].map(p => `
                <button class="btn-hud btn-hud-gold hud-protocol-btn" data-protocol="${p.code}" style="
                  padding: 6px 8px;
                  text-align: left;
                  display: flex;
                  flex-direction: column;
                  gap: 2px;
                ">
                  <span class="font-hud-mono" style="font-size: 8px; opacity: 0.65;">${p.code}</span>
                  <span style="font-size: 10px; font-weight: 700; color: #ffffff;" class="truncate">${p.name}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </aside>
      </div>
    `;

    document.body.appendChild(master);

    // Initialize Real-time Interactive Canvases
    const radarEl = document.getElementById('hud-radar-canvas');
    const waveEl = document.getElementById('hud-wave-canvas');
    initRadarCanvas(radarEl);
    initWaveCanvas(waveEl);

    // Wire Real-Time Digital Clock
    setInterval(() => {
      const clockEl = document.getElementById('hud-clock-time');
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString();
      }
    }, 1000);

    // Wire Throttle Slider & Presets
    const slider = document.getElementById('hud-reactor-slider');
    const reactorNum = document.getElementById('hud-reactor-num');
    const throttleLabel = document.getElementById('hud-throttle-label');
    const gaugeContainer = document.getElementById('gauge-reactor-container');

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        hudState.reactor = val;
        slider.style.setProperty('--fill', `${val}%`);
        if (reactorNum) reactorNum.textContent = val;
        if (throttleLabel) throttleLabel.textContent = val > 85 ? `OVERDRIVE (${val}%)` : val > 50 ? `CRUISE (${val}%)` : `ECO (${val}%)`;
        if (gaugeContainer) gaugeContainer.innerHTML = renderArcGaugeSVG(val, 120, val > 85 ? 'red' : 'cyan') + `
          <div class="font-hud-display text-glow-cyan" style="font-size: 20px; font-weight: 800; color: #ffffff; margin-top: -12px;">
            <span>${val}</span><span style="font-size: 11px; color: #22d3ee;">%</span>
          </div>
          <div class="font-hud-mono" style="font-size: 9.5px; color: rgba(34,211,238,0.7); letter-spacing: 0.16em;">OUTPUT · 3.1 GJ/s</div>
        `;
      });
    }

    // Throttle Preset Buttons
    document.querySelectorAll('[data-throttle]').forEach(btn => {
      btn.addEventListener('click', () => {
        beep(740, 0.05);
        const val = parseInt(btn.getAttribute('data-throttle'), 10);
        if (slider) {
          slider.value = val;
          slider.dispatchEvent(new Event('input'));
        }
        document.querySelectorAll('[data-throttle]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Wire Navigation Menu to Real MYRAA Modals & Views
    const navHolo = document.getElementById('hud-nav-holo');
    const navReactor = document.getElementById('hud-nav-reactor');
    const navTactical = document.getElementById('hud-nav-tactical');
    const navWorkforce = document.getElementById('hud-nav-workforce');
    const navSkills = document.getElementById('hud-nav-skills');
    const navWorkspace = document.getElementById('hud-nav-workspace');
    const navSettings = document.getElementById('hud-nav-settings');
    const navLivevoice = document.getElementById('hud-nav-livevoice');

    function setActiveNav(btn) {
      document.querySelectorAll('#myraa-hud-master nav button').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
    }

    if (navHolo) {
      navHolo.addEventListener('click', () => {
        beep(880, 0.05);
        setActiveNav(navHolo);
        // Focus center hologram companion
        const leftCol = document.getElementById('hud-left-col');
        const rightCol = document.getElementById('hud-right-col');
        if (leftCol && rightCol) {
          leftCol.classList.toggle('collapsed');
          rightCol.classList.toggle('collapsed');
        }
      });
    }

    if (navWorkforce) {
      navWorkforce.addEventListener('click', () => {
        beep(720, 0.05);
        setActiveNav(navWorkforce);
        // Trigger Workforce modal
        const modal = document.getElementById('modal-workforce');
        if (modal) modal.classList.add('active');
        else if (window.myraaOpenWorkforceModal) window.myraaOpenWorkforceModal();
      });
    }

    if (navSkills) {
      navSkills.addEventListener('click', () => {
        beep(660, 0.05);
        setActiveNav(navSkills);
        // Open skills catalog
        const modal = document.getElementById('modal-skills-catalog');
        if (modal) modal.classList.add('active');
        else if (window.myraaOpenSkillsCatalog) window.myraaOpenSkillsCatalog();
      });
    }

    if (navWorkspace) {
      navWorkspace.addEventListener('click', () => {
        beep(640, 0.05);
        setActiveNav(navWorkspace);
        // Trigger Project Launcher / App Studio
        window.dispatchEvent(new CustomEvent('OPEN_PROJECT_LAUNCHER'));
      });
    }

    if (navSettings) {
      navSettings.addEventListener('click', () => {
        beep(580, 0.05);
        setActiveNav(navSettings);
        // Trigger real Settings & Connectors
        window.dispatchEvent(new CustomEvent('OPEN_CONNECTORS_MANAGER'));
        const modal = document.getElementById('modal-plugins');
        if (modal) modal.classList.add('active');
      });
    }

    if (navLivevoice) {
      navLivevoice.addEventListener('click', () => {
        beep(920, 0.08);
        setActiveNav(navLivevoice);
        hudState.isListening = !hudState.isListening;
        if (window.myraaToggleVoice) window.myraaToggleVoice();
      });
    }

    // SFX Sound Toggle
    const soundBtn = document.getElementById('hud-toggle-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        sfxMuted = !sfxMuted;
        soundBtn.textContent = sfxMuted ? '🔇 MUTED' : '🔊 SFX';
        soundBtn.style.color = sfxMuted ? '#f43f5e' : '#a5f3fc';
        beep(440, 0.05);
      });
    }

    // Panels Layout Toggle (Full Cockpit vs Cinema Avatar)
    const layoutBtn = document.getElementById('hud-toggle-layout');
    if (layoutBtn) {
      layoutBtn.addEventListener('click', () => {
        beep(780, 0.05);
        const leftCol = document.getElementById('hud-left-col');
        const rightCol = document.getElementById('hud-right-col');
        if (leftCol && rightCol) {
          hudState.panelsCollapsed = !hudState.panelsCollapsed;
          leftCol.classList.toggle('collapsed', hudState.panelsCollapsed);
          rightCol.classList.toggle('collapsed', hudState.panelsCollapsed);
          layoutBtn.classList.toggle('active', hudState.panelsCollapsed);
        }
      });
    }

    // Chat Prompt Chips
    document.querySelectorAll('.hud-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        beep(800, 0.04);
        const q = chip.getAttribute('data-query');
        const input = document.getElementById('hud-chat-input');
        if (input) {
          input.value = q;
          const sendBtn = document.getElementById('hud-send-btn');
          if (sendBtn) sendBtn.click();
        }
      });
    });

    // Chat Send Button wired to real chat engine
    const sendBtn = document.getElementById('hud-send-btn');
    const chatInput = document.getElementById('hud-chat-input');
    function executeChat() {
      if (!chatInput) return;
      const text = chatInput.value.trim();
      if (!text) return;
      beep(880, 0.06);
      chatInput.value = '';

      // Broadcast to real MYRAA chat engine
      if (window.myraaSendMessage) {
        window.myraaSendMessage(text);
      } else {
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        }).catch(() => {});
      }
    }

    if (sendBtn) sendBtn.addEventListener('click', executeChat);
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeChat();
      });
    }

    // Protocol Buttons
    document.querySelectorAll('.hud-protocol-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        beep(600, 0.08);
        const p = btn.getAttribute('data-protocol');
        if (window.myraaToast) window.myraaToast(`Protocol ${p} executed. Telemetry nominal.`);
      });
    });

    console.log('[MYRAA HUD] Cyberpunk HUD Cockpit mounted successfully.');
  }

  // Mount on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountMyraaHUD);
  } else {
    mountMyraaHUD();
  }
})();
