const fs = require('fs');
const filePath = 'resources/app/dist/ui-health-patch.js';
let content = fs.readFileSync(filePath, 'utf8');

const idx1 = content.indexOf('const COMPOSER_MODES = [');
// Find the end of COMPOSER_MODES array: '];'
const modesEnd = content.indexOf('];', idx1) + 2;

// Find 'let observerDebounceTimer'
const idx2 = content.indexOf('let observerDebounceTimer');

const replacement = `

  function getChipIcon(att) {
    if (att.svg) return att.svg;
    if (att.type === 'file' && (att.name && (att.name.endsWith('.png') || att.name.endsWith('.jpg') || att.name.endsWith('.webp')))) {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
    }
    if (att.type === 'screenshot') {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    }
    if (att.type === 'skill') {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    }
    if (att.type === 'github') {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>';
    }
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  }

  function renderComposerChips(container) {
    if (!container) return;
    if (activeAttachments.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    container.innerHTML = activeAttachments.map((att, idx) => 
      '<div class="myraa-card-chip">' +
      '<span style="display:inline-flex; align-items:center; color: #38bdf8;">' + getChipIcon(att) + '</span>' +
      '<span style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">' + escapeHTML(att.name || att.title || 'Attachment') + '</span>' +
      '<button type="button" class="myraa-card-chip-remove" onclick="window.myraaRemoveAttachment(' + idx + ')" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
      '</div>'
    ).join('');
  }

  function detectContextTitle(text) {
    if (!text || !text.trim()) return { title: 'Ask MYRAA', action: 'Ask MYRAA' };
    const lower = text.toLowerCase();
    if (lower.includes('seo') || lower.includes('meta') || lower.includes('google search')) {
      return { title: 'Review your SEO', action: 'Review SEO' };
    }
    if (lower.includes('build') || lower.includes('create') || lower.includes('generate') || lower.includes('make app')) {
      return { title: 'Build your project', action: 'Build Project' };
    }
    if (lower.includes('debug') || lower.includes('fix') || lower.includes('error') || lower.includes('crash') || lower.includes('bug')) {
      return { title: 'Debug your application', action: 'Debug Project' };
    }
    if (lower.includes('review') || lower.includes('audit') || lower.includes('inspect')) {
      return { title: 'Review your code', action: 'Review Code' };
    }
    if (lower.includes('deploy') || lower.includes('publish') || lower.includes('docker')) {
      return { title: 'Deploy your workspace', action: 'Deploy Project' };
    }
    if (lower.includes('test') || lower.includes('unit test') || lower.includes('qa')) {
      return { title: 'Run test suite', action: 'Run Tests' };
    }
    if (lower.includes('research') || lower.includes('search web') || lower.includes('find')) {
      return { title: 'Deep research & web search', action: 'Run Research' };
    }
    return { title: 'Ask MYRAA', action: 'Send Prompt' };
  }

  function upgradeComposerInterface() {
    const customWrapper = document.getElementById('myraa-ai-composer-wrapper');
    if (customWrapper) customWrapper.remove();

    try {
      localStorage.removeItem('myraa_composer_layout');
      localStorage.removeItem('myraa_nav_placement');
    } catch (e) {}

    const chatInput = document.querySelector('input[placeholder*="message to MYRAA"], input[aria-label="Message MYRAA"]') || document.getElementById('chat-input-field');
    if (!chatInput) return;
    const chatForm = chatInput.closest('form') || chatInput.closest('.bottom-input-container');
    if (chatForm) {
      chatForm.style.display = '';
      if (chatForm.dataset.composerUpgraded) {
        delete chatForm.dataset.composerUpgraded;
      }
      chatForm.style.width = '100%';
      chatForm.style.maxWidth = '640px';
      chatForm.style.margin = '0 auto';

      if (!chatForm.dataset.nativeHooked) {
        chatForm.dataset.nativeHooked = 'true';
        chatForm.addEventListener('submit', () => {
          const val = chatInput.value.trim();
          if (val) {
            if (window.setMyraaAvatarState) window.setMyraaAvatarState('THINKING');
            // Do NOT mutate #cinematic-subtitles DOM directly - React reconciler manages it!
          }
        });
      }
    }
  }

  const runObserverCycle = () => {
    // 1. Safe subtitle mirror to transcripts without mutating React DOM
    try {
      const sub = document.querySelector('#cinematic-subtitles h2');
      if (sub && sub.textContent) {
        const t = sub.textContent.trim();
        if (t && t !== sub.dataset.lastRecordedText && t.length > 5) {
          sub.dataset.lastRecordedText = t;
          try { addTranscriptTurn('model', t); } catch (e) {}
        }
      }
    } catch (e) { /* guard must never break the observer */ }

    // 2. Intelligent Error Armor: Auto-dismiss 1006/Network/GoAway modals, format Auth Failures
    const errorBox = document.querySelector('.bg-rose-950\\\\/40, [class*="bg-rose-950"]');
    if (errorBox && !errorBox.dataset.handled) {
      const text = errorBox.textContent || '';
      const isAuthFailure = /AUTH_FAILURE|api.?key|Google rejected|unauthorized|401|403|API_KEY_INVALID|NO_API_KEY/i.test(text);
      const isNetworkOrDrop = /1006|No close reason|GoAway|duration|client failed to close|network|abnormal/i.test(text);

      if (isNetworkOrDrop && !isAuthFailure) {
        const dismissBtn = errorBox.querySelector('button');
        if (dismissBtn) dismissBtn.click();
        else errorBox.remove();
      } else if (isAuthFailure) {
        errorBox.dataset.handled = 'true';
        const h4 = errorBox.querySelector('h4');
        const p = errorBox.querySelector('p');
        const existingBtn = errorBox.querySelector('button');

        if (h4) h4.textContent = 'AUTHENTICATION FAILURE (API KEY)';
        if (p) p.textContent = 'Google rejected the Gemini API key. Please update your API key in Settings to resume voice sessions.';

        if (existingBtn && !errorBox.querySelector('#myraa-fix-key-modal-btn')) {
          existingBtn.style.display = 'none';
          const btnGroup = document.createElement('div');
          btnGroup.className = 'flex items-center gap-3 mt-3';
          btnGroup.innerHTML = '<button id="myraa-fix-key-modal-btn" class="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-bold text-rose-200 font-mono transition-colors">OPEN SETTINGS TO FIX API KEY</button>' +
                                '<button id="myraa-dismiss-auth-modal-btn" class="text-[10px] font-bold text-rose-400/80 hover:text-rose-300 underline font-mono uppercase">Dismiss</button>';
          existingBtn.parentElement.appendChild(btnGroup);

          btnGroup.querySelector('#myraa-fix-key-modal-btn').onclick = () => {
            const settingsBtn = document.querySelector('button[title="Myraa Configuration"]') ||
                                Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('SETTINGS'));
            if (settingsBtn) settingsBtn.click();
            else if (typeof window.openMyraaSettingsModal === 'function') window.openMyraaSettingsModal();
            else openUpdateModal();
            existingBtn.click();
          };

          btnGroup.querySelector('#myraa-dismiss-auth-modal-btn').onclick = () => {
            existingBtn.click();
          };
        }
      }
    }

    // 3. Inject header buttons & enhance settings tabs & chat affordances
    initAceternitySidebar();
    injectHeaderNavButtons();
    enhanceSettingsTabs();
    upgradeComposerInterface();
  };

  `;

content = content.slice(0, modesEnd) + replacement + content.slice(idx2);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched ui-health-patch.js!');
