const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

class BrowserAgent extends EventEmitter {
  constructor() {
    super();
    this.isActive = false;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.viewport = { width: 1440, height: 900 };
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.screenshotDir = path.join(os.homedir(), '.myraa', 'screenshots');
    this.actionHistory = [];
    this.maxHistory = 100;
    this.headless = true;
    this.playwrightAvailable = false;
    this._ensureScreenshotDir();
    this._checkPlaywright();
  }

  _ensureScreenshotDir() {
    try { if (!fs.existsSync(this.screenshotDir)) fs.mkdirSync(this.screenshotDir, { recursive: true }); } catch (e) { /* best effort */ }
  }

  async _checkPlaywright() {
    try {
      require('playwright');
      this.playwrightAvailable = true;
    } catch (e) {
      this.playwrightAvailable = false;
    }
  }

  getCapabilities() {
    return {
      playwrightAvailable: this.playwrightAvailable, headless: this.headless,
      viewport: this.viewport, isActive: this.isActive,
      supportedActions: ['navigate', 'go_back', 'go_forward', 'click', 'type', 'press', 'scroll', 'screenshot', 'evaluate', 'wait', 'hover', 'select', 'focus', 'close'],
      currentUrl: this.page?.url?.() || null, title: null
    };
  }

  async start(headless = true) {
    if (!this.playwrightAvailable) {
      throw new Error('Playwright not available. Install with: npm install playwright');
    }
    this.headless = headless;
    try {
      const { chromium } = require('playwright');
      this.browser = await chromium.launch({ headless, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
      this.context = await this.browser.newContext({ viewport: this.viewport, userAgent: this.userAgent });
      this.page = await this.context.newPage();
      this.isActive = true;
      this.emit('browser_started', { headless });
      return { active: true, headless };
    } catch (e) {
      throw new Error(`Failed to start browser: ${e.message}`);
    }
  }

  async stop() {
    if (this.page) { try { await this.page.close(); } catch (e) { /* ignore */ } }
    if (this.context) { try { await this.context.close(); } catch (e) { /* ignore */ } }
    if (this.browser) { try { await this.browser.close(); } catch (e) { /* ignore */ } }
    this.page = null; this.context = null; this.browser = null; this.isActive = false;
    this.emit('browser_stopped');
    return { active: false };
  }

  async navigate(url, options = {}) {
    if (!this.page) throw new Error('Browser not started');
    const { waitUntil = 'domcontentloaded', timeout = 30000 } = options;
    try {
      const response = await this.page.goto(url, { waitUntil, timeout });
      const title = await this.page.title();
      const currentUrl = this.page.url();
      this._recordAction('navigate', { url, title, currentUrl, status: response?.status() });
      this.emit('navigated', { url: currentUrl, title, status: response?.status() });
      return { url: currentUrl, title, status: response?.status() };
    } catch (e) {
      throw new Error(`Navigation failed: ${e.message}`);
    }
  }

  async goBack() {
    if (!this.page) throw new Error('Browser not started');
    await this.page.goBack();
    this._recordAction('go_back', { url: this.page.url() });
    return { url: this.page.url() };
  }

  async goForward() {
    if (!this.page) throw new Error('Browser not started');
    await this.page.goForward();
    this._recordAction('go_forward', { url: this.page.url() });
    return { url: this.page.url() };
  }

  async click(selector, options = {}) {
    if (!this.page) throw new Error('Browser not started');
    const { button = 'left', clickCount = 1, force = false, timeout = 10000 } = options;
    await this.page.click(selector, { button, clickCount, force, timeout });
    this._recordAction('click', { selector, button });
    return { clicked: selector };
  }

  async type(selector, text, options = {}) {
    if (!this.page) throw new Error('Browser not started');
    const { delay = 0, clear = true } = options;
    if (clear) await this.page.fill(selector, '');
    await this.page.type(selector, text, { delay });
    this._recordAction('type', { selector, text: text.substring(0, 50) + (text.length > 50 ? '...' : '') });
    return { typed: text.length, selector };
  }

  async press(key, options = {}) {
    if (!this.page) throw new Error('Browser not started');
    await this.page.keyboard.press(key, options);
    this._recordAction('press', { key });
    return { pressed: key };
  }

  async scroll(direction = 'down', amount = 3) {
    if (!this.page) throw new Error('Browser not started');
    const delta = direction === 'up' ? -amount * 100 : amount * 100;
    await this.page.mouse.wheel(0, delta);
    this._recordAction('scroll', { direction, amount });
    return { scrolled: direction, amount };
  }

  async screenshot(options = {}) {
    if (!this.page) throw new Error('Browser not started');
    const { fullPage = false, name = null } = options;
    const filename = name || `screenshot_${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    await this.page.screenshot({ path: filepath, fullPage });
    this._recordAction('screenshot', { filepath, fullPage });
    return { filepath, filename };
  }

  async evaluate(script) {
    if (!this.page) throw new Error('Browser not started');
    const result = await this.page.evaluate(script);
    this._recordAction('evaluate', { script: script.substring(0, 100) });
    return { result };
  }

  async wait(selector, options = {}) {
    if (!this.page) throw new Error('Browser not started');
    const { timeout = 10000, state = 'visible' } = options;
    await this.page.waitForSelector(selector, { timeout, state });
    this._recordAction('wait', { selector, state });
    return { waited: selector };
  }

  async hover(selector) {
    if (!this.page) throw new Error('Browser not started');
    await this.page.hover(selector);
    this._recordAction('hover', { selector });
    return { hovered: selector };
  }

  async select(selector, values) {
    if (!this.page) throw new Error('Browser not started');
    await this.page.selectOption(selector, values);
    this._recordAction('select', { selector, values });
    return { selected: values };
  }

  async focus(selector) {
    if (!this.page) throw new Error('Browser not started');
    await this.page.focus(selector);
    this._recordAction('focus', { selector });
    return { focused: selector };
  }

  async getTitle() {
    if (!this.page) return null;
    return await this.page.title();
  }

  async getUrl() {
    if (!this.page) return null;
    return this.page.url();
  }

  async getContent() {
    if (!this.page) throw new Error('Browser not started');
    return await this.page.content();
  }

  async searchGoogle(query) {
    return await this.navigate(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }

  async openUrl(url) {
    return await this.navigate(url);
  }

  _recordAction(type, details) {
    const action = { type, details, timestamp: Date.now() };
    this.actionHistory.push(action);
    if (this.actionHistory.length > this.maxHistory) this.actionHistory.shift();
  }

  getActionHistory() { return [...this.actionHistory]; }
  clearHistory() { this.actionHistory = []; }

  getState() {
    return {
      active: this.isActive, playwrightAvailable: this.playwrightAvailable,
      headless: this.headless, viewport: this.viewport,
      currentUrl: this.page?.url?.() || null,
      actionHistoryLength: this.actionHistory.length
    };
  }
}

module.exports = BrowserAgent;
