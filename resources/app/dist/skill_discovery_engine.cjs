/**
 * MYRAA AI OS — Universal Skill Discovery Engine & Skill Registry
 * Discovers, registers, indexes, and dynamically composes skills from:
 *   - C:\Users\Vishwajeet\Downloads\Skills (Primary Universal Library)
 *   - D:\Team of Vishwajeet\.agents\skills (Workspace Library)
 *   - %APPDATA%\MYRAA\skills (User Custom Library)
 *   - C:\Users\Vishwajeet\.gemini\config\skills (Global Built-in Skills)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const modelRouter = require('./model_router.cjs');

class SkillDiscoveryEngine {
  constructor() {
    this.primarySkillsDir = 'C:\\Users\\Vishwajeet\\Downloads\\Skills';
    this.workspaceSkillsDir = 'D:\\Team of Vishwajeet\\.agents\\skills';
    this.appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Application Support') : path.join(process.env.HOME, '.config'));
    this.userSkillsDir = path.join(this.appData, 'MYRAA', 'skills');
    this.globalSkillsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\Vishwajeet', '.gemini', 'config', 'skills');

    this.skillRegistry = new Map();
    this.categoryIndex = new Map();
    this.lastScanTime = null;

    this.scanAndRegisterAll();
  }

  /**
   * Scan all skill repositories and build SKILL_REGISTRY
   */
  scanAndRegisterAll() {
    this.skillRegistry.clear();
    this.categoryIndex.clear();

    const scanLocations = [
      { path: 'D:\\Team of Vishwajeet\\MYRAA\\skills', source: 'MYRAA Native Workspace' },
      { path: 'C:\\Users\\Vishwajeet\\Downloads\\MYRAA_ASTRA_SKILLS_PACK\\MYRAA_ASTRA_SKILLS_PACK\\skills', source: 'MYRAA Astra Skills Pack' },
      { path: this.primarySkillsDir, source: 'Universal Downloads Library' },
      { path: this.workspaceSkillsDir, source: 'Workspace Agents' },
      { path: this.userSkillsDir, source: 'User Custom' },
      { path: this.globalSkillsDir, source: 'Global Config' }
    ];

    for (const loc of scanLocations) {
      if (fs.existsSync(loc.path)) {
        try {
          const entries = fs.readdirSync(loc.path, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const skillDir = path.join(loc.path, entry.name);
              this._registerSkillDirectory(entry.name, skillDir, loc.source);
            }
          }
        } catch (e) {
          console.warn(`[Skill Discovery] Warning scanning ${loc.path}:`, e.message);
        }
      }
    }

    this.lastScanTime = new Date().toISOString();
    console.log(`[Skill Discovery] ✅ SKILL_REGISTRY initialized with ${this.skillRegistry.size} universal skills.`);
    return this.getRegistrySummary();
  }

  /**
   * Parse skill directory and construct standardized Skill Object
   */
  _registerSkillDirectory(skillId, skillDir, source) {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const skillJsonPath = path.join(skillDir, 'skill.json');
    const manifestJsonPath = path.join(skillDir, 'manifest.json');
    const packageJsonPath = path.join(skillDir, 'package.json');

    let name = skillId;
    let description = '';
    let category = 'GENERAL';
    let capabilities = [];
    let dependencies = [];
    let input_types = ['text'];
    let output_types = ['text'];
    let tools_required = ['terminal'];
    let risk_level = 'LOW';
    let version = '1.0.0';
    let rawInstructions = '';
    let sj = null;
    let mj = null;

    // 1. Read JSON metadata if present
    if (fs.existsSync(skillJsonPath)) {
      try {
        sj = JSON.parse(fs.readFileSync(skillJsonPath, 'utf8'));
        name = sj.name || name;
        description = sj.description || description;
        category = sj.category || category;
        capabilities = sj.capabilities || capabilities;
        dependencies = sj.dependencies || dependencies;
        input_types = sj.input_types || input_types;
        output_types = sj.output_types || output_types;
        tools_required = sj.tools_required || tools_required;
        risk_level = sj.risk_level || risk_level;
        version = sj.version || version;
      } catch (e) {}
    } else if (fs.existsSync(manifestJsonPath)) {
      try {
        mj = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
        name = mj.name || name;
        description = mj.description || description;
        version = mj.version || version;
      } catch (e) {}
    }

    // 2. Read and parse SKILL.md
    if (fs.existsSync(skillMdPath)) {
      try {
        rawInstructions = fs.readFileSync(skillMdPath, 'utf8');
        if (rawInstructions.startsWith('---')) {
          const parts = rawInstructions.split('---');
          if (parts.length >= 3) {
            const frontmatter = parts[1];
            const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
            const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
            const catMatch = frontmatter.match(/^category:\s*(.+)$/m);
            if (nameMatch && !name) name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
            if (descMatch && !description) description = descMatch[1].trim().replace(/^["']|["']$/g, '');
            if (catMatch) category = catMatch[1].trim().replace(/^["']|["']$/g, '');
          }
        }
      } catch (e) {}
    }

    if (!description) {
      const firstLine = rawInstructions.split('\n').find(l => l.trim().length > 0 && !l.startsWith('#')) || '';
      description = firstLine.slice(0, 180).trim() || `Universal AI capability for ${name}`;
    }

    // 3. Heuristic Classification & Capability Deduction
    const textBlob = `${name} ${skillId} ${description} ${category}`.toLowerCase();

    if (textBlob.includes('legal') || textBlob.includes('contract') || textBlob.includes('risk-scoring') || textBlob.includes('compliance')) {
      category = 'LEGAL ASSISTANCE';
      capabilities.push('contract_review', 'risk_scoring', 'legal_research', 'compliance_audit');
      input_types.push('document', 'pdf', 'docx');
      output_types.push('report', 'risk_score');
      risk_level = 'LOW';
    } else if (textBlob.includes('test') || textBlob.includes('qa') || textBlob.includes('webapp-testing') || textBlob.includes('playwright') || textBlob.includes('selenium')) {
      category = 'QA TESTING';
      capabilities.push('playwright_testing', 'e2e_testing', 'regression_testing', 'ui_verification', 'test_automation');
      input_types.push('url', 'code', 'project');
      output_types.push('test_report', 'test_suite', 'screenshots');
      tools_required.push('browser', 'terminal');
      risk_level = 'MEDIUM';
    } else if (textBlob.includes('security') || textBlob.includes('guardian') || textBlob.includes('audit') || textBlob.includes('penetration') || textBlob.includes('vulnerability')) {
      category = 'SECURITY';
      capabilities.push('vulnerability_scan', 'secret_detection', 'owasp_review', 'auth_audit', 'threat_modeling');
      input_types.push('code', 'project', 'config');
      output_types.push('security_report');
      risk_level = 'LOW';
    } else if (textBlob.includes('seo') || textBlob.includes('sitemap') || textBlob.includes('robots')) {
      category = 'SEO';
      capabilities.push('technical_seo', 'meta_analysis', 'core_web_vitals', 'schema_markup', 'ranking_audit');
      input_types.push('url', 'html', 'sitemap');
      output_types.push('seo_report');
      tools_required.push('browser');
    } else if (textBlob.includes('deploy') || textBlob.includes('devops') || textBlob.includes('docker') || textBlob.includes('kubernetes') || textBlob.includes('ship') || textBlob.includes('ci/cd')) {
      category = 'DEPLOYMENT & DEVOPS';
      capabilities.push('docker_containerization', 'ci_cd_pipelines', 'cloud_deploy', 'kubernetes_manifests', 'build_automation');
      input_types.push('project', 'dockerfile', 'config');
      output_types.push('deployment_config', 'pipeline_yaml');
      tools_required.push('terminal', 'docker', 'cloud_deploy');
      risk_level = 'HIGH';
    } else if (textBlob.includes('sql') || textBlob.includes('postgres') || textBlob.includes('database') || textBlob.includes('database-optimizer') || textBlob.includes('supabase') || textBlob.includes('mongo')) {
      category = 'DATABASES';
      capabilities.push('schema_design', 'migration_generation', 'query_optimization', 'index_tuning');
      input_types.push('schema', 'query', 'sql');
      output_types.push('sql_migration', 'optimization_report');
      tools_required.push('database');
      risk_level = 'MEDIUM';
    } else if (textBlob.includes('frontend') || textBlob.includes('ui') || textBlob.includes('design') || textBlob.includes('canvas') || textBlob.includes('excalidraw') || textBlob.includes('web-artifacts') || textBlob.includes('open-design')) {
      category = 'WEB DEVELOPMENT & UI/UX';
      capabilities.push('ui_design', 'responsive_layout', 'component_architecture', 'interactive_prototypes', 'tailwind_styling');
      input_types.push('prompt', 'wireframe', 'spec');
      output_types.push('react_component', 'html_css', 'design_tokens');
    } else if (textBlob.includes('docx') || textBlob.includes('pdf') || textBlob.includes('pptx') || textBlob.includes('doc-coauthoring') || textBlob.includes('office')) {
      category = 'DOCUMENT PROCESSING';
      capabilities.push('pdf_extraction', 'word_generation', 'presentation_design', 'table_extraction');
      input_types.push('pdf', 'docx', 'pptx', 'xlsx');
      output_types.push('document', 'report');
    } else if (textBlob.includes('instagram') || textBlob.includes('remotion') || textBlob.includes('video') || textBlob.includes('reel')) {
      category = 'VIDEO & SOCIAL';
      capabilities.push('video_editing', 'scene_generation', 'social_campaigns', 'remotion_rendering');
      input_types.push('video', 'image', 'script');
      output_types.push('video_file', 'caption_script');
    } else if (textBlob.includes('copywriting') || textBlob.includes('marketing') || textBlob.includes('humanizer') || textBlob.includes('internal-comms') || textBlob.includes('changelog')) {
      category = 'WRITING & MARKETING';
      capabilities.push('persuasive_copy', 'technical_writing', 'changelog_synthesis', 'marketing_strategy');
      input_types.push('draft', 'release_notes', 'brief');
      output_types.push('copy', 'markdown_doc');
    } else if (textBlob.includes('mcp') || textBlob.includes('agent') || textBlob.includes('ml-failure') || textBlob.includes('rag') || textBlob.includes('spec')) {
      category = 'AI & ARCHITECTURE';
      capabilities.push('mcp_protocol', 'agent_orchestration', 'spec_reverse_engineering', 'failure_auditing');
      input_types.push('spec', 'architecture_doc', 'code');
      output_types.push('mcp_server', 'spec_doc');
    } else {
      category = 'CODING & SOFTWARE ENGINEERING';
      capabilities.push('code_generation', 'refactoring', 'bug_fixing', 'architecture_design');
      input_types.push('code', 'issue', 'requirement');
      output_types.push('code_patch', 'full_source');
      tools_required.push('terminal', 'file_system');
    }

    const skillEntry = {
      id: skillId,
      name,
      description,
      category,
      capabilities: Array.from(new Set(capabilities)),
      dependencies,
      input_types: Array.from(new Set(input_types)),
      output_types: Array.from(new Set(output_types)),
      tools_required: Array.from(new Set(tools_required)),
      risk_level,
      status: 'ACTIVE',
      icon: (sj && (sj.icon || sj.image)) || (mj && (mj.icon || mj.image)) || 'icon.svg',
      image: (sj && (sj.image || sj.icon)) || (mj && (mj.image || mj.icon)) || 'icon.svg',
      title: name,
      version,
      path: skillDir,
      source,
      hasSkillMd: fs.existsSync(skillMdPath),
      instructionLength: rawInstructions.length
    };

    this.skillRegistry.set(skillId, skillEntry);

    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, []);
    }
    this.categoryIndex.get(category).push(skillId);
  }

  /**
   * Get all registered skills
   */
  getAllSkills() {
    return Array.from(this.skillRegistry.values());
  }

  /**
   * Get skill by ID
   */
  getSkill(skillId) {
    return this.skillRegistry.get(skillId) || null;
  }

  /**
   * Read full skill instructions from disk on demand
   */
  getSkillInstructions(skillId) {
    const skill = this.skillRegistry.get(skillId);
    if (!skill) return null;
    const skillMd = path.join(skill.path, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      return fs.readFileSync(skillMd, 'utf8');
    }
    return skill.description;
  }

  /**
   * Automatic Skill Selection for any user goal
   */
  matchSkillsForGoal(userGoal, options = {}) {
    const goalLower = userGoal.toLowerCase();
    const scoredSkills = [];

    for (const skill of this.skillRegistry.values()) {
      let score = 0;

      // 1. Direct name match
      if (goalLower.includes(skill.id.toLowerCase()) || goalLower.includes(skill.name.toLowerCase())) {
        score += 50;
      }

      // 2. Capability matches
      for (const cap of skill.capabilities) {
        if (goalLower.includes(cap.replace(/_/g, ' '))) {
          score += 20;
        }
      }

      // 3. Category match
      if (goalLower.includes(skill.category.toLowerCase())) {
        score += 15;
      }

      // 4. Keyword token matching
      const words = skill.description.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      for (const w of words) {
        if (goalLower.includes(w)) {
          score += 2;
        }
      }

      if (score > 0) {
        scoredSkills.push({ skill, score });
      }
    }

    scoredSkills.sort((a, b) => b.score - a.score);
    return scoredSkills.slice(0, options.limit || 5).map(s => s.skill);
  }

  /**
   * Create an intelligent Multi-Skill Composition Plan for complex tasks
   */
  composeSkillPlan(userGoal, context = {}) {
    const goalLower = userGoal.toLowerCase();
    const matched = this.matchSkillsForGoal(userGoal, { limit: 8 });

    const pipelineStages = [];

    // Stage 1: Planning / Spec
    const specSkill = this.skillRegistry.get('spec') || this.skillRegistry.get('feature-forge');
    if (specSkill) pipelineStages.push({ stage: '1. Requirements & Architecture', skill: specSkill.id, agent: 'planner' });

    // Stage 2: UI / Frontend
    if (goalLower.includes('web') || goalLower.includes('app') || goalLower.includes('ui') || goalLower.includes('dashboard') || goalLower.includes('site') || goalLower.includes('frontend')) {
      const uiSkill = this.skillRegistry.get('frontend-design') || this.skillRegistry.get('web-artifacts-builder') || this.skillRegistry.get('21st-ui-build');
      if (uiSkill) pipelineStages.push({ stage: '2. UI/UX & Frontend Architecture', skill: uiSkill.id, agent: 'frontend' });
    }

    // Stage 3: Database & Backend
    if (goalLower.includes('database') || goalLower.includes('backend') || goalLower.includes('api') || goalLower.includes('saas') || goalLower.includes('full-stack') || goalLower.includes('site')) {
      const dbSkill = this.skillRegistry.get('database-optimizer') || this.skillRegistry.get('sql-pro');
      const apiSkill = this.skillRegistry.get('api-designer') || this.skillRegistry.get('fastapi-expert');
      if (dbSkill) pipelineStages.push({ stage: '3. Database Modeling', skill: dbSkill.id, agent: 'database' });
      if (apiSkill) pipelineStages.push({ stage: '4. API Design & OpenAPI Specs', skill: apiSkill.id, agent: 'api' });
    }

    // Stage 4: Testing & QA (Playwright)
    const qaSkill = this.skillRegistry.get('webapp-testing') || this.skillRegistry.get('playwright-expert') || this.skillRegistry.get('test-master');
    if (qaSkill) pipelineStages.push({ stage: '5. Quality Assurance & E2E Testing', skill: qaSkill.id, agent: 'qa' });

    // Stage 5: Security Review
    const secSkill = this.skillRegistry.get('security-reviewer') || this.skillRegistry.get('secure-code-guardian');
    if (secSkill) pipelineStages.push({ stage: '6. Defensive Security Audit', skill: secSkill.id, agent: 'security' });

    // Stage 6: SEO Audit
    if (goalLower.includes('seo') || goalLower.includes('website') || goalLower.includes('site') || goalLower.includes('landing')) {
      const seoSkill = this.skillRegistry.get('seo-audit');
      if (seoSkill) pipelineStages.push({ stage: '7. Technical & Content SEO', skill: seoSkill.id, agent: 'seo' });
    }

    // Stage 7: DevOps & Ship
    const devopsSkill = this.skillRegistry.get('ship') || this.skillRegistry.get('devops-engineer') || this.skillRegistry.get('terraform-engineer');
    if (devopsSkill) pipelineStages.push({ stage: '8. Deployment & CI/CD Pipeline', skill: devopsSkill.id, agent: 'devops' });

    // Stage 8: Code Review
    const reviewSkill = this.skillRegistry.get('code-reviewer');
    if (reviewSkill) pipelineStages.push({ stage: '9. Final Code Review & Verification', skill: reviewSkill.id, agent: 'review' });

    return {
      userGoal,
      matchedPrimarySkills: matched.map(m => ({ id: m.id, name: m.name, category: m.category })),
      compositionPlan: pipelineStages,
      parallelExecutionAllowed: true
    };
  }

  /**
   * Summary overview of registered skills
   */
  getRegistrySummary() {
    const categories = {};
    for (const [cat, list] of this.categoryIndex.entries()) {
      categories[cat] = list.length;
    }
    return {
      totalSkills: this.skillRegistry.size,
      lastScanTime: this.lastScanTime,
      categories,
      primaryLocation: this.primarySkillsDir
    };
  }
}

const engine = new SkillDiscoveryEngine();
module.exports = engine;
