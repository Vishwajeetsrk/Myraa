const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

class PrintEngine3D extends EventEmitter {
  constructor() {
    super();
    this.printers = new Map();
    this.printHistory = [];
    this.maxHistory = 50;
    this.slicerPath = null;
    this.slicerProfile = null;
    this.settingsPath = path.join(os.homedir(), '.myraa', 'print_settings.json');
    this.slicerProfiles = new Map();
    this._loadSettings();
    this._detectSlicer();
  }

  _loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        if (settings.printers) {
          for (const [id, printer] of Object.entries(settings.printers)) {
            this.printers.set(id, printer);
          }
        }
        if (settings.slicerPath) this.slicerPath = settings.slicerPath;
        if (settings.slicerProfile) this.slicerProfile = settings.slicerProfile;
      }
    } catch (e) { /* use defaults */ }
  }

  _saveSettings() {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const settings = {
        printers: Object.fromEntries(this.printers),
        slicerPath: this.slicerPath,
        slicerProfile: this.slicerProfile
      };
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
    } catch (e) { /* best effort */ }
  }

  _detectSlicer() {
    const possiblePaths = [
      path.join(process.env.LOCALAPPDATA || '', 'OrcaSlicer', 'OrcaSlicer.exe'),
      path.join(process.env.PROGRAMFILES || '', 'OrcaSlicer', 'OrcaSlicer.exe'),
      path.join(process.env.PROGRAMFILES || '', 'PrusaSlicer', 'prusa-slicer.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'PrusaSlicer', 'prusa-slicer.exe'),
      '/usr/bin/orcaslicer', '/usr/bin/prusa-slicer',
      '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer',
      '/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer'
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.slicerPath = p;
        this.emit('slicer_detected', { path: p });
        return;
      }
    }
  }

  getCapabilities() {
    return {
      slicerAvailable: !!this.slicerPath, slicerPath: this.slicerPath,
      printerCount: this.printers.size, supportedFormats: ['stl', 'obj', 'step', '3mf'],
      slicers: ['OrcaSlicer', 'PrusaSlicer'], protocols: ['OctoPrint', 'Moonraker', 'PrusaLink']
    };
  }

  async addPrinter(config) {
    const { name, type = 'octoprint', ip, port = 80, apiKey = null } = config;
    if (!name || !ip) throw new Error('Printer name and IP are required');
    const id = `printer_${Date.now()}`;
    const printer = {
      id, name, type, ip, port, apiKey, status: 'unknown', online: false,
      temperature: { bed: 0, nozzle: 0 }, progress: 0, lastChecked: null,
      addedAt: Date.now()
    };
    this.printers.set(id, printer);
    await this._probePrinter(id);
    this._saveSettings();
    this.emit('printer_added', printer);
    return printer;
  }

  removePrinter(printerId) {
    if (!this.printers.has(printerId)) throw new Error('Printer not found');
    this.printers.delete(printerId);
    this._saveSettings();
    this.emit('printer_removed', { id: printerId });
    return { removed: printerId };
  }

  async _probePrinter(printerId) {
    const printer = this.printers.get(printerId);
    if (!printer) return;
    const baseUrl = `http://${printer.ip}:${printer.port}`;
    try {
      const response = await this._httpGet(baseUrl);
      printer.online = response.status < 400;
      printer.lastChecked = Date.now();
      if (printer.type === 'octoprint') {
        await this._probeOctoPrint(printer);
      } else if (printer.type === 'moonraker') {
        await this._probeMoonraker(printer);
      }
    } catch (e) {
      printer.online = false;
      printer.lastChecked = Date.now();
    }
    this.emit('printer_status', printer);
  }

  async _probeOctoPrint(printer) {
    try {
      const statusUrl = `http://${printer.ip}:${printer.port}/api/job`;
      const headers = printer.apiKey ? { 'X-Api-Key': printer.apiKey } : {};
      const response = await this._httpGet(statusUrl, headers);
      const data = JSON.parse(response.data);
      printer.status = data.state || 'unknown';
      printer.progress = data.progress?.completion || 0;
      if (data.progress?.printTime) printer.estimatedTimeLeft = data.progress.printTimeLeft;
    } catch (e) { /* ignore */ }

    try {
      const tempUrl = `http://${printer.ip}:${printer.port}/api/printer`;
      const headers = printer.apiKey ? { 'X-Api-Key': printer.apiKey } : {};
      const response = await this._httpGet(tempUrl, headers);
      const data = JSON.parse(response.data);
      printer.temperature = {
        bed: data.temperature?.bed?.actual || 0,
        nozzle: data.temperature?.tool0?.actual || 0
      };
    } catch (e) { /* ignore */ }
  }

  async _probeMoonraker(printer) {
    try {
      const statusUrl = `http://${printer.ip}:${printer.port}/printer/objects/query?heater_bed&extruder`;
      const response = await this._httpGet(statusUrl);
      const data = JSON.parse(response.data);
      if (data.result?.status) {
        printer.temperature = {
          bed: data.result.status.heater_bed?.temperature || 0,
          nozzle: data.result.status.extruder?.temperature || 0
        };
      }
    } catch (e) { /* ignore */ }

    try {
      const printUrl = `http://${printer.ip}:${printer.port}/printer/objects/query?print_stats&display_status`;
      const response = await this._httpGet(printUrl);
      const data = JSON.parse(response.data);
      if (data.result?.status) {
        printer.status = data.result.status.print_stats?.state || 'standby';
        printer.progress = (data.result.status.display_status?.progress || 0) * 100;
      }
    } catch (e) { /* ignore */ }
  }

  async getStatus(printerId) {
    if (printerId) {
      await this._probePrinter(printerId);
      return this.printers.get(printerId);
    }
    for (const [id] of this.printers) {
      await this._probePrinter(id);
    }
    return Array.from(this.printers.values());
  }

  async slice(stlPath, options = {}) {
    if (!this.slicerPath) throw new Error('No slicer detected. Install OrcaSlicer or PrusaSlicer.');
    if (!fs.existsSync(stlPath)) throw new Error(`STL file not found: ${stlPath}`);
    const { profile = this.slicerProfile, outputDir = path.join(os.homedir(), '.myraa', 'gcode_output') } = options;
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `${path.basename(stlPath, '.stl')}.gcode`);
    this.emit('slice_start', { stlPath, outputFile });
    try {
      const args = ['--export-gcode', '--output', outputFile];
      if (profile) args.push('--load', profile);
      args.push(stlPath);
      const { execSync } = require('child_process');
      execSync(`"${this.slicerPath}" ${args.join(' ')}`, { timeout: 300000, stdio: 'pipe' });
      if (!fs.existsSync(outputFile)) throw new Error('Slicing completed but output file not found');
      const stats = fs.statSync(outputFile);
      const result = { success: true, gcodePath: outputFile, size: stats.size, stlPath };
      this.emit('slice_complete', result);
      return result;
    } catch (e) {
      const error = new Error(`Slicing failed: ${e.message}`);
      this.emit('slice_failed', { stlPath, error: error.message });
      throw error;
    }
  }

  async uploadAndPrint(printerId, gcodePath) {
    const printer = this.printers.get(printerId);
    if (!printer) throw new Error('Printer not found');
    if (!fs.existsSync(gcodePath)) throw new Error(`G-code file not found: ${gcodePath}`);
    this.emit('print_start', { printerId, gcodePath });
    try {
      if (printer.type === 'octoprint') {
        await this._uploadOctoPrint(printer, gcodePath);
      } else if (printer.type === 'moonraker') {
        await this._uploadMoonraker(printer, gcodePath);
      } else {
        throw new Error(`Unsupported printer type: ${printer.type}`);
      }
      const printJob = {
        printerId, gcodePath, startedAt: Date.now(), status: 'printing', progress: 0
      };
      this.printHistory.push(printJob);
      if (this.printHistory.length > this.maxHistory) this.printHistory.shift();
      this.emit('print_uploaded', printJob);
      return printJob;
    } catch (e) {
      const error = new Error(`Upload failed: ${e.message}`);
      this.emit('print_failed', { printerId, gcodePath, error: error.message });
      throw error;
    }
  }

  async _uploadOctoPrint(printer, gcodePath) {
    const filename = path.basename(gcodePath);
    const fileContent = fs.readFileSync(gcodePath);
    const boundary = `----FormBoundary${Date.now()}`;
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      'Content-Type: application/octet-stream',
      '', fileContent, `--${boundary}--`
    ].join('\r\n');
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(body)
    };
    if (printer.apiKey) headers['X-Api-Key'] = printer.apiKey;
    await this._httpPost(`http://${printer.ip}:${printer.port}/api/files/local`, body, headers);
    const startResponse = await this._httpPost(
      `http://${printer.ip}:${printer.port}/api/job`,
      JSON.stringify({ command: 'start' }),
      { 'Content-Type': 'application/json', 'X-Api-Key': printer.apiKey || '' }
    );
    return { uploaded: true, started: true };
  }

  async _uploadMoonraker(printer, gcodePath) {
    const filename = path.basename(gcodePath);
    const fileContent = fs.readFileSync(gcodePath);
    const boundary = `----FormBoundary${Date.now()}`;
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      'Content-Type: application/octet-stream',
      '', fileContent, `--${boundary}--`
    ].join('\r\n');
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(body)
    };
    await this._httpPost(`http://${printer.ip}:${printer.port}/server/files/upload`, body, headers);
    await this._httpPost(
      `http://${printer.ip}:${printer.port}/printer/print/start`,
      JSON.stringify({ filename }),
      { 'Content-Type': 'application/json' }
    );
    return { uploaded: true, started: true };
  }

  async cancelPrint(printerId) {
    const printer = this.printers.get(printerId);
    if (!printer) throw new Error('Printer not found');
    try {
      if (printer.type === 'octoprint') {
        await this._httpPost(`http://${printer.ip}:${printer.port}/api/job`, JSON.stringify({ command: 'cancel' }), { 'Content-Type': 'application/json', 'X-Api-Key': printer.apiKey || '' });
      } else if (printer.type === 'moonraker') {
        await this._httpPost(`http://${printer.ip}:${printer.port}/printer/print/stop`, '{}', { 'Content-Type': 'application/json' });
      }
      this.emit('print_cancelled', { printerId });
      return { cancelled: true };
    } catch (e) {
      throw new Error(`Cancel failed: ${e.message}`);
    }
  }

  async pausePrint(printerId) {
    const printer = this.printers.get(printerId);
    if (!printer) throw new Error('Printer not found');
    try {
      if (printer.type === 'octoprint') {
        await this._httpPost(`http://${printer.ip}:${printer.port}/api/job`, JSON.stringify({ command: 'pause', action: 'toggle' }), { 'Content-Type': 'application/json', 'X-Api-Key': printer.apiKey || '' });
      }
      this.emit('print_paused', { printerId });
      return { paused: true };
    } catch (e) {
      throw new Error(`Pause failed: ${e.message}`);
    }
  }

  _httpGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { headers, timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }

  _httpPost(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname, port: urlObj.port, path: urlObj.pathname,
        method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        timeout: 30000
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(body);
      req.end();
    });
  }

  getPrintHistory() { return [...this.printHistory]; }
  getPrinters() { return Array.from(this.printers.values()); }
  getPrinter(printerId) { return this.printers.get(printerId); }

  getState() {
    return {
      printerCount: this.printers.size, printers: this.getPrinters(),
      slicerAvailable: !!this.slicerPath, slicerPath: this.slicerPath,
      historyLength: this.printHistory.length
    };
  }
}

module.exports = PrintEngine3D;
