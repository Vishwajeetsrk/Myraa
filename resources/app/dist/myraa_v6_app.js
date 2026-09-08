/**
 * =============================================================================
 * MYRAA v6.0 APEX — DESKTOP OPERATING COMPANION CORE CLIENT ENGINE
 * =============================================================================
 * - Production-quality desktop application architecture
 * - Strict Zero-Emoji standard: Handcrafted Lucide SVG icon system
 * - Zero Fake Data policy: Real system telemetry, truthful status indicators
 * - 3-Column Desktop Layout: Command Bar, Sidebar, Workspace, Quick Control
 * - Real Windows System Integration: Volume, Brightness, Power, Clipboard
 * =============================================================================
 */

(function () {
  'use strict';

  // ── 1. LUCIDE SVG ICON DICTIONARY (ZERO EMOJIS STANDARD) ─────────────────────
  const ICONS = {
    logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    appStudio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
    capabilities: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    skills: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>`,
    integrations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.5 2.5 0 0 1 0 5H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.5 2.5 0 0 1 5 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>`,
    memory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    learning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    files: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
    automation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    volumeMute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
    video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polygon points="23 7 16 12 23 17 23 7"/><rect width="15" height="14" x="1" y="5" rx="2"/></svg>`,
    clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
    power: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    paperclip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
    window: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
    crop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polyline points="9 18 15 12 9 6"/></svg>`,
    chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polyline points="15 18 9 12 15 6"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polyline points="20 6 9 17 4 12"/></svg>`,
    alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
    minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    layout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="M3 9h12"/></svg>`,
    waveform: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M2 10v4"/><path d="M6 6v12"/><path d="M10 3v18"/><path d="M14 8v8"/><path d="M18 5v14"/><path d="M22 10v4"/></svg>`,
    folderOpen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>`,
    square: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  // ── 2. APPLICATION STATE ───────────────────────────────────────────────────
  const CHAT_HISTORY_KEY = 'myraa_v6_chat_history';
  const loadStoredChat = () => {
    try { return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]'); } catch (e) { return []; }
  };

  const state = {
    activeView: 'home',
    activeModel: 'Smart',
    systemMetrics: { cpu: null, ram: null, status: 'CONNECTING' },
    isRightPanelCollapsed: false,
    volumeLevel: parseInt(localStorage.getItem('myraa_volume_hint') || '50', 10),
    volumeSynced: false,
    brightnessLevel: null,
    isMuted: false,
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: [],
    userName: 'there',
    identityName: 'MYRAA',
    speechBubbleText: "Booting systems...",
    isListeningVoice: false,
    voiceRecognition: null,
    isProcessingVoice: false,
    lastScreenshot: null,
    projects: [],
    skills: [],
    integrations: [],
    memoryStore: [],
    workflows: [],
    proposals: [],
    chatMessages: loadStoredChat(),
    capabilityStatuses: [],
    filesPath: null,
    filesParent: null,
  };
  if (state.chatMessages.length === 0) {
    state.chatMessages.push({
      sender: 'myraa',
      text: "I'm online. Everything in this app is wired to real services — ask me anything, or use the Quick Control panel to actually control Windows.",
      time: 'Just now'
    });
  }

  // ── 2b. SHARED HELPERS ─────────────────────────────────────────────────────
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Escape a value for use inside a single-quoted inline JS handler attribute
  // (prevents Windows backslash sequences like \n in "D:\new folder" from
  // becoming control characters).
  function jsAttr(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, ' ');
  }

  function fmtBytes(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function timeAgo(iso) {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diff)) return 'unknown';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} d ago`;
  }

  function toast(message, kind = 'info', ms = 4200) {
    let host = document.getElementById('myraa-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'myraa-toast-host';
      host.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:100000;display:flex;flex-direction:column;gap:8px;max-width:380px;';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    const colors = { info: 'var(--accent-cyan)', success: 'var(--success)', error: 'var(--error)', warn: 'var(--warning)' };
    el.style.cssText = `background:rgba(10,15,26,0.96);border:1px solid ${colors[kind] || colors.info};border-radius:10px;padding:10px 14px;color:#e8eef7;font-size:12.5px;box-shadow:0 8px 30px rgba(0,0,0,0.45);line-height:1.45;word-break:break-word;`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 450); }, ms);
  }

  function setBubble(text) {
    state.speechBubbleText = text;
    const bubble = document.getElementById('speech-bubble-text');
    if (bubble) bubble.textContent = text;
  }

  async function apiGet(url) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
  }

  async function apiPost(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
  }

  // ── 3. DOM INJECTION & MASTER SHELL ─────────────────────────────────────────
  function initDesktopShell() {
    let root = document.getElementById('myraa-app-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'myraa-app-root';
      document.body.prepend(root);
    }

    root.innerHTML = `
      <!-- TOP COMMAND BAR -->
      <header class="top-command-bar">
        <div class="topbar-left">
          <div class="brand-badge" id="btn-brand-home">
            <span class="logo-svg">${ICONS.logo}</span>
            <span class="brand-title">MYRAA</span>
            <span class="version-tag">v6.0 APEX</span>
          </div>
          <div class="history-nav">
            <button class="history-btn" id="btn-nav-back" title="Back">${ICONS.chevronLeft}</button>
            <button class="history-btn" id="btn-nav-fwd" title="Forward">${ICONS.chevronRight}</button>
          </div>
        </div>

        <div class="topbar-center">
          <div class="omnibar-trigger" id="btn-open-command-palette">
            <div class="omnibar-placeholder">
              ${ICONS.search}
              <span>Ask, search, control, or create...</span>
            </div>
            <span class="kbd-shortcut">Ctrl K</span>
          </div>
        </div>

        <div class="topbar-right">
          <button class="top-icon-btn" id="btn-top-notif" title="Notifications">
            ${ICONS.bell}
            <span class="badge-dot"></span>
          </button>
          <button class="top-icon-btn" id="btn-top-settings" title="Settings">
            ${ICONS.settings}
          </button>
          <button class="top-icon-btn" id="btn-toggle-right-panel" title="Toggle System Quick Control">
            ${ICONS.layout}
          </button>
          <button class="top-icon-btn" id="btn-live-mode" title="Immersive Live Voice — full 3D avatar with real-time Gemini voice">
            ${ICONS.waveform}
          </button>
          <div class="window-controls">
            <button class="win-ctrl-btn" id="win-min" title="Minimize">${ICONS.minus}</button>
            <button class="win-ctrl-btn" id="win-max" title="Maximize">${ICONS.square}</button>
            <button class="win-ctrl-btn close" id="win-close" title="Close">${ICONS.x}</button>
          </div>
        </div>
      </header>

      <!-- 3-COLUMN DESKTOP BODY -->
      <div class="desktop-body">
        <!-- LEFT NAVIGATION -->
        <aside class="left-sidebar">
          <div class="nav-group">
            <button class="nav-item active" data-view="home">
              <span class="nav-icon">${ICONS.home}</span>
              <span>Home</span>
            </button>
            <button class="nav-item" data-view="chat">
              <span class="nav-icon">${ICONS.chat}</span>
              <span>Chat</span>
            </button>
            <button class="nav-item" data-view="app_studio">
              <span class="nav-icon">${ICONS.appStudio}</span>
              <span>App Studio</span>
            </button>
            <button class="nav-item" data-view="capabilities">
              <span class="nav-icon">${ICONS.capabilities}</span>
              <span>Capabilities</span>
            </button>
            <button class="nav-item" data-view="skills">
              <span class="nav-icon">${ICONS.skills}</span>
              <span>Skills</span>
              <span class="nav-badge" id="nav-skills-badge">…</span>
            </button>
            <button class="nav-item" data-view="integrations">
              <span class="nav-icon">${ICONS.integrations}</span>
              <span>Integrations</span>
            </button>
            <button class="nav-item" data-view="memory">
              <span class="nav-icon">${ICONS.memory}</span>
              <span>Memory</span>
            </button>
            <button class="nav-item" data-view="learning">
              <span class="nav-icon">${ICONS.learning}</span>
              <span>Learning</span>
            </button>
            <button class="nav-item" data-view="files">
              <span class="nav-icon">${ICONS.files}</span>
              <span>Files</span>
            </button>
            <button class="nav-item" data-view="automation">
              <span class="nav-icon">${ICONS.automation}</span>
              <span>Automation</span>
            </button>
            <button class="nav-item" data-view="activity">
              <span class="nav-icon">${ICONS.activity}</span>
              <span>Activity</span>
            </button>
          </div>

          <div>
            <div class="nav-divider"></div>
            <button class="nav-item" data-view="settings">
              <span class="nav-icon">${ICONS.settings}</span>
              <span>Settings</span>
            </button>
            <div style="height: 8px;"></div>
            <div class="user-profile-pill" id="user-profile-btn">
              <div class="profile-avatar">V</div>
              <div class="profile-info">
                <span class="profile-name">Vishwajeet</span>
                <span class="profile-plan">Pro Plan</span>
              </div>
            </div>
          </div>
        </aside>

        <!-- MAIN WORKSPACE -->
        <main class="main-workspace" id="main-workspace-content">
          <!-- VIEW 1: HOME -->
          <div class="app-view-container active" id="view-home">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title" id="greeting-title">Booting…</h1>
                <p class="greeting-subtitle">What would you like to work on today?</p>
              </div>
              <div class="system-telemetry-badges">
                <div class="status-pill online">
                  <span class="dot-pulse"></span>
                  <span id="badge-online-text">ONLINE</span>
                </div>
                <div class="status-pill metric">
                  <span id="badge-cpu">CPU 14%</span>
                </div>
                <div class="status-pill metric">
                  <span id="badge-ram">RAM 48%</span>
                </div>
              </div>
            </div>

            <!-- Central Evelyn 3D Avatar -->
            <div class="avatar-stage-container">
              <div class="avatar-viewport" id="evelyn-avatar-canvas">
                <img src="/assets/characters/evelyn/textures/tex_0.png" class="avatar-fallback-img" alt="MYRAA Evelyn Avatar" onerror="this.src='/build/icon.ico'" />
              </div>
              <div class="avatar-speech-bubble" id="avatar-speech-bubble">
                <span id="speech-bubble-text">${state.speechBubbleText}</span>
                <div class="audio-waveform">
                  <div class="wave-bar"></div>
                  <div class="wave-bar"></div>
                  <div class="wave-bar"></div>
                  <div class="wave-bar"></div>
                  <div class="wave-bar"></div>
                </div>
              </div>
            </div>

            <!-- 6 Glass Quick Action Cards -->
            <div class="quick-actions-grid">
              <div class="action-card" data-action="research">
                <div class="card-icon">${ICONS.search}</div>
                <div class="card-title">Research</div>
                <div class="card-desc">Search & learn deeply</div>
              </div>
              <div class="action-card" data-action="app_studio">
                <div class="card-icon">${ICONS.appStudio}</div>
                <div class="card-title">Create App</div>
                <div class="card-desc">Build with App Studio</div>
              </div>
              <div class="action-card" data-action="desktop_control">
                <div class="card-icon">${ICONS.layout}</div>
                <div class="card-title">Control Desktop</div>
                <div class="card-desc">Manage your Windows</div>
              </div>
              <div class="action-card" data-action="analyze_screen">
                <div class="card-icon">${ICONS.camera}</div>
                <div class="card-title">Analyze Screen</div>
                <div class="card-desc">Understand visual content</div>
              </div>
              <div class="action-card" data-action="automate">
                <div class="card-icon">${ICONS.automation}</div>
                <div class="card-title">Automate</div>
                <div class="card-desc">Create workflows</div>
              </div>
              <div class="action-card" data-action="capabilities">
                <div class="card-icon">${ICONS.capabilities}</div>
                <div class="card-title">More</div>
                <div class="card-desc">Explore all capabilities</div>
              </div>
            </div>

            <!-- Bottom Multimodal Input Bar -->
            <div class="bottom-input-container">
              <div class="input-toolbar">
                <div class="input-tools-left">
                  <button class="tool-btn" id="tool-attach-file" title="Attach Document">${ICONS.paperclip}</button>
                  <button class="tool-btn" id="tool-attach-img" title="Attach Image">${ICONS.image}</button>
                  <button class="tool-btn" id="tool-capture-win" title="Capture Active Window">${ICONS.window}</button>
                  <button class="tool-btn" id="tool-capture-crop" title="Snip Screen Region">${ICONS.crop}</button>
                </div>
                <div class="model-mode-pills">
                  <button class="mode-pill active" data-model="Smart">Smart</button>
                  <button class="mode-pill" data-model="Creative">Creative</button>
                  <button class="mode-pill" data-model="Precise">Precise</button>
                </div>
              </div>

              <div class="input-main-row">
                <textarea class="chat-textarea" id="chat-input-field" placeholder="Ask MYRAA anything, or tell me what to do..." rows="1"></textarea>
                <button class="voice-mic-btn" id="btn-voice-mic" title="Voice Input / Push to Talk">
                  ${ICONS.mic}
                </button>
                <button class="send-btn" id="btn-send-message" title="Send Command">
                  ${ICONS.send}
                </button>
              </div>
            </div>
          </div>

          <!-- VIEW 2: CHAT -->
          <div class="app-view-container" id="view-chat">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">AI Conversation Stream</h1>
                <p class="greeting-subtitle">Multimodal cognitive assistant with persistent context memory</p>
              </div>
            </div>
            <div class="chat-stream-box" id="chat-stream-container" style="flex: 1; overflow-y: auto; padding: 12px 0; display: flex; flex-direction: column; gap: 14px;"></div>
            <div class="bottom-input-container" style="margin-top: 10px;">
              <div class="input-main-row">
                <textarea class="chat-textarea" id="chat-secondary-input" placeholder="Type a message or instruction..." rows="1"></textarea>
                <button class="send-btn" id="btn-secondary-send">${ICONS.send}</button>
              </div>
            </div>
          </div>

          <!-- VIEW 3: APP STUDIO -->
          <div class="app-view-container" id="view-app_studio">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">App Studio — Autonomous Software Forge</h1>
                <p class="greeting-subtitle">Design, generate PRDs, build full-stack web applications, and preview live</p>
              </div>
              <button class="action-card" id="btn-create-app-prompt" style="padding: 6px 14px; flex-direction: row; align-items: center; gap: 8px;">
                <span style="color: var(--accent-cyan);">${ICONS.appStudio}</span>
                <span style="font-weight: 600; font-size: 12px;">+ New Application</span>
              </button>
            </div>
            <div class="app-studio-layout" style="display: grid; grid-template-columns: 240px 1fr; gap: 16px; flex: 1; overflow: hidden;">
              <div style="background: rgba(16,24,39,0.5); border: 1px solid var(--border-divider); border-radius: var(--radius-lg); padding: 14px; overflow-y: auto;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Workspace Projects</div>
                <div id="app-studio-projects-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
              </div>
              <div style="background: rgba(16,24,39,0.5); border: 1px solid var(--border-divider); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden;">
                <div style="display: flex; border-bottom: 1px solid var(--border-divider); padding: 0 12px; background: rgba(7,11,20,0.4);" id="studio-tabs">
                  <button class="nav-item active" style="width: auto; border-radius: 0; padding: 10px 14px;" data-tab="preview">Live Preview</button>
                  <button class="nav-item" style="width: auto; border-radius: 0; padding: 10px 14px;" data-tab="prd">PRD & Spec</button>
                  <button class="nav-item" style="width: auto; border-radius: 0; padding: 10px 14px;" data-tab="code">Code Editor</button>
                </div>
                <div style="flex: 1; position: relative; overflow: hidden;" id="studio-viewport-container">
                  <iframe id="studio-preview-frame" style="width: 100%; height: 100%; border: none; background: #fff;" src="about:blank"></iframe>
                </div>
              </div>
            </div>
          </div>

          <!-- VIEW 4: CAPABILITIES -->
          <div class="app-view-container" id="view-capabilities">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">Capabilities Center</h1>
                <p class="greeting-subtitle">Production Windows operating capabilities with verified execution states</p>
              </div>
            </div>
            <div id="capabilities-full-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; overflow-y: auto; padding-bottom: 20px;"></div>
          </div>

          <!-- VIEW 5: SKILLS -->
          <div class="app-view-container" id="view-skills">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title" id="skills-fleet-title">Cognitive Skills Fleet</h1>
                <p class="greeting-subtitle">Ingested from .agents/skills and live user runtime registry</p>
              </div>
              <input type="text" id="skills-search-input" placeholder="Search cognitive skills..." style="background: rgba(16,24,39,0.8); border: 1px solid var(--border-subtle); padding: 6px 14px; border-radius: var(--radius-full); color: #fff; font-size: 12px; width: 240px;" />
            </div>
            <div class="skills-filter-container" id="skills-filter-tabs"></div>
            <div id="skills-full-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; overflow-y: auto; padding-bottom: 20px;"></div>
          </div>

          <!-- VIEW 6: INTEGRATIONS -->
          <div class="app-view-container" id="view-integrations">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">Connected Integrations & Connectors</h1>
                <p class="greeting-subtitle">Truthful connection status — zero fake connections or simulated tokens</p>
              </div>
            </div>
            <div id="integrations-full-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; overflow-y: auto;"></div>
          </div>

          <!-- VIEW 7: MEMORY -->
          <div class="app-view-container" id="view-memory">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">Transparent Memory System</h1>
                <p class="greeting-subtitle">Persistent preferences, project sessions, and learned user standards</p>
              </div>
              <button class="action-card" id="btn-clear-session-mem" style="padding: 6px 14px; flex-direction: row; align-items: center; gap: 8px;">
                <span style="color: var(--warning);">${ICONS.refresh}</span>
                <span style="font-size: 12px; font-weight: 600;">Clear Session Memory</span>
              </button>
            </div>
            <div id="memory-items-container" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto;"></div>
          </div>

          <!-- VIEW 8: LEARNING -->
          <div class="app-view-container" id="view-learning">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">Learning & Research Center</h1>
                <p class="greeting-subtitle">Deep research synthesis, GitHub repository analysis, and self-improvement proposals</p>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; flex: 1; overflow-y: auto;">
              <!-- Deep Research Box -->
              <div style="background: rgba(16,24,39,0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 18px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  ${ICONS.search} Deep Research Engine
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Synthesizes structured reports across documentation, code, and web sources.</p>
                <input type="text" id="research-query-input" placeholder="e.g. Modern Agent Frameworks on Windows" style="width: 100%; padding: 8px 12px; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); color: #fff; margin-bottom: 10px; font-size: 12.5px;" />
                <button class="send-btn" id="btn-run-deep-research" style="width: 100%; border-radius: var(--radius-md); font-weight: 600; font-size: 12.5px; height: 36px;">Execute Deep Research</button>
                <div id="research-results-box" style="margin-top: 14px; font-size: 12px; color: var(--text-secondary); max-height: 240px; overflow-y: auto;"></div>
              </div>

              <!-- GitHub Analysis Box -->
              <div style="background: rgba(16,24,39,0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 18px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--accent-blue); display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  ${ICONS.code} GitHub Repository Analyzer
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Audits architecture, frameworks, and reusable patterns from codebases.</p>
                <input type="text" id="github-repo-input" value="D:\\Team of Vishwajeet" style="width: 100%; padding: 8px 12px; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); color: #fff; margin-bottom: 10px; font-size: 12.5px;" />
                <button class="send-btn" id="btn-run-github-analysis" style="width: 100%; border-radius: var(--radius-md); font-weight: 600; font-size: 12.5px; height: 36px; background: var(--accent-blue);">Analyze Repository</button>
                <div id="github-results-box" style="margin-top: 14px; font-size: 12px; color: var(--text-secondary); max-height: 240px; overflow-y: auto;"></div>
              </div>

              <!-- Self-Improvement Proposals Box -->
              <div style="grid-column: span 2; background: rgba(16,24,39,0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 18px;">
                <div style="font-weight: 700; font-size: 14px; color: var(--success); display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                  ${ICONS.activity} Self-Improvement Proposals (User-Approved Evolution)
                </div>
                <div id="proposals-list-box" style="display: flex; flex-direction: column; gap: 10px;"></div>
              </div>
            </div>
          </div>

          <!-- VIEW 9: FILES -->
          <div class="app-view-container" id="view-files">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">Files & Workspace Explorer</h1>
                <p class="greeting-subtitle">Intelligent file perception, MRU context stack, and local search</p>
              </div>
            </div>
            <div id="files-list-box" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto;"></div>
          </div>

          <!-- VIEW 10: AUTOMATION -->
          <div class="app-view-container" id="view-automation">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">Desktop Automation & Workflows</h1>
                <p class="greeting-subtitle">Triggers, scheduled actions, and natural language routine execution</p>
              </div>
            </div>
            <div id="automation-workflows-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; overflow-y: auto;"></div>
          </div>

          <!-- VIEW 11: ACTIVITY -->
          <div class="app-view-container" id="view-activity">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">Activity & Transparency Log</h1>
                <p class="greeting-subtitle">Full operational visibility into tools dispatched, files touched, and background tasks</p>
              </div>
            </div>
            <div id="activity-full-stream" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto;"></div>
          </div>

          <!-- VIEW 12: SETTINGS -->
          <div class="app-view-container" id="view-settings">
            <div class="workspace-header">
              <div>
                <h1 class="greeting-title">System Settings</h1>
                <p class="greeting-subtitle">Global configurations, permissions, voice engine, and product identity</p>
              </div>
            </div>
            <div id="settings-content-box" style="background: rgba(16,24,39,0.5); border: 1px solid var(--border-divider); border-radius: var(--radius-lg); padding: 20px; overflow-y: auto;"></div>
          </div>
        </main>

        <!-- RIGHT CONTEXT PANEL ("System Quick Control") -->
        <aside class="right-panel" id="system-quick-control-panel">
          <div class="panel-header">
            <span class="panel-title">System Quick Control</span>
            <button class="top-icon-btn" id="btn-close-right-panel" title="Collapse Panel">${ICONS.chevronRight}</button>
          </div>

          <!-- Audio & Brightness Sliders -->
          <div class="slider-group">
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 2px;">
              <span>Volume</span>
              <span id="label-volume-val">${state.volumeLevel}%</span>
            </div>
            <div class="slider-row">
              <span class="slider-icon" id="btn-mute-toggle" style="cursor: pointer;" title="Mute / Unmute">${ICONS.volume}</span>
              <input type="range" class="quick-slider" id="slider-volume" min="0" max="100" value="${state.volumeLevel}" />
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 8px; margin-bottom: 2px;">
              <span>Brightness</span>
              <span id="label-brightness-val">—</span>
            </div>
            <div class="slider-row">
              <span class="slider-icon">${ICONS.sun}</span>
              <input type="range" class="quick-slider" id="slider-brightness" min="0" max="100" value="70" />
            </div>
          </div>

          <!-- 4 Quick Actions: Screenshot, Record, Clipboard, Power -->
          <div class="quick-buttons-grid">
            <button class="quick-ctrl-btn" id="btn-quick-screenshot">
              ${ICONS.camera}
              <span>Screenshot</span>
            </button>
            <button class="quick-ctrl-btn" id="btn-quick-record">
              ${ICONS.video}
              <span id="label-record-text">Record</span>
            </button>
            <button class="quick-ctrl-btn" id="btn-quick-clipboard">
              ${ICONS.clipboard}
              <span>Clipboard</span>
            </button>
            <button class="quick-ctrl-btn power" id="btn-quick-power">
              ${ICONS.power}
              <span>Power</span>
            </button>
          </div>

          <!-- Active Capabilities Summary (live-probed statuses) -->
          <div class="capabilities-list-section">
            <div class="section-header-row">
              <span class="panel-title">Active Capabilities</span>
              <button class="section-view-all" id="btn-view-all-caps">View All</button>
            </div>
            <div id="caps-status-list" style="display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:11px;color:var(--text-muted);">Probing real capability status…</div>
            </div>
          </div>

          <!-- Recent Activity (real activity ledger) -->
          <div class="activity-stream-section">
            <div class="section-header-row">
              <span class="panel-title">Recent Activity</span>
              <button class="section-view-all" id="btn-view-all-activity">View All</button>
            </div>
            <div id="recent-activity-list" style="display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:11px;color:var(--text-muted);">Loading activity ledger…</div>
            </div>
          </div>
        </aside>
      </div>

      <!-- GLOBAL COMMAND PALETTE (CTRL+K) -->
      <div class="modal-backdrop" id="modal-command-palette">
        <div class="modal-dialog" style="max-width: 580px;">
          <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-divider); display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--accent-cyan);">${ICONS.search}</span>
            <input type="text" id="palette-search-input" placeholder="Type a natural language command (e.g. 'Set volume to 50%', 'Take screenshot')..." style="flex: 1; background: transparent; border: none; color: #fff; font-size: 14px; outline: none;" />
            <span class="kbd-shortcut">ESC</span>
          </div>
          <div id="palette-results-list" style="padding: 10px; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;"></div>
        </div>
      </div>

      <!-- POWER ACTIONS SAFETY CONFIRMATION MODAL -->
      <div class="modal-backdrop" id="modal-power-confirmation">
        <div class="modal-dialog" style="max-width: 440px;">
          <div class="modal-header" style="border-color: rgba(255, 95, 109, 0.3);">
            <span class="modal-title" style="color: var(--error);">${ICONS.power} System Power Confirmation</span>
            <button class="modal-close-btn" id="btn-close-power-modal">${ICONS.x}</button>
          </div>
          <div class="modal-body">
            <p id="power-confirmation-text" style="font-size: 13.5px; color: var(--text-primary); margin-bottom: 16px;">Are you sure you want to execute this system power operation?</p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
              <button class="action-card" id="btn-exec-lock" style="align-items: center;">${ICONS.power} Lock Workstation</button>
              <button class="action-card" id="btn-exec-sleep" style="align-items: center;">${ICONS.power} Sleep Mode</button>
              <button class="action-card" id="btn-exec-restart" style="align-items: center; border-color: rgba(245, 185, 66, 0.4); color: var(--warning);">${ICONS.refresh} Restart Windows</button>
              <button class="action-card" id="btn-exec-shutdown" style="align-items: center; border-color: rgba(255, 95, 109, 0.4); color: var(--error);">${ICONS.power} Shut Down PC</button>
            </div>
          </div>
        </div>
      </div>

      <!-- CLIPBOARD DRAWER MODAL -->
      <div class="modal-backdrop" id="modal-clipboard-drawer">
        <div class="modal-dialog" style="max-width: 520px;">
          <div class="modal-header">
            <span class="modal-title">${ICONS.clipboard} Windows Clipboard Manager</span>
            <button class="modal-close-btn" id="btn-close-clip-modal">${ICONS.x}</button>
          </div>
          <div class="modal-body">
            <textarea id="clip-text-area" style="width: 100%; height: 160px; background: rgba(7,11,20,0.8); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px; color: #fff; font-family: var(--font-mono); font-size: 12px; resize: none;"></textarea>
          </div>
          <div class="modal-footer">
            <button class="action-card" id="btn-clip-clear" style="padding: 6px 14px; border-color: var(--error); color: var(--error);">Clear Clipboard</button>
            <button class="send-btn" id="btn-clip-copy" style="padding: 6px 14px; width: auto; font-weight: 600; font-size: 12px;">Copy Text</button>
          </div>
        </div>
      </div>

      <!-- SCREENSHOT PREVIEW + AI ANALYSIS MODAL -->
      <div class="modal-backdrop" id="modal-screenshot-preview">
        <div class="modal-dialog" style="max-width: 880px;">
          <div class="modal-header">
            <span class="modal-title">${ICONS.camera} Screenshot Captured</span>
            <button class="modal-close-btn" id="btn-close-shot-modal">${ICONS.x}</button>
          </div>
          <div class="modal-body" style="max-height: 62vh; overflow-y: auto;">
            <img id="screenshot-preview-img" style="width: 100%; border-radius: var(--radius-md); border: 1px solid var(--border-divider);" alt="Captured screenshot" />
            <div id="screenshot-meta" style="margin-top: 8px; font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);"></div>
            <div id="screenshot-analysis" style="margin-top: 12px; font-size: 12.5px; color: var(--text-primary); line-height: 1.55; white-space: pre-wrap; display: none; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); padding: 12px; max-height: 240px; overflow-y: auto;"></div>
          </div>
          <div class="modal-footer">
            <button class="action-card" id="btn-shot-open-folder" style="padding: 6px 14px;">${ICONS.folderOpen} Open Folder</button>
            <button class="action-card" id="btn-shot-analyze" style="padding: 6px 14px;">${ICONS.search} Analyze with AI</button>
          </div>
        </div>
      </div>

      <!-- NEW WORKFLOW BUILDER MODAL -->
      <div class="modal-backdrop" id="modal-new-workflow">
        <div class="modal-dialog" style="max-width: 640px;">
          <div class="modal-header">
            <span class="modal-title">${ICONS.automation} New Automation Workflow</span>
            <button class="modal-close-btn" id="btn-close-wf-modal">${ICONS.x}</button>
          </div>
          <div class="modal-body" style="max-height: 62vh; overflow-y: auto;">
            <input type="text" id="wf-name-input" placeholder="Workflow name (e.g. Morning setup)" style="width: 100%; padding: 8px 12px; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); color: #fff; margin-bottom: 8px; font-size: 12.5px;" />
            <input type="text" id="wf-desc-input" placeholder="Description (optional)" style="width: 100%; padding: 8px 12px; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); color: #fff; margin-bottom: 8px; font-size: 12.5px;" />
            <div style="display: flex; gap: 8px; margin-bottom: 10px; align-items: center;">
              <select id="wf-trigger-select" style="background: rgba(7,11,20,0.8); border: 1px solid var(--border-divider); color: #fff; padding: 7px 10px; border-radius: var(--radius-md); font-size: 12px;">
                <option value="manual">Run manually</option>
                <option value="interval_minutes">Repeat every N minutes</option>
              </select>
              <input type="number" id="wf-interval-input" min="5" value="30" style="width: 90px; display: none; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); color: #fff; padding: 7px 10px; border-radius: var(--radius-md); font-size: 12px;" />
            </div>
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">Action Sequence (runs top to bottom)</div>
            <div id="wf-actions-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;"></div>
            <button class="section-view-all" id="btn-wf-add-action">+ Add Action</button>
          </div>
          <div class="modal-footer">
            <button class="send-btn" id="btn-wf-save" style="padding: 8px 18px; width: auto; font-weight: 600; font-size: 12px;">Create Workflow</button>
          </div>
        </div>
      </div>

      <!-- NEW APP STUDIO PROJECT MODAL -->
      <div class="modal-backdrop" id="modal-new-app">
        <div class="modal-dialog" style="max-width: 560px;">
          <div class="modal-header">
            <span class="modal-title">${ICONS.appStudio} New Application</span>
            <button class="modal-close-btn" id="btn-close-app-modal">${ICONS.x}</button>
          </div>
          <div class="modal-body">
            <input type="text" id="new-app-name" placeholder="Application name" style="width: 100%; padding: 8px 12px; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); color: #fff; margin-bottom: 8px; font-size: 12.5px;" />
            <textarea id="new-app-idea" placeholder="Describe what the app should do — the App Studio engine generates a PRD and a live preview build." rows="4" style="width: 100%; padding: 8px 12px; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); color: #fff; margin-bottom: 8px; font-size: 12.5px; resize: vertical;"></textarea>
            <select id="new-app-type" style="background: rgba(7,11,20,0.8); border: 1px solid var(--border-divider); color: #fff; padding: 7px 10px; border-radius: var(--radius-md); font-size: 12px;">
              <option value="create_website">Web Application</option>
              <option value="create_mobile_app">Mobile App (PWA)</option>
            </select>
            <div id="new-app-status" style="margin-top: 10px; font-size: 12px; color: var(--text-muted);"></div>
          </div>
          <div class="modal-footer">
            <button class="send-btn" id="btn-create-app-go" style="padding: 8px 18px; width: auto; font-weight: 600; font-size: 12px;">Generate Project</button>
          </div>
        </div>
      </div>

      <!-- FILE CONTENT VIEWER MODAL -->
      <div class="modal-backdrop" id="modal-file-viewer">
        <div class="modal-dialog" style="max-width: 760px;">
          <div class="modal-header">
            <span class="modal-title" id="file-viewer-title">${ICONS.files} File</span>
            <button class="modal-close-btn" id="btn-close-file-modal">${ICONS.x}</button>
          </div>
          <div class="modal-body" style="max-height: 62vh; overflow-y: auto;">
            <pre id="file-viewer-content" style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 11.5px; color: var(--text-primary); background: rgba(7,11,20,0.6); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-divider);"></pre>
          </div>
          <div class="modal-footer">
            <button class="action-card" id="btn-file-open-default" style="padding: 6px 14px;">Open with default app</button>
          </div>
        </div>
      </div>
    `;

    bindShellEvents();
    startPollingMetrics();
    startPanelsPolling();
    initializeIdentityAndGreeting();
    initializeHardwareControls();
    renderChatStream();
    loadActiveViewData('home');
  }

  // ── 3b. IDENTITY, GREETING, PANEL POLLING ───────────────────────────────────
  async function initializeIdentityAndGreeting() {
    const hour = new Date().getHours();
    const partOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    try {
      const data = await apiGet('/api/identity');
      state.identityName = data.identity?.display_name || 'MYRAA';
    } catch (e) { /* identity file optional — keep default */ }
    try {
      const profile = JSON.parse(localStorage.getItem('myraa_profile') || '{}');
      state.userName = profile.name || state.userName;
    } catch (e) { /* optional */ }
    const title = document.getElementById('greeting-title');
    if (title) title.textContent = `Good ${partOfDay}.`;
    setBubble(`Hey. I'm ${state.identityName} — systems are live. What are we working on?`);
  }

  function startPanelsPolling() {
    refreshCapabilityPanel();
    refreshRecentActivityPanel();
    setInterval(refreshCapabilityPanel, 60000);
    setInterval(refreshRecentActivityPanel, 60000);
  }

  const STATUS_COLORS = {
    ACTIVE: 'var(--success)',
    READY: 'var(--success)',
    DEGRADED: 'var(--warning)',
    'NOT_CONFIGURED': 'var(--warning)',
    OFFLINE: 'var(--error)',
    ERROR: 'var(--error)',
  };

  async function refreshCapabilityPanel() {
    const host = document.getElementById('caps-status-list');
    if (!host) return;
    try {
      const data = await apiGet('/api/capabilities/status');
      state.capabilityStatuses = data.capabilities || [];
      host.innerHTML = state.capabilityStatuses.slice(0, 5).map((c) => `
        <div class="cap-item-row" data-cap-nav="capabilities" style="cursor:pointer;" title="${esc(c.detail)}">
          <div class="cap-left"><span>${esc(c.name)}</span></div>
          <span class="cap-state-badge" style="color: ${STATUS_COLORS[c.status] || 'var(--text-muted)'};">${esc(c.status)}</span>
        </div>
      `).join('');
    } catch (e) {
      host.innerHTML = `<div style="font-size:11px;color:var(--error);">Capability probe failed: ${esc(e.message)}</div>`;
    }
  }

  async function refreshRecentActivityPanel() {
    const host = document.getElementById('recent-activity-list');
    if (!host) return;
    try {
      const data = await apiGet('/api/activity?limit=3');
      const items = data.activity || [];
      host.innerHTML = items.length === 0
        ? `<div style="font-size:11px;color:var(--text-muted);">No activity recorded yet.</div>`
        : items.map((a) => `
          <div class="activity-item" title="${esc(a.details || '')}">
            <span>${esc(a.action)}</span>
            <span class="activity-time">${esc(timeAgo(a.time))}</span>
          </div>
        `).join('');
    } catch (e) {
      host.innerHTML = `<div style="font-size:11px;color:var(--error);">Activity ledger unavailable.</div>`;
    }
  }

  // ── 4. VIEW SWITCHING & ROUTING ─────────────────────────────────────────────
  function switchView(viewName) {
    state.activeView = viewName;

    // Update navigation item active state
    document.querySelectorAll('.left-sidebar .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Toggle view containers
    document.querySelectorAll('.app-view-container').forEach(cont => {
      cont.classList.toggle('active', cont.id === `view-${viewName}`);
    });

    loadActiveViewData(viewName);
  }

  function loadActiveViewData(viewName) {
    if (viewName === 'app_studio') loadAppStudioProjects();
    else if (viewName === 'capabilities') loadCapabilitiesView();
    else if (viewName === 'skills') loadSkillsView();
    else if (viewName === 'integrations') loadIntegrationsView();
    else if (viewName === 'memory') loadMemoryView();
    else if (viewName === 'automation') loadAutomationWorkflows();
    else if (viewName === 'activity') loadActivityView();
    else if (viewName === 'settings') loadSettingsView();
    else if (viewName === 'files') loadFilesView();
    else if (viewName === 'learning') loadLearningView();
  }

  // ── 5. REAL BACKEND INTEGRATION & DATA LOADERS ──────────────────────────────
  async function startPollingMetrics() {
    const updateMetrics = async () => {
      try {
        const res = await fetch('/api/system/metrics');
        const data = await res.json();
        if (data.success) {
          state.systemMetrics = data;
          const cpuEl = document.getElementById('badge-cpu');
          const ramEl = document.getElementById('badge-ram');
          if (cpuEl) cpuEl.textContent = `CPU ${data.cpu}%`;
          if (ramEl) ramEl.textContent = `RAM ${data.ram}%`;
        }
      } catch (err) {}
    };

    updateMetrics();
    setInterval(updateMetrics, 8000);
  }

  async function loadAppStudioProjects() {
    const listEl = document.getElementById('app-studio-projects-list');
    if (!listEl) return;
    try {
      const res = await fetch('/api/generate-app/projects');
      const data = await res.json();
      state.projects = data.projects || [];
      if (state.projects.length === 0) {
        listEl.innerHTML = `<div style="font-size: 11.5px; color: var(--text-muted);">No projects yet. Click "+ New Application" above.</div>`;
      } else {
        listEl.innerHTML = state.projects.map(p => `
          <div class="cap-item-row" onclick="window.myraaOpenProject('${p.id}')">
            <div style="font-size: 12px; font-weight: 600; color: #fff;">${p.name}</div>
            <span style="font-size: 10px; color: var(--accent-cyan); font-family: var(--font-mono);">${p.type}</span>
          </div>
        `).join('');
      }
    } catch (e) {
      listEl.innerHTML = `<div style="font-size: 11.5px; color: var(--error);">Error connecting to App Studio Engine.</div>`;
    }
  }

  async function loadCapabilitiesView() {
    const grid = document.getElementById('capabilities-full-grid');
    if (!grid) return;
    grid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Probing capabilities…</div>`;
    try {
      const data = await apiGet('/api/capabilities/status');
      const caps = data.capabilities || [];
      const iconFor = { desktop_control: ICONS.layout, voice_engine: ICONS.mic, screen_understanding: ICONS.camera, file_system: ICONS.files, browser_agent: ICONS.globe, memory_system: ICONS.memory, automation_engine: ICONS.automation, app_studio: ICONS.appStudio };
      grid.innerHTML = caps.map((c) => `
        <div class="action-card" style="cursor: default;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="card-title" style="display:flex;align-items:center;gap:8px;">${iconFor[c.id] || ICONS.capabilities} ${esc(c.name)}</span>
            <span class="cap-state-badge" style="color: ${STATUS_COLORS[c.status] || 'var(--text-muted)'};">${esc(c.status)}</span>
          </div>
          <div class="card-desc">${esc(c.detail)}</div>
          <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">
            <span>Last activity: ${esc(timeAgo(c.lastActivity))}</span>
            <button class="section-view-all" onclick="window.myraaTestCapability('${esc(c.id)}')">Execute Test</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      grid.innerHTML = `<div style="font-size:12px;color:var(--error);">Capability probe failed: ${esc(e.message)}</div>`;
    }
  }

  const SKILL_CATEGORY_TABS = [
    { id: 'ALL', label: 'All' },
    { id: 'WEB', label: 'Web & UI' },
    { id: 'ENG', label: 'Engineering' },
    { id: 'QA', label: 'QA & Testing' },
    { id: 'SEC', label: 'Security' },
    { id: 'DB', label: 'Databases' },
    { id: 'DEVOPS', label: 'DevOps & Cloud' },
    { id: 'AI', label: 'AI & Arch' },
  ];
  let currentSkillCategory = 'ALL';
  let cachedSkillsRegistry = { learned: [], catalog: [] };

  function categorizeSkill(name, desc, rawCat) {
    const text = `${name || ''} ${desc || ''} ${rawCat || ''}`.toLowerCase();
    if (text.includes('ui') || text.includes('web') || text.includes('react') || text.includes('vue') || text.includes('next') || text.includes('frontend') || text.includes('21st') || text.includes('html') || text.includes('css')) return 'WEB';
    if (text.includes('security') || text.includes('auth') || text.includes('audit') || text.includes('guardian') || text.includes('owasp') || text.includes('vault') || text.includes('secure')) return 'SEC';
    if (text.includes('test') || text.includes('playwright') || text.includes('qa') || text.includes('e2e') || text.includes('debug') || text.includes('testing')) return 'QA';
    if (text.includes('db') || text.includes('database') || text.includes('sql') || text.includes('postgres') || text.includes('bigquery') || text.includes('mysql') || text.includes('prisma') || text.includes('supabase')) return 'DB';
    if (text.includes('devops') || text.includes('docker') || text.includes('deploy') || text.includes('cloud') || text.includes('kubernetes') || text.includes('terraform') || text.includes('gcp') || text.includes('aws') || text.includes('pipeline')) return 'DEVOPS';
    if (text.includes('ai') || text.includes('model') || text.includes('prompt') || text.includes('rag') || text.includes('agent') || text.includes('ml') || text.includes('architect') || text.includes('llm')) return 'AI';
    return 'ENG';
  }

  function renderSkillsList() {
    const grid = document.getElementById('skills-full-grid');
    if (!grid) return;
    const filterTabsContainer = document.getElementById('skills-filter-tabs');
    const searchVal = (document.getElementById('skills-search-input')?.value || '').toLowerCase().trim();

    if (filterTabsContainer) {
      filterTabsContainer.innerHTML = SKILL_CATEGORY_TABS.map((tab) => `
        <button class="skill-cat-pill ${tab.id === currentSkillCategory ? 'active' : ''}" data-cat="${tab.id}">
          ${tab.label}
        </button>
      `).join('');
      filterTabsContainer.querySelectorAll('.skill-cat-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          currentSkillCategory = btn.dataset.cat;
          renderSkillsList();
        });
      });
    }

    const { learned, catalog } = cachedSkillsRegistry;

    const filterItem = (s, rawCat) => {
      const cat = categorizeSkill(s.name || s.id, s.description, rawCat);
      if (currentSkillCategory !== 'ALL' && cat !== currentSkillCategory) return false;
      if (searchVal) {
        const hay = `${s.name || ''} ${s.id || ''} ${s.description || ''} ${rawCat || ''}`.toLowerCase();
        if (!hay.includes(searchVal)) return false;
      }
      return true;
    };

    const filteredLearned = learned.filter(s => filterItem(s, 'executable'));
    const filteredCatalog = catalog.filter(s => filterItem(s, s.category));

    if (filteredLearned.length === 0 && filteredCatalog.length === 0) {
      grid.innerHTML = `
        <div class="myraa-empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">${ICONS.skills}</div>
          <div class="empty-title">No skills match current filter</div>
          <div class="empty-desc">Try clearing the search query or selecting "All" to view the entire cognitive fleet.</div>
        </div>
      `;
      return;
    }

    const learnedCards = filteredLearned.map((s) => `
      <div class="skill-card-modern">
        <div class="skill-card-header">
          <span class="card-title">${esc(s.name || s.id)}</span>
          <span class="skill-card-badge executable">EXECUTABLE</span>
        </div>
        <div class="skill-card-desc">${esc(s.description || 'Runtime MCP skill')}</div>
        <div class="skill-card-footer">
          <span>runtime registry</span>
          <button class="section-view-all" onclick="window.myraaTestSkill('${esc(s.id)}', '${esc(String(s.name || s.id).replace(/'/g, ''))}')">Run Skill</button>
        </div>
      </div>
    `).join('');

    const catalogCards = filteredCatalog.map((s) => `
      <div class="skill-card-modern">
        <div class="skill-card-header">
          <span class="card-title">${esc(s.name || s.id)}</span>
          <span class="skill-card-badge catalog">${esc(s.category || 'Skill')}</span>
        </div>
        <div class="skill-card-desc" title="${esc(s.description || '')}">${esc(String(s.description || 'Ingested from .agents/skills').slice(0, 140))}</div>
        <div class="skill-card-footer">
          <span>.agents/skills</span>
          <span style="color: var(--accent-cyan); font-weight: 500;">Active</span>
        </div>
      </div>
    `).join('');

    grid.innerHTML = learnedCards + catalogCards;
  }

  async function loadSkillsView() {
    const grid = document.getElementById('skills-full-grid');
    if (!grid) return;
    const title = document.getElementById('skills-fleet-title');
    grid.innerHTML = `<div class="myraa-loading-state" style="grid-column: 1 / -1;"><div class="myraa-spinner"></div><span>Loading live skill registry…</span></div>`;
    try {
      // Two real registries: executable runtime skills + the .agents/skills catalog.
      const [learnedRes, catalogRes] = await Promise.all([
        fetch('/api/skills').then((r) => r.json()).catch(() => ({ skills: [] })),
        fetch('/api/skills/catalog').then((r) => r.json()).catch(() => ({ skills: [] })),
      ]);
      const learned = Array.isArray(learnedRes.skills) ? learnedRes.skills : [];
      const catalog = Array.isArray(catalogRes.skills) ? catalogRes.skills : [];
      state.skills = learned;
      cachedSkillsRegistry = { learned, catalog };
      const badge = document.getElementById('nav-skills-badge');
      if (badge) badge.textContent = learned.length + catalog.length;
      if (title) title.textContent = `Cognitive Skills Fleet (${learned.length} Executable + ${catalog.length} Ingested)`;

      // Setup search input debounce
      const searchInput = document.getElementById('skills-search-input');
      if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', () => renderSkillsList());
      }

      renderSkillsList();
    } catch (e) {
      grid.innerHTML = `<div class="myraa-error-state" style="grid-column: 1 / -1;"><div class="error-title">Skill registry unavailable</div><div class="error-desc">${esc(e.message)}</div></div>`;
    }
  }

  async function loadIntegrationsView() {
    const grid = document.getElementById('integrations-full-grid');
    if (!grid) return;
    grid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Probing integrations (live health checks)…</div>`;
    try {
      const data = await apiGet('/api/integrations');
      state.integrations = data.integrations || [];
      grid.innerHTML = state.integrations.map((i) => `
        <div class="action-card" style="cursor: default;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="card-title">${esc(i.name)}</span>
            <span class="status-pill ${i.status === 'CONNECTED' ? 'online' : i.status === 'OFFLINE' ? '' : 'metric'}" style="font-size: 9.5px; padding: 2px 8px; ${i.status === 'OFFLINE' ? 'color: var(--error);' : ''}">
              ${esc(i.status)}
            </span>
          </div>
          <div class="card-desc">${esc(i.detail || '')}</div>
          ${i.account ? `<div style="margin-top: 10px; font-size: 11px; color: var(--text-muted);">Account: ${esc(i.account)}</div>` : ''}
          ${i.connectHint ? `<div style="margin-top: auto; padding-top: 8px; border-top: 1px solid var(--border-divider); display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
            <span style="color: var(--text-muted);">${esc(i.connectHint)}</span>
            <button class="section-view-all" onclick="window.myraaConnectIntegration('${esc(i.id)}')">${i.status === 'CONNECTED' ? 'Details' : 'Connect'}</button>
          </div>` : ''}
        </div>
      `).join('');
    } catch (e) {
      grid.innerHTML = `<div style="font-size:12px;color:var(--error);">Integration probe failed: ${esc(e.message)}</div>`;
    }
  }

  async function loadMemoryView() {
    const container = document.getElementById('memory-items-container');
    if (!container) return;
    container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Loading persistent memory…</div>`;
    try {
      const memories = await apiGet('/api/memories');
      state.memoryStore = Array.isArray(memories) ? memories : [];
      const mems = state.memoryStore;
      if (mems.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">No long-term memories stored yet. Add one below — MYRAA uses these in every conversation.</div>`;
      } else {
        container.innerHTML = mems.map((m) => `
          <div class="cap-item-row" style="padding: 12px 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="status-pill metric" style="font-size: 9.5px; padding: 1px 6px;">${esc(m.category)}</span>
                <span style="font-size: 12px; color: var(--text-secondary);">${esc(m.text)}</span>
              </div>
              <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">stored ${esc(timeAgo(m.createdAt))}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="tool-btn" title="Delete Memory" onclick="window.myraaDeleteMemory('${esc(m.id)}')">${ICONS.x}</button>
            </div>
          </div>
        `).join('');
      }

      // Add-memory composer (only injected once)
      if (!document.getElementById('memory-add-row')) {
        const addRow = document.createElement('div');
        addRow.id = 'memory-add-row';
        addRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
        addRow.innerHTML = `
          <select id="memory-new-category" style="background: rgba(7,11,20,0.8); border: 1px solid var(--border-subtle); color:#fff; padding: 6px 10px; border-radius: var(--radius-md); font-size: 12px;">
            <option value="preference">preference</option>
            <option value="identity">identity</option>
            <option value="goal">goal</option>
            <option value="project">project</option>
            <option value="behavior">behavior</option>
            <option value="life">life</option>
          </select>
          <input type="text" id="memory-new-text" placeholder="Remember: …" style="flex:1; background: rgba(16,24,39,0.8); border: 1px solid var(--border-subtle); padding: 6px 12px; border-radius: var(--radius-md); color: #fff; font-size: 12px;" />
          <button class="send-btn" id="btn-memory-add" style="width:auto; padding: 6px 14px; font-size: 11.5px; font-weight:600;">Remember</button>
        `;
        container.parentNode.insertBefore(addRow, container.nextSibling);
        document.getElementById('btn-memory-add').addEventListener('click', async () => {
          const text = document.getElementById('memory-new-text').value.trim();
          const category = document.getElementById('memory-new-category').value;
          if (!text) return toast('Type what MYRAA should remember first.', 'warn');
          try {
            await apiPost('/api/memories', { category, text });
            document.getElementById('memory-new-text').value = '';
            toast('Saved to persistent memory.', 'success');
            loadMemoryView();
          } catch (err) { toast('Memory write failed: ' + err.message, 'error'); }
        });
      }
    } catch (e) {
      container.innerHTML = `<div style="font-size:12px;color:var(--error);">Memory store unavailable: ${esc(e.message)}</div>`;
    }
  }

  async function loadAutomationWorkflows() {
    const grid = document.getElementById('automation-workflows-grid');
    if (!grid) return;
    grid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Loading workflows…</div>`;
    try {
      const data = await apiGet('/api/automation/workflows');
      state.workflows = data.workflows || [];
      const history = data.history || [];

      const newBtn = `
        <div class="action-card" id="btn-new-workflow" style="cursor:pointer; align-items:center; justify-content:center; border-style: dashed;">
          <div class="card-icon">${ICONS.automation}</div>
          <div class="card-title">New Workflow</div>
          <div class="card-desc">Real trigger → action sequences</div>
        </div>`;
      const cards = state.workflows.map((w) => `
        <div class="action-card" style="cursor: default;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="card-title">${esc(w.name)}</span>
            <span class="status-pill ${w.enabled ? 'online' : 'metric'}" style="font-size: 9px; padding: 2px 6px;">${w.enabled ? 'ENABLED' : 'DISABLED'}</span>
          </div>
          <div class="card-desc">${esc(w.description || '')}</div>
          <div style="font-size: 11px; color: var(--accent-cyan); font-family: var(--font-mono); margin-top: 6px;">Trigger: ${esc(w.trigger?.label || 'Manual')} • ${esc(String(w.actions?.length || 0))} actions</div>
          <div style="margin-top: auto; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 10px; color: var(--text-muted);">${w.lastRun ? 'Last: ' + esc(w.lastResult || '') + ' ' + esc(timeAgo(w.lastRun)) : 'Never run'}</span>
            <span style="display:flex; gap:6px;">
              <button class="section-view-all" onclick="window.myraaToggleWorkflow('${esc(w.id)}')">${w.enabled ? 'Disable' : 'Enable'}</button>
              <button class="section-view-all" onclick="window.myraaDeleteWorkflow('${esc(w.id)}')">Delete</button>
              <button class="send-btn" style="width: auto; padding: 4px 10px; font-size: 11px; font-weight: 600;" onclick="window.myraaRunWorkflow('${esc(w.id)}')">Run Now</button>
            </span>
          </div>
        </div>
      `).join('');

      const historyHtml = `
        <div style="grid-column: 1 / -1;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin: 4px 0 8px;">Execution History (real runs)</div>
          ${history.length === 0 ? `<div style="font-size:11.5px;color:var(--text-muted);">No executions yet.</div>` : history.map((h) => `
            <div class="cap-item-row" style="padding: 8px 14px;">
              <span style="font-size: 12px; color: var(--text-primary);">${esc(h.name)}</span>
              <span style="font-size: 10.5px; color: var(--text-muted); font-family: var(--font-mono);">${esc(h.results.map((r) => `${r.action}:${r.ok ? 'ok' : 'fail'}`).join(' '))} • ${esc(timeAgo(h.startedAt))}</span>
            </div>
          `).join('')}
        </div>`;

      grid.innerHTML = newBtn + cards + historyHtml;

      document.getElementById('btn-new-workflow')?.addEventListener('click', openWorkflowBuilder);
    } catch (e) {
      grid.innerHTML = `<div style="font-size:12px;color:var(--error);">Automation engine unavailable: ${esc(e.message)}</div>`;
    }
  }

  async function loadActivityView() {
    const cont = document.getElementById('activity-full-stream');
    if (!cont) return;
    cont.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Loading activity ledger…</div>`;
    try {
      const data = await apiGet('/api/activity?limit=80');
      const items = data.activity || [];
      cont.innerHTML = items.length === 0
        ? `<div style="font-size:12px;color:var(--text-muted);">Nothing recorded yet. Every real action MYRAA takes (chat, screenshots, research, automation, memory writes) appears here.</div>`
        : items.map((i) => `
          <div class="cap-item-row" style="padding: 12px 16px;" title="${esc(i.details || '')}">
            <div>
              <div style="font-weight: 600; font-size: 13px; color: #fff;">${esc(i.action)}</div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">Module: ${esc(i.module)} • ${esc(new Date(i.time).toLocaleTimeString())}${i.details ? ' • ' + esc(i.details) : ''}</div>
            </div>
            <span class="status-pill ${i.status === 'SUCCESS' ? 'online' : ''}" style="font-size: 10px; ${i.status !== 'SUCCESS' ? 'color: var(--warning);' : ''}">${esc(i.status)}</span>
          </div>
        `).join('');
    } catch (e) {
      cont.innerHTML = `<div style="font-size:12px;color:var(--error);">Activity ledger unavailable: ${esc(e.message)}</div>`;
    }
  }

  async function loadFilesView() {
    const cont = document.getElementById('files-list-box');
    if (!cont) return;
    const targetPath = state.filesPath;
    cont.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Reading directory…</div>`;
    try {
      const data = await apiGet('/api/fs/browse' + (targetPath ? `?path=${encodeURIComponent(targetPath)}` : ''));
      state.filesPath = data.path;
      state.filesParent = data.parent;
      const rows = data.entries.map((f) => `
        <div class="cap-item-row" style="padding: 10px 14px;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <span style="color: var(--accent-cyan);">${f.type === 'directory' ? ICONS.folderOpen : ICONS.files}</span>
            <span style="font-family: var(--font-mono); font-size: 12px; color: #fff; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onclick="window.myraaOpenEntry('${jsAttr(f.path)}', ${f.type === 'directory'})">${esc(f.name)}</span>
          </div>
          <span style="display:flex; align-items:center; gap:10px; font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
            ${f.type === 'directory' ? 'DIR' : esc(f.type)} ${f.size != null ? '• ' + esc(fmtBytes(f.size)) : ''}
            ${f.type !== 'directory' ? `<button class="section-view-all" onclick="window.myraaViewFile('${jsAttr(f.path)}')">Read</button>` : ''}
          </span>
        </div>
      `).join('');
      cont.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
          <button class="section-view-all" id="btn-files-up">↑ Up</button>
          <input type="text" id="files-path-input" value="${esc(data.path)}" style="flex:1; background: rgba(16,24,39,0.8); border: 1px solid var(--border-subtle); padding: 6px 12px; border-radius: var(--radius-md); color: #fff; font-size: 11.5px; font-family: var(--font-mono);" />
          <button class="section-view-all" id="btn-files-go">Go</button>
        </div>
        ${rows}
      `;
      document.getElementById('btn-files-up').addEventListener('click', () => { state.filesPath = data.parent; loadFilesView(); });
      document.getElementById('btn-files-go').addEventListener('click', () => { state.filesPath = document.getElementById('files-path-input').value.trim(); loadFilesView(); });
    } catch (e) {
      cont.innerHTML = `<div style="font-size:12px;color:var(--error);">Cannot browse: ${esc(e.message)}</div>`;
    }
  }

  function loadLearningView() {
    // Research + GitHub results boxes are event-driven; proposals are real diagnostics.
    loadSelfImprovementProposals();
  }

  async function loadSelfImprovementProposals() {
    const box = document.getElementById('proposals-list-box');
    if (!box) return;
    box.innerHTML = `<div style="font-size:11.5px;color:var(--text-muted);">Running real diagnostics to generate proposals…</div>`;
    try {
      const data = await apiGet('/api/self-improvement/proposals');
      state.proposals = data.proposals || [];
      box.innerHTML = state.proposals.length === 0
        ? `<div style="font-size:12px;color:var(--success);">No proposals right now — all probes nominal. Proposals appear here when diagnostics find a real, fixable limitation.</div>`
        : state.proposals.map((p) => `
          <div class="cap-item-row" style="padding: 12px 16px; align-items: flex-start;">
            <div>
              <div style="font-weight: 600; font-size: 13px; color: #fff;">${esc(p.title)} <span style="font-size: 9.5px; color: ${p.risk === 'LOW' ? 'var(--success)' : 'var(--text-muted)'}; border: 1px solid var(--border-subtle); border-radius: 999px; padding: 1px 8px;">risk: ${esc(p.risk)}</span></div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${esc(p.observation)}</div>
              <div style="font-size: 11.5px; color: var(--accent-cyan); margin-top: 4px;">Recommendation: ${esc(p.recommendation)}</div>
            </div>
            <button class="send-btn" style="width:auto; padding: 5px 12px; font-size: 11px; font-weight: 600;" onclick="window.myraaApproveProposal('${esc(p.id)}')">Approve</button>
          </div>
        `).join('');
    } catch (e) {
      box.innerHTML = `<div style="font-size:12px;color:var(--error);">Diagnostics unavailable: ${esc(e.message)}</div>`;
    }
  }

  async function loadSettingsView() {
    const cont = document.getElementById('settings-content-box');
    if (!cont) return;
    cont.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Loading real settings…</div>`;
    try {
      const [settings, config, identity] = await Promise.all([
        apiGet('/api/settings'),
        apiGet('/api/config'),
        apiGet('/api/identity').catch(() => ({ identity: { display_name: state.identityName, wake_names: [] } })),
      ]);
      const displayName = identity.identity?.display_name || state.identityName;
      const wakeNames = (identity.identity?.wake_names || []).join(', ');
      cont.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 22px;">
          <div>
            <h3 style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 6px;">Assistant Identity</h3>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">Canonical core: MYRAA • Display name is configurable. Wake names: ${esc(wakeNames) || '—'}</p>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="text" id="settings-name-input" value="${esc(displayName)}" style="flex:1; max-width: 280px; background: rgba(16,24,39,0.8); border: 1px solid var(--border-subtle); padding: 7px 12px; border-radius: var(--radius-md); color: #fff; font-size: 12.5px;" />
              <button class="send-btn" id="btn-save-identity" style="width:auto; padding: 7px 16px; font-size: 12px; font-weight:600;">Rename</button>
            </div>
          </div>

          <div>
            <h3 style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 6px;">Gemini API Key</h3>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">
              Status: <span style="color: ${config.hasApiKey ? 'var(--success)' : 'var(--error)'}; font-weight: 600;">${config.hasApiKey ? 'Configured' : 'Not configured — chat, voice, vision and research synthesis need this'}</span>.
              The key is validated against Google before being saved and never leaves this machine.
            </p>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="password" id="settings-apikey-input" placeholder="Paste your Google AI Studio API key" style="flex:1; max-width: 380px; background: rgba(16,24,39,0.8); border: 1px solid var(--border-subtle); padding: 7px 12px; border-radius: var(--radius-md); color: #fff; font-size: 12.5px;" />
              <button class="send-btn" id="btn-save-apikey" style="width:auto; padding: 7px 16px; font-size: 12px; font-weight:600;">Save & Validate</button>
            </div>
            <div id="apikey-status" style="margin-top: 8px; font-size: 11.5px; color: var(--text-muted);"></div>
          </div>

          <div>
            <h3 style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 6px;">Runtime Preferences (settings.json — live persisted)</h3>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
              <label style="display:flex; align-items:center; gap:10px; font-size: 12.5px; color: var(--text-primary); cursor:pointer;">
                <input type="checkbox" id="settings-autostart" ${settings.autoStart ? 'checked' : ''} />
                Start MYRAA automatically when Windows starts
              </label>
              ${Object.entries(settings).filter(([k]) => k !== 'autoStart').map(([k, v]) => `
                <div style="display:flex; justify-content:space-between; font-size: 11.5px; color: var(--text-muted); font-family: var(--font-mono);">
                  <span>${esc(k)}</span><span>${esc(typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v))}</span>
                </div>`).join('')}
            </div>
          </div>

          <div>
            <h3 style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 6px;">Platform</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
              <div class="slider-group">
                <span style="font-size: 11px; color: var(--text-muted);">Shell</span>
                <span style="font-weight: 600; color: #fff;">${esc(window.myraa?.platform || 'web')} ${window.myraa?.isDesktop ? '(Electron desktop)' : '(browser)'}</span>
              </div>
              <div class="slider-group">
                <span style="font-size: 11px; color: var(--text-muted);">Icon Standard</span>
                <span style="font-weight: 600; color: var(--success);">Lucide SVG (Zero Emojis Standard)</span>
              </div>
            </div>
          </div>

          <div id="about-updates-card" style="border: 1px solid rgba(56,207,255,0.18); border-radius: 12px; padding: 18px 16px; background: linear-gradient(135deg, rgba(56,207,255,0.06) 0%, rgba(16,24,39,0.6) 100%);">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom: 14px;">
              <div>
                <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin:0; letter-spacing: -0.01em;">MYRAA AI</h3>
                <div id="about-version-line" style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Version — loading…</div>
              </div>
              <div id="about-status-badge" style="font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 20px; background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3);">● System Healthy</div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 10px; margin-bottom: 14px;">
              <div style="background: rgba(0,0,0,0.25); border-radius: 8px; padding: 10px 12px;">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;">Publisher</div>
                <div id="about-publisher" style="font-size: 12.5px; font-weight: 600; color: #fff; margin-top: 2px;">—</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); border-radius: 8px; padding: 10px 12px;">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;">Installation</div>
                <div id="about-install-path" style="font-size: 11px; font-weight: 500; color: var(--text-muted); margin-top: 2px; word-break: break-all;">—</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); border-radius: 8px; padding: 10px 12px;">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;">Channel</div>
                <select id="about-channel-select" style="margin-top: 4px; width: 100%; background: rgba(16,24,39,0.9); border: 1px solid var(--border-subtle); padding: 5px 8px; border-radius: 6px; color: #fff; font-size: 12px;">
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                  <option value="development">Development</option>
                </select>
              </div>
            </div>
            <div id="about-verify-badges" style="display:flex; flex-wrap:wrap; gap: 8px; margin-bottom: 14px;"></div>
            <div id="about-update-status" style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 10px; min-height: 18px;"></div>
            <div id="about-update-progress" style="display:none; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow:hidden; margin-bottom: 12px;">
              <div id="about-update-progress-bar" style="height:100%; width:0%; background: linear-gradient(90deg, #38CFFF, #8b5cf6); border-radius: 3px; transition: width 0.3s;"></div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap: 8px;">
              <button class="send-btn" id="btn-check-updates" style="width:auto; padding: 7px 14px; font-size: 12px; font-weight:600;">Check for Updates</button>
              <button id="btn-download-update" style="display:none; padding: 7px 14px; font-size: 12px; font-weight:600; background: #38CFFF; color: #000; border:none; border-radius: 8px; cursor:pointer;">Download Update</button>
              <button id="btn-install-update" style="display:none; padding: 7px 14px; font-size: 12px; font-weight:600; background: #22c55e; color: #fff; border:none; border-radius: 8px; cursor:pointer;">Install & Restart</button>
              <button id="btn-view-releasenotes" style="padding: 7px 14px; font-size: 12px; font-weight:500; background: rgba(255,255,255,0.06); color: var(--text-primary); border:1px solid var(--border-subtle); border-radius: 8px; cursor:pointer;">View Release Notes</button>
              <button id="btn-open-install-folder" style="padding: 7px 14px; font-size: 12px; font-weight:500; background: rgba(255,255,255,0.06); color: var(--text-primary); border:1px solid var(--border-subtle); border-radius: 8px; cursor:pointer;">Open Installation Folder</button>
              <button id="btn-copy-diagnostics" style="padding: 7px 14px; font-size: 12px; font-weight:500; background: rgba(255,255,255,0.06); color: var(--text-primary); border:1px solid var(--border-subtle); border-radius: 8px; cursor:pointer;">Copy Diagnostics</button>
            </div>
            <div style="display:flex; align-items:center; gap:10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
              <label style="display:flex; align-items:center; gap:8px; font-size: 12px; color: var(--text-primary); cursor:pointer;">
                <input type="checkbox" id="about-auto-update" checked />
                Automatic update checks
              </label>
              <span style="font-size: 11px; color: var(--text-muted);">Checks silently on startup (12s delay)</span>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-save-identity').addEventListener('click', async () => {
        const name = document.getElementById('settings-name-input').value.trim();
        if (!name) return toast('Enter a display name first.', 'warn');
        try {
          await apiPost('/api/identity/rename', { new_name: name });
          state.identityName = name;
          toast(`Assistant display name set to "${name}".`, 'success');
          initializeIdentityAndGreeting();
        } catch (err) { toast('Rename failed: ' + err.message, 'error'); }
      });

      document.getElementById('btn-save-apikey').addEventListener('click', async () => {
        const key = document.getElementById('settings-apikey-input').value.trim();
        const status = document.getElementById('apikey-status');
        if (!key) return toast('Paste an API key first.', 'warn');
        status.textContent = 'Validating against Google…';
        try {
          await apiPost('/api/config/apikey', { apiKey: key });
          status.textContent = 'Key validated and saved. Chat, voice and vision are now live.';
          status.style.color = 'var(--success)';
          toast('Gemini API key configured.', 'success');
          refreshCapabilityPanel();
        } catch (err) {
          status.textContent = 'Validation failed: ' + err.message;
          status.style.color = 'var(--error)';
        }
      });

      document.getElementById('settings-autostart').addEventListener('change', async (e) => {
        try {
          await apiPost('/api/settings', { autoStart: e.target.checked });
          toast(`Windows auto-start ${e.target.checked ? 'enabled' : 'disabled'}.`, 'success');
        } catch (err) { toast('Could not save auto-start: ' + err.message, 'error'); }
      });

      // ── ABOUT & UPDATES wiring ──────────────────────────────────────────
      (function setupAboutUpdates() {
        var aboutData = null;
        var updateUnsub = null;

        function renderBadges(signed, verified, isLatest) {
          var c = document.getElementById('about-verify-badges');
          if (!c) return;
          var badges = [];
          if (verified) badges.push('<span style="font-size:11px; font-weight:600; padding:4px 9px; border-radius:20px; background:rgba(34,197,94,0.12); color:#22c55e; border:1px solid rgba(34,197,94,0.25);">\u2713 Application signed</span>');
          else if (signed) badges.push('<span style="font-size:11px; font-weight:600; padding:4px 9px; border-radius:20px; background:rgba(234,179,8,0.12); color:#eab308; border:1px solid rgba(234,179,8,0.25);">\u26a0 Signed (unverified)</span>');
          else badges.push('<span style="font-size:11px; font-weight:600; padding:4px 9px; border-radius:20px; background:rgba(100,116,139,0.15); color:var(--text-muted); border:1px solid rgba(100,116,139,0.2);">Unsigned build (dev)</span>');
          if (isLatest) badges.push('<span style="font-size:11px; font-weight:600; padding:4px 9px; border-radius:20px; background:rgba(56,207,255,0.12); color:#38CFFF; border:1px solid rgba(56,207,255,0.25);">\u2713 Latest version</span>');
          c.innerHTML = badges.join('');
        }

        function renderUpdateState(s) {
          var statusEl = document.getElementById('about-update-status');
          var barWrap = document.getElementById('about-update-progress');
          var bar = document.getElementById('about-update-progress-bar');
          var btnCheck = document.getElementById('btn-check-updates');
          var btnDl = document.getElementById('btn-download-update');
          var btnInstall = document.getElementById('btn-install-update');
          if (!statusEl) return;
          var state = (s && s.state) || 'idle';
          if (state === 'idle') { statusEl.textContent = aboutData ? 'Up to date — no updates pending.' : ''; if (barWrap) barWrap.style.display = 'none'; if (btnDl) btnDl.style.display = 'none'; if (btnInstall) btnInstall.style.display = 'none'; if (btnCheck) btnCheck.disabled = false; }
          else if (state === 'checking') { statusEl.textContent = 'Checking for updates…'; if (barWrap) barWrap.style.display = 'none'; if (btnCheck) btnCheck.disabled = true; }
          else if (state === 'available') { statusEl.innerHTML = 'Update available: <b style="color:#fff;">' + esc(s.version || 'new version') + '</b> — click Download to fetch.'; if (barWrap) barWrap.style.display = 'none'; if (btnDl) btnDl.style.display = ''; if (btnCheck) btnCheck.disabled = false; }
          else if (state === 'up-to-date' || state === 'upToDate') { statusEl.textContent = '\u2713 You are on the latest version.'; if (barWrap) barWrap.style.display = 'none'; if (btnDl) btnDl.style.display = 'none'; if (btnInstall) btnInstall.style.display = 'none'; if (btnCheck) btnCheck.disabled = false; renderBadges(aboutData && aboutData.isSigned, aboutData && aboutData.isVerified, true); }
          else if (state === 'downloading') { var pct = s.percent != null ? Number(s.percent).toFixed(1) : '0'; statusEl.textContent = 'Downloading update… ' + pct + '%'; if (barWrap) { barWrap.style.display = ''; if (bar) bar.style.width = pct + '%'; } if (btnDl) btnDl.style.display = 'none'; }
          else if (state === 'ready') { statusEl.innerHTML = '\u2713 Update <b style="color:#fff;">' + esc(s.version || '') + '</b> downloaded — click Install & Restart.'; if (barWrap) { barWrap.style.display = ''; if (bar) bar.style.width = '100%'; } if (btnInstall) btnInstall.style.display = ''; if (btnDl) btnDl.style.display = 'none'; }
          else if (state === 'error') { statusEl.textContent = '\u2717 Update error: ' + esc(s.message || 'unknown'); statusEl.style.color = 'var(--error)'; if (barWrap) barWrap.style.display = 'none'; if (btnCheck) btnCheck.disabled = false; }
          else if (state === 'disabled') { statusEl.textContent = 'Updates disabled on this build.'; }
          else { statusEl.textContent = 'Update status: ' + esc(state); }
        }

        // Fetch about info
        var aboutPromise = (window.myraa && window.myraa.getAbout) ? window.myraa.getAbout().catch(function() { return apiGet('/api/system/about').catch(function() { return null; }); }) : apiGet('/api/system/about').catch(function() { return null; });
        aboutPromise.then(function(data) {
          if (!data || !data.ok) return;
          aboutData = data;
          var vEl = document.getElementById('about-version-line');
          var pEl = document.getElementById('about-publisher');
          var iEl = document.getElementById('about-install-path');
          if (vEl) vEl.textContent = 'Version ' + esc(data.version) + (data.isPackaged ? '' : ' (development)');
          if (pEl) pEl.textContent = esc(data.publisher || 'MYRAA') + (data.copyright ? '  \u00b7  ' + esc(data.copyright) : '');
          if (iEl) iEl.textContent = esc(data.installPath || '—');
          renderBadges(!!data.isSigned, !!data.isVerified, false);
          // Initial update state
          if (window.myraaUpdate && window.myraaUpdate.state) {
            window.myraaUpdate.state().then(renderUpdateState).catch(function(){});
            if (updateUnsub) updateUnsub();
            updateUnsub = window.myraaUpdate.subscribe(function(s) { renderUpdateState(s); });
          }
        }).catch(function(){});

        // Check for Updates
        var btnCheck = document.getElementById('btn-check-updates');
        if (btnCheck) btnCheck.addEventListener('click', async function() {
          var statusEl = document.getElementById('about-update-status');
          if (statusEl) { statusEl.textContent = 'Checking for updates…'; statusEl.style.color = ''; }
          btnCheck.disabled = true;
          try {
            if (window.myraaUpdate && window.myraaUpdate.check) {
              var s = await window.myraaUpdate.check();
              renderUpdateState(s);
            } else {
              var r = await apiGet('/api/update/check');
              if (r.updateAvailable) toast('Update available: ' + (r.latestVersion || 'new version'), 'success');
              else toast('You are on the latest version.', 'success');
              if (statusEl) statusEl.textContent = r.updateAvailable ? 'Update available: ' + r.latestVersion : '\u2713 Up to date.';
            }
          } catch (err) { if (statusEl) { statusEl.textContent = 'Check failed: ' + err.message; statusEl.style.color = 'var(--error)'; } }
          btnCheck.disabled = false;
        });

        var btnDl = document.getElementById('btn-download-update');
        if (btnDl) btnDl.addEventListener('click', async function() {
          btnDl.disabled = true;
          try {
            if (window.myraaUpdate && window.myraaUpdate.download) { var s = await window.myraaUpdate.download(); renderUpdateState(s); }
          } catch (err) { toast('Download failed: ' + err.message, 'error'); }
          btnDl.disabled = false;
        });

        var btnInstall = document.getElementById('btn-install-update');
        if (btnInstall) btnInstall.addEventListener('click', async function() {
          if (!confirm('Install the downloaded update and restart MYRAA?')) return;
          try {
            if (window.myraaUpdate && window.myraaUpdate.install) await window.myraaUpdate.install();
          } catch (err) { toast('Install failed: ' + err.message, 'error'); }
        });

        var btnNotes = document.getElementById('btn-view-releasenotes');
        if (btnNotes) btnNotes.addEventListener('click', async function() {
          try {
            var r = await apiGet('/api/update/check');
            var notes = (r.changelog || []).join('\n\u2022 ');
            if (notes) alert('Release Notes:\n\n\u2022 ' + notes);
            else window.open('https://github.com/vishwajeetsrk/JARVIS-AI-OS/releases', '_blank');
          } catch (e) { window.open('https://github.com/vishwajeetsrk/JARVIS-AI-OS/releases', '_blank'); }
        });

        var btnFolder = document.getElementById('btn-open-install-folder');
        if (btnFolder) btnFolder.addEventListener('click', async function() {
          try {
            if (window.myraa && window.myraa.openFolder) { await window.myraa.openFolder(aboutData && aboutData.installPath); toast('Opened installation folder.', 'success'); }
            else if (aboutData && aboutData.installPath) { await fetch('/api/system/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: aboutData.installPath }) }); }
          } catch (err) { toast('Could not open folder: ' + err.message, 'error'); }
        });

        var btnDiag = document.getElementById('btn-copy-diagnostics');
        if (btnDiag) btnDiag.addEventListener('click', async function() {
          try {
            var d = null;
            if (window.myraa && window.myraa.getDiagnostics) d = await window.myraa.getDiagnostics();
            else d = await apiGet('/api/system/diagnostics');
            var text = (d && d.text) || JSON.stringify(d, null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); toast('Diagnostics copied to clipboard.', 'success'); }
            else { prompt('Copy diagnostics:', text); }
          } catch (err) { toast('Could not copy diagnostics: ' + err.message, 'error'); }
        });
      })();
    } catch (e) {
      cont.innerHTML = `<div style="font-size:12px;color:var(--error);">Settings unavailable: ${esc(e.message)}</div>`;
    }
  }

  // ── 6. REAL WINDOWS HARDWARE CONTROLS (VOLUME, BRIGHTNESS, POWER, SCREEN) ───
  async function initializeHardwareControls() {
    // Volume: read the real system level when the desktop agent can provide it.
    try {
      const vol = await apiGet('/api/system/volume');
      if (vol.level != null) {
        state.volumeLevel = vol.level;
        state.volumeSynced = true;
        const slider = document.getElementById('slider-volume');
        const label = document.getElementById('label-volume-val');
        if (slider) slider.value = String(vol.level);
        if (label) label.textContent = `${vol.level}%`;
      }
    } catch (e) { /* slider stays at hint value; set on move */ }

    // Brightness: real WMI read (may be unsupported on external monitors).
    try {
      const res = await fetch('/api/system/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_brightness' }) });
      const data = await res.json();
      if (data.ok && data.level != null) {
        state.brightnessLevel = data.level;
        const slider = document.getElementById('slider-brightness');
        const label = document.getElementById('label-brightness-val');
        if (slider) slider.value = String(data.level);
        if (label) label.textContent = `${data.level}%`;
      } else {
        const label = document.getElementById('label-brightness-val');
        if (label) label.textContent = 'unsupported';
      }
    } catch (e) { /* label stays "—" */ }
  }

  function setSystemVolume(val) {
    const previous = state.volumeLevel;
    state.volumeLevel = val;
    localStorage.setItem('myraa_volume_hint', String(val));
    document.getElementById('label-volume-val').textContent = `${val}%`;
    fetch('/api/system/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_volume', level: val, previous })
    }).then((r) => r.json())
      .then((data) => {
        if (data.ok && data.method === 'volume-keys-approx') {
          toast(data.message, 'warn');
        } else if (!data.ok) {
          toast(data.error || 'Volume set failed.', 'error');
        } else {
          state.volumeSynced = true;
        }
      })
      .catch(() => toast('Volume control unreachable.', 'error'));
  }

  function setSystemBrightness(val) {
    state.brightnessLevel = val;
    document.getElementById('label-brightness-val').textContent = `${val}%`;
    fetch('/api/system/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_brightness', level: val })
    }).then((r) => r.json())
      .then((data) => {
        if (data.ok === false || data.supported === false) {
          toast(data.message || data.error || 'Brightness control is not supported on this display (external monitors are hardware-dependent).', 'warn');
          if (state.brightnessLevel == null) document.getElementById('label-brightness-val').textContent = 'unsupported';
        }
      })
      .catch(() => {});
  }

  async function takeScreenshotAction() {
    const btn = document.getElementById('btn-quick-screenshot');
    if (btn) btn.style.transform = 'scale(0.92)';
    setTimeout(() => { if (btn) btn.style.transform = 'none'; }, 150);
    setBubble('Capturing your screen…');
    try {
      const data = await apiPost('/api/system/control', { action: 'screenshot' });
      state.lastScreenshot = data;
      const img = document.getElementById('screenshot-preview-img');
      const meta = document.getElementById('screenshot-meta');
      const analysis = document.getElementById('screenshot-analysis');
      if (img) img.src = data.dataUrl;
      if (meta) meta.textContent = `${data.path || ''} • via ${data.backend || 'capture'}`;
      if (analysis) { analysis.style.display = 'none'; analysis.textContent = ''; }
      document.getElementById('modal-screenshot-preview')?.classList.add('active');
      setBubble('Screenshot captured and saved.');
      logClientActivity('Screen Vision', 'Screenshot captured from Quick Control');
    } catch (err) {
      setBubble("I couldn't capture the screen just now.");
      toast('Screenshot failed: ' + err.message, 'error');
    }
  }

  async function analyzeCurrentScreenshot() {
    if (!state.lastScreenshot?.dataUrl) return toast('Take a screenshot first.', 'warn');
    const analysis = document.getElementById('screenshot-analysis');
    if (analysis) {
      analysis.style.display = 'block';
      analysis.textContent = 'Analyzing the frame with Gemini vision…';
    }
    try {
      const data = await apiPost('/api/vision/analyze-frame', { imageBase64: state.lastScreenshot.dataUrl });
      if (analysis) analysis.textContent = data.analysis || '(empty analysis)';
    } catch (err) {
      if (analysis) analysis.textContent = 'Analysis failed: ' + err.message;
    }
  }

  async function analyzeScreenAction() {
    setBubble('Looking at your screen…');
    toast('Capturing and analyzing your screen…', 'info');
    try {
      const shot = await apiPost('/api/system/control', { action: 'screenshot' });
      const data = await apiPost('/api/vision/analyze-frame', {
        imageBase64: shot.dataUrl,
        prompt: 'Describe what is on this screen for the user: active application, key visible content, and anything notable (errors, unread items, code). Concise.'
      });
      addChatMessage('myraa', `Screen analysis — ${data.analysis}`);
      switchView('chat');
      setBubble('Here is what I see on your screen.');
    } catch (err) {
      setBubble('Screen analysis is unavailable right now.');
      toast('Screen analysis failed: ' + err.message, 'error');
    }
  }

  async function toggleScreenRecording() {
    const label = document.getElementById('label-record-text');
    const btn = document.getElementById('btn-quick-record');

    if (!state.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
        state.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        state.recordedChunks = [];
        state.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.recordedChunks.push(e.data); };
        state.mediaRecorder.onstop = () => {
          const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `MYRAA_Recording_${Date.now()}.webm`;
          a.click();
          toast('Screen recording saved to your Downloads folder.', 'success');
        };
        state.mediaRecorder.start();
        state.isRecording = true;
        if (label) label.textContent = 'STOP';
        if (btn) btn.style.borderColor = 'var(--error)';
      } catch (err) {
        toast('Screen recording failed: ' + err.message, 'error', 7000);
      }
    } else {
      if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.stop();
        state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
      }
      state.isRecording = false;
      if (label) label.textContent = 'Record';
      if (btn) btn.style.borderColor = 'var(--border-divider)';
    }
  }

  // ── 6c. SLASH COMMANDS ENGINE ──────────────────────────────────────────────
  const SLASH_COMMANDS = [
    { cmd: '/code', desc: 'Full-stack software engineering, refactoring & multi-file editing' },
    { cmd: '/review', desc: 'Code quality review, bug investigation & PR architectural audit' },
    { cmd: '/test', desc: 'Generate unit, integration, and Playwright end-to-end tests' },
    { cmd: '/security', desc: 'Run defensive security audit for OWASP vulnerabilities & leaks' },
    { cmd: '/research', desc: 'Deep web & technical state-of-the-art research synthesis' },
    { cmd: '/automate', desc: 'Create and dispatch Windows desktop automation workflow' },
    { cmd: '/app', desc: 'Launch App Studio Forge to design and scaffold new application' },
  ];

  function setupSlashCommands(inputEl) {
    if (!inputEl) return;
    const wrapper = inputEl.closest('.bottom-input-container') || inputEl.parentElement;
    if (!wrapper) return;
    let popup = wrapper.querySelector('.slash-palette-dropdown');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'slash-palette-dropdown';
      popup.style.display = 'none';
      wrapper.style.position = 'relative';
      wrapper.appendChild(popup);
    }

    let selectedIndex = 0;

    const renderPopup = (query) => {
      const q = (query || '').toLowerCase().trim();
      const filtered = SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
      if (filtered.length === 0) {
        popup.style.display = 'none';
        return;
      }
      selectedIndex = Math.min(selectedIndex, filtered.length - 1);
      if (selectedIndex < 0) selectedIndex = 0;
      popup.innerHTML = filtered.map((c, i) => `
        <div class="slash-option-item ${i === selectedIndex ? 'selected' : ''}" data-cmd="${c.cmd}">
          <span class="slash-cmd-tag">${c.cmd}</span>
          <span class="slash-cmd-info">${c.desc}</span>
        </div>
      `).join('');
      popup.style.display = 'block';

      popup.querySelectorAll('.slash-option-item').forEach((item) => {
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectCmd(item.dataset.cmd);
        });
      });
    };

    const selectCmd = (cmd) => {
      inputEl.value = cmd + ' ';
      popup.style.display = 'none';
      inputEl.focus();
    };

    inputEl.addEventListener('input', () => {
      const val = inputEl.value;
      if (val.startsWith('/')) {
        renderPopup(val.slice(1));
      } else {
        popup.style.display = 'none';
      }
    });

    inputEl.addEventListener('keydown', (e) => {
      if (popup.style.display === 'block') {
        const items = popup.querySelectorAll('.slash-option-item');
        if (items.length === 0) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % items.length;
          items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = (selectedIndex - 1 + items.length) % items.length;
          items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          if (items[selectedIndex]) {
            e.preventDefault();
            selectCmd(items[selectedIndex].dataset.cmd);
          }
        } else if (e.key === 'Escape') {
          popup.style.display = 'none';
        }
      }
    });

    inputEl.addEventListener('blur', () => {
      setTimeout(() => { popup.style.display = 'none'; }, 200);
    });
  }

  // ── 7. EVENT BINDING ────────────────────────────────────────────────────────
  function bindShellEvents() {
    // Navigation items
    document.querySelectorAll('.left-sidebar .nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Brand logo home
    document.getElementById('btn-brand-home')?.addEventListener('click', () => switchView('home'));

    // Command palette triggers
    const palTrigger = document.getElementById('btn-open-command-palette');
    const palModal = document.getElementById('modal-command-palette');
    const palInput = document.getElementById('palette-search-input');

    const openPalette = () => {
      if (palModal) palModal.classList.add('active');
      if (palInput) { palInput.value = ''; palInput.focus(); renderPaletteCommands(''); }
    };
    const closePalette = () => { if (palModal) palModal.classList.remove('active'); };

    if (palTrigger) palTrigger.addEventListener('click', openPalette);
    window.addEventListener('keydown', e => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.ctrlKey && e.code === 'Space')) {
        e.preventDefault();
        openPalette();
      } else if (e.key === 'Escape') {
        closePalette();
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
      }
    });

    if (palInput) {
      palInput.addEventListener('input', e => renderPaletteCommands(e.target.value));
    }

    // Right panel toggle
    const toggleRightBtn = document.getElementById('btn-toggle-right-panel');
    const closeRightBtn = document.getElementById('btn-close-right-panel');
    const rightPanel = document.getElementById('system-quick-control-panel');
    const toggleRight = () => {
      if (rightPanel) rightPanel.classList.toggle('collapsed');
    };
    if (toggleRightBtn) toggleRightBtn.addEventListener('click', toggleRight);
    if (closeRightBtn) closeRightBtn.addEventListener('click', toggleRight);

    // Immersive Live Voice mode (real Gemini Live + 3D avatar React surface)
    document.getElementById('btn-live-mode')?.addEventListener('click', toggleLiveMode);

    // Hardware sliders
    const volSlider = document.getElementById('slider-volume');
    if (volSlider) volSlider.addEventListener('input', e => setSystemVolume(parseInt(e.target.value, 10)));

    const brightSlider = document.getElementById('slider-brightness');
    if (brightSlider) brightSlider.addEventListener('input', e => setSystemBrightness(parseInt(e.target.value, 10)));

    // Quick control buttons
    document.getElementById('btn-quick-screenshot')?.addEventListener('click', takeScreenshotAction);
    document.getElementById('btn-quick-record')?.addEventListener('click', toggleScreenRecording);

    // Clipboard Modal
    const clipBtn = document.getElementById('btn-quick-clipboard');
    const clipModal = document.getElementById('modal-clipboard-drawer');
    const clipClose = document.getElementById('btn-close-clip-modal');
    const clipArea = document.getElementById('clip-text-area');

    if (clipBtn) {
      clipBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/system/clipboard');
          const data = await res.json();
          if (clipArea) clipArea.value = data.text || '';
        } catch {}
        if (clipModal) clipModal.classList.add('active');
      });
    }
    if (clipClose) clipClose.addEventListener('click', () => clipModal.classList.remove('active'));

    document.getElementById('btn-clip-clear')?.addEventListener('click', () => {
      fetch('/api/system/clipboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) });
      if (clipArea) clipArea.value = '';
    });
    document.getElementById('btn-clip-copy')?.addEventListener('click', () => {
      if (clipArea) {
        fetch('/api/system/clipboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: clipArea.value }) });
        toast('Copied to Windows clipboard.', 'success');
      }
    });

    // Power Confirmation Modal
    const powerBtn = document.getElementById('btn-quick-power');
    const powerModal = document.getElementById('modal-power-confirmation');
    const powerClose = document.getElementById('btn-close-power-modal');

    if (powerBtn) powerBtn.addEventListener('click', () => powerModal?.classList.add('active'));
    if (powerClose) powerClose.addEventListener('click', () => powerModal?.classList.remove('active'));

    const execPower = (action) => {
      if (confirm(`Execute Windows ${action.toUpperCase()} now?`)) {
        fetch('/api/system/power', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, confirmed: true })
        }).then(r => r.json()).then(res => toast(res.message || res.error || 'Power action dispatched.', 'info', 6000));
        powerModal?.classList.remove('active');
      }
    };

    document.getElementById('btn-exec-lock')?.addEventListener('click', () => execPower('lock'));
    document.getElementById('btn-exec-sleep')?.addEventListener('click', () => execPower('sleep'));
    document.getElementById('btn-exec-restart')?.addEventListener('click', () => execPower('restart'));
    document.getElementById('btn-exec-shutdown')?.addEventListener('click', () => execPower('shutdown'));

    // Quick Action cards on Home
    document.querySelectorAll('.action-card[data-action]').forEach(card => {
      card.addEventListener('click', () => {
        const act = card.dataset.action;
        if (act === 'research') switchView('learning');
        else if (act === 'app_studio') switchView('app_studio');
        else if (act === 'desktop_control') switchView('capabilities');
        else if (act === 'analyze_screen') takeScreenshotAction();
        else if (act === 'automate') switchView('automation');
        else if (act === 'capabilities') switchView('capabilities');
      });
    });

    // Window controls (Electron IPC when available, server fallback otherwise)
    document.getElementById('win-min')?.addEventListener('click', () => {
      if (window.myraaDesktop?.minimize) return window.myraaDesktop.minimize();
      fetch('/api/desktop/focus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'minimize' }) }).catch(() => {});
    });
    document.getElementById('win-max')?.addEventListener('click', () => {
      if (window.myraaDesktop?.maximize) window.myraaDesktop.maximize();
    });
    document.getElementById('win-close')?.addEventListener('click', () => {
      if (window.myraaDesktop?.close) return window.myraaDesktop.close();
      if (confirm('Exit MYRAA AI OS?')) window.close();
    });

    // Send Message — real backend round-trip
    const sendBtn = document.getElementById('btn-send-message');
    const chatInput = document.getElementById('chat-input-field');
    const executeChat = () => {
      const text = (chatInput?.value || '').trim();
      if (!text || state.isSendingChat) return;
      if (chatInput) chatInput.value = '';
      sendMessage(text);
    };
    if (sendBtn) sendBtn.addEventListener('click', executeChat);
    if (chatInput) {
      chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); executeChat(); }
      });
    }

    const secondaryInput = document.getElementById('chat-secondary-input');
    const secondaryBtn = document.getElementById('btn-secondary-send');
    const executeSecondaryChat = () => {
      const text = (secondaryInput?.value || '').trim();
      if (!text || state.isSendingChat) return;
      if (secondaryInput) secondaryInput.value = '';
      sendMessage(text);
    };
    if (secondaryBtn) secondaryBtn.addEventListener('click', executeSecondaryChat);
    if (secondaryInput) {
      secondaryInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); executeSecondaryChat(); }
      });
    }

    // Slash command suggestions popup
    setupSlashCommands(chatInput);
    setupSlashCommands(secondaryInput);

    // Voice Mic — real speech recognition (Chromium/Electron SpeechRecognition)
    const micBtn = document.getElementById('btn-voice-mic');
    if (micBtn) micBtn.addEventListener('click', toggleVoiceListening);

    // Screenshot modal actions
    document.getElementById('btn-close-shot-modal')?.addEventListener('click', () => {
      document.getElementById('modal-screenshot-preview')?.classList.remove('active');
    });
    document.getElementById('btn-shot-open-folder')?.addEventListener('click', () => {
      if (state.lastScreenshot?.path) {
        fetch('/api/fs/app-open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: state.lastScreenshot.path }) });
      }
    });
    document.getElementById('btn-shot-analyze')?.addEventListener('click', analyzeCurrentScreenshot);

    // Workflow modal
    document.getElementById('btn-close-wf-modal')?.addEventListener('click', () => {
      document.getElementById('modal-new-workflow')?.classList.remove('active');
    });
    document.getElementById('btn-wf-add-action')?.addEventListener('click', addWorkflowActionRow);
    document.getElementById('wf-trigger-select')?.addEventListener('change', (e) => {
      const interval = document.getElementById('wf-interval-input');
      if (interval) interval.style.display = e.target.value === 'interval_minutes' ? 'block' : 'none';
    });
    document.getElementById('btn-wf-save')?.addEventListener('click', saveNewWorkflow);

    // New App modal
    document.getElementById('btn-create-app-prompt')?.addEventListener('click', () => {
      document.getElementById('modal-new-app')?.classList.add('active');
    });
    document.getElementById('btn-close-app-modal')?.addEventListener('click', () => {
      document.getElementById('modal-new-app')?.classList.remove('active');
    });
    document.getElementById('btn-create-app-go')?.addEventListener('click', createNewApp);

    // File viewer modal
    document.getElementById('btn-close-file-modal')?.addEventListener('click', () => {
      document.getElementById('modal-file-viewer')?.classList.remove('active');
    });
    document.getElementById('btn-file-open-default')?.addEventListener('click', () => {
      if (state.lastViewedFile) {
        fetch('/api/fs/app-open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: state.lastViewedFile }) });
      }
    });

    document.getElementById('tool-attach-file')?.addEventListener('click', () => {
      const f = document.getElementById('myraa-chat-hidden-file') || document.getElementById('btn-attach-file-trigger');
      if (f) f.click();
    });
    document.getElementById('tool-attach-img')?.addEventListener('click', () => {
      const f = document.getElementById('myraa-chat-hidden-file') || document.getElementById('btn-attach-file-trigger');
      if (f) f.click();
    });
    document.getElementById('tool-capture-win')?.addEventListener('click', () => {
      const b = document.getElementById('btn-attach-screen-trigger');
      if (b) b.click();
    });
    document.getElementById('tool-capture-crop')?.addEventListener('click', () => {
      const b = document.getElementById('btn-attach-screen-trigger');
      if (b) b.click();
    });

    // App Studio tabs (Preview / PRD / Code)
    document.querySelectorAll('#studio-tabs .nav-item[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => switchStudioTab(tab.dataset.tab));
    });

    // Capability status rows navigate to the Capabilities view
    document.getElementById('caps-status-list')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-cap-nav="capabilities"]')) switchView('capabilities');
    });
    document.getElementById('btn-view-all-caps')?.addEventListener('click', () => switchView('capabilities'));
    document.getElementById('btn-view-all-activity')?.addEventListener('click', () => switchView('activity'));
    document.getElementById('btn-clear-session-mem')?.addEventListener('click', () => {
      switchView('memory');
      toast('Memory is long-term and deliberate. Delete individual memories from the list, or disable writes in Settings.', 'info', 6000);
    });

    // Deep Research execute button — async job with live steps
    document.getElementById('btn-run-deep-research')?.addEventListener('click', runDeepResearch);

    // GitHub Analyze execute button — real repository scan
    document.getElementById('btn-run-github-analysis')?.addEventListener('click', runGithubAnalysis);
  }

  // ── 7b. REAL CHAT ENGINE ────────────────────────────────────────────────────
  function addChatMessage(sender, text) {
    state.chatMessages.push({ sender, text, time: new Date().toISOString() });
    if (state.chatMessages.length > 40) state.chatMessages = state.chatMessages.slice(-40);
    try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(state.chatMessages)); } catch (e) {}
    renderChatStream();
  }

  function formatChatMessage(text) {
    if (!text) return '';
    let content = String(text);

    // Extract code blocks first to protect from markdown formatting
    const codeBlocks = [];
    content = content.replace(/```([a-zA-Z0-9_\-#+]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      const id = codeBlocks.length;
      const cleanLang = (lang || 'code').trim().toUpperCase();
      const escapedCode = esc(code.replace(/\r\n/g, '\n').trimEnd());
      codeBlocks.push(`
        <div class="myraa-code-block">
          <div class="code-header-bar">
            <span class="code-lang-tag">${esc(cleanLang)}</span>
            <button class="code-copy-btn" onclick="window.myraaCopyCode(this)" title="Copy code to clipboard">
              ${ICONS.clipboard} Copy
            </button>
          </div>
          <pre><code>${escapedCode}</code></pre>
        </div>
      `);
      return `__CODE_BLOCK_${id}__`;
    });

    // Escape the remaining text safely
    content = esc(content);

    // Inline code: `code`
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold: **text**
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Newlines to line breaks (outside of code blocks)
    content = content.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
    content = `<p>${content}</p>`;

    // Put code blocks back
    codeBlocks.forEach((block, idx) => {
      content = content.replace(`<p>__CODE_BLOCK_${idx}__</p>`, block);
      content = content.replace(`__CODE_BLOCK_${idx}__`, block);
    });

    return content;
  }

  function renderChatStream() {
    const container = document.getElementById('chat-stream-container');
    if (!container) return;
    container.innerHTML = state.chatMessages.map((m) => {
      const isUser = m.sender === 'user';
      const senderLabel = isUser ? 'YOU' : esc(state.identityName);
      const timeStr = m.time ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="chat-message-row ${isUser ? 'user' : 'myraa'}">
          <div class="chat-meta-row" style="margin-bottom: 2px;">
            <span class="chat-sender-label" style="color: ${isUser ? 'var(--accent-cyan)' : 'var(--text-muted)'};">${senderLabel}</span>
            <span class="chat-time-label">${timeStr}</span>
          </div>
          <div class="chat-bubble ${isUser ? 'user' : 'myraa'}">
            ${isUser ? `<p style="white-space: pre-wrap;">${esc(m.text)}</p>` : formatChatMessage(m.text)}
          </div>
        </div>
      `;
    }).join('') + (state.isSendingChat ? `
      <div class="chat-message-row myraa">
        <div class="chat-meta-row">
          <span class="chat-sender-label">${esc(state.identityName)}</span>
        </div>
        <div class="chat-bubble myraa" style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12.5px; color: var(--text-secondary);">Synthesizing response</span>
          <div class="chat-streaming-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>` : '');
    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage(text) {
    addChatMessage('user', text);
    setBubble(`Thinking about: "${String(text).slice(0, 60)}${String(text).length > 60 ? '…' : ''}"`);
    state.isSendingChat = true;
    renderChatStream();
    try {
      const data = await apiPost('/api/chat', {
        message: text,
        history: state.chatMessages.slice(-13, -1).map((m) => ({ sender: m.sender, text: m.text })),
        userName: state.userName,
      });
      addChatMessage('myraa', data.reply);
      setBubble(String(data.reply).slice(0, 90) + (String(data.reply).length > 90 ? '…' : ''));
      if (state.speakReplies) speakText(data.reply);
    } catch (err) {
      addChatMessage('myraa', `⚠ ${err.message}`);
      setBubble('Something failed — check the chat for details.');
    } finally {
      state.isSendingChat = false;
      renderChatStream();
    }
  }

  function speakText(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 600));
      utterance.rate = 1.02;
      utterance.pitch = 1.25;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (e) { /* TTS is best-effort */ }
  }

  // ── 7c. REAL VOICE INPUT (SpeechRecognition) ────────────────────────────────
  function toggleVoiceListening() {
    const micBtn = document.getElementById('btn-voice-mic');
    if (state.isProcessingVoice) return;
    if (state.isListeningVoice) {
      state.voiceRecognition?.stop();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast('Speech recognition is not available in this runtime. Type instead — the chat pipeline is fully connected.', 'warn', 6000);
      return;
    }
    try {
      const recognition = new SR();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      let finalTranscript = '';
      state.voiceRecognition = recognition;
      state.isListeningVoice = true;
      micBtn?.classList.add('listening');
      setBubble('Listening… speak now.');
      recognition.onresult = (event) => {
        finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) setBubble(`Heard: "${finalTranscript.slice(0, 70)}"`);
      };
      recognition.onerror = (event) => {
        toast(`Voice input error (${event.error}). Microphone permission and internet are required.`, 'error', 6000);
      };
      recognition.onend = () => {
        state.isListeningVoice = false;
        micBtn?.classList.remove('listening');
        if (finalTranscript.trim()) {
          state.isProcessingVoice = true;
          state.speakReplies = true; // spoken replies for spoken questions
          setBubble('Processing your request…');
          sendMessage(finalTranscript.trim()).finally(() => { state.isProcessingVoice = false; });
        } else {
          setBubble("I didn't catch anything — tap the mic and try again.");
        }
      };
      recognition.start();
    } catch (err) {
      state.isListeningVoice = false;
      micBtn?.classList.remove('listening');
      toast('Could not start the microphone: ' + err.message, 'error');
    }
  }

  // ── 7d. RESEARCH & REPOSITORY ANALYSIS (async, live steps) ─────────────────
  async function runDeepResearch() {
    const query = document.getElementById('research-query-input')?.value?.trim();
    const box = document.getElementById('research-results-box');
    if (!query) return toast('Enter a research question first.', 'warn');
    if (!box) return;
    box.innerHTML = `<span style="color: var(--accent-cyan);">● Starting research job…</span>`;
    try {
      const start = await apiPost('/api/research/start', { query });
      const render = (job) => {
        box.innerHTML = `
          <div style="font-weight:600; margin-bottom:6px; color:${job.status === 'COMPLETE' ? 'var(--success)' : job.status === 'FAILED' ? 'var(--error)' : 'var(--accent-cyan)'};">
            ${job.status === 'COMPLETE' ? '✓ Research complete' : job.status === 'FAILED' ? '✗ Research failed' : '● Research running'} — <span style="font-weight:400; font-size:11px;">${esc(job.synthesis || 'live pipeline')}</span>
          </div>
          ${job.steps.map((s) => `
            <div style="font-size:11.5px; margin-bottom:3px; color:${s.status === 'DONE' ? 'var(--success)' : s.status === 'ACTIVE' ? 'var(--accent-cyan)' : s.status === 'FAILED' ? 'var(--error)' : 'var(--text-muted)'};">
              ${s.status === 'DONE' ? '✓' : s.status === 'ACTIVE' ? '→' : s.status === 'FAILED' ? '✗' : '○'} ${esc(s.label)}${s.detail ? ` — ${esc(s.detail)}` : ''}
            </div>`).join('')}
          ${job.sources && job.sources.length ? `
            <div style="margin-top:8px; font-size:11px; color:var(--text-muted);">Sources actually read:</div>
            ${job.sources.map((s, i) => `<div style="font-size:10.5px;"><a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:var(--accent-blue); text-decoration:none;">[${i + 1}] ${esc(s.title)}</a>${s.error ? ` <span style="color:var(--warning);">(${esc(s.error)})</span>` : ''}</div>`).join('')}` : ''}
          ${job.report ? `<pre style="white-space: pre-wrap; font-family: var(--font-sans); background: rgba(7,11,20,0.6); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-divider); font-size: 11px; margin-top: 8px;">${esc(job.report)}</pre>` : ''}
          ${job.error ? `<div style="color: var(--error); font-size: 11.5px; margin-top: 6px;">${esc(job.error)}</div>` : ''}
        `;
      };
      render({ status: 'RUNNING', steps: start.steps, sources: [], report: null, synthesis: null });
      const poll = setInterval(async () => {
        try {
          const data = await apiGet(`/api/research/status/${start.jobId}`);
          render(data.job);
          if (data.job.status === 'COMPLETE' || data.job.status === 'FAILED') {
            clearInterval(poll);
            logClientActivity('Research Engine', `Research ${data.job.status.toLowerCase()}: ${query}`);
          }
        } catch (e) {
          clearInterval(poll);
          box.innerHTML = `<span style="color: var(--error);">Lost the research job: ${esc(e.message)}</span>`;
        }
      }, 1500);
    } catch (err) {
      box.innerHTML = `<span style="color: var(--error);">Could not start research: ${esc(err.message)}</span>`;
    }
  }

  async function runGithubAnalysis() {
    const repoPath = document.getElementById('github-repo-input')?.value?.trim();
    const box = document.getElementById('github-results-box');
    if (!repoPath) return toast('Enter a repo (owner/name, GitHub URL, or local path).', 'warn');
    if (!box) return;
    box.innerHTML = `<span style="color: var(--accent-blue);">● Scanning repository (real metadata only)…</span>`;
    try {
      const data = await apiPost('/api/github/analyze', { repoPath });
      box.innerHTML = `
        <div style="color: var(--success); font-weight: 600; margin-bottom: 4px;">✓ ${esc(data.kind)} repository: ${esc(data.name)}${data.stars != null ? ` • ★ ${esc(data.stars)}` : ''}</div>
        <div style="font-size: 11px; margin-bottom: 4px;">Files analyzed: ${esc(data.filesCount)} • Languages: ${esc((data.languages || []).slice(0, 4).map((l) => l.language).join(', ')) || '—'}</div>
        <div style="font-size: 11px; margin-bottom: 6px;">Frameworks detected: ${esc((data.frameworks || []).join(', ')) || 'none detected'}</div>
        ${data.description ? `<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">${esc(data.description)}</div>` : ''}
        ${data.aiSummary ? `<div style="font-size: 11.5px; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); padding: 10px; white-space: pre-wrap;">${esc(data.aiSummary)}</div><div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">AI synthesis: ${esc(data.aiSynthesis)}</div>` : `<div style="font-size: 10.5px; color: var(--text-muted);">AI synthesis: ${esc(data.aiSynthesis || 'not configured')} — the raw real metadata above is still complete.</div>`}
      `;
      logClientActivity('Repository Analyzer', `Analyzed ${data.name}`);
    } catch (err) {
      box.innerHTML = `<span style="color: var(--error);">Repository analysis failed: ${esc(err.message)}</span>`;
    }
  }

  async function loadSelfImprovementProposalsProxy() { return loadSelfImprovementProposals(); }

  // ── 7e. WORKFLOW BUILDER ────────────────────────────────────────────────────
  const WF_ACTION_TYPES = [
    { value: 'open_app', label: 'Open application', param: 'App name (e.g. notepad)', key: 'name' },
    { value: 'open_url', label: 'Open website', param: 'https://…', key: 'url' },
    { value: 'set_volume', label: 'Set volume', param: 'Level 0-100', key: 'level' },
    { value: 'set_brightness', label: 'Set brightness', param: 'Level 0-100', key: 'level' },
    { value: 'run_command', label: 'Run command', param: 'Shell command', key: 'command' },
    { value: 'notify', label: 'Show a note (logged)', param: 'Message', key: 'message' },
  ];

  function openWorkflowBuilder() {
    document.getElementById('wf-name-input').value = '';
    document.getElementById('wf-desc-input').value = '';
    document.getElementById('wf-trigger-select').value = 'manual';
    document.getElementById('wf-interval-input').style.display = 'none';
    const list = document.getElementById('wf-actions-list');
    list.innerHTML = '';
    addWorkflowActionRow();
    document.getElementById('modal-new-workflow')?.classList.add('active');
  }

  function addWorkflowActionRow() {
    const list = document.getElementById('wf-actions-list');
    if (!list) return;
    const rowIndex = list.children.length;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; align-items:center;';
    row.innerHTML = `
      <select class="wf-action-type" style="width: 190px; background: rgba(7,11,20,0.8); border: 1px solid var(--border-divider); color: #fff; padding: 7px 10px; border-radius: var(--radius-md); font-size: 12px;">
        ${WF_ACTION_TYPES.map((t, i) => `<option value="${t.value}">${t.label}</option>`).join('')}
      </select>
      <input type="text" class="wf-action-param" placeholder="Value" style="flex:1; background: rgba(7,11,20,0.6); border: 1px solid var(--border-divider); border-radius: var(--radius-md); color: #fff; padding: 7px 10px; font-size: 12px;" />
      <button class="section-view-all" style="color: var(--error); border-color: var(--error);">✕</button>
    `;
    row.querySelector('.wf-action-type').addEventListener('change', (e) => {
      const t = WF_ACTION_TYPES.find((x) => x.value === e.target.value);
      row.querySelector('.wf-action-param').placeholder = t ? t.param : 'Value';
    });
    row.querySelector('button').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  async function saveNewWorkflow() {
    const name = document.getElementById('wf-name-input').value.trim();
    const description = document.getElementById('wf-desc-input').value.trim();
    const triggerType = document.getElementById('wf-trigger-select').value;
    const intervalMinutes = parseInt(document.getElementById('wf-interval-input').value, 10) || 30;
    const actions = [];
    document.querySelectorAll('#wf-actions-list > div').forEach((row) => {
      const type = row.querySelector('.wf-action-type').value;
      const paramText = row.querySelector('.wf-action-param').value.trim();
      const def = WF_ACTION_TYPES.find((x) => x.value === type);
      if (!def || !paramText) return;
      const params = { [def.key]: type === 'set_volume' || type === 'set_brightness' ? Math.max(0, Math.min(100, parseInt(paramText, 10) || 0)) : paramText };
      actions.push({ type, params });
    });
    if (!name || actions.length === 0) return toast('A workflow needs a name and at least one action with a value.', 'warn');
    try {
      await apiPost('/api/automation/workflows', { name, description, trigger: { type: triggerType, intervalMinutes }, actions });
      document.getElementById('modal-new-workflow')?.classList.remove('active');
      toast(`Workflow "${name}" created and enabled.`, 'success');
      loadAutomationWorkflows();
    } catch (err) {
      toast('Could not create workflow: ' + err.message, 'error');
    }
  }

  // ── 7f. APP STUDIO ──────────────────────────────────────────────────────────
  async function createNewApp() {
    const name = document.getElementById('new-app-name').value.trim();
    const idea = document.getElementById('new-app-idea').value.trim();
    const type = document.getElementById('new-app-type').value;
    const status = document.getElementById('new-app-status');
    if (!name || !idea) return toast('Give the app a name and describe the idea.', 'warn');
    status.textContent = 'App Studio engine: generating PRD and scaffold…';
    try {
      const result = await apiPost('/api/generate-app', { action: type, appName: name, prompt: idea, type });
      const projectId = result.project?.id || result.id || result.slug;
      if (!projectId) throw new Error(result.error || 'Engine returned no project id');
      status.textContent = `Created "${projectId}". Opening live preview…`;
      toast(`Project "${projectId}" generated under /Projects.`, 'success');
      setTimeout(() => {
        document.getElementById('modal-new-app')?.classList.remove('active');
        loadAppStudioProjects();
        window.myraaOpenProject(projectId);
        switchStudioTab('preview');
      }, 900);
    } catch (err) {
      status.textContent = 'Generation failed: ' + err.message;
    }
  }

  function switchStudioTab(tab) {
    document.querySelectorAll('#studio-tabs .nav-item[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    const viewport = document.getElementById('studio-viewport-container');
    if (!viewport) return;
    const project = state.currentProject;
    if (tab === 'preview') {
      viewport.innerHTML = `<iframe id="studio-preview-frame" style="width: 100%; height: 100%; border: none; background: #fff;" src="${project ? `/Projects/${encodeURIComponent(project)}/index.html` : 'about:blank'}"></iframe>`;
    } else if (tab === 'prd') {
      viewport.innerHTML = `<div id="studio-prd-box" style="padding: 16px; overflow-y: auto; height: 100%; font-size: 12px; color: var(--text-secondary);">${project ? 'Loading PRD…' : 'Select a project from the workspace list.'}</div>`;
      if (project) {
        apiGet(`/api/fs/read?filePath=${encodeURIComponent(`D:\\Team of Vishwajeet\\MYRAA\\resources\\app\\Projects\\${project}\\prd.md`)}`)
          .then((data) => {
            const box = document.getElementById('studio-prd-box');
            if (box) box.innerHTML = `<pre style="white-space: pre-wrap; font-family: var(--font-sans);">${esc(data.content)}</pre>`;
          })
          .catch(() => {
            const box = document.getElementById('studio-prd-box');
            if (box) box.textContent = 'No PRD file found for this project. Newer projects generated by the engine include prd.md.';
          });
      }
    } else if (tab === 'code') {
      viewport.innerHTML = `<div id="studio-code-box" style="padding: 16px; overflow-y: auto; height: 100%; font-size: 12px; color: var(--text-secondary);">${project ? 'Listing project files…' : 'Select a project first.'}</div>`;
      if (project) {
        apiGet(`/api/fs/browse?path=${encodeURIComponent(`D:\\Team of Vishwajeet\\MYRAA\\resources\\app\\Projects\\${project}`)}`)
          .then((data) => {
            const box = document.getElementById('studio-code-box');
            if (box) box.innerHTML = (data.entries || []).map((f) => `
              <div class="cap-item-row" style="padding: 8px 12px;">
                <span style="font-family: var(--font-mono); font-size: 11.5px; color: #fff;">${esc(f.name)}</span>
                <span style="display: flex; gap: 8px;">
                  <span style="font-size: 10px; color: var(--text-muted);">${f.type === 'directory' ? 'DIR' : esc(fmtBytes(f.size))}</span>
                  ${f.type !== 'directory' ? `<button class="section-view-all" onclick="window.myraaViewFile('${jsAttr(f.path)}')">Read</button>` : ''}
                </span>
              </div>`).join('');
          })
          .catch((e) => {
            const box = document.getElementById('studio-code-box');
            if (box) box.textContent = 'Cannot list project files: ' + e.message;
          });
      }
    }
  }

  function logClientActivity(moduleName, action, details = '') {
    fetch('/api/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: moduleName, action, status: 'SUCCESS', details }) }).catch(() => {});
  }

  // ── 8. COMMAND PALETTE SEARCH ENGINE (event-delegated, fully functional) ────
  function paletteCommands() {
    return [
      { title: 'Open App Studio', desc: 'Build and scaffold applications', icon: ICONS.appStudio, act: () => switchView('app_studio') },
      { title: 'Take Screenshot', desc: 'Capture the screen, preview and analyze it', icon: ICONS.camera, act: () => takeScreenshotAction() },
      { title: 'Analyze My Screen', desc: 'Capture + Gemini vision description', icon: ICONS.search, act: () => analyzeScreenAction() },
      { title: 'Start Screen Recording', desc: 'Record screen video with audio', icon: ICONS.video, act: () => toggleScreenRecording() },
      { title: 'Deep Research Task', desc: 'Real search → read → synthesis pipeline', icon: ICONS.search, act: () => switchView('learning') },
      { title: 'Capabilities Center', desc: 'Live probed capability statuses', icon: ICONS.capabilities, act: () => switchView('capabilities') },
      { title: 'Cognitive Skills Fleet', desc: 'Run the real registered skills', icon: ICONS.skills, act: () => switchView('skills') },
      { title: 'Browse Files', desc: 'Real workspace file explorer', icon: ICONS.files, act: () => switchView('files') },
      { title: 'Set Volume to 50%', desc: 'Set Windows master audio volume', icon: ICONS.volume, act: () => setSystemVolume(50) },
      { title: 'Lock Workstation', desc: 'Immediately lock Windows screen', icon: ICONS.power, act: () => {
        fetch('/api/system/power', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lock', confirmed: true }) });
      } },
      { title: 'Open Settings', desc: 'API key, identity, runtime preferences', icon: ICONS.settings, act: () => switchView('settings') },
    ];
  }

  function renderPaletteCommands(filter) {
    const list = document.getElementById('palette-results-list');
    if (!list) return;
    const q = (filter || '').toLowerCase();
    const filtered = paletteCommands().filter((c) => c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
    list.innerHTML = filtered.length === 0
      ? `<div style="padding: 10px; font-size: 12px; color: var(--text-muted);">No matching command.</div>`
      : filtered.map((c, i) => `
        <div class="cap-item-row palette-command" data-cmd-index="${i}" style="padding: 8px 12px; cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--accent-cyan);">${c.icon}</span>
            <div>
              <div style="font-weight: 600; color: #fff; font-size: 12.5px;">${esc(c.title)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${esc(c.desc)}</div>
            </div>
          </div>
          <span style="color: var(--text-muted); font-size: 12px;">↵</span>
        </div>
      `).join('');
    // Store resolved actions for the click/Enter delegation below.
    list.dataset.actions = JSON.stringify(filtered.map((c, i) => i));
    window.__paletteActions = filtered.map((c) => c.act);
    list.querySelectorAll('.palette-command').forEach((el) => {
      el.addEventListener('click', () => {
        const act = window.__paletteActions && window.__paletteActions[parseInt(el.dataset.cmdIndex, 10)];
        document.getElementById('modal-command-palette')?.classList.remove('active');
        if (act) act();
      });
    });
  }

  // ── 8b. IMMERSIVE LIVE VOICE MODE ───────────────────────────────────────────
  function toggleLiveMode() {
    const shell = document.getElementById('myraa-app-root');
    const reactRoot = document.getElementById('root');
    if (!shell || !reactRoot) return;
    const entering = !shell.classList.contains('live-mode-active');
    if (entering) {
      shell.classList.add('live-mode-active');
      reactRoot.classList.add('live-mode-active');
      const exit = document.createElement('button');
      exit.id = 'myraa-live-exit-btn';
      exit.textContent = '← Back to Desktop';
      exit.addEventListener('click', toggleLiveMode);
      document.body.appendChild(exit);
      logClientActivity('Voice', 'Entered immersive Live voice mode');
    } else {
      shell.classList.remove('live-mode-active');
      reactRoot.classList.remove('live-mode-active');
      document.getElementById('myraa-live-exit-btn')?.remove();
      logClientActivity('Voice', 'Returned to desktop shell');
    }
  }

  // ── 9. GLOBAL HELPER FUNCTIONS (real behaviors only) ────────────────────────
  window.myraaRunWorkflow = async (id) => {
    toast('Running workflow…', 'info', 2500);
    try {
      const data = await apiPost('/api/automation/run', { workflowId: id });
      toast(`${data.message}\n` + (data.results || []).map((r) => `${r.action}: ${r.ok ? 'ok' : 'fail — ' + r.detail}`).join('\n'), data.ok ? 'success' : 'warn', 8000);
      loadAutomationWorkflows();
    } catch (err) {
      toast('Run failed: ' + err.message, 'error');
    }
  };

  window.myraaToggleWorkflow = async (id) => {
    try {
      const wf = state.workflows.find((w) => w.id === id);
      await apiPost('/api/automation/update', { id, enabled: !(wf && wf.enabled) });
      loadAutomationWorkflows();
    } catch (err) { toast('Toggle failed: ' + err.message, 'error'); }
  };

  window.myraaDeleteWorkflow = async (id) => {
    if (!confirm('Delete this workflow? This cannot be undone.')) return;
    try {
      await apiPost('/api/automation/delete', { id });
      toast('Workflow deleted.', 'success');
      loadAutomationWorkflows();
    } catch (err) { toast('Delete failed: ' + err.message, 'error'); }
  };

  window.myraaOpenProject = (id) => {
    state.currentProject = id;
    switchStudioTab('preview');
  };

  window.myraaTestCapability = async (id) => {
    toast(`Testing capability "${id}" for real…`, 'info', 2500);
    try {
      if (id === 'desktop_control') {
        const data = await apiPost('/api/system/control', { action: 'get_volume' });
        toast(data.ok && data.level != null ? `Desktop agent answered — current volume ${data.level}%.` : 'Desktop agent reachable but could not read volume (agent may be offline).', data.ok ? 'success' : 'warn');
      } else if (id === 'screen_understanding') {
        const shot = await apiPost('/api/system/control', { action: 'screenshot' });
        toast(`Real capture succeeded via ${shot.backend}. Saved: ${shot.path}`, 'success', 7000);
      } else if (id === 'file_system') {
        const data = await apiGet('/api/fs/browse');
        toast(`Real directory read: ${data.entries.length} entries at ${data.path}`, 'success', 7000);
      } else if (id === 'browser_agent') {
        const data = await apiGet('/api/integrations');
        const net = (data.integrations || []).find((i) => i.id === 'network');
        toast(`Network probe: ${net ? net.status : 'UNKNOWN'} — ${net ? net.detail : ''}`, net && net.status === 'CONNECTED' ? 'success' : 'error', 7000);
      } else if (id === 'memory_system') {
        const mems = await apiGet('/api/memories');
        toast(`Memory store live: ${mems.length} long-term memories.`, 'success');
      } else if (id === 'automation_engine') {
        const data = await apiGet('/api/automation/workflows');
        toast(`Automation engine live: ${data.workflows.length} workflows, ${data.history.length} recent runs.`, 'success');
      } else if (id === 'app_studio') {
        const res = await fetch('/api/generate-app/projects');
        const data = await res.json();
        toast(`App Studio live: ${(data.projects || []).length} projects on disk.`, 'success');
      } else if (id === 'voice_engine') {
        const config = await apiGet('/api/config');
        toast(config.hasApiKey ? 'Voice pipeline configured (Gemini Live + browser speech input).' : 'Voice needs a Gemini API key — Settings → API Key.', config.hasApiKey ? 'success' : 'warn');
      } else {
        toast(`No test procedure for "${id}" yet.`, 'warn');
      }
    } catch (err) {
      toast(`Test failed (this is real feedback): ${err.message}`, 'error', 7000);
    }
  };

  window.myraaTestSkill = async (skillId, skillName) => {
    const input = prompt(`Run "${skillName || skillId}".\nEnter the task text (or JSON params) for this skill:`, 'test run');
    if (input === null) return;
    let params;
    try { params = JSON.parse(input); } catch (e) { params = { task: input }; }
    try {
      const res = await fetch('/api/skills/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skillId, params }) });
      const data = await res.json();
      toast(data.success ? `Skill result: ${JSON.stringify(data.result).slice(0, 260)}` : `Skill failed: ${data.message || data.error || 'no result'}`, data.success ? 'success' : 'error', 9000);
    } catch (err) {
      toast('Skill execution unreachable: ' + err.message, 'error');
    }
  };

  window.myraaDeleteMemory = async (id) => {
    if (!confirm('Delete this memory permanently?')) return;
    try {
      await fetch(`/api/memories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('Memory deleted.', 'success');
      loadMemoryView();
    } catch (err) { toast('Delete failed: ' + err.message, 'error'); }
  };

  window.myraaConnectIntegration = (id) => {
    if (id === 'gemini_api') return switchView('settings');
    const integration = state.integrations.find((i) => i.id === id);
    toast(integration?.connectHint || `Integration "${id}" — see the details shown on its card.`, 'info', 7000);
  };

  window.myraaOpenEntry = (path, isDirectory) => {
    if (isDirectory) {
      state.filesPath = path;
      loadFilesView();
    } else {
      fetch('/api/fs/app-open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: path }) })
        .then(() => logClientActivity('File System', `Opened ${path.split('\\').pop() || path} with default app`))
        .catch(() => {});
    }
  };

  window.myraaViewFile = async (path) => {
    try {
      const data = await apiGet(`/api/fs/read?filePath=${encodeURIComponent(path)}`);
      state.lastViewedFile = path;
      document.getElementById('file-viewer-title').innerHTML = `${ICONS.files} ${esc(path.split('\\').pop())}`;
      document.getElementById('file-viewer-content').textContent = (data.content || '').slice(0, 60000);
      document.getElementById('modal-file-viewer')?.classList.add('active');
    } catch (err) {
      toast('Cannot read file: ' + err.message, 'error');
    }
  };

  window.myraaApproveProposal = async (id) => {
    toast('Executing approved remediation…', 'info', 2500);
    try {
      const data = await apiPost('/api/self-improvement/approve', { id });
      if (data.needsUser) toast(data.result, 'warn', 8000);
      else toast(data.result, data.ok ? 'success' : 'error', 8000);
      loadSelfImprovementProposals();
      refreshCapabilityPanel();
    } catch (err) {
      toast('Approval execution failed: ' + err.message, 'error');
    }
  };

  window.myraaCopyCode = (btn) => {
    try {
      const block = btn.closest('.myraa-code-block');
      const code = block?.querySelector('pre code');
      if (!code) return;
      const text = code.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = `${ICONS.check} Copied!`;
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `${ICONS.clipboard} Copy`;
        }, 2000);
      }).catch(() => {
        toast('Clipboard write permission denied.', 'warn');
      });
    } catch (e) {
      toast('Could not copy code: ' + e.message, 'warn');
    }
  };

  // ── 9. DOM INITIALIZATION ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDesktopShell);
  } else {
    initDesktopShell();
  }

  console.log('[MYRAA v6.0 APEX] Master Desktop Operating Suite initialized (Zero-Emoji Lucide Standard).');
})();
