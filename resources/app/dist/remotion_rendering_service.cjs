'use strict';
/**
 * remotion_rendering_service.cjs — Video Rendering with Remotion
 * MYRAA Coding Agent — v9.0.0
 *
 * Provides:
 * - Scaffold Remotion projects
 * - Create compositions
 * - Render videos
 * - Preview in browser
 * - Manage video projects
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REMOTION_DIR = path.join(os.homedir(), '.myraa', 'remotion');

class RemotionRenderingService {
  constructor() {
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(REMOTION_DIR)) fs.mkdirSync(REMOTION_DIR, { recursive: true });
  }

  // ── Project Scaffolding ────────────────────────────────────────────────────

  async scaffoldProject(projectName, opts = {}) {
    const projectDir = path.join(REMOTION_DIR, projectName);
    if (fs.existsSync(projectDir)) {
      return { ok: false, error: `Project ${projectName} already exists` };
    }

    try {
      fs.mkdirSync(projectDir, { recursive: true });

      // Create package.json
      const pkgJson = {
        name: projectName,
        version: '1.0.0',
        description: `Remotion video project - ${projectName}`,
        scripts: {
          studio: 'remotion studio',
          render: 'remotion render',
          build: 'remotion render',
        },
        dependencies: {
          remotion: '^4.0.0',
          '@remotion/cli': '^4.0.0',
          '@remotion/player': '^4.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          '@types/react': '^18.0.0',
        },
      };

      if (opts.captions) {
        pkgJson.dependencies['@remotion/captions'] = '^4.0.0';
      }
      if (opts.maps) {
        pkgJson.dependencies['@remotion/google-maps'] = '^4.0.0';
      }
      if (opts.media) {
        pkgJson.dependencies['@remotion/media-utils'] = '^4.0.0';
      }

      fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

      // Create tsconfig.json
      const tsConfig = {
        compilerOptions: {
          target: 'ES2018',
          module: 'commonjs',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
        include: ['src/**/*'],
      };
      fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

      // Create src directory
      fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

      // Create default composition
      const defaultComposition = `import React from 'react';
import { Composition } from 'remotion';
import { MyComposition } from './Composition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyVideo"
        component={MyComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
`;
      fs.writeFileSync(path.join(projectDir, 'src', 'Root.tsx'), defaultComposition);

      // Create composition component
      const compositionComponent = `import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 10,
      stiffness: 200,
    },
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ opacity, transform: \`scale(\${scale})\` }}>
        <h1 style={{ fontSize: 72, fontWeight: 'bold' }}>
          {projectName || 'MYRAA Video'}
        </h1>
        <p style={{ fontSize: 24, marginTop: 20, opacity: 0.7 }}>
          Created with Remotion
        </p>
      </div>
    </div>
  );
};
`;
      fs.writeFileSync(path.join(projectDir, 'src', 'Composition.tsx'), compositionComponent);

      // Create index.ts
      const indexFile = `import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
`;
      fs.writeFileSync(path.join(projectDir, 'src', 'index.ts'), indexFile);

      // Create remotion.config.ts
      const remotionConfig = `import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
`;
      fs.writeFileSync(path.join(projectDir, 'remotion.config.ts'), remotionConfig);

      // Install dependencies
      const installResult = await this._npmInstall(projectDir);

      return {
        ok: true,
        projectDir,
        name: projectName,
        files: ['package.json', 'tsconfig.json', 'remotion.config.ts', 'src/Root.tsx', 'src/Composition.tsx', 'src/index.ts'],
        installResult,
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Composition Management ─────────────────────────────────────────────────

  addComposition(projectDir, comp) {
    const rootPath = path.join(projectDir, 'src', 'Root.tsx');
    if (!fs.existsSync(rootPath)) return { ok: false, error: 'Root.tsx not found' };

    try {
      let content = fs.readFileSync(rootPath, 'utf-8');
      const newComp = `
      <Composition
        id="${comp.id || 'NewComposition'}"
        component={${comp.component || 'MyComposition'}}
        durationInFrames={${comp.durationInFrames || 300}}
        fps={${comp.fps || 30}}
        width={${comp.width || 1920}}
        height={${comp.height || 1080}}
      />`;

      content = content.replace('<>', `<>\n${newComp}`);
      fs.writeFileSync(rootPath, content, 'utf-8');
      return { ok: true, message: `Added composition: ${comp.id}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  async renderVideo(projectDir, opts = {}) {
    const composition = opts.composition || 'MyVideo';
    const output = opts.output || path.join(projectDir, 'out', `${composition}.mp4`);

    fs.mkdirSync(path.dirname(output), { recursive: true });

    const args = ['render', composition, output];
    if (opts.codec) args.push('--codec', opts.codec);
    if (opts.quality) args.push('--quality', opts.quality.toString());
    if (opts.fps) args.push('--fps', opts.fps.toString());
    if (opts.frames) args.push('--frames', opts.frames);
    if (opts.imageFormat) args.push('--image-format', opts.imageFormat);

    try {
      const result = execSync(`npx remotion ${args.join(' ')}`, {
        cwd: projectDir,
        encoding: 'utf-8',
        timeout: opts.timeout || 600_000,
        maxBuffer: 50 * 1024 * 1024,
      });

      const stats = fs.existsSync(output) ? fs.statSync(output) : null;

      return {
        ok: true,
        output,
        size: stats?.size || 0,
        composition,
        command: `npx remotion ${args.join(' ')}`,
        duration: Date.now(),
      };
    } catch (e) {
      return {
        ok: false,
        error: e.message,
        output: e.stdout || '',
        command: `npx remotion ${args.join(' ')}`,
      };
    }
  }

  async renderFrames(projectDir, opts = {}) {
    const composition = opts.composition || 'MyVideo';
    const outputDir = opts.output || path.join(projectDir, 'out', 'frames');

    fs.mkdirSync(outputDir, { recursive: true });

    const args = ['render', composition, outputDir, '--image-format', opts.imageFormat || 'png'];
    if (opts.frames) args.push('--frames', opts.frames);

    try {
      const result = execSync(`npx remotion ${args.join(' ')}`, {
        cwd: projectDir,
        encoding: 'utf-8',
        timeout: opts.timeout || 300_000,
        maxBuffer: 50 * 1024 * 1024,
      });

      const frames = fs.readdirSync(outputDir).filter(f => f.endsWith('.png') || f.endsWith('.jpeg'));

      return {
        ok: true,
        outputDir,
        frameCount: frames.length,
        frames: frames.slice(0, 10),
        command: `npx remotion ${args.join(' ')}`,
      };
    } catch (e) {
      return { ok: false, error: e.message, output: e.stdout || '' };
    }
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  startStudio(projectDir, port = 3000) {
    try {
      const proc = spawn('npx', ['remotion', 'studio', '--port', port.toString(), '--no-open'], {
        cwd: projectDir,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      proc.unref();
      return { ok: true, port, pid: proc.pid, message: `Studio started on http://localhost:${port}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Project Management ─────────────────────────────────────────────────────

  listProjects() {
    try {
      const projects = fs.readdirSync(REMOTION_DIR).filter(name => {
        const pkgPath = path.join(REMOTION_DIR, name, 'package.json');
        return fs.existsSync(pkgPath);
      });

      return {
        ok: true,
        projects: projects.map(name => {
          const pkgPath = path.join(REMOTION_DIR, name, 'package.json');
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          return { name, version: pkg.version, description: pkg.description, path: path.join(REMOTION_DIR, name) };
        }),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  deleteProject(projectName) {
    const projectDir = path.join(REMOTION_DIR, projectName);
    if (!fs.existsSync(projectDir)) return { ok: false, error: 'Project not found' };
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
      return { ok: true, message: `Deleted project: ${projectName}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  async _npmInstall(dir) {
    try {
      execSync('npm install', { cwd: dir, encoding: 'utf-8', timeout: 180_000 });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

module.exports = new RemotionRenderingService();
