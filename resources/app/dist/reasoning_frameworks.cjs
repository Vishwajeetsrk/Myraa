'use strict';
/**
 * MYRAA Reasoning Frameworks
 * =============================================================================
 * Structured scaffolds for product, engineering, security, legal-awareness and
 * reporting work. These frameworks are deliberately EVIDENCE-GATED:
 *
 *   - A field is PROVIDED only when the caller supplied a real value.
 *   - Everything else is UNKNOWN, NOT_ASSESSED or NOT_CHECKED.
 *   - No market demand, legal requirement, security status, deployment,
 *     test result or source citation is ever invented.
 *
 * A framework is a way of thinking and reporting, not a claim that research
 * was performed. Live research still needs a real tool call and real sources.
 */

const EVIDENCE_LABELS = [
  'Found', 'Verified', 'Inferred', 'Estimated', 'Suggested',
  'Unknown', 'Not found', 'Unsupported', 'Failed', 'Partially completed',
];

const EVIDENCE_BUCKETS = ['observed', 'research', 'inferred', 'hypothesis', 'unknown', 'notFound'];

const FRAMEWORKS = {
  websiteRealityCheck: {
    title: 'Website Reality Check',
    sections: [
      ['user', 'Who is this for?'],
      ['problem', 'What actual problem is being solved?'],
      ['value', 'Why should anyone care?'],
      ['differentiation', 'Why this instead of existing alternatives?'],
      ['trust', 'Why should users trust it?'],
      ['friction', 'What could stop someone from using it?'],
      ['conversion', 'What makes someone sign up?'],
      ['payment', 'What makes someone pay?'],
      ['retention', 'What makes them return?'],
      ['failure', 'What could make the product fail?'],
    ],
  },
  realityCheck: {
    title: 'Reality Check',
    sections: [
      ['strongestReasonToBuild', 'Strongest reason to build'],
      ['strongestReasonNotToBuild', 'Strongest reason not to build'],
      ['biggestUnknown', 'Biggest unknown'],
      ['cheapestValidation', 'Cheapest validation'],
      ['biggestTechnicalRisk', 'Biggest technical risk'],
      ['biggestSecurityRisk', 'Biggest security risk'],
      ['biggestLegalRisk', 'Biggest legal risk'],
      ['biggestBusinessRisk', 'Biggest business risk'],
      ['biggestAdoptionRisk', 'Biggest adoption risk'],
      ['whatUsersMayHate', 'What users may hate'],
      ['whatUsersMayLove', 'What users may love'],
      ['whatCompetitorsAlreadyDo', 'What competitors already do'],
      ['genuineDifferentiation', 'What is genuinely differentiated'],
      ['recommendedMvp', 'Recommended MVP'],
      ['removeFromMvp', 'What to remove from MVP'],
    ],
  },
  prd: {
    title: 'SaaS Product Requirements Document',
    sections: [
      ['problem', 'Problem'], ['user', 'User'], ['persona', 'Persona'],
      ['jobsToBeDone', 'Jobs to be done'], ['useCases', 'Use cases'],
      ['assumptions', 'Assumptions'], ['goals', 'Goals'], ['nonGoals', 'Non-goals'],
      ['scope', 'Product scope'], ['mvp', 'MVP'], ['v1', 'V1'],
      ['roadmap', 'Future roadmap'], ['functionalRequirements', 'Functional requirements'],
      ['nonFunctionalRequirements', 'Non-functional requirements'], ['uxRequirements', 'UX requirements'],
      ['security', 'Security'], ['privacy', 'Privacy'], ['performance', 'Performance'],
      ['integrations', 'Integrations'], ['analytics', 'Analytics'], ['billing', 'Billing'],
      ['onboarding', 'Onboarding'], ['support', 'Support'],
      ['operationalRequirements', 'Operational requirements'], ['risks', 'Risks'],
      ['dependencies', 'Dependencies'], ['acceptanceCriteria', 'Acceptance criteria'],
    ],
  },
  saasUserReality: {
    title: 'SaaS User Reality Check',
    sections: [
      ['willPeopleUse', 'Will people use this?'], ['willTheyPay', 'Will they pay?'],
      ['whoPays', 'Who pays?'], ['whyPay', 'Why would they pay?'],
      ['currentAlternative', 'What do they currently use?'], ['currentWorkaround', 'Current workaround'],
      ['painFrequency', 'Is the problem painful and frequent enough?'],
      ['betterThanNothing', 'Better than doing nothing?'],
      ['adoptionBlockers', 'What would stop adoption?'], ['churnCauses', 'What would cause churn?'],
      ['cheapestDemandTest', 'Cheapest way to test demand'], ['strongestEvidence', 'Strongest evidence'],
    ],
  },
  weaknessAudit: {
    title: 'SaaS Weakness Audit',
    sections: [
      ['valueProposition', 'Unclear value proposition'], ['onboarding', 'Weak onboarding'],
      ['retention', 'Poor retention'], ['activation', 'Weak activation'],
      ['unnecessaryFeatures', 'Unnecessary features'], ['missingIntegrations', 'Missing integrations'],
      ['performance', 'Poor performance'], ['mobile', 'Bad mobile experience'],
      ['accessibility', 'Poor accessibility'], ['securityRisks', 'Security risks'],
      ['privacyRisks', 'Privacy risks'], ['legalRisks', 'Legal risks'],
      ['pricingConfusion', 'Pricing confusion'], ['billing', 'Weak billing'],
      ['support', 'Bad support'], ['observability', 'Lack of observability'],
      ['errorHandling', 'Poor error handling'], ['dataModel', 'Poor data model'],
      ['scalability', 'Scalability problems'], ['infrastructureCost', 'Hidden infrastructure cost'],
      ['vendorLockIn', 'Vendor lock-in'], ['backups', 'Weak backups'],
      ['disasterRecovery', 'Weak disaster recovery'], ['documentation', 'Poor documentation'],
      ['analytics', 'Weak analytics'], ['auditTrails', 'Missing audit trails'],
      ['mediocreAreas', 'Things that are merely mediocre'],
    ],
  },
  whatWillBreak: {
    title: 'What Will Break Our SaaS?',
    sections: [
      ['productFailure', 'Product failure: nobody wants it'],
      ['uxFailure', 'UX failure: users cannot understand it'],
      ['technicalFailure', 'Technical failure: breaks under load'],
      ['securityFailure', 'Security failure: account or data compromise'],
      ['businessFailure', 'Business failure: costs exceed revenue'],
      ['marketFailure', 'Market failure: competitor copies or outperforms'],
      ['operationalFailure', 'Operational failure: team cannot support it'],
      ['legalFailure', 'Legal failure: required compliance missing'],
      ['dependencyFailure', 'Dependency failure: API or provider changes'],
      ['trustFailure', 'Trust failure: users lose confidence'],
      ['scaleFailure', 'Scale failure: architecture collapses'],
      ['founderFailure', 'Founder failure: too much complexity for too little value'],
    ],
  },
  securityReview: {
    title: 'SaaS Security Review',
    sections: [
      ['authentication', 'Authentication'], ['authorization', 'Authorization'],
      ['sessions', 'Sessions'], ['rbac', 'RBAC'], ['mfa', 'MFA'],
      ['passwordHandling', 'Password handling'], ['secrets', 'Secrets'],
      ['tokens', 'Tokens'], ['oauth', 'OAuth'], ['apiKeys', 'API keys'],
      ['encryption', 'Encryption'], ['tls', 'TLS'], ['databasePermissions', 'Database permissions'],
      ['tenantIsolation', 'Tenant isolation'], ['idor', 'IDOR'], ['ssrf', 'SSRF'],
      ['xss', 'XSS'], ['csrf', 'CSRF'], ['sqlInjection', 'SQL injection'],
      ['commandInjection', 'Command injection'], ['fileUpload', 'File upload'],
      ['pathTraversal', 'Path traversal'], ['deserialization', 'Insecure deserialization'],
      ['dependencies', 'Dependency vulnerabilities'], ['supplyChain', 'Supply-chain risks'],
      ['adminEndpoints', 'Exposed admin endpoints'], ['rateLimiting', 'Rate limiting'],
      ['bruteForce', 'Brute force'], ['abusePrevention', 'Abuse prevention'],
      ['logging', 'Logging'], ['monitoring', 'Monitoring'], ['backups', 'Backups'],
      ['incidentResponse', 'Incident response'], ['dataRetention', 'Data retention'],
      ['deletion', 'Deletion'], ['auditLogs', 'Audit logs'],
      ['standards', 'Applicable standards (OWASP ASVS/Top 10, secure SDLC, threat model, SBOM, SAST/DAST)'],
    ],
  },
  threatModel: {
    title: 'Threat Model',
    sections: [
      ['assets', 'Assets'], ['actors', 'Actors'], ['attackSurface', 'Attack surface'],
      ['threats', 'Threats'], ['likelihood', 'Likelihood'], ['impact', 'Impact'],
      ['risk', 'Risk'], ['controls', 'Controls'], ['residualRisk', 'Residual risk'],
    ],
  },
  privacyReview: {
    title: 'Privacy Review',
    sections: [
      ['collected', 'What data is collected'], ['purpose', 'Why it is collected'],
      ['necessity', 'Whether necessary'], ['storage', 'Where stored'],
      ['access', 'Who can access it'], ['retention', 'Retention'],
      ['deletion', 'Deletion'], ['consentNotice', 'Consent and notice requirements'],
      ['processors', 'Processor and vendor relationships'], ['sharing', 'Data sharing'],
      ['transfers', 'International transfers'], ['security', 'Security controls'],
      ['userRights', 'User rights'], ['breachHandling', 'Breach handling'],
    ],
  },
  contractReview: {
    title: 'Contract Review',
    sections: [
      ['termsOfService', 'Terms of Service'], ['privacyPolicy', 'Privacy Policy'],
      ['dpa', 'DPA'], ['sla', 'SLA'], ['subscription', 'Subscription terms'],
      ['refundPolicy', 'Refund policy'], ['acceptableUse', 'Acceptable use'],
      ['vendorAgreements', 'Vendor agreements'], ['processorAgreements', 'Processor agreements'],
      ['nda', 'NDA'], ['employmentTerms', 'Employment or contractor terms'],
      ['unclearLiability', 'Unclear liability'], ['termination', 'Missing termination terms'],
      ['ownership', 'Unclear ownership'], ['dataHandling', 'Data handling'],
      ['confidentiality', 'Confidentiality'], ['indemnity', 'Indemnity'],
      ['paymentTerms', 'Payment terms'], ['ipOwnership', 'IP ownership'],
      ['jurisdiction', 'Jurisdiction'], ['disputeResolution', 'Dispute resolution'],
    ],
  },
  aiProductReview: {
    title: 'AI Product Review',
    sections: [
      ['modelProviders', 'Model providers'], ['providerData', 'Data sent to providers'],
      ['retention', 'Provider retention'], ['trainingPolicies', 'Model training policies'],
      ['promptInjection', 'Direct prompt injection'], ['dataLeakage', 'Data leakage'],
      ['hallucination', 'Hallucination risk'], ['toolAccess', 'Tool access'],
      ['agentPermissions', 'Agent permissions'], ['tenantIsolation', 'Tenant isolation'],
      ['indirectInjection', 'Indirect prompt injection through files or pages'],
      ['unsafeToolCalls', 'Unsafe tool calls'], ['excessiveAgency', 'Excessive agency'],
      ['outputValidation', 'Output validation'],
    ],
  },
  agentSecurityReview: {
    title: 'AI Agent Security Boundaries',
    sections: [
      ['userPrompt', 'User to prompt boundary'],
      ['promptAgent', 'Prompt to agent boundary'],
      ['agentTools', 'Agent to tools boundary'],
      ['toolsExternal', 'Tools to external content boundary'],
      ['externalActions', 'External content to actions boundary'],
      ['promptInjection', 'Prompt injection'], ['maliciousWebsites', 'Malicious websites'],
      ['maliciousDocuments', 'Malicious documents'], ['poisonedRepositories', 'Poisoned repositories'],
      ['unsafeMcp', 'Unsafe MCP servers'], ['credentialTheft', 'Credential theft'],
      ['toolAbuse', 'Tool abuse'], ['exfiltration', 'Data exfiltration'],
      ['unauthorizedActions', 'Unauthorized actions'],
    ],
  },
  researchPlan: {
    title: 'Research Plan',
    sections: [
      ['problem', 'Understand the problem'], ['existing', 'Search existing solutions'],
      ['compare', 'Compare options'], ['weaknesses', 'Find weaknesses'],
      ['buildNecessity', 'Determine whether building is necessary'],
      ['integration', 'Identify integration options'], ['implementationCost', 'Estimate implementation cost'],
      ['maintenance', 'Estimate maintenance'], ['scalability', 'Estimate scalability'],
      ['recommendation', 'Recommend the smallest reliable solution'],
    ],
  },
  doWeNeedToBuild: {
    title: 'Do We Even Need To Build This?',
    sections: [
      ['existingSoftware', 'Can existing software solve this?'],
      ['api', 'Can an API solve this?'], ['mcp', 'Can an MCP solve this?'],
      ['excel', 'Can Excel solve this?'], ['automation', 'Can automation solve this?'],
      ['configuration', 'Can configuration solve this?'],
      ['smallScript', 'Can a small script solve this?'],
      ['existingCapability', "Can MYRAA's existing capability solve this?"],
      ['justification', 'If building, why is it justified?'],
    ],
  },
  severityBugReport: {
    title: 'Bug Report',
    sections: [
      ['bug', 'Bug'], ['severity', 'Severity (Critical/High/Medium/Low)'],
      ['environment', 'Environment'], ['steps', 'Steps to reproduce'],
      ['expected', 'Expected'], ['actual', 'Actual'], ['evidence', 'Evidence'],
      ['rootCause', 'Root cause'], ['fix', 'Fix'], ['regressionTest', 'Regression test'],
      ['status', 'Status'],
    ],
  },
  repoHealth: {
    title: 'Repository Health',
    sections: [
      ['product', 'Product'], ['architecture', 'Architecture'], ['security', 'Security'],
      ['quality', 'Quality'], ['testing', 'Testing'], ['deployment', 'Deployment'],
      ['documentation', 'Documentation'], ['performance', 'Performance'],
      ['maintainability', 'Maintainability'],
      ['reviewed', 'Reviewed items (README, manifests, env files, secrets, dependencies, licenses, tests, CI/CD, Docker, deployment, database, logging, monitoring, error handling, stale/dead code, TODOs, FIXME, security warnings)'],
    ],
  },
  prioritization: {
    title: 'Product + Engineering Prioritization',
    sections: [
      ['userImpact', 'User impact'], ['businessImpact', 'Business impact'],
      ['revenueImpact', 'Revenue impact'], ['riskReduction', 'Risk reduction'],
      ['engineeringEffort', 'Engineering effort'], ['timeToValue', 'Time to value'],
      ['confidence', 'Confidence'], ['quadrant', 'Quadrant (high/low impact x effort)'],
    ],
  },
};

function hasValue(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function build(name, input = {}) {
  const f = FRAMEWORKS[name];
  if (!f) {
    return { ok: false, code: 'UNKNOWN_FRAMEWORK', error: `Unknown framework "${name}".`, available: Object.keys(FRAMEWORKS) };
  }
  const supplied = input && typeof input === 'object' ? input : {};
  const sections = f.sections.map(([key, label]) => {
    const value = supplied[key];
    const provided = hasValue(value);
    return {
      key,
      label,
      status: provided ? 'PROVIDED' : (f.defaultStatus || 'UNKNOWN'),
      value: provided ? value : (f.unknownText || 'UNKNOWN — no evidence supplied'),
    };
  });

  const result = {
    ok: true,
    framework: name,
    title: f.title,
    method: 'evidence-gated scaffold; no research or verification performed by this function',
    sections,
    providedCount: sections.filter((s) => s.status === 'PROVIDED').length,
    unknownCount: sections.filter((s) => s.status !== 'PROVIDED').length,
    evidencePolicy: {
      labels: EVIDENCE_LABELS,
      buckets: EVIDENCE_BUCKETS,
      rule: 'Only values supplied by the caller are PROVIDED. Everything else stays UNKNOWN. Tier 4 sources are never treated as confirmed facts.',
    },
    neverFabricate: [
      'market demand', 'legal requirements', 'security status', 'completed deployment',
      'test results', 'user preferences', 'source citations', 'customer quotes',
    ],
  };
  return result;
}

function plans(input = {}) {
  const complexity = ['small', 'medium', 'large'].includes(String(input.complexity || '').toLowerCase())
    ? String(input.complexity).toLowerCase() : 'unknown';
  const supplied = input && typeof input === 'object' ? input : {};
  const horizons = [
    {
      horizon: '1 hour',
      goal: 'Prove the idea quickly',
      candidateProofs: ['clickable prototype', 'landing page', 'simple demo', 'manual workflow', 'proof of concept', 'customer interview script'],
      status: hasValue(supplied.oneHour) ? 'PROVIDED' : 'UNKNOWN',
      value: supplied.oneHour || 'UNKNOWN — no proof-of-concept evidence supplied',
    },
    {
      horizon: '1 day',
      goal: 'Usable MVP',
      candidateComponents: ['database', 'authentication', 'core workflow', 'UI', 'basic API', 'deployment', 'analytics', 'basic error handling'],
      status: hasValue(supplied.oneDay) ? 'PROVIDED' : 'UNKNOWN',
      value: supplied.oneDay || 'UNKNOWN — no scoped MVP supplied',
    },
    {
      horizon: '7 days',
      goal: 'Serious MVP',
      candidateComponents: ['polished UX', 'core features', 'onboarding', 'billing if needed', 'security baseline', 'monitoring', 'testing', 'documentation', 'deployment', 'customer feedback loop'],
      status: hasValue(supplied.sevenDays) ? 'PROVIDED' : 'UNKNOWN',
      value: supplied.sevenDays || 'UNKNOWN — no scoped week plan supplied',
    },
  ];
  return {
    ok: true,
    framework: 'plans',
    title: '1 Hour / 1 Day / 7 Day Planning',
    complexity,
    horizons,
    estimatePolicy: 'Estimates are not promises. Complexity is unknown unless supplied. Do not claim a timeline is achievable without checking the real scope, dependencies and environment.',
    status: complexity === 'unknown' ? 'UNKNOWN' : 'PROVIDED',
  };
}

const INDIA_CHECKLIST = [
  'Companies Act', 'LLP Act where applicable', 'GST', 'CGST', 'SGST', 'IGST',
  'GST invoicing requirements', 'export-of-services rules', 'FEMA', 'RBI rules/guidance',
  'payment regulations', 'Consumer Protection Act',
  'Consumer Protection (E-Commerce) Rules where applicable', 'Information Technology Act',
  'IT Rules where applicable', 'Digital Personal Data Protection Act',
  'Digital Personal Data Protection Rules (check current phased commencement, including 2025 Rules)',
  'CERT-In directions and current security guidance', 'Copyright', 'Trade Marks',
  'patents where relevant', 'contract law', 'employment/labour rules where applicable',
  'accessibility requirements where applicable', 'sector-specific regulations',
];

function legalAwareness(input = {}) {
  const supplied = input && typeof input === 'object' ? input : {};
  const required = [
    ['jurisdiction', 'Jurisdiction'], ['businessModel', 'Business model'],
    ['productCategory', 'Product category'], ['dataInvolved', 'Data involved'],
    ['users', 'Users'], ['transactionType', 'Transaction type'],
    ['currentSources', 'Official source URLs'], ['dateChecked', 'Date checked'],
    ['uncertainty', 'Uncertainty'], ['professionalReview', 'Professional review'],
  ];
  const fields = required.map(([key, label]) => ({
    key,
    label,
    status: hasValue(supplied[key]) ? 'PROVIDED' : 'UNKNOWN',
    value: supplied[key] || 'UNKNOWN — not supplied',
  }));
  const sourceUrls = Array.isArray(supplied.currentSources)
    ? supplied.currentSources
    : (hasValue(supplied.currentSources) ? [supplied.currentSources] : []);

  return {
    ok: true,
    framework: 'legalAwareness',
    title: 'Compliance Review',
    status: sourceUrls.length ? 'GAPS_OR_UNKNOWN' : 'UNKNOWN',
    jurisdiction: supplied.jurisdiction || 'UNKNOWN',
    fields,
    issues: Array.isArray(supplied.issues) ? supplied.issues : [],
    evidence: sourceUrls.length ? sourceUrls : [],
    currentOfficialSource: sourceUrls.length ? sourceUrls : 'NOT_CHECKED — no official source supplied',
    lastChecked: supplied.dateChecked || 'NOT_CHECKED',
    needsProfessionalReview: supplied.professionalReview || 'Required until a qualified lawyer/CA/CS confirms',
    applicability: supplied.jurisdiction && /india/i.test(String(supplied.jurisdiction))
      ? {
          note: 'Applicability cannot be asserted from memory. Check the actual current text and commencement dates on official sources before answering.',
          items: INDIA_CHECKLIST.map((item) => ({
            item,
            applicable: 'Unclear',
            why: 'NOT_ASSESSED',
            currentSource: 'NOT_CHECKED',
            dateChecked: 'NOT_CHECKED',
            actionRequired: 'NOT_ASSESSED',
            professionalReview: 'Recommended until verified',
          })),
        }
      : { note: 'Jurisdiction not supplied or not India; applicability NOT_ASSESSED.' },
    disclaimer: 'This is a structured legal-awareness workflow, not legal advice. Never say "this is legally compliant" without verified current sources and professional review where required.',
    sourceTiers: [
      'Tier 1: official government, standards, product documentation, official repositories',
      'Tier 2: maintainer documentation, academic papers, recognised security organisations',
      'Tier 3: established technical publications',
      'Tier 4: community, forums, Reddit, blogs — never confirmed without verification',
    ],
  };
}

function finalReport(input = {}) {
  const supplied = input && typeof input === 'object' ? input : {};
  const keys = [
    ['task', 'Task'], ['understood', 'What I understood'], ['changed', 'What I changed'],
    ['tools', 'Tools used'], ['files', 'Files changed'], ['tests', 'Tests'],
    ['verification', 'Verification'], ['risks', 'Risks'], ['missing', 'Missing'],
    ['nextStep', 'Recommended next step'],
  ];
  return {
    ok: true,
    framework: 'finalReport',
    title: 'Final Task Report',
    sections: keys.map(([key, label]) => ({
      key,
      label,
      status: hasValue(supplied[key]) ? 'PROVIDED' : 'UNKNOWN',
      value: supplied[key] || 'UNKNOWN — not supplied',
    })),
    honestyRule: 'Do not report a step as completed if a dependency, permission, account or environment prevented it. Use the exact status words: Found, Verified, Inferred, Estimated, Suggested, Unknown, Not found, Unsupported, Failed, Partially completed.',
  };
}

function decisionRule() {
  return {
    ok: true,
    framework: 'masterDecisionRule',
    title: 'Master Decision Rule',
    questions: [
      'What is the real goal?',
      'What is the smallest useful solution?',
      'What existing capability can solve this?',
      'What is the safest tool?',
      'What is the fastest reliable approach?',
      'What evidence supports this?',
      'What could go wrong?',
      'How do I verify success?',
    ],
    operatingLoop: ['SEE', 'UNDERSTAND', 'RESEARCH', 'CHALLENGE', 'PLAN', 'BUILD', 'EXECUTE', 'TEST', 'SECURE', 'VERIFY', 'DEPLOY', 'MONITOR', 'LEARN', 'IMPROVE'],
  };
}

const STATUS = {
  ok: true,
  service: 'reasoning-frameworks',
  method: 'evidence-gated structured scaffolds; no research or execution performed here',
  frameworks: Object.keys(FRAMEWORKS),
  additional: ['plans', 'legalAwareness', 'finalReport', 'masterDecisionRule'],
  evidenceLabels: EVIDENCE_LABELS,
  policy: 'UNKNOWN is the default. Never fabricate demand, compliance, security, deployment, tests or sources.',
};

function invoke(name, input = {}) {
  switch (name) {
    case 'plans': return plans(input);
    case 'legalAwareness': return legalAwareness(input);
    case 'finalReport': case 'taskReport': return finalReport(input);
    case 'masterDecisionRule': return decisionRule();
    default: return build(name, input);
  }
}

module.exports = {
  STATUS,
  FRAMEWORKS,
  EVIDENCE_LABELS,
  EVIDENCE_BUCKETS,
  INDIA_CHECKLIST,
  invoke,
  build,
  plans,
  legalAwareness,
  finalReport,
  decisionRule,
};
