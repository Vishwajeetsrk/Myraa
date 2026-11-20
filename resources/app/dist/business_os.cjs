"use strict";
/**
 * MYRAA Business OS — business awareness + reporting layer.
 *
 * Read-only by default. Reads the business workspace (profile, pricing, CRM leads,
 * pipeline/payment state, finance tracker, templates) and produces:
 *  - a live summary (counts, revenue math, blockers)
 *  - a daily report (markdown)
 *  - lead queries with filters
 *  - template listing + safe placeholder rendering
 *  - a workspace inventory (spreadsheets, docs, images, email drafts)
 *
 * Truthfulness rules baked in:
 *  - Money collected is only what finance/pipeline state records as collected.
 *  - Missing/unreadable data is reported as UNAVAILABLE, never invented.
 *  - Unresolved template placeholders are reported, never silently blanked.
 *  - No writes unless an explicit save path is given and it stays inside the workspace.
 */

const fs = require("fs");
const path = require("path");

const STATUS = {
  OK: "OK",
  UNAVAILABLE: "UNAVAILABLE",
  INVALID: "INVALID",
};

const LEAD_STATUSES = [
  "NEW", "RESEARCHED", "QUALIFIED", "CONTACT_READY", "DRAFTED",
  "APPROVAL_REQUIRED", "CONTACTED", "REPLIED", "INTERESTED",
  "PROPOSAL_SENT", "INVOICE_SENT", "DEPOSIT_PAID", "IN_PROGRESS",
  "DELIVERED", "FINAL_PAYMENT_PENDING", "PAID", "LOST", "FOLLOW_UP",
];

const PIPELINE_STATUSES = new Set([
  "QUALIFIED", "CONTACT_READY", "DRAFTED", "APPROVAL_REQUIRED", "CONTACTED",
  "REPLIED", "INTERESTED", "PROPOSAL_SENT", "INVOICE_SENT", "FOLLOW_UP",
]);

const INVENTORY_EXTENSIONS = {
  spreadsheet: [".xlsx", ".xls", ".csv", ".tsv", ".xlsm"],
  document: [".md", ".docx", ".doc", ".pdf", ".txt"],
  image: [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"],
  template: [".html", ".hbs", ".ejs"],
  data: [".json", ".yml", ".yaml"],
  email: [".eml", ".msg"],
};

function cleanValue(value) {
  if (value == null) return null;
  let out = String(value).trim();
  out = out.replace(/\*\*/g, "");
  out = out.replace(/\s*\([^()]*\)\s*$/, "");
  return out.trim() || null;
}

// ---------------------------------------------------------------------------
// Workspace resolution
// ---------------------------------------------------------------------------

function workspaceDir() {
  if (process.env.MYRAA_BUSINESS_DIR) return path.resolve(process.env.MYRAA_BUSINESS_DIR);
  return path.resolve(__dirname, "..", "..", "..", "business");
}

function insideWorkspace(target, root) {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  const rel = path.relative(base, resolved);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return { ok: false, error: "not found", file };
    return { ok: true, data: JSON.parse(fs.readFileSync(file, "utf8")), file };
  } catch (err) {
    return { ok: false, error: err.message, file };
  }
}

function readTextSafe(file) {
  try {
    if (!fs.existsSync(file)) return { ok: false, error: "not found", file };
    return { ok: true, data: fs.readFileSync(file, "utf8"), file };
  } catch (err) {
    return { ok: false, error: err.message, file };
  }
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC4180-ish: quoted fields, escaped quotes, embedded newlines)
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((v) => String(v).trim() === "")) continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = r[c] !== undefined ? String(r[c]).trim() : "";
    records.push(obj);
  }
  return { header, records };
}

// ---------------------------------------------------------------------------
// Business data readers
// ---------------------------------------------------------------------------

function readPricing(root) {
  const res = readJsonSafe(path.join(root, "pricing.json"));
  if (!res.ok) return { status: STATUS.UNAVAILABLE, detail: res.error, packages: {}, target: null };
  const data = res.data || {};
  return {
    status: STATUS.OK,
    currency: data.currency || "USD",
    packages: data.packages || {},
    paymentTerms: data.paymentTerms || null,
    target: data.target || null,
    discountPolicy: data.discountPolicy || null,
  };
}

function readPipelineState(root) {
  const res = readJsonSafe(path.join(root, "state", "pipeline_state.json"));
  if (!res.ok) return { status: STATUS.UNAVAILABLE, detail: res.error };
  return { status: STATUS.OK, state: res.data };
}

function readPaymentModel(root) {
  const res = readJsonSafe(path.join(root, "state", "payment_state_model.json"));
  if (!res.ok) return { status: STATUS.UNAVAILABLE, detail: res.error };
  return { status: STATUS.OK, model: res.data };
}

function readFinance(root) {
  const res = readJsonSafe(path.join(root, "finance", "profit_tracker.json"));
  if (!res.ok) return { status: STATUS.UNAVAILABLE, detail: res.error, gross: 0, expenses: 0, net: 0 };
  const d = res.data || {};
  const gross = Number(d.revenue && d.revenue.collected) || 0;
  const expenseRows = Array.isArray(d.expenses) ? d.expenses : [];
  const expenses = expenseRows.reduce((sum, e) => sum + (Number(e && e.amount) || 0), 0);
  return {
    status: STATUS.OK,
    currency: d.currency || "USD",
    gross,
    expenses,
    net: gross - expenses,
    expenseCount: expenseRows.length,
    outstanding: Number(d.revenue && d.revenue.outstanding) || 0,
    pipelineWeighted: Number(d.pipeline && d.pipeline.weighted) || 0,
    note: (d.profit && d.profit.formula) || "gross_collected - expenses",
  };
}

function readLeads(root) {
  const file = path.join(root, "crm", "leads.csv");
  if (!fs.existsSync(file)) {
    return { status: STATUS.UNAVAILABLE, detail: "crm/leads.csv not found", leads: [], count: 0 };
  }
  const text = fs.readFileSync(file, "utf8");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { status: STATUS.OK, leads: [], count: 0, header: [] };
  }
  const header = rows[0].map((h) => h.trim());
  const records = [];
  const malformed = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((v) => String(v).trim() === "")) continue;
    if (r.length !== header.length) {
      malformed.push({ line: i + 1, expectedColumns: header.length, gotColumns: r.length, firstValue: r[0] || "" });
      continue; // never map a shifted row into the wrong fields
    }
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = r[c] !== undefined ? String(r[c]).trim() : "";
    records.push(obj);
  }

  return {
    status: STATUS.OK,
    leads: records,
    count: records.length,
    header,
    malformedRows: malformed.length,
    malformed: malformed.slice(0, 10),
    warning: malformed.length
      ? `${malformed.length} row(s) have the wrong column count and were excluded instead of being misfiled. First bad line: ${malformed[0].line}.`
      : null,
  };
}

function leadStats(leads) {
  const byStatus = {};
  const byIndustry = {};
  const byCountry = {};
  let withWebsite = 0;
  let withoutWebsite = 0;
  let withEmail = 0;
  let contacted = 0;
  let replied = 0;
  let interested = 0;

  for (const l of leads) {
    const status = (l.outreach_status || "NEW").toUpperCase();
    byStatus[status] = (byStatus[status] || 0) + 1;
    const industry = (l.industry || "unknown").toLowerCase();
    byIndustry[industry] = (byIndustry[industry] || 0) + 1;
    const country = (l.country || "unknown").toUpperCase();
    byCountry[country] = (byCountry[country] || 0) + 1;

    const ws = (l.website_status || "").toUpperCase();
    if (ws === "FOUND") withWebsite++;
    else if (ws === "NONE_FOUND" || ws === "SOCIAL_ONLY") withoutWebsite++;

    if (l.public_email && l.public_email.includes("@")) withEmail++;
    if (["CONTACTED", "REPLIED", "INTERESTED", "PROPOSAL_SENT", "INVOICE_SENT", "DEPOSIT_PAID", "IN_PROGRESS", "DELIVERED", "FINAL_PAYMENT_PENDING", "PAID"].includes(status)) contacted++;
    if (["REPLIED", "INTERESTED", "PROPOSAL_SENT", "INVOICE_SENT", "DEPOSIT_PAID", "IN_PROGRESS", "DELIVERED", "FINAL_PAYMENT_PENDING", "PAID"].includes(status)) replied++;
    if (["INTERESTED", "PROPOSAL_SENT", "INVOICE_SENT", "DEPOSIT_PAID", "IN_PROGRESS", "DELIVERED", "FINAL_PAYMENT_PENDING", "PAID"].includes(status)) interested++;
  }

  const pipelineLeads = leads.filter((l) => PIPELINE_STATUSES.has((l.outreach_status || "NEW").toUpperCase())).length;

  return {
    total: leads.length,
    byStatus,
    byIndustry,
    byCountry,
    withWebsite,
    withoutWebsite,
    withPublicEmail: withEmail,
    contacted,
    replied,
    interested,
    inPipeline: pipelineLeads,
    replyRate: contacted > 0 ? Number(((replied / contacted) * 100).toFixed(1)) : null,
    note: "Rates are null until there are real sends; never inferred.",
  };
}

function revenueMath(pricing, finance, pipelineState) {
  const target = (pricing.target && Number(pricing.target.revenueTarget)) ||
    (pipelineState && pipelineState.target && Number(pipelineState.target.revenueTarget)) || 1000;
  const avgDeal = (pricing.target && Number(pricing.target.averageDealAssumption)) || 200;
  const collected = finance.gross || 0;
  const remaining = Math.max(0, target - collected);
  return {
    currency: pricing.currency || "USD",
    target,
    collected,
    remaining,
    targetReached: collected >= target,
    averageDealAssumption: avgDeal,
    requiredDealsAtAssumption: avgDeal > 0 ? Math.ceil(remaining / avgDeal) : null,
    label: "Collected is verified money only. Invoice creation never counts as collected.",
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function listTemplates(root) {
  const dir = path.join(root, "templates");
  if (!fs.existsSync(dir)) return { status: STATUS.UNAVAILABLE, detail: "templates/ not found", templates: [] };
  const files = fs.readdirSync(dir).filter((f) => /\.(html|md|txt)$/i.test(f));
  return {
    status: STATUS.OK,
    templates: files.map((f) => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      return { name: f, bytes: stat.size, modified: stat.mtime.toISOString() };
    }),
  };
}

const PLACEHOLDER_RE = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

function renderTemplate(root, templateName, values) {
  if (!templateName || typeof templateName !== "string") {
    return { status: STATUS.INVALID, error: "template name required" };
  }
  const dir = path.join(root, "templates");
  const target = path.join(dir, templateName);
  if (!insideWorkspace(target, dir)) {
    return { status: STATUS.INVALID, error: "template path escapes templates folder" };
  }
  const read = readTextSafe(target);
  if (!read.ok) return { status: STATUS.UNAVAILABLE, error: read.error, template: templateName };

  const vars = values && typeof values === "object" ? values : {};
  const used = new Set();
  const unresolved = new Set();

  const output = read.data.replace(PLACEHOLDER_RE, (match, key) => {
    used.add(key);
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key] == null ? "" : vars[key]);
    }
    unresolved.add(key);
    return match; // keep placeholder visible — never silently blank
  });

  return {
    status: STATUS.OK,
    template: templateName,
    output,
    usedPlaceholders: Array.from(used).sort(),
    unresolvedPlaceholders: Array.from(unresolved).sort(),
    unresolvedCount: unresolved.size,
    note: "Unresolved placeholders are preserved verbatim so drafts cannot look complete by accident.",
  };
}

// ---------------------------------------------------------------------------
// Inventory (workspace awareness)
// ---------------------------------------------------------------------------

function scanInventory(root, opts) {
  const options = opts || {};
  const maxFiles = Math.min(Number(options.maxFiles) || 500, 2000);
  const skipDirs = new Set([".git", "node_modules", "finance", "backups"]);
  const buckets = { spreadsheet: [], document: [], image: [], template: [], data: [], other: [] };
  let scanned = 0;
  let truncated = false;

  function classify(ext) {
    for (const [bucket, exts] of Object.entries(INVENTORY_EXTENSIONS)) {
      if (exts.includes(ext)) return bucket;
    }
    return "other";
  }

  function walk(dir, depth) {
    if (truncated || depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (truncated) return;
      if (e.name.startsWith(".") && e.name !== ".gitignore") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) continue;
        walk(full, depth + 1);
      } else if (e.isFile()) {
        scanned++;
        if (scanned > maxFiles) { truncated = true; return; }
        const ext = path.extname(e.name).toLowerCase();
        let size = 0;
        try { size = fs.statSync(full).size; } catch { /* keep 0 */ }
        buckets[classify(ext)].push({
          path: path.relative(root, full).replace(/\\/g, "/"),
          bytes: size,
        });
      }
    }
  }

  if (!fs.existsSync(root)) {
    return { status: STATUS.UNAVAILABLE, detail: "business workspace not found", root };
  }
  walk(root, 0);

  const totals = {};
  for (const [k, v] of Object.entries(buckets)) totals[k] = v.length;

  return {
    status: STATUS.OK,
    root,
    scanned,
    truncated,
    totals,
    buckets,
    note: "finance/ is excluded from inventory to keep sensitive numbers out of casual listings; use /finance for totals.",
  };
}

function listSpreadsheets(root) {
  const inv = scanInventory(root, { maxFiles: 2000 });
  if (inv.status !== STATUS.OK) return inv;
  return {
    status: STATUS.OK,
    spreadsheets: inv.buckets.spreadsheet,
    count: inv.buckets.spreadsheet.length,
  };
}

// ---------------------------------------------------------------------------
// Profile parsing (lightweight, honest about what it found)
// ---------------------------------------------------------------------------

function readProfile(root) {
  const read = readTextSafe(path.join(root, "BUSINESS_PROFILE.md"));
  if (!read.ok) return { status: STATUS.UNAVAILABLE, detail: read.error };
  const lines = read.data.split(/\r?\n/);
  const sections = {};
  let current = "intro";
  for (const line of lines) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { current = h[1].trim(); sections[current] = []; continue; }
    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }
  const identity = {};
  for (const line of (sections["Identity"] || [])) {
    const m = line.match(/^-\s*([^:]+):\s*(.+)$/);
    if (m) identity[m[1].trim()] = cleanValue(m[2]);
  }
  const markets = {};
  const marketText = (sections["Markets"] || []).join("\n");
  const primary = marketText.match(/Primary[^:]*:\s*(.+)/i);
  if (primary) {
    markets.primary = primary[1].split(",").map((m) => {
      const v = cleanValue(m);
      return v ? v.replace(/\.$/, "").trim() : v;
    }).filter(Boolean);
  }
  const marketNote = marketText.match(/Note:\s*(.+)/i);
  if (marketNote) markets.note = cleanValue(marketNote[1]);
  return {
    status: STATUS.OK,
    studioName: identity["Studio name"] || null,
    branding: identity["Branding decision"] || null,
    markets,
    sectionNames: Object.keys(sections),
    rawLength: read.data.length,
  };
}

// ---------------------------------------------------------------------------
// Email awareness
// ---------------------------------------------------------------------------

function readProfileSection(root, name) {
  const read = readTextSafe(path.join(root, "BUSINESS_PROFILE.md"));
  if (!read.ok) return { status: STATUS.UNAVAILABLE, detail: read.error, text: "" };
  const lines = read.data.split(/\r?\n/);
  const wanted = String(name).toLowerCase();
  const out = [];
  let inSection = false;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { inSection = h[1].trim().toLowerCase() === wanted; continue; }
    if (inSection) out.push(line);
  }
  return { status: STATUS.OK, text: out.join("\n").trim() };
}

function emailConnectionState(root) {
  const section = readProfileSection(root, "Email");
  if (section.status !== STATUS.OK) {
    return { status: STATUS.UNAVAILABLE, detail: section.detail, address: null, connection: "UNKNOWN" };
  }
  const text = section.text;
  const addressMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const lower = text.toLowerCase();
  let connection = "UNKNOWN";
  if (/authentication required|no api|no oauth|not connected|no connection/.test(lower)) connection = "AUTHENTICATION_REQUIRED";
  else if (/connected|oauth token/.test(lower)) connection = "CONNECTED";
  return {
    status: STATUS.OK,
    address: addressMatch ? addressMatch[0] : null,
    connection,
    canSendAutomatically: connection === "CONNECTED",
    note: "Automated sending requires a secure OAuth connection. Nothing is sent from MYRAA without explicit owner approval.",
  };
}

const EMAIL_DIRS = ["emails", "outreach", path.join("crm", "drafts")];

function scanDrafts(root) {
  const drafts = [];
  let foundDir = null;
  for (const rel of EMAIL_DIRS) {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    foundDir = rel;
    for (const name of fs.readdirSync(dir)) {
      if (!/\.(md|txt|html|eml|msg)$/i.test(name)) continue;
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      drafts.push({ path: path.relative(root, full).replace(/\\/g, "/"), bytes: stat.size, modified: stat.mtime.toISOString() });
    }
  }
  return {
    status: STATUS.OK,
    draftsFolder: foundDir,
    draftCount: drafts.length,
    drafts,
    note: foundDir
      ? "Drafts listed here are local files only. A draft is never a send."
      : "No drafts folder exists yet. Outreach templates live in templates/outreach_templates.md and are approval-gated.",
  };
}

function listEmailTemplates(root) {
  const dir = path.join(root, "templates");
  if (!fs.existsSync(dir)) return { status: STATUS.UNAVAILABLE, templates: [] };
  const files = fs.readdirSync(dir).filter((f) => /(email|outreach|follow)/i.test(f) && /\.(md|html|txt)$/i.test(f));
  return {
    status: STATUS.OK,
    templates: files.map((f) => {
      const full = path.join(dir, f);
      const text = fs.readFileSync(full, "utf8");
      const headings = (text.match(/^#{2,3}\s+.+$/gm) || []).map((h) => h.replace(/^#+\s*/, "").trim());
      const placeholders = Array.from(new Set((text.match(PLACEHOLDER_RE) || []).map((p) => p.replace(/[{}]/g, "").trim())));
      return { name: f, bytes: fs.statSync(full).size, sections: headings, placeholders };
    }),
  };
}

function emailOverview(root) {
  const connection = emailConnectionState(root);
  const drafts = scanDrafts(root);
  const templates = listEmailTemplates(root);
  const leads = readLeads(root);
  const withEmail = leads.status === STATUS.OK ? leads.leads.filter((l) => (l.public_email || "").includes("@")).length : 0;
  return {
    status: connection.status === STATUS.OK ? STATUS.OK : connection.status,
    connection,
    drafts,
    templates,
    leadsWithPublicEmail: withEmail,
    outreachPolicy: "DRAFT -> APPROVAL_REQUIRED -> owner approves each send. No bulk sending, no inferred sends.",
  };
}

// ---------------------------------------------------------------------------
// Spreadsheet analysis via the existing Excel engine (no duplicate engine)
// ---------------------------------------------------------------------------

function analyzeDelimitedFile(target, relPath) {
  try {
    const text = fs.readFileSync(target, "utf8");
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return { status: STATUS.OK, file: relPath, engine: "business_os.csv", rowCount: 0, columnCount: 0, columns: [] };
    }
    const header = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
    const records = rows.slice(1).filter((r) => r.some((v) => String(v).trim() !== ""));
    const widths = Array.from(new Set(records.map((r) => r.length))).sort((a, b) => a - b);
    const columns = header.map((name, i) => ({
      name,
      nonEmpty: records.filter((r) => String(r[i] || "").trim() !== "").length,
    }));
    return {
      status: STATUS.OK,
      file: relPath,
      engine: "business_os.csv",
      rowCount: records.length,
      columnCount: header.length,
      columns,
      uniformWidth: widths.length <= 1,
      rowWidths: widths,
      note: "CSV/TSV parsed directly. The Excel engine handles .xlsx only; no parity is claimed.",
    };
  } catch (err) {
    return { status: STATUS.UNAVAILABLE, error: err.message, file: relPath };
  }
}

function analyzeSpreadsheet(root, relPath) {
  if (!relPath || typeof relPath !== "string") {
    return { status: STATUS.INVALID, error: "file required (path relative to business/)" };
  }
  const target = path.resolve(root, relPath);
  if (!insideWorkspace(target, root)) {
    return { status: STATUS.INVALID, error: "path escapes the business workspace" };
  }
  if (!fs.existsSync(target)) {
    return { status: STATUS.UNAVAILABLE, error: "file not found", file: relPath };
  }
  if (/\.(csv|tsv)$/i.test(target)) {
    return analyzeDelimitedFile(target, relPath);
  }
  let engine;
  try {
    engine = require(path.join(__dirname, "excel_intelligence.cjs"));
  } catch (err) {
    return { status: STATUS.UNAVAILABLE, error: "excel_intelligence.cjs not loadable", detail: err.message };
  }
  let result;
  try {
    result = engine.analyzeWorkbook({ file: target });
  } catch (err) {
    return { status: STATUS.UNAVAILABLE, error: "analysis threw", detail: err.message, file: relPath };
  }
  const ok = !(result && result.ok === false);
  return {
    status: ok ? STATUS.OK : STATUS.UNAVAILABLE,
    file: relPath,
    engine: "excel_intelligence.cjs",
    result,
    note: ok ? null : "The engine reports the analysis could not run. Its reason is preserved verbatim in result.error.",
  };
}

// ---------------------------------------------------------------------------
// Report archive (additive only)
// ---------------------------------------------------------------------------

function saveReport(root) {
  const report = dailyReport();
  if (report.status !== STATUS.OK) return report;
  const dir = path.join(root, "reports");
  try {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `report-${stamp}.md`;
    const file = path.join(dir, name);
    if (fs.existsSync(file)) {
      return { status: STATUS.INVALID, error: "report file already exists; refusing to overwrite", file: name };
    }
    fs.writeFileSync(file, report.markdown, "utf8");
    return {
      status: STATUS.OK,
      file: path.relative(root, file).replace(/\\/g, "/"),
      bytes: Buffer.byteLength(report.markdown, "utf8"),
      note: "Additive only; existing reports are never overwritten.",
    };
  } catch (err) {
    return { status: STATUS.UNAVAILABLE, error: err.message };
  }
}

function listReports(root) {
  const dir = path.join(root, "reports");
  if (!fs.existsSync(dir)) return { status: STATUS.OK, reports: [], count: 0 };
  const files = fs.readdirSync(dir).filter((f) => /\.(md|txt)$/i.test(f)).sort().reverse();
  return {
    status: STATUS.OK,
    count: files.length,
    reports: files.map((f) => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      return { name: f, bytes: stat.size, modified: stat.mtime.toISOString() };
    }),
  };
}

function dedupeBlockers(list) {
  const out = [];
  const keys = [];
  for (const raw of list) {
    if (!raw) continue;
    const text = String(raw).trim();
    if (!text) continue;
    const key = text.toLowerCase().replace(/\s*\([^)]*\)\s*/g, " ").split(":")[0].trim();
    const duplicate = keys.some((k) => k === key || k.startsWith(key + " ") || key.startsWith(k + " "));
    if (duplicate) continue;
    keys.push(key);
    out.push(text);
  }
  return out;
}

// ---------------------------------------------------------------------------

function summary() {
  const root = workspaceDir();
  if (!fs.existsSync(root)) {
    return {
      status: STATUS.UNAVAILABLE,
      detail: "Business workspace not found at " + root,
      hint: "Set MYRAA_BUSINESS_DIR or create the business/ folder.",
    };
  }

  const profile = readProfile(root);
  const pricing = readPricing(root);
  const pipeline = readPipelineState(root);
  const payment = readPaymentModel(root);
  const finance = readFinance(root);
  const leadsRes = readLeads(root);
  const stats = leadsRes.status === STATUS.OK ? leadStats(leadsRes.leads) : null;
  const money = revenueMath(pricing, finance, pipeline.status === STATUS.OK ? pipeline.state : null);
  const templates = listTemplates(root);
  const inventory = scanInventory(root, { maxFiles: 1000 });

  const rawBlockers = [];
  if (pipeline.status === STATUS.OK && Array.isArray(pipeline.state.blockers)) {
    rawBlockers.push(...pipeline.state.blockers);
  }
  if (payment.status === STATUS.OK && payment.model.providerIntegration) {
    for (const [provider, info] of Object.entries(payment.model.providerIntegration)) {
      if (info.status && info.status !== "AVAILABLE_MANUAL") {
        rawBlockers.push(`${provider}: ${info.status}`);
      }
    }
  }
  const blockers = dedupeBlockers(rawBlockers);

  const warnings = [];
  if (leadsRes.status !== STATUS.OK) warnings.push("Leads: " + leadsRes.detail);
  else if (leadsRes.warning) warnings.push("Leads: " + leadsRes.warning);
  if (pricing.status !== STATUS.OK) warnings.push("Pricing: " + pricing.detail);
  if (finance.status !== STATUS.OK) warnings.push("Finance: " + finance.detail);
  if (templates.status !== STATUS.OK) warnings.push("Templates: " + templates.detail);
  if (inventory.status !== STATUS.OK) warnings.push("Inventory: " + inventory.detail);

  return {
    status: STATUS.OK,
    generatedAt: new Date().toISOString(),
    workspace: root,
    studio: profile.status === STATUS.OK ? profile.studioName : null,
    profile: profile.status === STATUS.OK ? { markets: profile.markets, sections: profile.sectionNames } : { status: profile.status },
    revenue: money,
    finance,
    pipeline: pipeline.status === STATUS.OK ? {
      dayOf7: pipeline.state.dayOf7 || null,
      counts: pipeline.state.counts || {},
      lastUpdated: pipeline.state.lastUpdated || null,
    } : { status: pipeline.status },
    leads: stats,
    leadCount: stats ? stats.total : 0,
    templates: templates.status === STATUS.OK ? templates.templates.map((t) => t.name) : [],
    inventory: inventory.status === STATUS.OK ? inventory.totals : { status: inventory.status },
    blockers,
    warnings,
    honesty: "Zeros are real. No payment is counted until verified; no lead is counted as contacted without a recorded send.",
  };
}

function dailyReport(opts) {
  const s = summary();
  if (s.status !== STATUS.OK) return { status: s.status, detail: s.detail, markdown: "" };
  const lines = [];
  const day = (s.pipeline && s.pipeline.dayOf7) || 1;

  lines.push(`# Business Report - ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`Day ${day} of 7 | Studio: ${s.studio || "not set"}`);
  lines.push("");
  lines.push("## Revenue");
  lines.push("");
  lines.push("```");
  lines.push(`Collected:   $${s.revenue.collected}`);
  lines.push(`Target:      $${s.revenue.target}`);
  lines.push(`Remaining:   $${s.revenue.remaining}`);
  lines.push(`Expenses:    $${s.finance.expenses}`);
  lines.push(`Net:         $${s.finance.net}`);
  lines.push(`Deals needed at $${s.revenue.averageDealAssumption} avg: ${s.revenue.requiredDealsAtAssumption}`);
  lines.push("```");
  lines.push("");
  lines.push("## Leads");
  lines.push("");
  if (s.leads) {
    lines.push(`- Total: ${s.leads.total}`);
    lines.push(`- In pipeline: ${s.leads.inPipeline}`);
    lines.push(`- Contacted: ${s.leads.contacted}`);
    lines.push(`- Replied: ${s.leads.replied} (reply rate: ${s.leads.replyRate === null ? "n/a" : s.leads.replyRate + "%"})`);
    lines.push(`- Interested: ${s.leads.interested}`);
    lines.push(`- Without a usable website: ${s.leads.withoutWebsite}`);
    lines.push(`- Public email on file: ${s.leads.withPublicEmail}`);
    const statuses = Object.entries(s.leads.byStatus).sort((a, b) => b[1] - a[1]);
    if (statuses.length) {
      lines.push("");
      lines.push("By status: " + statuses.map(([k, v]) => `${k}=${v}`).join(", "));
    }
    const industries = Object.entries(s.leads.byIndustry).sort((a, b) => b[1] - a[1]);
    if (industries.length) lines.push("By industry: " + industries.map(([k, v]) => `${k}=${v}`).join(", "));
  } else {
    lines.push("- UNAVAILABLE (no readable CRM file)");
  }
  lines.push("");
  lines.push("## Assets");
  lines.push("");
  lines.push(`- Templates: ${s.templates.length ? s.templates.join(", ") : "none found"}`);
  const inv = s.inventory || {};
  lines.push(`- Inventory: spreadsheets=${inv.spreadsheet || 0}, documents=${inv.document || 0}, images=${inv.image || 0}, templates=${inv.template || 0}, data=${inv.data || 0}`);
  lines.push("");
  lines.push("## Blockers");
  lines.push("");
  if (s.blockers.length === 0) lines.push("- None recorded.");
  else for (const b of s.blockers) lines.push(`- ${b}`);
  if (s.warnings.length) {
    lines.push("");
    lines.push("## Warnings");
    lines.push("");
    for (const w of s.warnings) lines.push(`- ${w}`);
  }
  lines.push("");
  lines.push("---");
  lines.push(s.honesty);

  return { status: STATUS.OK, markdown: lines.join("\n"), summary: s };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function createRouter(express) {
  const router = (express || require("express")).Router();

  router.get("/status", (req, res) => {
    const root = workspaceDir();
    res.json({
      status: fs.existsSync(root) ? STATUS.OK : STATUS.UNAVAILABLE,
      workspace: root,
      exists: fs.existsSync(root),
      routes: ["/summary", "/report", "/report/save", "/reports", "/leads", "/finance", "/templates", "/inventory", "/excel", "/excel/analyze", "/email"],
    });
  });

  router.get("/summary", (req, res) => res.json(summary()));

  router.get("/report", (req, res) => {
    const report = dailyReport();
    if (String(req.query.format || "json") === "markdown") {
      res.type("text/markdown").send(report.markdown || report.detail || "");
      return;
    }
    res.json(report);
  });

  router.get("/leads", (req, res) => {
    const root = workspaceDir();
    const result = readLeads(root);
    if (result.status !== STATUS.OK) { res.json(result); return; }
    let leads = result.leads;
    if (req.query.status) {
      const want = String(req.query.status).toUpperCase();
      leads = leads.filter((l) => (l.outreach_status || "NEW").toUpperCase() === want);
    }
    if (req.query.industry) {
      const want = String(req.query.industry).toLowerCase();
      leads = leads.filter((l) => (l.industry || "").toLowerCase() === want);
    }
    if (req.query.country) {
      const want = String(req.query.country).toUpperCase();
      leads = leads.filter((l) => (l.country || "").toUpperCase() === want);
    }
    if (req.query.q) {
      const q = String(req.query.q).toLowerCase();
      leads = leads.filter((l) => Object.values(l).some((v) => String(v).toLowerCase().includes(q)));
    }
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    res.json({ status: STATUS.OK, total: leads.length, returned: Math.min(leads.length, limit), leads: leads.slice(0, limit) });
  });

  router.get("/finance", (req, res) => {
    const root = workspaceDir();
    const finance = readFinance(root);
    const pricing = readPricing(root);
    const pipeline = readPipelineState(root);
    res.json({
      status: finance.status,
      finance,
      revenue: revenueMath(pricing, finance, pipeline.status === STATUS.OK ? pipeline.state : null),
    });
  });

  router.get("/templates", (req, res) => res.json(listTemplates(workspaceDir())));

  router.post("/templates/render", (req, res) => {
    const body = req.body || {};
    const result = renderTemplate(workspaceDir(), body.template, body.values || {});
    res.status(result.status === STATUS.OK ? 200 : 400).json(result);
  });

  router.get("/inventory", (req, res) => {
    res.json(scanInventory(workspaceDir(), { maxFiles: Number(req.query.maxFiles) || 500 }));
  });

  router.get("/excel", (req, res) => {
    const root = workspaceDir();
    const sheets = listSpreadsheets(root);
    if (sheets.status !== STATUS.OK) { res.json(sheets); return; }
    res.json({
      status: STATUS.OK,
      count: sheets.count,
      spreadsheets: sheets.spreadsheets,
      analyzeRoute: "GET /api/business/excel/analyze?file=crm/leads.csv",
      note: "Analysis runs through the existing excel_intelligence.cjs engine. If its toolchain is missing, the engine's own error is returned unchanged.",
    });
  });

  router.get("/excel/analyze", (req, res) => {
    const result = analyzeSpreadsheet(workspaceDir(), String(req.query.file || ""));
    res.status(result.status === STATUS.INVALID ? 400 : 200).json(result);
  });

  router.get("/email", (req, res) => res.json(emailOverview(workspaceDir())));

  router.post("/report/save", (req, res) => {
    const result = saveReport(workspaceDir());
    res.status(result.status === STATUS.OK ? 200 : 400).json(result);
  });

  router.get("/reports", (req, res) => res.json(listReports(workspaceDir())));

  return router;
}

module.exports = {
  STATUS,
  LEAD_STATUSES,
  workspaceDir,
  parseCsv,
  csvToObjects,
  readProfile,
  readPricing,
  readPipelineState,
  readPaymentModel,
  readFinance,
  readLeads,
  leadStats,
  revenueMath,
  listTemplates,
  renderTemplate,
  scanInventory,
  listSpreadsheets,
  analyzeSpreadsheet,
  readProfileSection,
  emailConnectionState,
  scanDrafts,
  listEmailTemplates,
  emailOverview,
  dedupeBlockers,
  saveReport,
  listReports,
  summary,
  dailyReport,
  createRouter,
};
