const fs = require('fs');
const path = require('path');

const targetPath = 'C:\\Users\\Vishwajeet\\AppData\\Local\\Programs\\MYRAA-AI-OS\\resources\\app\\dist\\ui-health-patch.js';
let content = fs.readFileSync(targetPath, 'utf8');

console.log('Original content length:', content.length);

// ── 1. REPLACE OLD LIQUID NAVIGATION CSS ─────────────────────────────────────
const oldCssMarker = '/* ── LIQUID NAVIGATION SYSTEM (Framer Liquid Nav Spec) ──────────────── */';
const nextCssMarker = '/* Clean Vector Tool Popover Icons */';

const newNavCSS = `/* =========================================================================
       MYRAA UNIFIED NAVIGATION SYSTEM (Desktop Sidebar & Top Utilities)
       Colors: Background: #0B0D12, Sidebar: #11141B, Accent: #45C7E8,
       Active: rgba(69, 199, 232, 0.10), Text Primary: #F4F6FA,
       Text Secondary: #9AA4B5, Borders: rgba(255, 255, 255, 0.07)
       ========================================================================= */

    /* Desktop Sidebar */
    #myraa-desktop-sidebar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      bottom: 0 !important;
      width: 240px !important;
      background: #11141B !important;
      border-right: 1px solid rgba(255, 255, 255, 0.07) !important;
      display: flex !important;
      flex-direction: column !important;
      z-index: 95 !important;
      padding: 16px 12px !important;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5) !important;
      transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      user-select: none !important;
      font-family: 'Outfit', 'Inter', -apple-system, system-ui, sans-serif !important;
    }

    #myraa-desktop-sidebar.collapsed {
      width: 64px !important;
      padding: 16px 8px !important;
    }

    /* Sidebar Brand Header */
    .myraa-sidebar-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 0 4px 16px 4px !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
      margin-bottom: 12px !important;
    }

    .myraa-sidebar-brand {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      text-decoration: none !important;
      cursor: pointer !important;
    }

    .myraa-sidebar-logo {
      width: 32px !important;
      height: 32px !important;
      border-radius: 9px !important;
      background: linear-gradient(135deg, rgba(69, 199, 232, 0.25) 0%, rgba(69, 199, 232, 0.05) 100%) !important;
      border: 1px solid rgba(69, 199, 232, 0.35) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #45C7E8 !important;
      flex-shrink: 0 !important;
    }

    .myraa-sidebar-title {
      font-family: 'Orbitron', 'Outfit', sans-serif !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      letter-spacing: 0.12em !important;
      color: #F4F6FA !important;
      white-space: nowrap !important;
      transition: opacity 0.2s ease !important;
    }

    #myraa-desktop-sidebar.collapsed .myraa-sidebar-title {
      display: none !important;
    }

    .myraa-sidebar-toggle-btn {
      background: transparent !important;
      border: none !important;
      color: #9AA4B5 !important;
      cursor: pointer !important;
      width: 26px !important;
      height: 26px !important;
      border-radius: 6px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: background 0.15s ease, color 0.15s ease !important;
    }

    .myraa-sidebar-toggle-btn:hover {
      background: rgba(255, 255, 255, 0.06) !important;
      color: #F4F6FA !important;
    }

    /* Section Labels */
    .myraa-sidebar-section-label {
      font-size: 10px !important;
      font-weight: 700 !important;
      letter-spacing: 0.1em !important;
      color: #5d6778 !important;
      text-transform: uppercase !important;
      padding: 10px 10px 4px 10px !important;
      white-space: nowrap !important;
    }

    #myraa-desktop-sidebar.collapsed .myraa-sidebar-section-label {
      text-align: center !important;
      font-size: 8px !important;
      padding: 10px 0 4px 0 !important;
    }

    /* Nav List & Items */
    .myraa-sidebar-nav-list {
      display: flex !important;
      flex-direction: column !important;
      gap: 3px !important;
      margin-bottom: 8px !important;
    }

    .myraa-sidebar-nav-item {
      display: flex !important;
      align-items: center !important;
      height: 44px !important;
      padding: 0 12px !important;
      border-radius: 10px !important;
      background: transparent !important;
      border: 1px solid transparent !important;
      color: #9AA4B5 !important;
      cursor: pointer !important;
      text-align: left !important;
      text-decoration: none !important;
      white-space: nowrap !important;
      font-size: 13.5px !important;
      font-weight: 500 !important;
      transition: all 0.18s ease !important;
      position: relative !important;
      outline: none !important;
      gap: 10px !important;
    }

    .myraa-sidebar-nav-item:hover {
      background: rgba(255, 255, 255, 0.04) !important;
      color: #F4F6FA !important;
    }

    .myraa-sidebar-nav-item.active {
      background: rgba(69, 199, 232, 0.10) !important;
      border-color: rgba(69, 199, 232, 0.25) !important;
      color: #F4F6FA !important;
    }

    .myraa-sidebar-nav-item.active .myraa-nav-dot {
      color: #45C7E8 !important;
      opacity: 1 !important;
    }

    .myraa-sidebar-nav-item.active .myraa-nav-icon {
      color: #45C7E8 !important;
    }

    .myraa-nav-dot {
      font-size: 9px !important;
      color: transparent !important;
      opacity: 0 !important;
      width: 8px !important;
      text-align: center !important;
      flex-shrink: 0 !important;
      transition: all 0.2s ease !important;
    }

    .myraa-nav-icon {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 20px !important;
      height: 20px !important;
      flex-shrink: 0 !important;
      color: #9AA4B5 !important;
      transition: color 0.18s ease !important;
    }

    .myraa-nav-text {
      flex: 1 !important;
      font-size: 13.5px !important;
      letter-spacing: 0.01em !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    #myraa-desktop-sidebar.collapsed .myraa-nav-text,
    #myraa-desktop-sidebar.collapsed .myraa-nav-dot {
      display: none !important;
    }

    #myraa-desktop-sidebar.collapsed .myraa-sidebar-nav-item {
      justify-content: center !important;
      padding: 0 !important;
    }

    .myraa-sidebar-badge {
      font-size: 10px !important;
      font-weight: 600 !important;
      padding: 2px 7px !important;
      border-radius: 999px !important;
      background: rgba(69, 199, 232, 0.15) !important;
      color: #45C7E8 !important;
      border: 1px solid rgba(69, 199, 232, 0.25) !important;
    }

    #myraa-desktop-sidebar.collapsed .myraa-sidebar-badge {
      display: none !important;
    }

    /* Top Utility Bar */
    .myraa-top-utilities {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin-left: auto !important;
      z-index: 80 !important;
    }

    .myraa-top-util-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      height: 32px !important;
      padding: 0 10px !important;
      border-radius: 8px !important;
      background: rgba(17, 20, 27, 0.85) !important;
      backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      color: #9AA4B5 !important;
      cursor: pointer !important;
      font-family: 'Outfit', 'Inter', -apple-system, sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      transition: all 0.18s ease !important;
      outline: none !important;
    }

    .myraa-top-util-btn:hover {
      background: rgba(255, 255, 255, 0.06) !important;
      border-color: rgba(69, 199, 232, 0.3) !important;
      color: #F4F6FA !important;
    }

    .myraa-top-util-btn.active {
      background: rgba(69, 199, 232, 0.12) !important;
      border-color: rgba(69, 199, 232, 0.4) !important;
      color: #45C7E8 !important;
    }

    .myraa-top-util-btn.myraa-top-util-icononly {
      padding: 0 !important;
      width: 32px !important;
      justify-content: center !important;
    }

    .top-util-dot {
      color: #22c55e !important;
      font-size: 10px !important;
      animation: pulseGreen 2s infinite ease-in-out !important;
    }

    @keyframes pulseGreen {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.2); }
    }

    /* Topics Dropdown Panel */
    #myraa-topics-panel {
      display: none;
      position: fixed;
      top: 56px;
      right: 180px;
      width: 320px;
      background: #11141B;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85);
      z-index: 10010;
      padding: 14px;
      backdrop-filter: blur(24px);
    }
    #myraa-topics-panel.active {
      display: block;
    }

    /* Recalls Panel */
    #myraa-recalls-panel {
      display: none;
      position: fixed;
      top: 56px;
      right: 80px;
      width: 420px;
      max-height: 80vh;
      background: #11141B;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 16px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9);
      z-index: 10010;
      padding: 18px;
      overflow-y: auto;
      backdrop-filter: blur(28px);
    }
    #myraa-recalls-panel.active {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Adjust main content when sidebar is present */
    @media (min-width: 1025px) {
      body.has-myraa-sidebar header {
        left: 240px !important;
        width: calc(100% - 240px) !important;
        transition: left 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      body.has-myraa-sidebar.sidebar-collapsed header {
        left: 64px !important;
        width: calc(100% - 64px) !important;
      }
      body.has-myraa-sidebar #cinematic-subtitles {
        left: calc(50% + 120px) !important;
      }
      body.has-myraa-sidebar.sidebar-collapsed #cinematic-subtitles {
        left: calc(50% + 32px) !important;
      }
      body.has-myraa-sidebar #myraa-ai-composer-wrapper {
        margin-left: auto !important;
        margin-right: auto !important;
      }
    }

    /* Tablet responsive (769px to 1024px) */
    @media (min-width: 769px) and (max-width: 1024px) {
      #myraa-desktop-sidebar {
        width: 64px !important;
        padding: 16px 8px !important;
      }
      #myraa-desktop-sidebar .myraa-sidebar-title,
      #myraa-desktop-sidebar .myraa-nav-text,
      #myraa-desktop-sidebar .myraa-nav-dot,
      #myraa-desktop-sidebar .myraa-sidebar-badge {
        display: none !important;
      }
      #myraa-desktop-sidebar .myraa-sidebar-section-label {
        font-size: 8px !important;
        text-align: center !important;
        padding: 10px 0 4px 0 !important;
      }
      #myraa-desktop-sidebar .myraa-sidebar-nav-item {
        justify-content: center !important;
        padding: 0 !important;
      }
      body.has-myraa-sidebar header {
        left: 64px !important;
        width: calc(100% - 64px) !important;
      }
    }

    /* Mobile responsive (<= 768px) */
    @media (max-width: 768px) {
      #myraa-desktop-sidebar {
        top: auto !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
        height: 56px !important;
        flex-direction: row !important;
        padding: 0 8px !important;
        border-right: none !important;
        border-top: 1px solid rgba(255, 255, 255, 0.07) !important;
        justify-content: space-around !important;
        align-items: center !important;
      }
      .myraa-sidebar-header,
      .myraa-sidebar-section-label,
      .myraa-nav-dot,
      .myraa-sidebar-badge {
        display: none !important;
      }
      .myraa-sidebar-nav-list {
        display: flex !important;
        flex-direction: row !important;
        width: 100% !important;
        justify-content: space-around !important;
        margin-bottom: 0 !important;
      }
      .myraa-sidebar-nav-item {
        height: 44px !important;
        flex-direction: column !important;
        gap: 2px !important;
        padding: 4px 8px !important;
        font-size: 10px !important;
      }
      .myraa-sidebar-nav-item .myraa-nav-text {
        font-size: 10px !important;
      }
      .myraa-top-util-btn span:not(.top-util-icon):not(.top-util-dot) {
        display: none !important;
      }
      .myraa-top-util-btn {
        width: 32px !important;
        padding: 0 !important;
        justify-content: center !important;
      }
    }
`;

const cssStartIdx = content.indexOf(oldCssMarker);
const cssEndIdx = content.indexOf(nextCssMarker);

if (cssStartIdx !== -1 && cssEndIdx !== -1) {
  content = content.substring(0, cssStartIdx) + newNavCSS + '\n\n    ' + content.substring(cssEndIdx);
  console.log('Successfully replaced navigation CSS!');
} else {
  console.error('Could not find CSS markers:', { cssStartIdx, cssEndIdx });
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Saved patched CSS to:', targetPath);
