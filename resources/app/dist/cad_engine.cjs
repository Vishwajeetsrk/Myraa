const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

class CADEngine extends EventEmitter {
  constructor() {
    super();
    this.outputDir = path.join(os.homedir(), '.myraa', 'cad_output');
    this.pythonPath = 'python';
    this.build123dAvailable = false;
    this.currentDesign = null;
    this.designHistory = [];
    this.maxHistory = 20;
    this._ensureOutputDir();
    this._checkBuild123d();
  }

  _ensureOutputDir() {
    try {
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
    } catch (e) { /* best effort */ }
  }

  _checkBuild123d() {
    try {
      execSync(`${this.pythonPath} -c "import build123d; print(build123d.__version__)"`, { timeout: 10000, stdio: 'pipe' });
      this.build123dAvailable = true;
    } catch (e) {
      this.build123dAvailable = false;
      console.warn('build123d not available. CAD generation will use fallback.');
    }
  }

  setPythonPath(pythonPath) {
    this.pythonPath = pythonPath;
    this._checkBuild123d();
    return { pythonPath, build123dAvailable: this.build123dAvailable };
  }

  getCapabilities() {
    return {
      build123dAvailable: this.build123dAvailable, pythonPath: this.pythonPath,
      outputDir: this.outputDir, currentDesign: this.currentDesign,
      historyLength: this.designHistory.length,
      primitives: ['Box', 'Sphere', 'Cylinder', 'Cone', 'Torus', 'Wedge', 'Pyramid', 'RoundedBox'],
      operations: ['extrude', 'revolve', 'fillet', 'chamfer', 'boolean_union', 'boolean_subtract', 'boolean_intersect', 'move', 'rotate', 'mirror', 'pattern', 'scale'],
      exports: ['STL', 'STEP', 'OBJ', 'SVG']
    };
  }

  async generateDesign(prompt, options = {}) {
    const { retries = 3, timeout = 120000, format = 'stl', name = null } = options;
    const designName = name || `design_${Date.now()}`;
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      this.emit('generation_start', { prompt, attempt, designName });
      try {
        const code = await this._generateCode(prompt, designName);
        const outputPath = path.join(this.outputDir, `${designName}.${format}`);
        const result = await this._executeDesign(code, outputPath, timeout);
        this.currentDesign = { name: designName, prompt, code, outputPath, format, generatedAt: Date.now(), attempt };
        this.designHistory.push(this.currentDesign);
        if (this.designHistory.length > this.maxHistory) this.designHistory.shift();
        this.emit('generation_complete', this.currentDesign);
        return this.currentDesign;
      } catch (e) {
        lastError = e;
        this.emit('generation_attempt_failed', { prompt, attempt, error: e.message });
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }
    const error = new Error(`Design generation failed after ${retries} attempts: ${lastError?.message}`);
    this.emit('generation_failed', { prompt, error: error.message });
    throw error;
  }

  async _generateCode(prompt, designName) {
    const systemPrompt = `You are a parametric CAD designer using build123d. Generate Python code that creates a 3D model.

RULES:
1. ONLY use build123d library
2. Start with "from build123d import *"
3. Create the shape and assign it to "result_part"
4. End with "export_stl(result_part, 'OUTPUT_PATH')"
5. Use lowercase function names (no PascalCase for your functions)
6. Keep dimensions in millimeters
7. Center the model at origin (0,0,0)
8. Use conservative fillet/chamfer values (0.5-2.0mm)
9. No external dependencies beyond build123d
10. Ensure the code is syntactically valid Python

OUTPUT_PATH will be replaced at runtime.`;

    const userPrompt = `Create a 3D model: ${prompt}\n\nDesign name: ${designName}\nOutput directory: ${this.outputDir}`;

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash', systemInstruction: systemPrompt });
      const result = await model.generateContent(userPrompt);
      let code = result.response.text();
      code = code.replace(/```python\n?/g, '').replace(/```\n?/g, '').trim();
      const outputPath = path.join(this.outputDir, `${designName}.stl`);
      code = code.replace(/export_stl\([^,]+,\s*['"][^'"]+['"]\)/, `export_stl(result_part, '${outputPath.replace(/\\/g, '\\\\')}')`);
      return code;
    } catch (e) {
      return this._generateFallbackCode(prompt, designName);
    }
  }

  _generateFallbackCode(prompt, designName) {
    const outputPath = path.join(this.outputDir, `${designName}.stl`).replace(/\\/g, '\\\\');
    const lowerPrompt = prompt.toLowerCase();
    let code = `from build123d import *\n\n`;
    if (lowerPrompt.includes('box') || lowerPrompt.includes('cube') || lowerPrompt.includes('rectangle')) {
      code += `result_part = Box(50, 50, 50)\n`;
    } else if (lowerPrompt.includes('sphere') || lowerPrompt.includes('ball')) {
      code += `result_part = Sphere(radius=25)\n`;
    } else if (lowerPrompt.includes('cylinder') || lowerPrompt.includes('tube') || lowerPrompt.includes('pipe')) {
      code += `result_part = Cylinder(radius=15, height=50)\n`;
    } else if (lowerPrompt.includes('cone')) {
      code += `result_part = Cone(bottom_radius=25, top_radius=0, height=50)\n`;
    } else if (lowerPrompt.includes('torus') || lowerPrompt.includes('donut') || lowerPrompt.includes('ring')) {
      code += `result_part = Torus(major_radius=30, minor_radius=10)\n`;
    } else {
      code += `result_part = Box(50, 50, 50)\n`;
    }
    code += `\nexport_stl(result_part, '${outputPath}')\n`;
    return code;
  }

  async _executeDesign(code, outputPath, timeout) {
    if (!this.build123dAvailable) {
      const stubPath = this._createStubSTL(outputPath);
      return { success: true, output: stubPath, stub: true };
    }
    const scriptPath = path.join(this.outputDir, `temp_design_${Date.now()}.py`);
    try {
      fs.writeFileSync(scriptPath, code);
      const result = execSync(`${this.pythonPath} "${scriptPath}"`, {
        timeout, stdio: 'pipe', encoding: 'utf8', cwd: this.outputDir
      });
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Output file not created: ${outputPath}`);
      }
      const stats = fs.statSync(outputPath);
      return { success: true, output: outputPath, size: stats.size, stub: false, stdout: result };
    } catch (e) {
      throw new Error(`Design execution failed: ${e.message}`);
    } finally {
      try { if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath); } catch (e) { /* ignore */ }
    }
  }

  _createStubSTL(outputPath) {
    const stlContent = `solid MyraaCAD
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 1 0
      vertex 0 1 0
    endloop
  endfacet
endsolid MyraaCAD`;
    fs.writeFileSync(outputPath, stlContent);
    return outputPath;
  }

  async iterateDesign(iterationPrompt) {
    if (!this.currentDesign) throw new Error('No current design to iterate on');
    const iterationName = `${this.currentDesign.name}_iter_${this.designHistory.length + 1}`;
    const fullPrompt = `Previous design: ${this.currentDesign.prompt}\nPrevious code:\n${this.currentDesign.code}\n\nIteration request: ${iterationPrompt}`;
    return await this.generateDesign(fullPrompt, { name: iterationName });
  }

  getDesignHistory() { return [...this.designHistory]; }
  getCurrentDesign() { return this.currentDesign; }

  async exportDesign(designName, format) {
    const design = this.designHistory.find(d => d.name === designName);
    if (!design) throw new Error(`Design not found: ${designName}`);
    if (!fs.existsSync(design.outputPath)) throw new Error(`Design file not found: ${design.outputPath}`);
    const newOutputPath = path.join(this.outputDir, `${designName}.${format}`);
    try {
      execSync(`${this.pythonPath} -c "from build123d import *; import sys; sys.path.insert(0, '.'); exec(open('${design.outputPath.replace(/\\/g, '\\\\')}').read()); export_${format}(result_part, '${newOutputPath.replace(/\\/g, '\\\\')}')"`, { timeout: 30000, stdio: 'pipe' });
      return { success: true, output: newOutputPath, format };
    } catch (e) {
      throw new Error(`Export failed: ${e.message}`);
    }
  }

  listDesigns() {
    try {
      return fs.readdirSync(this.outputDir)
        .filter(f => f.endsWith('.stl') || f.endsWith('.step') || f.endsWith('.obj'))
        .map(f => ({ name: path.parse(f).name, file: f, path: path.join(this.outputDir, f), size: fs.statSync(path.join(this.outputDir, f)).size }));
    } catch (e) { return []; }
  }

  getState() {
    return {
      build123dAvailable: this.build123dAvailable, pythonPath: this.pythonPath,
      outputDir: this.outputDir, currentDesign: this.currentDesign,
      historyLength: this.designHistory.length, designsOnDisk: this.listDesigns().length
    };
  }
}

module.exports =CADEngine;
