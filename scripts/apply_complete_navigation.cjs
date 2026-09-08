const fs = require('fs');

const targetPath = 'C:\\Users\\Vishwajeet\\AppData\\Local\\Programs\\MYRAA-AI-OS\\resources\\app\\dist\\ui-health-patch.js';
let content = fs.readFileSync(targetPath, 'utf8');

console.log('Original content length:', content.length);

// ── 1. REPLACE NAVIGATION JS IMPLEMENTATION ─────────────────────────────────
const navStartMarker = '// ── 8. FRAMER LIQUID NAVIGATION BAR & SYSTEM ACTIONS ───────────────────────';
const navEndMarker = '// ── 9. SETTINGS TABS ENHANCER ──────────────────────────────────────────────';

const newNavJS = `// ── 8. UNIFIED NAVIGATION SYSTEM (Desktop Sidebar, Top Utilities & Modals) ──
  const MYRAA_NAV_ICONS = {
    logo: \`<svg viewBox="0 0 24 24" fill="none" stroke="#45C7E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>\`,
    chat: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>\`,
    history: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>\`,
    skills: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>\`,
    knowledge: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>\`,
    integrations: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/><rect x="8" y="8" width="8" height="8" rx="2"/></svg>\`,
    settings: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>\`,
    help: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>\`,
    topics: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>\`,
    recalls: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>\`,
    screen: \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>\`
  };

  // State
  let currentActiveNav = 'chat';
  let isScreenSharingActive = false;
  let activeScreenStream = null;

  function setActiveNav(navKey) {
    currentActiveNav = navKey;
    document.querySelectorAll('.myraa-sidebar-nav-item').forEach(btn => {
      const isTarget = btn.getAttribute('data-nav') === navKey;
      btn.classList.toggle('active', isTarget);
      const dot = btn.querySelector('.myraa-nav-dot');
      if (dot) dot.textContent = isTarget ? '●' : '';
    });
  }

  function closeAllPanels() {
    document.getElementById('myraa-topics-panel')?.classList.remove('active');
    document.getElementById('myraa-recalls-panel')?.classList.remove('active');
    document.getElementById('myraa-knowledge-modal')?.classList.remove('active');
    document.getElementById('myraa-help-modal')?.classList.remove('active');
    document.getElementById('myraa-skills-modal')?.classList.remove('active');
    document.getElementById('myraa-plugins-modal')?.classList.remove('active');
    document.getElementById('myraa-transcripts-modal')?.classList.remove('active');
    document.getElementById('myraa-update-modal')?.classList.remove('active');
    document.getElementById('myraa-avatar-modal')?.classList.remove('active');
    document.getElementById('myraa-office-modal')?.classList.remove('active');
  }

  // ── DESKTOP SIDEBAR INJECTION ─────────────────────────────────────────────
  function injectDesktopSidebar() {
    if (document.getElementById('myraa-desktop-sidebar')) return;

    document.body.classList.add('has-myraa-sidebar');

    const sidebar = document.createElement('aside');
    sidebar.id = 'myraa-desktop-sidebar';
    sidebar.setAttribute('aria-label', 'Primary Navigation');
    sidebar.innerHTML = \`
      <!-- HEADER -->
      <div class="myraa-sidebar-header">
        <div class="myraa-sidebar-brand" id="sidebar-brand-btn" title="MYRAA AI Operating System">
          <div class="myraa-sidebar-logo">\${MYRAA_NAV_ICONS.logo}</div>
          <span class="myraa-sidebar-title">MYRAA</span>
        </div>
        <button type="button" class="myraa-sidebar-toggle-btn" id="sidebar-toggle-btn" title="Collapse / Expand Sidebar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>

      <!-- WORKSPACE / PRIMARY -->
      <div class="myraa-sidebar-section-label">WORKSPACE</div>
      <div class="myraa-sidebar-nav-list">
        <button type="button" class="myraa-sidebar-nav-item active" data-nav="chat" id="side-nav-chat" title="Chat Workspace (Default Home)">
          <span class="myraa-nav-dot">●</span>
          <span class="myraa-nav-icon">\${MYRAA_NAV_ICONS.chat}</span>
          <span class="myraa-nav-text">Chat</span>
        </button>
        <button type="button" class="myraa-sidebar-nav-item" data-nav="history" id="side-nav-history" title="History & Transcripts">
          <span class="myraa-nav-dot"></span>
          <span class="myraa-nav-icon">\${MYRAA_NAV_ICONS.history}</span>
          <span class="myraa-nav-text">History</span>
        </button>
        <button type="button" class="myraa-sidebar-nav-item" data-nav="skills" id="side-nav-skills" title="Cognitive Skills Catalog (139 Skills)">
          <span class="myraa-nav-dot"></span>
          <span class="myraa-nav-icon">\${MYRAA_NAV_ICONS.skills}</span>
          <span class="myraa-nav-text">Skills</span>
          <span class="myraa-sidebar-badge" id="side-skills-badge">139</span>
        </button>
        <button type="button" class="myraa-sidebar-nav-item" data-nav="knowledge" id="side-nav-knowledge" title="Knowledge Base & Documents">
          <span class="myraa-nav-dot"></span>
          <span class="myraa-nav-icon">\${MYRAA_NAV_ICONS.knowledge}</span>
          <span class="myraa-nav-text">Knowledge</span>
        </button>
      </div>

      <!-- CONNECT -->
      <div class="myraa-sidebar-section-label">CONNECT</div>
      <div class="myraa-sidebar-nav-list">
        <button type="button" class="myraa-sidebar-nav-item" data-nav="integrations" id="side-nav-integrations" title="Connectors & Plugins">
          <span class="myraa-nav-dot"></span>
          <span class="myraa-nav-icon">\${MYRAA_NAV_ICONS.integrations}</span>
          <span class="myraa-nav-text">Integrations</span>
        </button>
      </div>

      <!-- SYSTEM -->
      <div class="myraa-sidebar-section-label">SYSTEM</div>
      <div class="myraa-sidebar-nav-list" style="margin-top: auto;">
        <button type="button" class="myraa-sidebar-nav-item" data-nav="settings" id="side-nav-settings" title="System Settings">
          <span class="myraa-nav-dot"></span>
          <span class="myraa-nav-icon">\${MYRAA_NAV_ICONS.settings}</span>
          <span class="myraa-nav-text">Settings</span>
        </button>
        <button type="button" class="myraa-sidebar-nav-item" data-nav="help" id="side-nav-help" title="Help & Documentation">
          <span class="myraa-nav-dot"></span>
          <span class="myraa-nav-icon">\${MYRAA_NAV_ICONS.help}</span>
          <span class="myraa-nav-text">Help</span>
        </button>
      </div>
    \`;

    document.body.prepend(sidebar);

    // Sidebar Toggle
    sidebar.querySelector('#sidebar-toggle-btn').onclick = () => {
      sidebar.classList.toggle('collapsed');
      document.body.classList.toggle('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    };

    sidebar.querySelector('#sidebar-brand-btn').onclick = () => {
      setActiveNav('chat');
      closeAllPanels();
      document.getElementById('myraa-composer-textarea')?.focus();
    };

    // Nav Item Click Actions
    sidebar.querySelector('#side-nav-chat').onclick = () => {
      setActiveNav('chat');
      closeAllPanels();
      document.getElementById('myraa-composer-textarea')?.focus();
      showToast('Chat Workspace Active');
    };

    sidebar.querySelector('#side-nav-history').onclick = () => {
      setActiveNav('history');
      openTranscriptsModal();
    };

    sidebar.querySelector('#side-nav-skills').onclick = () => {
      setActiveNav('skills');
      openSkillsModal();
    };

    sidebar.querySelector('#side-nav-knowledge').onclick = () => {
      setActiveNav('knowledge');
      openKnowledgeModal();
    };

    sidebar.querySelector('#side-nav-integrations').onclick = () => {
      setActiveNav('integrations');
      openPluginsModal();
    };

    sidebar.querySelector('#side-nav-settings').onclick = () => {
      setActiveNav('settings');
      openNativeSettings();
    };

    sidebar.querySelector('#side-nav-help').onclick = () => {
      setActiveNav('help');
      openHelpModal();
    };
  }

  function openNativeSettings() {
    const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('SETTINGS')) ||
                        document.querySelector('button[title*="Configuration"]');
    if (settingsBtn) settingsBtn.click();
    else showToast('Opening Settings & Configuration...');
  }

  // ── TOP UTILITY NAVIGATION BAR ────────────────────────────────────────────
  function injectTopUtilities() {
    // Remove old liquid nav or floating dock
    document.getElementById('myraa-liquid-navigation')?.remove();
    document.getElementById('myraa-floating-dock')?.remove();
    document.getElementById('myraa-header-hub-container')?.remove();

    if (document.getElementById('myraa-top-utilities')) return;

    const header = document.querySelector('header');
    if (!header) return;

    const topBar = document.createElement('div');
    topBar.className = 'myraa-top-utilities';
    topBar.id = 'myraa-top-utilities';
    topBar.innerHTML = \`
      <button type="button" class="myraa-top-util-btn" id="top-util-topics" title="Active Topics & Tasks">
        <span class="top-util-icon">\${MYRAA_NAV_ICONS.topics}</span>
        <span class="top-util-label">Topics</span>
      </button>
      <button type="button" class="myraa-top-util-btn" id="top-util-recalls" title="MYRAA Memory & Recollections">
        <span class="top-util-icon">\${MYRAA_NAV_ICONS.recalls}</span>
        <span class="top-util-label">Recalls</span>
      </button>
      <button type="button" class="myraa-top-util-btn" id="top-util-screen" title="Share Screen Context with MYRAA">
        <span class="top-util-dot" id="screen-share-dot" style="display: none;">●</span>
        <span class="top-util-icon" id="screen-share-icon">\${MYRAA_NAV_ICONS.screen}</span>
        <span class="top-util-label" id="screen-share-label">Share Screen</span>
      </button>
      <button type="button" class="myraa-top-util-btn myraa-top-util-icononly" id="top-util-settings" title="Quick Settings">
        <span class="top-util-icon">\${MYRAA_NAV_ICONS.settings}</span>
      </button>
    \`;

    header.appendChild(topBar);

    topBar.querySelector('#top-util-topics').onclick = (e) => {
      e.stopPropagation();
      toggleTopicsPanel();
    };

    topBar.querySelector('#top-util-recalls').onclick = (e) => {
      e.stopPropagation();
      openRecallsPanel();
    };

    topBar.querySelector('#top-util-screen').onclick = () => {
      toggleScreenSharing();
    };

    topBar.querySelector('#top-util-settings').onclick = () => {
      openNativeSettings();
    };
  }

  // ── TOPICS DROPDOWN & MANAGEMENT PANEL ────────────────────────────────────
  let activeTopicsList = [
    { id: '1', name: 'Current Project', category: 'Projects', active: true },
    { id: '2', name: 'MYRAA Development', category: 'Active Tasks', active: false },
    { id: '3', name: 'AWS Bedrock', category: 'Discussion Categories', active: false },
    { id: '4', name: 'AI Skills', category: 'Discussion Categories', active: false },
    { id: '5', name: 'Website Design', category: 'Projects', active: false }
  ];

  function createTopicsPanel() {
    if (document.getElementById('myraa-topics-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'myraa-topics-panel';
    panel.innerHTML = \`
      <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 10px;">
        <div style="font-size: 12px; font-weight: 700; color: #F4F6FA; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
          <span style="color: #45C7E8;">\${MYRAA_NAV_ICONS.topics}</span>
          <span>TOPICS</span>
        </div>
        <button type="button" id="topics-add-btn" style="background: rgba(69, 199, 232, 0.15); border: 1px solid rgba(69, 199, 232, 0.3); color: #45C7E8; font-size: 11px; padding: 3px 8px; border-radius: 6px; cursor: pointer;">+ Create</button>
      </div>
      <input type="text" id="topics-search-input" placeholder="Search topics..." style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 10px; font-size: 11px; color: #F4F6FA; outline: none; margin-bottom: 10px;">
      <div id="topics-list-container" style="display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto;"></div>
    \`;

    document.body.appendChild(panel);

    panel.querySelector('#topics-search-input').oninput = (e) => {
      renderTopicsList(e.target.value.toLowerCase());
    };

    panel.querySelector('#topics-add-btn').onclick = () => {
      const topicName = prompt('Enter new Topic name:');
      if (topicName && topicName.trim()) {
        activeTopicsList.push({
          id: String(Date.now()),
          name: topicName.trim(),
          category: 'Projects',
          active: false
        });
        renderTopicsList();
        showToast('✓ Topic "' + topicName.trim() + '" created');
      }
    };

    document.addEventListener('click', (e) => {
      if (panel.classList.contains('active') && !panel.contains(e.target) && !e.target.closest('#top-util-topics')) {
        panel.classList.remove('active');
      }
    });
  }

  function renderTopicsList(filter = '') {
    const container = document.getElementById('topics-list-container');
    if (!container) return;

    const filtered = activeTopicsList.filter(t => t.name.toLowerCase().includes(filter) || t.category.toLowerCase().includes(filter));
    if (filtered.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; color: #64748b; text-align: center; padding: 12px;">No topics found</div>';
      return;
    }

    container.innerHTML = filtered.map(t => \`
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 8px; background: \${t.active ? 'rgba(69, 199, 232, 0.12)' : 'rgba(255,255,255,0.03)'}; border: 1px solid \${t.active ? 'rgba(69, 199, 232, 0.3)' : 'transparent'}; cursor: pointer; transition: all 0.15s ease;" onclick="window.myraaSelectTopic('\${t.id}')">
        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
          <span style="color: \${t.active ? '#45C7E8' : '#64748b'}; font-size: 10px;">\${t.active ? '●' : '○'}</span>
          <span style="font-size: 12px; color: \${t.active ? '#F4F6FA' : '#9AA4B5'}; font-weight: \${t.active ? '600' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">\${escapeHTML(t.name)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;" onclick="event.stopPropagation();">
          <button style="background: transparent; border: none; color: #64748b; font-size: 11px; cursor: pointer; padding: 2px;" onclick="window.myraaRenameTopic('\${t.id}')" title="Rename">✎</button>
          <button style="background: transparent; border: none; color: #f87171; font-size: 11px; cursor: pointer; padding: 2px;" onclick="window.myraaDeleteTopic('\${t.id}')" title="Delete">✕</button>
        </div>
      </div>
    \`).join('');
  }

  function toggleTopicsPanel() {
    createTopicsPanel();
    const panel = document.getElementById('myraa-topics-panel');
    if (!panel) return;
    const isOpening = !panel.classList.contains('active');
    closeAllPanels();
    if (isOpening) {
      renderTopicsList();
      panel.classList.add('active');
    }
  }

  window.myraaSelectTopic = (id) => {
    activeTopicsList.forEach(t => t.active = (t.id === id));
    renderTopicsList();
    const activeT = activeTopicsList.find(t => t.id === id);
    if (activeT) showToast('Active Topic: ' + activeT.name);
  };

  window.myraaRenameTopic = (id) => {
    const t = activeTopicsList.find(item => item.id === id);
    if (!t) return;
    const newName = prompt('Rename topic:', t.name);
    if (newName && newName.trim()) {
      t.name = newName.trim();
      renderTopicsList();
      showToast('✓ Topic renamed to: ' + t.name);
    }
  };

  window.myraaDeleteTopic = (id) => {
    activeTopicsList = activeTopicsList.filter(t => t.id !== id);
    renderTopicsList();
    showToast('✓ Topic removed');
  };

  // ── RECALLS MEMORY SYSTEM PANEL ───────────────────────────────────────────
  let recallsList = [
    { id: '1', title: 'Preferred language', value: 'Hinglish', category: 'Personal Preferences', pinned: true },
    { id: '2', title: 'Assistant personality', value: 'Female (Strict feminine Hindi grammar: Main karti hoon, etc.)', category: 'Personal Preferences', pinned: true },
    { id: '3', title: 'Current project', value: 'MYRAA AI', category: 'Projects', pinned: true },
    { id: '4', title: 'Preferred UI style', value: 'Dark futuristic minimal (#0B0D12)', category: 'Learned Preferences', pinned: false },
    { id: '5', title: 'Connected services', value: 'GitHub, AWS, Google Cloud, Gmail', category: 'Technical Information', pinned: false },
    { id: '6', title: 'Operator profile', value: 'Vishwajeet (Lead Architect & Builder)', category: 'Saved Context', pinned: true }
  ];

  function createRecallsPanel() {
    if (document.getElementById('myraa-recalls-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'myraa-recalls-panel';
    panel.innerHTML = \`
      <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div style="font-size: 13px; font-weight: 700; color: #F4F6FA; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
          <span style="color: #45C7E8;">\${MYRAA_NAV_ICONS.recalls}</span>
          <span>RECALLS — MYRAA MEMORY SYSTEM</span>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" id="recalls-add-btn" style="background: rgba(69, 199, 232, 0.15); border: 1px solid rgba(69, 199, 232, 0.3); color: #45C7E8; font-size: 11px; padding: 4px 10px; border-radius: 6px; cursor: pointer;">+ Add Recall</button>
          <button type="button" id="recalls-close-btn" style="background: transparent; border: none; color: #9AA4B5; font-size: 16px; cursor: pointer; padding: 2px 6px;">✕</button>
        </div>
      </div>
      <input type="text" id="recalls-search-input" placeholder="Search memories..." style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 7px 12px; font-size: 11px; color: #F4F6FA; outline: none;">
      <div id="recalls-category-tabs" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px;">
        <button class="myraa-btn myraa-btn-outline active-filter" data-cat="all" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">All</button>
        <button class="myraa-btn myraa-btn-outline" data-cat="Personal Preferences" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Preferences</button>
        <button class="myraa-btn myraa-btn-outline" data-cat="Projects" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Projects</button>
        <button class="myraa-btn myraa-btn-outline" data-cat="Technical Information" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Technical</button>
        <button class="myraa-btn myraa-btn-outline" data-cat="Saved Context" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Context</button>
      </div>
      <div id="recalls-list-container" style="display: flex; flex-direction: column; gap: 6px; max-height: 420px; overflow-y: auto;"></div>
    \`;

    document.body.appendChild(panel);

    panel.querySelector('#recalls-close-btn').onclick = () => panel.classList.remove('active');
    panel.querySelector('#recalls-search-input').oninput = (e) => renderRecallsList(e.target.value.toLowerCase(), activeRecallCategory);

    let activeRecallCategory = 'all';
    panel.querySelectorAll('#recalls-category-tabs button').forEach(btn => {
      btn.onclick = () => {
        panel.querySelectorAll('#recalls-category-tabs button').forEach(b => b.classList.remove('active-filter'));
        btn.classList.add('active-filter');
        activeRecallCategory = btn.dataset.cat;
        renderRecallsList(panel.querySelector('#recalls-search-input').value.toLowerCase(), activeRecallCategory);
      };
    });

    panel.querySelector('#recalls-add-btn').onclick = () => {
      const title = prompt('Memory title (e.g. Preferred Editor):');
      if (!title) return;
      const value = prompt('Memory details (e.g. VS Code with Dark Theme):');
      if (!value) return;
      recallsList.unshift({
        id: String(Date.now()),
        title: title.trim(),
        value: value.trim(),
        category: 'Personal Preferences',
        pinned: false
      });
      renderRecallsList();
      showToast('✓ Memory saved to MYRAA Recalls');
    };
  }

  function renderRecallsList(filter = '', category = 'all') {
    const container = document.getElementById('recalls-list-container');
    if (!container) return;

    let list = recallsList;
    if (category !== 'all') {
      list = list.filter(r => r.category === category);
    }
    if (filter) {
      list = list.filter(r => r.title.toLowerCase().includes(filter) || r.value.toLowerCase().includes(filter));
    }

    if (list.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; color: #64748b; text-align: center; padding: 20px;">No recalls match your query</div>';
      return;
    }

    container.innerHTML = list.map(r => \`
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; transition: border-color 0.15s ease;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 6px;">
            \${r.pinned ? '<span style="color: #45C7E8; font-size: 11px;" title="Pinned Memory">★</span>' : ''}
            <span style="font-size: 12px; font-weight: 600; color: #F4F6FA;">\${escapeHTML(r.title)}</span>
            <span style="font-size: 9px; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: #9AA4B5;">\${escapeHTML(r.category)}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="background: transparent; border: none; color: #9AA4B5; cursor: pointer; font-size: 10px;" onclick="window.myraaTogglePinRecall('\${r.id}')" title="Pin / Unpin">\${r.pinned ? 'Unpin' : 'Pin'}</button>
            <button style="background: transparent; border: none; color: #f87171; cursor: pointer; font-size: 10px;" onclick="window.myraaDeleteRecall('\${r.id}')" title="Delete">Delete</button>
          </div>
        </div>
        <div style="font-size: 11px; color: #9AA4B5; line-height: 1.4;">• \${escapeHTML(r.value)}</div>
      </div>
    \`).join('');
  }

  function openRecallsPanel() {
    createRecallsPanel();
    const panel = document.getElementById('myraa-recalls-panel');
    if (!panel) return;
    const isOpening = !panel.classList.contains('active');
    closeAllPanels();
    if (isOpening) {
      renderRecallsList();
      panel.classList.add('active');
    }
  }

  window.myraaTogglePinRecall = (id) => {
    const r = recallsList.find(item => item.id === id);
    if (r) {
      r.pinned = !r.pinned;
      renderRecallsList();
    }
  };

  window.myraaDeleteRecall = (id) => {
    recallsList = recallsList.filter(item => item.id !== id);
    renderRecallsList();
    showToast('✓ Recall removed');
  };

  // ── KNOWLEDGE BASE MODAL ──────────────────────────────────────────────────
  let knowledgeItems = [
    { id: '1', title: 'MYRAA System Architecture & Skills Spec', type: 'Documents', size: '24 KB', date: 'Today' },
    { id: '2', title: 'Windows Desktop Automation Protocol', type: 'Project Files', size: '18 KB', date: 'Today' },
    { id: '3', title: 'AWS Bedrock Integration Guidelines', type: 'Web References', size: '12 KB', date: 'Yesterday' },
    { id: '4', title: 'Feminine Hindi Persona & Conversation Guide', type: 'Notes', size: '8 KB', date: 'Today' },
    { id: '5', title: 'System Architecture Diagram', type: 'Images', size: '1.2 MB', date: '2 days ago' }
  ];

  function createKnowledgeModal() {
    if (document.getElementById('myraa-knowledge-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'myraa-knowledge-modal';
    overlay.className = 'myraa-hud-overlay';
    overlay.innerHTML = \`
      <div class="myraa-hud-panel" style="max-width: 780px; height: 80vh;">
        <div class="myraa-hud-header">
          <div class="myraa-hud-title" style="color: #45C7E8;">
            <span>\${MYRAA_NAV_ICONS.knowledge}</span> KNOWLEDGE — WORKSPACE ASSETS & REFERENCES
          </div>
          <button class="myraa-hud-close" id="knowledge-close-btn">✕</button>
        </div>
        <div style="padding: 12px 20px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; gap: 10px; align-items: center;">
            <input id="knowledge-search-input" type="text" placeholder="Search knowledge, documents, notes, URLs..." style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 7px 12px; font-size: 11px; color: #fff; outline: none;">
            <button class="myraa-btn myraa-btn-primary" id="knowledge-upload-btn" style="background: linear-gradient(135deg, #0284c7, #45C7E8); font-size: 11px; padding: 6px 14px; white-space: nowrap;">+ Upload File</button>
            <button class="myraa-btn myraa-btn-outline" id="knowledge-add-url-btn" style="font-size: 11px; padding: 6px 12px; white-space: nowrap;">+ Add URL</button>
            <input type="file" id="knowledge-file-input" style="display: none;" multiple>
          </div>
          <div id="knowledge-tabs-row" style="display: flex; gap: 6px; overflow-x: auto;">
            <button class="myraa-btn myraa-btn-outline active-filter" data-type="all" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">All</button>
            <button class="myraa-btn myraa-btn-outline" data-type="Documents" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Documents</button>
            <button class="myraa-btn myraa-btn-outline" data-type="Project Files" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Project Files</button>
            <button class="myraa-btn myraa-btn-outline" data-type="Web References" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Web References</button>
            <button class="myraa-btn myraa-btn-outline" data-type="Notes" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Notes</button>
            <button class="myraa-btn myraa-btn-outline" data-type="Images" style="font-size: 10px; padding: 3px 10px; border-radius: 999px;">Images</button>
          </div>
        </div>
        <div class="myraa-hud-body" id="knowledge-list-body" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
    \`;

    document.body.appendChild(overlay);

    overlay.querySelector('#knowledge-close-btn').onclick = () => {
      overlay.classList.remove('active');
      setActiveNav('chat');
    };
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        setActiveNav('chat');
      }
    };

    let activeFilter = 'all';
    overlay.querySelectorAll('#knowledge-tabs-row button').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('#knowledge-tabs-row button').forEach(b => b.classList.remove('active-filter'));
        btn.classList.add('active-filter');
        activeFilter = btn.dataset.type;
        renderKnowledgeList(overlay.querySelector('#knowledge-search-input').value.toLowerCase(), activeFilter);
      };
    });

    overlay.querySelector('#knowledge-search-input').oninput = (e) => {
      renderKnowledgeList(e.target.value.toLowerCase(), activeFilter);
    };

    const fileInput = overlay.querySelector('#knowledge-file-input');
    overlay.querySelector('#knowledge-upload-btn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(f => {
        knowledgeItems.unshift({
          id: String(Date.now()),
          title: f.name,
          type: f.type.startsWith('image/') ? 'Images' : 'Documents',
          size: Math.round(f.size / 1024) + ' KB',
          date: 'Just now'
        });
      });
      renderKnowledgeList();
      showToast('✓ ' + files.length + ' file(s) ingested into Knowledge Base');
    };

    overlay.querySelector('#knowledge-add-url-btn').onclick = () => {
      const url = prompt('Enter Web URL / Documentation link:');
      if (url && url.trim()) {
        knowledgeItems.unshift({
          id: String(Date.now()),
          title: url.trim(),
          type: 'Web References',
          size: 'Remote URL',
          date: 'Just now'
        });
        renderKnowledgeList();
        showToast('✓ Web Reference saved: ' + url.trim());
      }
    };
  }

  function renderKnowledgeList(search = '', type = 'all') {
    const container = document.getElementById('knowledge-list-body');
    if (!container) return;

    let list = knowledgeItems;
    if (type !== 'all') list = list.filter(k => k.type === type);
    if (search) list = list.filter(k => k.title.toLowerCase().includes(search) || k.type.toLowerCase().includes(search));

    if (list.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; color: #64748b; text-align: center; padding: 40px;">No knowledge assets found</div>';
      return;
    }

    container.innerHTML = list.map(k => \`
      <div style="padding: 10px 14px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="color: #45C7E8;">\${MYRAA_NAV_ICONS.knowledge}</span>
          <div>
            <div style="font-size: 12px; font-weight: 600; color: #F4F6FA;">\${escapeHTML(k.title)}</div>
            <div style="font-size: 10px; color: #9AA4B5; display: flex; gap: 8px; margin-top: 2px;">
              <span style="color: #38bdf8;">\${escapeHTML(k.type)}</span>
              <span>•</span>
              <span>\${escapeHTML(k.size)}</span>
              <span>•</span>
              <span>\${escapeHTML(k.date)}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="myraa-btn myraa-btn-outline" style="font-size: 10px; padding: 3px 8px;" onclick="window.myraaUseKnowledge('\${k.id}')">Reference in Chat</button>
          <button class="myraa-btn myraa-btn-outline" style="font-size: 10px; padding: 3px 8px; color: #f87171;" onclick="window.myraaDeleteKnowledge('\${k.id}')">✕</button>
        </div>
      </div>
    \`).join('');
  }

  function openKnowledgeModal() {
    createKnowledgeModal();
    renderKnowledgeList();
    closeAllPanels();
    document.getElementById('myraa-knowledge-modal')?.classList.add('active');
  }

  window.myraaUseKnowledge = (id) => {
    const item = knowledgeItems.find(k => k.id === id);
    if (!item) return;
    const textarea = document.getElementById('myraa-composer-textarea');
    if (textarea) {
      textarea.value = (textarea.value ? textarea.value + ' ' : '') + '@[' + item.title + '] ';
      closeAllPanels();
      setActiveNav('chat');
      textarea.focus();
      showToast('✓ Knowledge asset referenced in chat');
    }
  };

  window.myraaDeleteKnowledge = (id) => {
    knowledgeItems = knowledgeItems.filter(k => k.id !== id);
    renderKnowledgeList();
    showToast('✓ Knowledge item removed');
  };

  // ── HELP & DOCUMENTATION MODAL ────────────────────────────────────────────
  function createHelpModal() {
    if (document.getElementById('myraa-help-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'myraa-help-modal';
    overlay.className = 'myraa-hud-overlay';
    overlay.innerHTML = \`
      <div class="myraa-hud-panel" style="max-width: 760px; height: 80vh;">
        <div class="myraa-hud-header">
          <div class="myraa-hud-title" style="color: #45C7E8;">
            <span>\${MYRAA_NAV_ICONS.help}</span> MYRAA AI OS — HELP & DOCUMENTATION
          </div>
          <button class="myraa-hud-close" id="help-close-btn">✕</button>
        </div>
        <div class="myraa-hud-body" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; color: #F4F6FA; font-size: 12px; line-height: 1.6;">
          <div style="background: rgba(69, 199, 232, 0.08); border: 1px solid rgba(69, 199, 232, 0.25); border-radius: 12px; padding: 14px;">
            <div style="font-weight: 700; color: #45C7E8; font-size: 13px; margin-bottom: 4px;">Core Operating Philosophy: "Less Interface, More Intelligence"</div>
            <p style="margin: 0; color: #cbd5e1;">The navigation is for organization. The chat is for action. You do not need to manually browse menus to trigger deep research, debugging, or code review. Simply state your intent in natural language or voice, and MYRAA will automatically select and coordinate the required skills, tools, and integrations.</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: #fff; margin-bottom: 8px;">Keyboard Shortcuts</div>
              <ul style="margin: 0; padding-left: 18px; color: #9AA4B5; display: flex; flex-direction: column; gap: 4px;">
                <li><kbd style="background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; color: #fff;">Enter</kbd> Send chat prompt</li>
                <li><kbd style="background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; color: #fff;">Shift+Enter</kbd> Multi-line input</li>
                <li><kbd style="background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; color: #fff;">Alt+A</kbd> Switch to Ask Mode</li>
                <li><kbd style="background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; color: #fff;">Alt+C</kbd> Switch to Act Mode</li>
                <li><kbd style="background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; color: #fff;">Esc</kbd> Close any modal or drawer</li>
              </ul>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: #fff; margin-bottom: 8px;">Voice Commands</div>
              <ul style="margin: 0; padding-left: 18px; color: #9AA4B5; display: flex; flex-direction: column; gap: 4px;">
                <li>"Hey MYRAA" — Wake word trigger</li>
                <li>"MYRAA, research this topic..."</li>
                <li>"MYRAA, analyze what is on my screen"</li>
                <li>"MYRAA, debug this project error"</li>
                <li>"MYRAA, find my previous conversation"</li>
              </ul>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
            <div style="font-weight: 700; color: #fff; margin-bottom: 6px;">Skills & Integrations Architecture</div>
            <p style="margin: 0 0 6px 0; color: #9AA4B5;">MYRAA features 139 active cognitive skills and real connectors across Development (GitHub, GitLab), Cloud (AWS, GCP), Communication (Gmail, WhatsApp, Slack), and Design (Figma, Canva). All skills run autonomously in the background.</p>
            <div style="font-size: 11px; color: #45C7E8;">Maintained for Vishwajeet • Version: v6.0 APEX Master</div>
          </div>
        </div>
      </div>
    \`;

    document.body.appendChild(overlay);

    overlay.querySelector('#help-close-btn').onclick = () => {
      overlay.classList.remove('active');
      setActiveNav('chat');
    };
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        setActiveNav('chat');
      }
    };
  }

  function openHelpModal() {
    createHelpModal();
    closeAllPanels();
    document.getElementById('myraa-help-modal')?.classList.add('active');
  }

  // ── SCREEN SHARING CONTROLLER ─────────────────────────────────────────────
  async function toggleScreenSharing() {
    const dot = document.getElementById('screen-share-dot');
    const label = document.getElementById('screen-share-label');
    const btn = document.getElementById('top-util-screen');

    if (isScreenSharingActive) {
      // Stop sharing
      if (activeScreenStream) {
        activeScreenStream.getTracks().forEach(t => t.stop());
        activeScreenStream = null;
      }
      isScreenSharingActive = false;
      if (dot) dot.style.display = 'none';
      if (label) label.textContent = 'Share Screen';
      if (btn) btn.classList.remove('active');
      showToast('Screen sharing stopped');
      return;
    }

    try {
      showToast('Requesting screen sharing permission...');
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      activeScreenStream = stream;
      isScreenSharingActive = true;

      if (dot) dot.style.display = 'inline-block';
      if (label) label.textContent = 'Stop Sharing';
      if (btn) btn.classList.add('active');

      showToast('● Screen Connected! MYRAA can now see your screen context.');

      stream.getVideoTracks()[0].onended = () => {
        isScreenSharingActive = false;
        activeScreenStream = null;
        if (dot) dot.style.display = 'none';
        if (label) label.textContent = 'Share Screen';
        if (btn) btn.classList.remove('active');
        showToast('Screen sharing ended');
      };
    } catch (err) {
      console.warn('Screen share cancelled or error:', err);
      showToast('Screen share not authorized: ' + err.message);
    }
  }

  // Backward compatibility aliases
  function injectHeaderNavButtons() {
    injectDesktopSidebar();
    injectTopUtilities();
  }
`;

const navStartIdx = content.indexOf(navStartMarker);
const navEndIdx = content.indexOf(navEndMarker);

if (navStartIdx !== -1 && navEndIdx !== -1) {
  content = content.substring(0, navStartIdx) + newNavJS + '\n\n  ' + content.substring(navEndIdx);
  console.log('Successfully replaced navigation JS functions!');
} else {
  console.error('Could not find Nav markers:', { navStartIdx, navEndIdx });
}

// ── 2. SIMPLIFY COMPOSER MODES (ASK vs ACT) ─────────────────────────────────
const oldModesDef = `  let currentComposerMode = 'build'; // 'build', 'plan', 'autonomous', 'review', 'safe'

  const COMPOSER_MODES = [
    { id: 'build', name: 'Build', desc: 'Make changes directly', shortcut: 'Alt+B' },
    { id: 'plan', name: 'Plan', desc: 'Discuss before building', shortcut: 'Alt+P' },
    { id: 'autonomous', name: 'Autonomous', desc: 'Full workflow execution', shortcut: 'Alt+A' },
    { id: 'review', name: 'Review', desc: 'Analyze before modifying', shortcut: 'Alt+R' },
    { id: 'safe', name: 'Safe Mode', desc: 'Ask confirmation for all actions', shortcut: 'Alt+S' }
  ];`;

const newModesDef = `  let currentComposerMode = 'ask'; // 'ask' (Default) or 'act'

  const COMPOSER_MODES = [
    { id: 'ask', name: 'Ask', desc: 'Chat, analyze and plan', shortcut: 'Alt+A' },
    { id: 'act', name: 'Act', desc: 'Take actions and complete tasks', shortcut: 'Alt+C' }
  ];`;

if (content.includes(oldModesDef)) {
  content = content.replace(oldModesDef, newModesDef);
  console.log('Successfully updated COMPOSER_MODES to Ask and Act!');
} else {
  console.log('Searching alternate modes pattern...');
  content = content.replace(/let currentComposerMode = '[^']*';[\s\S]*?const COMPOSER_MODES = \[[^\]]*\];/, newModesDef);
  console.log('Replaced modes via regex.');
}

// Set mode button default text to 'Ask'
content = content.replace('<span id="myraa-mode-btn-text">Build</span>', '<span id="myraa-mode-btn-text">Ask</span>');

// ── 3. CLEAN UP PLUS MENU IN COMPOSER ───────────────────────────────────────
// Remove manual action clutter from tools menu (Deep Research, Web Search, etc)
const actionsBlockRegex = /<div class="myraa-tool-section-label" style="margin-top: 6px;">ACTIONS<\/div>[\s\S]*?<div style="border-top: 1px solid rgba\(255,255,255,0.06\); padding-top: 4px; margin-top: 4px;">/;
if (actionsBlockRegex.test(content)) {
  content = content.replace(actionsBlockRegex, '<div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 4px; margin-top: 4px;">');
  console.log('Successfully removed manual action clutter from composer plus menu!');
}

// ── 4. CALL NEW INITIALIZERS ────────────────────────────────────────────────
content = content.replace('injectHeaderNavButtons();', 'injectDesktopSidebar(); injectTopUtilities();');
content = content.replace('injectHeaderNavButtons();', 'injectDesktopSidebar(); injectTopUtilities();');

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Saved final updated ui-health-patch.js to runtime dist!');

// Sync to Master copy
const masterPath = 'C:\\Users\\Vishwajeet\\Music\\Myraa\\resources\\app\\dist\\ui-health-patch.js';
fs.writeFileSync(masterPath, content, 'utf8');
console.log('Saved final updated ui-health-patch.js to master dist!');
