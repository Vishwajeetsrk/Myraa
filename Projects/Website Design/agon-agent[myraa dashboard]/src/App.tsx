import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power, Shield, Radio, Radar, Cpu, Flame, HeartPulse, Wind, Droplets,
  MessageSquare, Mic, Send, ChevronRight, Lock, FileDigit, Zap, Activity,
  Satellite, Terminal, ListChecks, Database, Swords, Fingerprint, Volume2,
  VolumeX, Plus, Check, Search, Play, AlertTriangle, Hexagon, CircleDot, Sparkles
} from 'lucide-react';
import { ArcGauge, Bar, EqBars, RadarCanvas, SectionTitle, Spark, StatusDot, Toggle, WaveCanvas } from './components/hud';
import {
  MODEL_IMG, ambientChatter, bootLines, getAIResponse, initialContacts, initialSystems,
  initialTasks, initialVault, nowStamp, protocols, tickerItems, uid,
  type Contact, type LogLine, type Protocol, type SystemModule, type TaskItem, type VaultFile,
} from './lib/engine';

interface ChatMsg { id: string; role: 'user' | 'ai'; text: string; t: string }

function beep(freq = 880, dur = 0.06, vol = 0.05) {
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur);
    setTimeout(() => ctx.close(), dur * 1000 + 100);
  } catch { /* silent */ }
}

function speak(text: string, enabled: boolean) {
  if (!enabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 220));
    u.rate = 1.02; u.pitch = 1.15; u.volume = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const fem = voices.find(v => /female|samantha|zira|google uk english female|aria|jenny/i.test(v.name)) ?? voices.find(v => v.lang.startsWith('en'));
    if (fem) u.voice = fem;
    window.speechSynthesis.speak(u);
  } catch { /* silent */ }
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [bootIdx, setBootIdx] = useState(0);
  const [systems, setSystems] = useState<SystemModule[]>(initialSystems);
  const [reactor, setReactor] = useState(78);
  const [threat, setThreat] = useState(27);
  const [now, setNow] = useState(new Date());
  const [logs, setLogs] = useState<LogLine[]>([
    { id: uid(), t: nowStamp(), src: 'AURELIA', msg: 'Interface bound to operator. Welcome back, sir.', kind: 'ok' },
    { id: uid(), t: nowStamp(), src: 'REACTOR', msg: 'Output nominal — 3.1 GJ/s.', kind: 'info' },
  ]);
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: uid(), role: 'ai', text: 'Systems online, sir. I am AURELIA — your interface, analyst and occasional conscience. Ask for a status report, raise the shields, or simply talk to me.', t: nowStamp() },
  ]);
  const [input, setInput] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [mood, setMood] = useState<'calm' | 'alert' | 'busy'>('calm');
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [newTask, setNewTask] = useState('');
  const [vault, setVault] = useState<VaultFile[]>(initialVault);
  const [vaultQ, setVaultQ] = useState('');
  const [contacts] = useState<Contact[]>(initialContacts);
  const [activeContact, setActiveContact] = useState('c1');
  const [voiceOn, setVoiceOn] = useState(true);
  const [activeProtocol, setActiveProtocol] = useState<Protocol | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [powerHist, setPowerHist] = useState<number[]>([72, 74, 73, 76, 78, 77, 79, 78]);
  const [neuralHist, setNeuralHist] = useState<number[]>([60, 62, 61, 64, 63, 66, 64, 65]);
  const [listening, setListening] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<unknown>(null);

  const reactorSys = systems.find(s => s.id === 'reactor');
  const onlineCount = systems.filter(s => s.status === 'online').length;

  const pushLog = (src: string, msg: string, kind: LogLine['kind'] = 'info') => {
    setLogs(prev => [...prev.slice(-60), { id: uid(), t: nowStamp(), src, msg, kind }]);
  };

  const flashToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 3200);
  };

  // boot sequence
  useEffect(() => {
    if (booted) return;
    if (bootIdx < bootLines.length) {
      const t = setTimeout(() => setBootIdx(i => i + 1), 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setBooted(true); beep(660, 0.12, 0.06); }, 700);
    return () => clearTimeout(t);
  }, [bootIdx, booted]);

  // clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // telemetry
  useEffect(() => {
    if (!booted) return;
    const t = setInterval(() => {
      const jitter = (v: number, amt = 4) => Math.max(2, Math.min(99, v + (Math.random() - 0.5) * amt));
      setSystems(prev => prev.map(s => ({
        ...s,
        load: s.status === 'online' ? Math.round(jitter(s.load, 7)) : s.status === 'standby' ? Math.round(jitter(s.load, 3)) : Math.max(0, Math.round(s.load + (Math.random() - 0.5) * 2)),
        temp: Math.round(jitter(s.temp, 1.4) * 10) / 10,
      })));
      setReactor(r => Math.max(20, Math.min(99, Math.round(r + (Math.random() - 0.5) * 2.4))));
      setPowerHist(p => [...p.slice(-23), Math.max(20, Math.min(99, reactor + (Math.random() - 0.5) * 6))]);
      setNeuralHist(p => [...p.slice(-23), Math.max(30, Math.min(98, 64 + (Math.random() - 0.5) * 8))]);
      setThreat(th => Math.max(8, Math.min(72, Math.round(th + (Math.random() - 0.5) * 4))));
      if (Math.random() < 0.55) {
        const c = ambientChatter[Math.floor(Math.random() * ambientChatter.length)];
        pushLog(c.src, c.msg, Math.random() < 0.08 ? 'warn' : 'info');
      }
    }, 2200);
    return () => clearInterval(t);
  }, [booted, reactor]);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, speaking]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [logs]);

  const toggleSystem = (id: string) => {
    beep(id === 'weapons' ? 220 : 740, 0.07);
    setSystems(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = s.status === 'online' ? (id === 'weapons' || id === 'stealth' ? 'offline' : 'standby') : 'online';
      pushLog(s.code, `${s.name} → ${next.toUpperCase()}`, next === 'online' ? 'ok' : 'warn');
      return { ...s, status: next as SystemModule['status'] };
    }));
  };

  const runProtocol = (p: Protocol) => {
    setActiveProtocol(p);
    beep(520, 0.09); setTimeout(() => beep(780, 0.09), 120);
    pushLog('TACTICAL', `Protocol ${p.code} “${p.name}” armed — ${p.units}`, p.risk === 'CRITICAL' ? 'alert' : 'warn');
    if (p.id === 'p1') flashToast('HOUSE PARTY — 35 suits airborne. ETA 90 seconds.');
    else if (p.id === 'p4') {
      setSystems(prev => prev.map(s => s.id === 'shield' ? { ...s, status: 'online', load: 96 } : s));
      flashToast('AEGIS WALL — shield matrix at 100%.');
    } else if (p.id === 'p2') {
      setSystems(prev => prev.map(s => s.id === 'stealth' ? { ...s, status: 'online', load: 88 } : s));
      flashToast('SILENT NIGHT — emissions at near zero.');
    } else if (p.id === 'p5') {
      flashToast('CRIMSON LOCK requires dual authorization.');
    } else flashToast(`Protocol ${p.code} executing — ${p.name}.`);
  };

  const send = (textRaw?: string) => {
    const text = (textRaw ?? input).trim();
    if (!text) return;
    beep(980, 0.05, 0.04);
    setInput('');
    setMsgs(prev => [...prev, { id: uid(), role: 'user', text, t: nowStamp() }]);
    pushLog('OPERATOR', text.slice(0, 90), 'info');
    setSpeaking(true);
    setMood('busy');
    const { text: reply, action, mood: m } = getAIResponse(text);
    setTimeout(() => {
      setMsgs(prev => [...prev, { id: uid(), role: 'ai', text: reply, t: nowStamp() }]);
      setMood(m);
      pushLog('AURELIA', reply.slice(0, 110) + (reply.length > 110 ? '…' : ''), m === 'alert' ? 'warn' : 'ok');
      // apply actions
      if (action.type === 'toggle' && action.payload) {
        const [sys, mode] = action.payload.split(':');
        setSystems(prev => prev.map(s => {
          if ((sys === 'shield' && s.id === 'shield') || (sys === 'stealth' && s.id === 'stealth') || (sys === 'weapons' && s.id === 'weapons')) {
            const ns = mode === 'on' ? 'online' : mode === 'off' ? 'standby' : s.status;
            return { ...s, status: ns as SystemModule['status'], load: mode === 'on' ? 90 : 14 };
          }
          return s;
        }));
      } else if (action.type === 'power' && action.payload) {
        const v = parseInt(action.payload, 10);
        setReactor(v);
        setPowerHist(p => [...p.slice(-23), v]);
      } else if (action.type === 'task' && action.payload) {
        setTasks(prev => [{ id: uid(), label: action.payload as string, tag: 'AURELIA', done: false, priority: 'med' }, ...prev]);
      } else if (action.type === 'protocol' && action.payload) {
        const p = protocols.find(x => x.id === action.payload);
        if (p) runProtocol(p);
      }
      speak(reply, voiceOn);
      setTimeout(() => { setSpeaking(false); setMood('calm'); }, 2600);
    }, 750 + Math.random() * 650);
  };

  const toggleMic = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => VoiceRec; webkitSpeechRecognition?: new () => VoiceRec }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => VoiceRec }).webkitSpeechRecognition;
    if (!SR) { flashToast('Voice capture unavailable in this browser — type instead.'); return; }
    if (listening) {
      (recogRef.current as VoiceRec | null)?.stop?.();
      setListening(false);
      return;
    }
    try {
      const rec: VoiceRec = new SR();
      recogRef.current = rec;
      rec.lang = 'en-US'; rec.interimResults = false;
      rec.onresult = (e: { results: { [k: number]: { [j: number]: { transcript: string } } } }) => {
        const t = e.results[0]?.[0]?.transcript;
        if (t) send(t);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.start();
      setListening(true);
      beep(1200, 0.08);
    } catch { flashToast('Mic blocked — check permissions.'); }
  };

  const filteredVault = useMemo(() => vault.filter(f => (f.name + f.type).toLowerCase().includes(vaultQ.toLowerCase())), [vault, vaultQ]);
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
  const timeStr = now.toTimeString().slice(0, 8);

  const moodColor = mood === 'alert' ? '#ff2d4d' : mood === 'busy' ? '#e8c15a' : '#22d3ee';

  return (
    <div className="min-h-screen relative">
      {/* ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 grid-bg opacity-70" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(34,211,238,0.16), transparent)' }} />
        <div className="absolute bottom-0 -left-40 w-[500px] h-[380px] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,45,77,0.10), transparent)' }} />
      </div>

      {/* BOOT */}
      <AnimatePresence>
        {!booted && (
          <motion.div className="fixed inset-0 z-[100] bg-[#020507] flex items-center justify-center p-6" exit={{ opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.7 }}>
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full border border-cyan-400/60 flex items-center justify-center ring-spin-fast" style={{ boxShadow: '0 0 30px rgba(34,211,238,0.4)' }}>
                  <CircleDot className="text-cyan-300" size={28} />
                </div>
                <div>
                  <div className="font-display text-2xl font-extrabold tracking-[0.3em] text-white text-glow-cyan">AURELIA</div>
                  <div className="font-mono2 text-[11px] text-cyan-400/70 tracking-[0.2em]">AUTONOMOUS UTILITY · RECON · LOGISTICS · INTEL ARRAY</div>
                </div>
              </div>
              <div className="hud-panel p-5 scanlines">
                <div className="font-mono2 text-[12px] leading-6 text-cyan-100/90 min-h-[168px]">
                  {bootLines.slice(0, bootIdx).map((l, i) => (
                    <div key={i} className={i === bootLines.length - 1 ? 'text-emerald-300' : ''}>
                      <span className="text-cyan-500 mr-2">›</span>{l}
                    </div>
                  ))}
                  <span className="blink text-cyan-300">▊</span>
                </div>
                <div className="mt-4 h-1.5 bg-cyan-950 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-200" style={{ width: `${(bootIdx / bootLines.length) * 100}%`, transition: 'width 0.4s', boxShadow: '0 0 12px #22d3ee' }} />
                </div>
                <div className="flex justify-between mt-2 font-mono2 text-[10px] text-cyan-400/60">
                  <span>SECURE BOOT · AES-512</span><span>{Math.round((bootIdx / bootLines.length) * 100)}%</span>
                </div>
              </div>
              <button onClick={() => setBooted(true)} className="mt-4 font-display text-[11px] tracking-[0.3em] text-cyan-300/60 hover:text-cyan-200 cursor-pointer">SKIP SEQUENCE →</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-cyan-400/15 bg-[#030a0f]/85 backdrop-blur-xl">
        <div className="max-w-[1720px] mx-auto px-3 md:px-5 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 shrink-0">
              <div className="absolute inset-0 rounded-full border border-cyan-400/50 ring-spin" />
              <div className="absolute inset-[5px] rounded-full border border-dashed border-cyan-300/40 ring-spin-rev" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-full bg-cyan-300" style={{ boxShadow: '0 0 14px #22d3ee' }} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold tracking-[0.32em] text-white text-sm md:text-base leading-none">AURELIA <span className="text-cyan-300 text-glow-cyan">OS</span> <span className="hidden sm:inline text-[10px] text-rose-400/90 tracking-[0.2em] ml-1 border border-rose-500/40 px-1.5 py-0.5">MK-VII</span></div>
              <div className="font-mono2 text-[10px] text-cyan-400/60 tracking-[0.18em] mt-1 truncate">STARK PRIVATE GRID · NODE MALIBU-01 · {dateStr}</div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-5 font-mono2 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-300"><StatusDot status="online" /> GRID STABLE</span>
            <span className="text-cyan-200/70 flex items-center gap-1.5"><Satellite size={13} /> 4.2ms</span>
            <span className="text-amber-200/80 flex items-center gap-1.5"><AlertTriangle size={13} /> THREAT {threat}</span>
          </div>
          <div className="text-right leading-none">
            <div className="font-display font-bold text-cyan-100 text-lg tabular-nums text-glow-cyan">{timeStr}</div>
            <div className="font-mono2 text-[10px] text-cyan-400/60 tracking-[0.2em]">LOCAL · UTC{new Date().getTimezoneOffset() <= 0 ? '+' : '-'}{Math.abs(new Date().getTimezoneOffset() / 60)}</div>
          </div>
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-cyan-400/15">
            <img src={MODEL_IMG} alt="operator" className="w-9 h-9 rounded-full object-cover object-top border border-cyan-300/50" style={{ boxShadow: '0 0 12px rgba(34,211,238,0.4)' }} />
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-white">T. Stark</div>
              <div className="font-mono2 text-[10px] text-emerald-300 flex items-center gap-1"><StatusDot status="online" /> OPERATOR</div>
            </div>
          </div>
        </div>
        {/* ticker */}
        <div className="border-t border-cyan-400/10 bg-black/40 overflow-hidden whitespace-nowrap py-1">
          <div className="ticker-track inline-flex gap-8 font-mono2 text-[10.5px] tracking-[0.18em] text-cyan-300/70">
            {[...tickerItems, ...tickerItems].map((t, i) => (
              <span key={i} className="flex items-center gap-2"><span className="text-cyan-500">◆</span>{t}</span>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1720px] mx-auto px-3 md:px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 pb-10">

        {/* ============ LEFT ============ */}
        <section className="lg:col-span-3 flex flex-col gap-4 order-2 lg:order-1">
          {/* reactor */}
          <div className="hud-panel hud-corner scanlines p-4">
            <SectionTitle icon={<Zap size={14} />} title="Arc Reactor" right={<span className="font-mono2 text-[10px] text-emerald-300 flex items-center gap-1.5"><StatusDot status="online" /> {reactorSys?.code}</span>} />
            <div className="flex items-center justify-around">
              <ArcGauge value={reactor} label="OUTPUT" sub="3.1 GJ/s nominal" />
              <div className="flex flex-col gap-3 items-center">
                <ArcGauge value={reactorSys?.temp ? Math.min(100, reactorSys.temp) : 36} label="THERMAL" sub={`${reactorSys?.temp.toFixed(1)}°C`} size={110} tone={reactor > 90 ? 'red' : 'gold'} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between font-mono2 text-[10px] text-cyan-300/70 mb-1.5"><span>REACTOR THROTTLE</span><span className="text-white">{reactor}%</span></div>
              <input type="range" min={10} max={100} value={reactor} onChange={e => { setReactor(+e.target.value); }} className={`hud-range w-full ${reactor > 90 ? 'red' : ''}`} style={{ ['--fill' as string]: `${reactor}%` }} />
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[32, 65, 97].map(v => (
                  <button key={v} onClick={() => { setReactor(v); beep(v === 97 ? 300 : 700, 0.08); pushLog('REACTOR', `Throttle → ${v}%`, v > 90 ? 'warn' : 'ok'); }} className={`btn-hud font-display text-[10px] tracking-[0.2em] py-1.5 border cursor-pointer transition-all ${reactor === v ? 'bg-cyan-400/25 border-cyan-300/70 text-white' : 'bg-cyan-950/40 border-cyan-400/20 text-cyan-300/70 hover:border-cyan-300/50'}`}>{v === 32 ? 'ECO' : v === 65 ? 'CRUISE' : 'OVERDRIVE'}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-cyan-400/10 flex items-center justify-between">
              <div className="font-mono2 text-[10px] text-cyan-400/60">POWER CURVE · 24 PTS</div>
              <Spark data={powerHist} w={150} h={34} />
            </div>
          </div>

          {/* systems */}
          <div className="hud-panel p-4">
            <SectionTitle icon={<Cpu size={14} />} title={`Core Systems · ${onlineCount}/9`} right={<span className="font-mono2 text-[10px] text-cyan-400/60">{onlineCount >= 6 ? 'NOMINAL' : 'DEGRADED'}</span>} />
            <div className="flex flex-col gap-2 max-h-[430px] overflow-y-auto thin-scroll pr-1">
              {systems.map(s => (
                <div key={s.id} className={`border px-3 py-2.5 transition-all ${s.status === 'online' ? 'border-cyan-400/20 bg-cyan-400/[0.04]' : s.status === 'standby' ? 'border-amber-300/20 bg-amber-300/[0.03]' : 'border-slate-700/40 bg-black/30 opacity-75'}`} style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <div className="flex items-center gap-2">
                    <StatusDot status={s.status} />
                    <span className="font-semibold text-[13.5px] text-white leading-none">{s.name}</span>
                    <span className="font-mono2 text-[9px] text-cyan-400/50 ml-auto">{s.code}</span>
                    <Toggle on={s.status === 'online'} onFlip={() => toggleSystem(s.id)} tone={s.id === 'weapons' ? 'red' : 'cyan'} />
                  </div>
                  <div className="font-mono2 text-[10px] text-cyan-200/40 mt-1 truncate">{s.desc}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1"><Bar value={s.load} tone={s.load > 85 ? 'red' : s.load > 50 ? 'cyan' : 'green'} h="h-1" /></div>
                    <span className="font-mono2 text-[10px] text-cyan-200/70 w-8 text-right tabular-nums">{s.load}%</span>
                    <span className={`font-mono2 text-[9px] px-1.5 py-0.5 tracking-widest ${s.status === 'online' ? 'text-emerald-300 bg-emerald-400/10' : s.status === 'standby' ? 'text-amber-300 bg-amber-400/10' : 'text-slate-400 bg-slate-500/10'}`}>{s.status.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* directives */}
          <div className="hud-panel p-4">
            <SectionTitle icon={<ListChecks size={14} />} title="Directives" right={<span className="font-mono2 text-[10px] text-cyan-400/60">{tasks.filter(t => !t.done).length} OPEN</span>} />
            <div className="flex gap-2 mb-3">
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && (newTask.trim() && (setTasks(p => [{ id: uid(), label: newTask.trim(), tag: 'FIELD', done: false, priority: 'med' }, ...p]), setNewTask(''), beep(880, 0.05)))} placeholder="New directive…" className="flex-1 bg-black/50 border border-cyan-400/20 px-3 py-2 text-[13px] text-cyan-100 placeholder:text-cyan-600/60 outline-none focus:border-cyan-300/60" />
              <button onClick={() => { if (newTask.trim()) { setTasks(p => [{ id: uid(), label: newTask.trim(), tag: 'FIELD', done: false, priority: 'med' }, ...p]); setNewTask(''); beep(880, 0.05); } }} className="btn-hud bg-cyan-400/20 border border-cyan-300/50 px-3 text-cyan-200 hover:bg-cyan-400/35 cursor-pointer"><Plus size={16} /></button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto thin-scroll">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2.5 group px-2 py-2 border border-transparent hover:border-cyan-400/20 hover:bg-cyan-400/[0.04]">
                  <button onClick={() => setTasks(p => p.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} className={`w-4.5 w-[18px] h-[18px] shrink-0 border flex items-center justify-center cursor-pointer ${t.done ? 'bg-emerald-400/30 border-emerald-300/70' : 'border-cyan-400/40 hover:border-cyan-200'}`}>{t.done && <Check size={12} className="text-emerald-200" />}</button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] leading-tight ${t.done ? 'line-through text-slate-500' : 'text-cyan-50'}`}>{t.label}</div>
                    <div className="flex gap-1.5 mt-0.5">
                      <span className="font-mono2 text-[9px] text-cyan-400/60 tracking-widest">{t.tag}</span>
                      <span className={`font-mono2 text-[9px] tracking-widest ${t.priority === 'high' ? 'text-rose-300' : t.priority === 'med' ? 'text-amber-300' : 'text-slate-400'}`}>● {t.priority.toUpperCase()}</span>
                    </div>
                  </div>
                  <button onClick={() => setTasks(p => p.filter(x => x.id !== t.id))} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-300 text-lg leading-none cursor-pointer">×</button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ CENTER ============ */}
        <section className="lg:col-span-6 flex flex-col gap-4 order-1 lg:order-2">
          {/* HOLOGRAM */}
          <div className="hud-panel hud-corner scanlines relative overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3">
              <div className="flex items-center gap-2 font-mono2 text-[10px] tracking-[0.25em] text-cyan-300/70">
                <Hexagon size={13} /> HOLO-PROJECTION · CHAMBER 01
              </div>
              <div className="flex items-center gap-2 font-mono2 text-[10px]">
                <span className="flex items-center gap-1.5 px-2 py-1 border" style={{ borderColor: moodColor + '55', color: moodColor }}>
                  <span className="w-1.5 h-1.5 rounded-full blink" style={{ background: moodColor, boxShadow: `0 0 8px ${moodColor}` }} />
                  {mood === 'alert' ? 'COMBAT FOCUS' : mood === 'busy' ? 'PROCESSING' : 'ATTENTIVE'}
                </span>
                <span className="hidden sm:inline text-cyan-400/50 tracking-[0.2em]">SYNC 98.2%</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px] px-4">
              {/* rings behind */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-[112%] max-w-[640px] aspect-square rounded-full border border-cyan-400/15 ring-spin" style={{ borderStyle: 'dashed' }} />
                <div className="absolute w-[92%] max-w-[520px] aspect-square rounded-full border border-cyan-300/25 ring-spin-rev" />
                <div className="absolute w-[74%] max-w-[420px] aspect-square rounded-full border border-dashed border-amber-200/20 ring-spin" />
                <div className="absolute w-[120%] h-[60px] bottom-[8%] rounded-[100%] border border-cyan-400/30" style={{ boxShadow: '0 0 40px rgba(34,211,238,0.25)' }} />
              </div>

              {/* the model */}
              <div className="relative float-y">
                <div className="holo-frame relative mx-auto w-[78%] max-w-[380px]">
                  <img src={MODEL_IMG} alt="AURELIA avatar" className="w-full h-auto object-cover holo-tint select-none" draggable={false} style={{ filter: 'saturate(1.1) contrast(1.05) drop-shadow(0 0 45px rgba(34,211,238,0.35))' }} />
                  {/* holo tint overlays */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(34,211,238,0.14), transparent 30%, transparent 62%, rgba(34,211,238,0.22)), radial-gradient(ellipse at 50% 30%, rgba(150,240,255,0.12), transparent 60%)', mixBlendMode: 'screen' }} />
                  <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: 'repeating-linear-gradient(to bottom, transparent 0 3px, rgba(120,230,255,0.18) 3px 4px)' }} />
                  <div className="holo-scan" />
                  {/* face scan bracket */}
                  <div className="absolute top-[6%] left-1/2 -translate-x-1/2 w-[46%] aspect-[3/4] pointer-events-none">
                    <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-200" style={{ boxShadow: '-2px -2px 8px rgba(34,211,238,0.5)' }} />
                    <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-200" style={{ boxShadow: '2px -2px 8px rgba(34,211,238,0.5)' }} />
                    <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-200" />
                    <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-200" />
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono2 text-[9px] tracking-[0.2em] text-cyan-200 whitespace-nowrap">ID: A.STARK ✓</span>
                  </div>
                </div>
                {/* pedestal glow */}
                <div className="mx-auto -mt-6 h-10 w-[70%] rounded-[100%]" style={{ background: 'radial-gradient(closest-side, rgba(34,211,238,0.5), rgba(34,211,238,0.12), transparent)' }} />
              </div>

              {/* side data rails */}
              <div className="absolute left-0 top-[16%] hidden sm:flex flex-col gap-2 font-mono2 text-[10px]">
                {[['PWR', `${reactor}%`, '#22d3ee'], ['SYNC', '98.2%', '#34d399'], ['CORE', `${reactorSys?.temp.toFixed(0)}°C`, '#e8c15a']].map(([k, v, c]) => (
                  <div key={k} className="border border-cyan-400/20 bg-black/50 backdrop-blur px-2.5 py-1.5 min-w-[92px]" style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}>
                    <div className="text-cyan-400/50 tracking-[0.2em] text-[9px]">{k}</div>
                    <div className="font-display font-bold text-[15px]" style={{ color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="absolute right-0 top-[16%] hidden sm:flex flex-col gap-2 font-mono2 text-[10px] text-right">
                {[['THREAT', String(threat), threat > 45 ? '#ff2d4d' : '#22d3ee'], ['SUITS', '35 RDY', '#e8c15a'], ['UPLINK', '4.2ms', '#34d399']].map(([k, v, c]) => (
                  <div key={k} className="border border-cyan-400/20 bg-black/50 backdrop-blur px-2.5 py-1.5 min-w-[92px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%)' }}>
                    <div className="text-cyan-400/50 tracking-[0.2em] text-[9px]">{k}</div>
                    <div className="font-display font-bold text-[15px]" style={{ color: c }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* nameplate */}
              <div className="relative text-center pb-1 -mt-2">
                <div className="font-display font-black text-3xl md:text-4xl tracking-[0.28em] text-white text-glow-cyan">AURELIA</div>
                <div className="font-mono2 text-[10.5px] tracking-[0.3em] text-amber-200/70 mt-1">AUTONOMOUS UTILITY · RECON · LOGISTICS · INTEL ARRAY</div>
              </div>

              {/* voice band */}
              <div className="mx-4 mb-4 border border-cyan-400/20 bg-black/60 backdrop-blur px-3 py-2.5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-all ${speaking || listening ? 'border-cyan-200 bg-cyan-400/20' : 'border-cyan-400/30 bg-cyan-950/40'}`} style={speaking || listening ? { boxShadow: '0 0 18px rgba(34,211,238,0.6)' } : {}}>
                  <Activity size={18} className={speaking || listening ? 'text-cyan-100' : 'text-cyan-400/60'} />
                </div>
                <div className="flex-1 h-[44px]"><WaveCanvas level={speaking ? 0.9 : listening ? 0.6 : 0.14} color={moodColor} /></div>
                <div className="text-right shrink-0">
                  <EqBars active={speaking || listening} color={moodColor} />
                  <div className="font-mono2 text-[9px] tracking-[0.2em] mt-1" style={{ color: moodColor }}>{speaking ? '● SPEAKING' : listening ? '● LISTENING' : '○ IDLE'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* CONSOLE */}
          <div className="hud-panel hud-corner p-4">
            <SectionTitle icon={<MessageSquare size={14} />} title="Voice Interface" right={
              <div className="flex items-center gap-2">
                <button onClick={() => setVoiceOn(v => !v)} className="flex items-center gap-1.5 font-mono2 text-[10px] px-2 py-1 border border-cyan-400/25 text-cyan-300/80 hover:border-cyan-300/60 cursor-pointer">{voiceOn ? <Volume2 size={12} /> : <VolumeX size={12} />}{voiceOn ? 'VOICE' : 'MUTED'}</button>
                <span className="font-mono2 text-[10px] text-cyan-400/50 hidden sm:inline">EN · NEURAL TTS</span>
              </div>
            } />
            <div ref={chatRef} className="h-[240px] overflow-y-auto thin-scroll flex flex-col gap-2.5 pr-1 mb-3">
              {msgs.map(m => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3.5 py-2.5 text-[13.5px] leading-relaxed ${m.role === 'user'
                    ? 'bg-amber-200/[0.08] border border-amber-200/25 text-amber-50'
                    : 'bg-cyan-400/[0.07] border border-cyan-400/25 text-cyan-50'}`} style={{ clipPath: m.role === 'user' ? 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)' : 'polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
                    <div className={`font-mono2 text-[9px] tracking-[0.25em] mb-1 ${m.role === 'user' ? 'text-amber-300/70' : 'text-cyan-300/70'}`}>{m.role === 'user' ? '◈ OPERATOR' : '⬢ AURELIA'} · {m.t}</div>
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {speaking && (
                <div className="flex justify-start"><div className="px-3 py-2 border border-cyan-400/25 bg-cyan-400/[0.05] flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-300 blink" style={{ animationDelay: `${i * 0.2}s` }} />)}</div></div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['Status report', 'Raise shields', 'Engage stealth', 'Deep scan', 'Power to 97%', 'Deploy house party'].map(q => (
                <button key={q} onClick={() => send(q)} className="font-mono2 text-[10.5px] tracking-wider px-2.5 py-1.5 border border-cyan-400/20 bg-cyan-950/40 text-cyan-200/80 hover:border-cyan-300/60 hover:text-white hover:bg-cyan-400/15 transition-all cursor-pointer flex items-center gap-1"><ChevronRight size={11} />{q}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={toggleMic} title="Voice input" className={`btn-hud w-11 shrink-0 flex items-center justify-center border cursor-pointer transition-all ${listening ? 'bg-rose-500/30 border-rose-400/70 text-rose-100 blink' : 'bg-cyan-950/60 border-cyan-400/30 text-cyan-300 hover:border-cyan-200'}`}><Mic size={17} /></button>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder='Speak to AURELIA — try “raise shields” or “power to 90%”…' className="flex-1 min-w-0 bg-black/60 border border-cyan-400/25 px-4 py-2.5 text-[14px] text-cyan-50 placeholder:text-cyan-600/70 outline-none focus:border-cyan-300/70 focus:shadow-[0_0_18px_rgba(34,211,238,0.25)]" />
              <button onClick={() => send()} className="btn-hud px-5 bg-gradient-to-r from-cyan-500 to-cyan-400 text-[#03222b] font-display font-bold text-[12px] tracking-[0.2em] flex items-center gap-2 hover:brightness-110 cursor-pointer" style={{ boxShadow: '0 0 22px rgba(34,211,238,0.45)' }}><Send size={14} /> SEND</button>
            </div>
          </div>

          {/* sys log */}
          <div className="hud-panel p-4">
            <SectionTitle icon={<Terminal size={14} />} title="System Stream" right={<span className="font-mono2 text-[10px] text-emerald-300 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 blink" /> LIVE</span>} />
            <div ref={logRef} className="h-[132px] overflow-y-auto thin-scroll font-mono2 text-[11.5px] leading-5 bg-black/50 border border-cyan-400/10 p-3">
              {logs.map(l => (
                <div key={l.id} className="flex gap-2 whitespace-nowrap">
                  <span className="text-slate-500 shrink-0">[{l.t}]</span>
                  <span className={`shrink-0 w-[74px] ${l.kind === 'ok' ? 'text-emerald-300' : l.kind === 'warn' ? 'text-amber-300' : l.kind === 'alert' ? 'text-rose-400' : 'text-cyan-300'}`}>{l.src}</span>
                  <span className="text-slate-300 truncate">{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ RIGHT ============ */}
        <section className="lg:col-span-3 flex flex-col gap-4 order-3">
          {/* tactical */}
          <div className="hud-panel hud-red p-4">
            <SectionTitle icon={<Radar size={14} />} title="Tactical Scope" accent="red" right={<span className="font-mono2 text-[10px] text-rose-300/90">GRID K-9</span>} />
            <div className="h-[190px] border border-rose-400/15 bg-black/50"><RadarCanvas threat={threat} /></div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[['THREAT', String(threat), threat > 45 ? 'text-rose-300 text-glow-red' : 'text-cyan-200'], ['CONTACTS', '03', 'text-amber-200'], ['SWEEP', 'CLEAN', 'text-emerald-300']].map(([k, v, c]) => (
                <div key={k} className="border border-cyan-400/15 bg-black/40 py-2">
                  <div className={`font-display font-extrabold text-lg ${c}`}>{v}</div>
                  <div className="font-mono2 text-[9px] tracking-[0.25em] text-cyan-400/50">{k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* vitals */}
          <div className="hud-panel p-4">
            <SectionTitle icon={<HeartPulse size={14} />} title="Operator Vitals" right={<span className="font-mono2 text-[10px] text-emerald-300">● STABLE</span>} />
            <div className="grid grid-cols-2 gap-2.5">
              {[['HEART', '72 BPM', <HeartPulse key="h" size={13} />, '#ff5d7a', [72, 74, 71, 76, 73, 75, 72, 74]], ['OXYGEN', '98.1%', <Wind key="w" size={13} />, '#22d3ee', [97, 98, 98, 97, 98, 99, 98, 98]], ['HYDRATION', '61%', <Droplets key="d" size={13} />, '#60a5fa', [58, 60, 61, 59, 62, 61, 60, 61]], ['SUIT SYNC', '98.2%', <Fingerprint key="f" size={13} />, '#e8c15a', [96, 97, 98, 97, 98, 98, 99, 98]]].map(([k, v, ic, c, d]) => (
                <div key={k as string} className="border border-cyan-400/15 bg-black/40 p-2.5">
                  <div className="flex items-center gap-1.5 font-mono2 text-[9px] tracking-[0.2em] text-cyan-400/60">{ic}{k}</div>
                  <div className="font-display font-bold text-[17px] text-white mt-0.5">{v}</div>
                  <div className="mt-1"><Spark data={d as number[]} w={110} h={26} stroke={c as string} /></div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="flex justify-between font-mono2 text-[10px] text-cyan-300/60 mb-1"><span className="flex items-center gap-1"><Flame size={11} /> SUIT THERMAL</span><span>36.6°C</span></div>
              <Bar value={38} tone="gold" />
            </div>
          </div>

          {/* comms */}
          <div className="hud-panel p-4">
            <SectionTitle icon={<Radio size={14} />} title="Secure Comms" right={<span className="font-mono2 text-[10px] text-cyan-400/60">5 CH</span>} />
            <div className="flex flex-col gap-1.5">
              {contacts.map(c => (
                <button key={c.id} onClick={() => { setActiveContact(c.id); beep(660, 0.05); }} className={`flex items-center gap-2.5 px-2.5 py-2 border text-left cursor-pointer transition-all ${activeContact === c.id ? 'border-cyan-300/50 bg-cyan-400/[0.08]' : 'border-transparent hover:border-cyan-400/20 hover:bg-cyan-400/[0.04]'}`}>
                  <span className="w-8 h-8 rounded-full border border-cyan-400/30 bg-gradient-to-br from-cyan-950 to-slate-900 flex items-center justify-center font-display font-bold text-[12px] text-cyan-200 shrink-0">{c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white leading-none">{c.name} <StatusDot status={c.status} /></span>
                    <span className="block text-[11.5px] text-cyan-200/50 truncate mt-0.5">{c.last}</span>
                  </span>
                  <span className="font-mono2 text-[9px] text-cyan-500/60">{c.role.split('—')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* vault */}
          <div className="hud-panel p-4">
            <SectionTitle icon={<Database size={14} />} title="Data Vault" right={<span className="font-mono2 text-[10px] text-cyan-400/60 flex items-center gap-1"><Lock size={10} /> AES-512</span>} />
            <div className="relative mb-2.5">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-500" />
              <input value={vaultQ} onChange={e => setVaultQ(e.target.value)} placeholder="Search vault…" className="w-full bg-black/50 border border-cyan-400/20 pl-8 pr-3 py-2 text-[12.5px] text-cyan-100 placeholder:text-cyan-700 outline-none focus:border-cyan-300/60" />
            </div>
            <div className="flex flex-col gap-1 max-h-[190px] overflow-y-auto thin-scroll">
              {filteredVault.map(f => (
                <button key={f.id} onClick={() => { beep(520, 0.05); flashToast(`${f.name} — decrypting for operator eyes only.`); pushLog('VAULT', `Access: ${f.name}`, 'info'); }} className="flex items-center gap-2.5 px-2 py-2 border border-transparent hover:border-amber-200/25 hover:bg-amber-200/[0.05] text-left cursor-pointer group">
                  <span className="w-7 h-7 shrink-0 flex items-center justify-center border border-amber-200/25 bg-amber-200/[0.06] text-amber-200"><FileDigit size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-mono2 text-cyan-50 truncate">{f.name}</span>
                    <span className="block font-mono2 text-[9.5px] text-cyan-400/50">{f.type} · {f.size} · {f.updated}</span>
                  </span>
                  <span className="font-mono2 text-[9px] px-1.5 py-0.5 border border-amber-200/30 text-amber-200/80 shrink-0">{f.clearance}</span>
                </button>
              ))}
              {filteredVault.length === 0 && <div className="font-mono2 text-[11px] text-slate-500 py-4 text-center">NO MATCHING ARTIFACTS</div>}
            </div>
          </div>

          {/* protocols */}
          <div className="hud-panel hud-gold p-4">
            <SectionTitle icon={<Swords size={14} />} title="Protocols" accent="gold" right={<span className="font-mono2 text-[10px] text-amber-200/70">6 ARMED</span>} />
            <div className="grid grid-cols-2 gap-2">
              {protocols.map(p => (
                <button key={p.id} onClick={() => runProtocol(p)} className={`text-left border p-2.5 cursor-pointer transition-all hover:-translate-y-0.5 ${p.risk === 'CRITICAL' ? 'border-rose-500/40 bg-rose-500/[0.06] hover:bg-rose-500/[0.12]' : 'border-amber-200/20 bg-amber-200/[0.04] hover:bg-amber-200/[0.09]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono2 text-[9px] text-amber-200/60 tracking-[0.2em]">{p.code}</span>
                    <Play size={11} className={p.risk === 'CRITICAL' ? 'text-rose-300' : 'text-amber-200'} />
                  </div>
                  <div className="font-display font-bold text-[12.5px] text-white mt-0.5 leading-tight">{p.name}</div>
                  <div className={`font-mono2 text-[9px] tracking-[0.2em] mt-1 ${p.risk === 'CRITICAL' ? 'text-rose-300' : p.risk === 'HIGH' ? 'text-orange-300' : 'text-emerald-300'}`}>◈ {p.risk}</div>
                </button>
              ))}
            </div>
          </div>

          {/* neural */}
          <div className="hud-panel p-4">
            <SectionTitle icon={<Sparkles size={14} />} title="Neural Lattice" right={<span className="font-mono2 text-[10px] text-cyan-400/60">4.2 PHz</span>} />
            <div className="flex items-center justify-between">
              <Spark data={neuralHist} w={170} h={40} stroke="#e8c15a" />
              <div className="text-right">
                <div className="font-display font-extrabold text-xl text-amber-200 text-glow-gold">{neuralHist[neuralHist.length - 1]?.toFixed(0)}%</div>
                <div className="font-mono2 text-[9px] tracking-[0.25em] text-cyan-400/50">COHERENCE</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-cyan-400/15 bg-black/50 backdrop-blur py-3">
        <div className="max-w-[1720px] mx-auto px-5 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono2 text-[10px] tracking-[0.2em] text-cyan-400/50">
          <span>AURELIA OS v7.2.1</span>
          <span className="flex items-center gap-1.5"><Shield size={11} /> ALL HANDLERS NOMINAL</span>
          <span className="flex items-center gap-1.5"><Power size={11} /> GRID {reactor}%</span>
          <span className="ml-auto">DESIGNED FOR T. STARK · MALIBU POINT · 2026</span>
        </div>
      </footer>

      {/* protocol modal */}
      <AnimatePresence>
        {activeProtocol && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveProtocol(null)}>
            <motion.div onClick={e => e.stopPropagation()} initial={{ scale: 0.92, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 10 }} className={`hud-panel max-w-md w-full p-6 ${activeProtocol.risk === 'CRITICAL' ? 'hud-red' : 'hud-gold'}`}>
              <div className="flex items-center gap-2 font-mono2 text-[10px] tracking-[0.3em] text-amber-200/70"><AlertTriangle size={13} /> TACTICAL AUTHORIZATION · {activeProtocol.code}</div>
              <h2 className="font-display font-black text-2xl text-white mt-2 tracking-wider">{activeProtocol.name}</h2>
              <p className="text-[14px] text-cyan-100/80 leading-relaxed mt-2">{activeProtocol.desc}</p>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center font-mono2 text-[10px]">
                <div className="border border-cyan-400/20 bg-black/40 py-2"><div className="text-white font-bold text-[13px]">{activeProtocol.units}</div><div className="text-cyan-400/50 tracking-[0.2em]">ASSETS</div></div>
                <div className="border border-cyan-400/20 bg-black/40 py-2"><div className={`font-bold text-[13px] ${activeProtocol.risk === 'CRITICAL' ? 'text-rose-300' : 'text-amber-200'}`}>{activeProtocol.risk}</div><div className="text-cyan-400/50 tracking-[0.2em]">RISK</div></div>
                <div className="border border-cyan-400/20 bg-black/40 py-2"><div className="text-emerald-300 font-bold text-[13px]">READY</div><div className="text-cyan-400/50 tracking-[0.2em]">STATE</div></div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => { pushLog('TACTICAL', `${activeProtocol.code} executed.`, 'ok'); flashToast(`${activeProtocol.name} deployed, sir.`); setActiveProtocol(null); }} className="btn-hud flex-1 py-2.5 bg-gradient-to-r from-amber-300 to-amber-400 text-black font-display font-bold text-[12px] tracking-[0.2em] cursor-pointer hover:brightness-110">EXECUTE</button>
                <button onClick={() => setActiveProtocol(null)} className="btn-hud flex-1 py-2.5 border border-cyan-400/30 text-cyan-200 font-display text-[12px] tracking-[0.2em] cursor-pointer hover:bg-cyan-400/10">STAND DOWN</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] max-w-[92vw]">
            <div className="hud-panel px-5 py-3 flex items-center gap-3 border-cyan-300/40" style={{ boxShadow: '0 0 30px rgba(34,211,238,0.35)' }}>
              <span className="w-2 h-2 rounded-full bg-cyan-300 blink" />
              <span className="font-mono2 text-[12px] tracking-wider text-cyan-50">{toast}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface VoiceRec {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { [k: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
