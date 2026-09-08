'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '.myraa-data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
const CORRECTIONS_FILE   = path.join(DATA_DIR, 'corrections.json');
const DOC_SKILLS_FILE    = path.join(DATA_DIR, 'doc_design_skills.json');

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT DOCUMENT DESIGN SKILLS (fallback if user hasn't taught Myraa yet)
// ─────────────────────────────────────────────────────────────────────────────
const DOC_DEFAULTS = {
  word: {
    header_color:   '#0078D7',
    accent_color:   '#0078D7',
    body_font:      'Segoe UI',
    heading_style:  'Heading 1',
    table_style:    'Table Grid',
    page_numbers:   true,
    toc:            true
  },
  excel: {
    header_bg:        '0A192F',
    header_font_color: '00E5FF',
    body_font:        'Segoe UI',
    chart_type:       'bar',
    number_format:    '#,##0.00',
    freeze_panes:     true,
    conditional_fmt:  true
  },
  powerpoint: {
    slide_accent_color: 'A855F7',
    title_color:        '00E5FF',
    bg_color:           '030712',
    title_font:         'Segoe UI',
    body_font:          'Segoe UI',
    slide_theme:        'dark_myraa'
  }
};

const MistakeLearningEngine = {
  // ── Corrections (existing behaviour) ────────────────────────────────────
  getCorrections() {
    try {
      if (fs.existsSync(CORRECTIONS_FILE)) return JSON.parse(fs.readFileSync(CORRECTIONS_FILE, 'utf8'));
    } catch (err) { console.error('[MistakeEngine] Error reading corrections:', err); }
    return [];
  },

  saveCorrections(corrections) {
    try { fs.writeFileSync(CORRECTIONS_FILE, JSON.stringify(corrections, null, 2), 'utf8'); return true; }
    catch (err) { console.error('[MistakeEngine] Error saving corrections:', err); return false; }
  },

  recordCorrection(input) {
    const corrections = this.getCorrections();
    const entry = {
      id: 'cor_' + Date.now(),
      wrongBehavior:   input.wrongBehavior  || input.mistake    || 'Unspecified behavior',
      correctBehavior: input.correctBehavior || input.correction || 'Desired behavior',
      category: input.category || 'general',
      context:  input.context  || '',
      timesPrevented: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    corrections.unshift(entry);
    this.saveCorrections(corrections);
    return { success: true, correction: entry };
  },

  deleteCorrection(id) {
    let corrections = this.getCorrections();
    const initialLen = corrections.length;
    corrections = corrections.filter(c => c.id !== id);
    this.saveCorrections(corrections);
    return { success: corrections.length < initialLen };
  },

  clearAll() { this.saveCorrections([]); return { success: true }; },

  getSystemInstructionInjection() {
    const corrections = this.getCorrections();
    if (!corrections || corrections.length === 0) return '';
    const lines = corrections.slice(0, 15).map(c =>
      `- DO NOT: "${c.wrongBehavior}". INSTEAD: "${c.correctBehavior}".`
    );
    return (
      '\n=== MISTAKE PREVENTION DIRECTIVES (MANDATORY USER CORRECTIONS) ===\n' +
      'MYRAA must never repeat these logged user corrections under any circumstances:\n' +
      lines.join('\n') +
      '\n==================================================================\n'
    );
  },

  // ── Document Design Skills (new) ─────────────────────────────────────────
  _readDocSkills() {
    try {
      if (fs.existsSync(DOC_SKILLS_FILE)) return JSON.parse(fs.readFileSync(DOC_SKILLS_FILE, 'utf8'));
    } catch(_) {}
    return {};
  },

  _writeDocSkills(skills) {
    try { fs.writeFileSync(DOC_SKILLS_FILE, JSON.stringify(skills, null, 2), 'utf8'); return true; }
    catch(_) { return false; }
  },

  /**
   * Save a learned formatting correction.
   * @param {string} docType  - 'word' | 'excel' | 'powerpoint'
   * @param {string} aspect   - e.g. 'header_color', 'chart_type'
   * @param {*}      value    - the corrected value
   */
  saveDocSkill(docType, aspect, value) {
    const skills = this._readDocSkills();
    if (!skills[docType]) skills[docType] = {};
    skills[docType][aspect] = {
      value,
      learnedAt: new Date().toISOString(),
      source: 'user_correction'
    };
    this._writeDocSkills(skills);
    return { success: true, docType, aspect, value };
  },

  /**
   * Get a formatting value. User corrections override defaults.
   */
  getDocSkill(docType, aspect) {
    const skills = this._readDocSkills();
    const learned = skills[docType] && skills[docType][aspect];
    if (learned) return learned.value;
    const defaults = DOC_DEFAULTS[docType] || {};
    return defaults[aspect] !== undefined ? defaults[aspect] : null;
  },

  /**
   * Return all learned skills for a docType, merged with defaults.
   */
  getDocSkillsForType(docType) {
    const skills = this._readDocSkills();
    const learned = skills[docType] || {};
    const defaults = DOC_DEFAULTS[docType] || {};
    const merged = { ...defaults };
    for (const [k, v] of Object.entries(learned)) merged[k] = v.value;
    return merged;
  },

  /**
   * Return all doc design skills (all docTypes).
   */
  getAllDocSkills() {
    const skills = this._readDocSkills();
    const result = {};
    for (const docType of ['word','excel','powerpoint']) {
      result[docType] = this.getDocSkillsForType(docType);
    }
    return result;
  }
};

module.exports = MistakeLearningEngine;
