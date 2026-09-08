import { useEffect, useRef, type ReactNode } from 'react';
import type { SysStatus } from '../lib/engine';

export function SectionTitle({ icon, title, right, accent = 'cyan' }: { icon: ReactNode; title: string; right?: ReactNode; accent?: 'cyan' | 'red' | 'gold' }) {
  const color = accent === 'red' ? 'text-rose-400' : accent === 'gold' ? 'text-amber-300' : 'text-cyan-300';
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <h3 className="font-display text-[11px] tracking-[0.28em] text-cyan-100/90 uppercase">{title}</h3>
      </div>
      {right}
    </div>
  );
}

export function Bar({ value, tone = 'cyan', h = 'h-1.5' }: { value: number; tone?: 'cyan' | 'red' | 'gold' | 'green'; h?: string }) {
  const g =
    tone === 'red' ? 'from-rose-500 to-rose-300' :
    tone === 'gold' ? 'from-amber-500 to-amber-200' :
    tone === 'green' ? 'from-emerald-500 to-emerald-300' : 'from-cyan-500 to-cyan-200';
  return (
    <div className={`w-full ${h} rounded-full bg-cyan-950/80 border border-cyan-400/10 overflow-hidden`}>
      <div className={`h-full rounded-full bg-gradient-to-r ${g} transition-all duration-700`} style={{ width: `${Math.max(2, Math.min(100, value))}%`, boxShadow: '0 0 10px rgba(34,211,238,0.5)' }} />
    </div>
  );
}

export function StatusDot({ status }: { status: SysStatus | string }) {
  const map: Record<string, string> = {
    online: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]',
    standby: 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]',
    offline: 'bg-slate-600',
    alert: 'bg-rose-500 shadow-[0_0_10px_rgba(255,45,77,0.9)] blink',
    busy: 'bg-rose-400 shadow-[0_0_8px_rgba(255,45,77,0.8)]',
    away: 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] ?? 'bg-cyan-400'}`} />;
}

export function Toggle({ on, onFlip, tone = 'cyan' }: { on: boolean; onFlip: () => void; tone?: 'cyan' | 'red' }) {
  return (
    <button
      onClick={onFlip}
      className={`relative w-11 h-[22px] rounded-full border transition-all duration-300 cursor-pointer ${on
        ? tone === 'red' ? 'bg-rose-500/25 border-rose-400/70 shadow-[0_0_12px_rgba(255,45,77,0.5)]' : 'bg-cyan-400/20 border-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
        : 'bg-slate-900/80 border-slate-600/60'}`}
    >
      <span className={`absolute top-[2px] w-[16px] h-[16px] rounded-full transition-all duration-300 ${on ? 'right-[2px]' : 'left-[2px]'} ${on ? (tone === 'red' ? 'bg-rose-300' : 'bg-cyan-200') : 'bg-slate-500'}`} style={on ? { boxShadow: tone === 'red' ? '0 0 10px #ff2d4d' : '0 0 10px #22d3ee' } : {}} />
    </button>
  );
}

export function ArcGauge({ value, label, sub, size = 150, tone = 'cyan' }: { value: number; label: string; sub?: string; size?: number; tone?: 'cyan' | 'red' | 'gold' }) {
  const r = 58;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / 100));
  const stroke = tone === 'red' ? '#ff2d4d' : tone === 'gold' ? '#e8c15a' : '#22d3ee';
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size * 0.72 }}>
        <svg viewBox="0 0 140 92" className="w-full h-full">
          <path d="M 12 82 A 58 58 0 0 1 128 82" fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth="9" strokeLinecap="round" />
          <path
            d="M 12 82 A 58 58 0 0 1 128 82"
            fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={c * 0.78}
            strokeDashoffset={c * 0.78 * (1 - frac)}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s', filter: `drop-shadow(0 0 8px ${stroke})` }}
          />
          {[0, 25, 50, 75, 100].map((t) => {
            const a = Math.PI * (1 - t / 100);
            const x1 = 70 + Math.cos(a) * 48, y1 = 82 - Math.sin(a) * 48;
            const x2 = 70 + Math.cos(a) * 54, y2 = 82 - Math.sin(a) * 54;
            return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(165,243,252,0.5)" strokeWidth="1.5" />;
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="font-display font-800 font-extrabold text-2xl text-white text-glow-cyan" style={{ fontWeight: 800 }}>{Math.round(value)}<span className="text-xs text-cyan-300/80">%</span></div>
        </div>
      </div>
      <div className="font-display text-[10px] tracking-[0.25em] text-cyan-200/90 mt-1">{label}</div>
      {sub && <div className="font-mono2 text-[10px] text-cyan-400/60">{sub}</div>}
    </div>
  );
}

export function Spark({ data, w = 120, h = 34, stroke = '#22d3ee' }: { data: number[]; w?: number; h?: number; stroke?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const id = useRef(`g${Math.random().toString(36).slice(2)}`).current;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.5" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${stroke})` }} />
    </svg>
  );
}

export function WaveCanvas({ level, color = '#22d3ee' }: { level: number; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lvl = useRef(level);
  lvl.current = level;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    const draw = () => {
      t += 0.08;
      const W = (cv.width = cv.offsetWidth * 2);
      const H = (cv.height = cv.offsetHeight * 2);
      ctx.clearRect(0, 0, W, H);
      const lines = 3;
      for (let l = 0; l < lines; l++) {
        ctx.beginPath();
        const amp = (6 + lvl.current * 26) * (1 - l * 0.25);
        for (let x = 0; x <= W; x += 6) {
          const p = x / W;
          const env = Math.sin(p * Math.PI);
          const y = H / 2 + Math.sin(p * 10 + t * (2 + l * 0.6) + l) * amp * env * 2 + Math.sin(p * 23 - t * 3.1) * amp * 0.35 * env;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = l === 0 ? color : color + '55';
        ctx.lineWidth = l === 0 ? 3 : 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = l === 0 ? 14 : 4;
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [color]);
  return <canvas ref={ref} className="w-full h-full" />;
}

export function RadarCanvas({ threat = 27 }: { threat?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let ang = 0;
    const blips = [
      { r: 0.32, a: 0.8, c: '#22d3ee', s: 1 },
      { r: 0.55, a: 2.4, c: '#22d3ee', s: 0.7 },
      { r: 0.68, a: 4.4, c: '#ff2d4d', s: 1 },
      { r: 0.44, a: 5.3, c: '#e8c15a', s: 0.8 },
      { r: 0.8, a: 1.5, c: '#22d3ee', s: 0.5 },
    ];
    const draw = () => {
      ang += 0.022;
      const S = (cv.width = cv.offsetWidth * 2);
      const Hh = (cv.height = cv.offsetHeight * 2);
      const cx = S / 2, cy = Hh / 2;
      const R = Math.min(S, Hh) / 2 - 12;
      ctx.clearRect(0, 0, S, Hh);
      // rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34,211,238,0.22)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // cross
      ctx.strokeStyle = 'rgba(34,211,238,0.14)';
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      // sweep
      for (let i = 0; i < 40; i++) {
        const a = ang - i * 0.02;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a - 0.02, a);
        ctx.closePath();
        ctx.fillStyle = `rgba(34,211,238,${0.20 * (1 - i / 40)})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
      ctx.strokeStyle = 'rgba(165,243,252,0.9)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // blips
      blips.forEach((b) => {
        const bx = cx + Math.cos(b.a) * R * b.r;
        const by = cy + Math.sin(b.a) * R * b.r;
        let d = (ang - b.a) % (Math.PI * 2);
        if (d < 0) d += Math.PI * 2;
        const fade = Math.max(0.15, 1 - d / (Math.PI * 1.2));
        ctx.beginPath();
        ctx.arc(bx, by, 5 * b.s + 2, 0, Math.PI * 2);
        ctx.fillStyle = b.c;
        ctx.globalAlpha = fade;
        ctx.shadowColor = b.c; ctx.shadowBlur = 12;
        ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="relative w-full h-full">
      <canvas ref={ref} className="w-full h-full" />
      <div className="absolute top-1 left-2 font-mono2 text-[10px] text-cyan-300/70">RNG 10KM</div>
      <div className="absolute bottom-1 right-2 font-mono2 text-[10px] text-rose-300/80">THREAT {threat}</div>
    </div>
  );
}

export function EqBars({ active, color = '#22d3ee' }: { active: boolean; color?: string }) {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[0.9, 0.5, 1.1, 0.7, 1.3, 0.6, 1.0, 0.8, 1.2, 0.55, 0.95, 0.7].map((d, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full origin-bottom"
          style={{
            height: '100%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animation: active ? `eqBar ${d}s ease-in-out infinite` : undefined,
            transform: active ? undefined : 'scaleY(0.25)',
            animationDelay: `${i * 0.09}s`,
          }}
        />
      ))}
    </div>
  );
}
