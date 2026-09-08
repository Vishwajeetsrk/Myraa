/**
 * =============================================================================
 * MYRAA AI OS — Web Fetch & GitHub Browsing Engine
 * =============================================================================
 * Enables App Studio and MYRAA to retrieve, parse, and learn from live websites,
 * public documentation, GitHub repositories, and design links.
 * =============================================================================
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

function request(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${targetUrl}`));
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 MYRAA-AI-OS/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
        ...(options.headers || {})
      },
      timeout: options.timeoutMs || 15000
    };

    const req = client.request(parsed, reqOptions, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, parsed.origin).toString();
        }
        return resolve(request(redirectUrl, options));
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${options.timeoutMs || 15000}ms`));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

function getVaultedGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  try {
    const fs = require('fs');
    const path = require('path');
    const candidates = [
      path.join(process.env.APPDATA || '', 'MYRAA', 'secrets.json'),
      path.join(process.env.MYRAA_DATA_DIR || '', 'secrets.json'),
      path.join(process.cwd(), '.myraa-data', 'secrets.json'),
      path.join(process.cwd(), 'secrets.json')
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) {
        const sec = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (sec.githubToken) return sec.githubToken.trim();
        if (sec.github_token) return sec.github_token.trim();
      }
    }
  } catch (e) {}
  return null;
}

class WebFetchService {
  /**
   * Fetches public web page, strips scripts/styles, and extracts readable text & markdown
   */
  async fetchWebPage(targetUrl) {
    let cleanUrl = String(targetUrl || '').trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    try {
      const resp = await request(cleanUrl);
      if (resp.statusCode >= 400) {
        return { ok: false, error: `HTTP ${resp.statusCode}: Could not fetch page.`, url: cleanUrl };
      }

      const html = resp.data;
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : cleanUrl;

      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
      const description = metaDescMatch ? metaDescMatch[1].trim() : '';

      // Strip comments, scripts, styles, svg, and headers/footers for clean content
      let text = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
        .replace(/<(?:h1|h2|h3)[^>]*>(.*?)<\/(?:h1|h2|h3)>/gi, '\n### $1\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n* $1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

      const summary = text.slice(0, 4000);

      return {
        ok: true,
        url: cleanUrl,
        title,
        description,
        contentLength: text.length,
        summary,
        markdown: `# ${title}\n\n${description ? `> ${description}\n\n` : ''}${summary}`
      };
    } catch (err) {
      return { ok: false, url: cleanUrl, error: `Web fetch error: ${err.message}` };
    }
  }

  /**
   * Fetches GitHub repository details, README, package.json, and file structure
   */
  async fetchGitHubRepo(repoUrlOrShorthand) {
    let owner = '';
    let repo = '';

    const clean = String(repoUrlOrShorthand || '').trim();
    const ghMatch = clean.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/i);
    if (ghMatch) {
      owner = ghMatch[1];
      repo = ghMatch[2].replace(/\.git$/i, '');
    } else {
      const parts = clean.split('/');
      if (parts.length === 2) {
        owner = parts[0];
        repo = parts[1];
      }
    }

    if (!owner || !repo) {
      return { ok: false, error: 'Invalid GitHub repository specification. Use "owner/repo" or full URL.' };
    }

    const repoApiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`;
    const ghToken = getVaultedGitHubToken();
    const reqHeaders = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'MYRAA-AI-OS/1.0'
    };
    if (ghToken) {
      reqHeaders['Authorization'] = `token ${ghToken}`;
    }

    try {
      // 1. Fetch repo metadata
      const metaResp = await request(repoApiUrl, { headers: reqHeaders });
      let repoData = {};
      try { repoData = JSON.parse(metaResp.data); } catch (e) {}

      // 2. Fetch README
      let readme = '';
      try {
        const readmeResp = await request(`${rawBase}/README.md`);
        if (readmeResp.statusCode === 200) readme = readmeResp.data.slice(0, 8000);
      } catch (e) {}

      // 3. Fetch package.json if exists
      let packageJson = null;
      try {
        const pkgResp = await request(`${rawBase}/package.json`);
        if (pkgResp.statusCode === 200) packageJson = JSON.parse(pkgResp.data);
      } catch (e) {}

      return {
        ok: true,
        owner,
        repo,
        fullName: `${owner}/${repo}`,
        url: `https://github.com/${owner}/${repo}`,
        description: repoData.description || 'No description provided.',
        stars: repoData.stargazers_count || 0,
        defaultBranch: repoData.default_branch || 'main',
        hasPackageJson: Boolean(packageJson),
        dependencies: packageJson ? Object.keys(packageJson.dependencies || {}) : [],
        devDependencies: packageJson ? Object.keys(packageJson.devDependencies || {}) : [],
        readmeExcerpt: readme ? readme.slice(0, 2000) : 'README not found',
        summary: `GitHub Repository: ${owner}/${repo} (${repoData.stargazers_count || 0}★)\nDescription: ${repoData.description || 'N/A'}\nKey Dependencies: ${packageJson ? Object.keys(packageJson.dependencies || {}).slice(0, 10).join(', ') : 'None detected'}`
      };
    } catch (err) {
      return { ok: false, owner, repo, error: `GitHub fetch error: ${err.message}` };
    }
  }

  /**
   * Inspects Figma link or design file
   */
  parseFigmaUrl(url) {
    const clean = String(url || '').trim();
    const match = clean.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i);
    if (!match) return { ok: false, error: 'Not a valid Figma file or design URL' };

    const fileKey = match[1];
    return {
      ok: true,
      fileKey,
      url: clean,
      type: 'figma_design',
      note: 'Figma file key extracted. Use Figma REST API with personal access token to fetch frames.'
    };
  }
}

const webFetchService = new WebFetchService();
module.exports = webFetchService;
