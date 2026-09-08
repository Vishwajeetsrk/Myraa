export type SysStatus = 'online' | 'offline' | 'standby' | 'alert';

export interface SystemModule {
  id: string;
  name: string;
  code: string;
  desc: string;
  status: SysStatus;
  load: number;
  power: number;
  temp: number;
}

export interface TaskItem {
  id: string;
  label: string;
  tag: string;
  done: boolean;
  priority: 'low' | 'med' | 'high';
}

export interface LogLine {
  id: string;
  t: string;
  src: string;
  msg: string;
  kind: 'info' | 'ok' | 'warn' | 'alert';
}

export interface VaultFile {
  id: string;
  name: string;
  type: string;
  size: string;
  clearance: string;
  updated: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'busy' | 'away';
  last: string;
}

export interface Protocol {
  id: string;
  name: string;
  code: string;
  desc: string;
  risk: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  units: string;
}

export const MODEL_IMG = '/uploads/model.png';

export const initialSystems: SystemModule[] = [
  { id: 'reactor', name: 'Arc Reactor', code: 'ARC-01', desc: 'Palladium-core output bus. Primary power.', status: 'online', load: 78, power: 92, temp: 36 },
  { id: 'neural', name: 'Neural Core', code: 'NRL-07', desc: 'AURELIA cognition lattice. 4.2 PHz.', status: 'online', load: 64, power: 81, temp: 41 },
  { id: 'shield', name: 'Aegis Shield', code: 'SHD-03', desc: 'Hexagonal plasma deflection grid.', status: 'standby', load: 12, power: 30, temp: 29 },
  { id: 'prop', name: 'Repulsor Drive', code: 'RPL-11', desc: 'Vectored thrust + stabilizers.', status: 'online', load: 45, power: 66, temp: 52 },
  { id: 'weapons', name: 'Arsenal Bus', code: 'WPN-09', desc: 'Safed. Requires dual authorization.', status: 'offline', load: 4, power: 8, temp: 24 },
  { id: 'stealth', name: 'Ghost Veil', code: 'STH-04', desc: 'EM + optical signature dampening.', status: 'offline', load: 6, power: 12, temp: 27 },
  { id: 'comms', name: 'Comms Array', code: 'COM-02', desc: 'Sat / mesh / quantum relay.', status: 'online', load: 52, power: 58, temp: 33 },
  { id: 'sensors', name: 'Omni Sensors', code: 'SNS-06', desc: 'Lidar, thermal, bio-scan sphere.', status: 'online', load: 71, power: 74, temp: 38 },
  { id: 'life', name: 'Life Support', code: 'LFS-05', desc: 'Atmo, vitals, med-foam reserve.', status: 'online', load: 33, power: 44, temp: 31 },
];

export const initialTasks: TaskItem[] = [
  { id: 't1', label: 'Calibrate repulsor trim — sector 7 crosswind', tag: 'FLIGHT', done: false, priority: 'high' },
  { id: 't2', label: 'Decrypt intercepted burst transmission', tag: 'INTEL', done: false, priority: 'high' },
  { id: 't3', label: 'Sync Mark-VII suit diagnostics', tag: 'ARMORY', done: true, priority: 'med' },
  { id: 't4', label: 'Reroute auxiliary power to sensor grid', tag: 'POWER', done: false, priority: 'med' },
  { id: 't5', label: 'Briefing at 08:00 — Stark Industries board', tag: 'AGENDA', done: false, priority: 'low' },
];

export const initialVault: VaultFile[] = [
  { id: 'v1', name: 'mark_vii_schematics.aura', type: 'SCHEMATIC', size: '2.4 GB', clearance: 'LVL-5', updated: '02:14' },
  { id: 'v2', name: 'aurelia_kernel_v7.2.1.bin', type: 'FIRMWARE', size: '884 MB', clearance: 'LVL-5', updated: '01:47' },
  { id: 'v3', name: 'sector7_threat_assessment.pdf', type: 'INTEL', size: '14 MB', clearance: 'LVL-4', updated: '00:32' },
  { id: 'v4', name: 'ghost_veil_field_tests.log', type: 'LOG', size: '221 MB', clearance: 'LVL-3', updated: '23:58' },
  { id: 'v5', name: 'arc_reactor_telemetry.csv', type: 'DATA', size: '96 MB', clearance: 'LVL-3', updated: '23:11' },
  { id: 'v6', name: 'intercept_burst_0441.wav', type: 'AUDIO', size: '38 MB', clearance: 'LVL-4', updated: '22:40' },
  { id: 'v7', name: 'safehouse_network.map', type: 'MAP', size: '12 MB', clearance: 'LVL-2', updated: '21:05' },
];

export const initialContacts: Contact[] = [
  { id: 'c1', name: 'T. Stark', role: 'Principal — Armory', status: 'online', last: 'Suit up. Party in Malibu?' },
  { id: 'c2', name: 'P. Potts', role: 'Operations — SI', status: 'busy', last: 'Board moved to 08:00 sharp.' },
  { id: 'c3', name: 'J. Rhodes', role: 'Liaison — Air Force', status: 'online', last: 'Need an overwatch pass, south ridge.' },
  { id: 'c4', name: 'S.H.I.E.L.D Relay', role: 'Secure Channel 7', status: 'away', last: 'Encrypted burst received.' },
  { id: 'c5', name: 'F.R.I.D.A.Y', role: 'Sub-routine — Orbital', status: 'online', last: 'Satellite handoff complete.' },
];

export const protocols: Protocol[] = [
  { id: 'p1', name: 'House Party', code: 'HP-35', desc: 'Deploy full Iron Legion for perimeter saturation. All suits airborne in 90 seconds.', risk: 'HIGH', units: '35 UNITS' },
  { id: 'p2', name: 'Silent Night', code: 'SN-02', desc: 'Ghost Veil + comms blackout. Zero-emission infiltration posture.', risk: 'MED', units: 'STEALTH' },
  { id: 'p3', name: 'Deep Scan', code: 'DS-12', desc: 'Omni-sensor overdrive. 10km bio / EM sweep with triangulation.', risk: 'LOW', units: 'SENSORS' },
  { id: 'p4', name: 'Aegis Wall', code: 'AW-07', desc: 'Shield matrix to 100%. Ablative screen over 400m dome.', risk: 'MED', units: 'SHIELD' },
  { id: 'p5', name: 'Crimson Lock', code: 'CL-99', desc: 'Arsenal bus live. Lethal authorization required. Dual-key.', risk: 'CRITICAL', units: 'WEAPONS' },
  { id: 'p6', name: 'Clean Slate', code: 'CS-00', desc: 'Purge caches, rotate keys, burn mesh nodes. Vanish.', risk: 'LOW', units: 'SYSTEM' },
];

export const tickerItems = [
  'SAT UPLINK STABLE — 4.2ms',
  'SECTOR 7 CROSSWIND 22KT',
  'ARC OUTPUT 3.1 GJ/s NOMINAL',
  'ENCRYPTED BURST TRIANGULATED — GRID K-9',
  'GHOST VEIL STANDBY',
  'BOARD BRIEFING 08:00',
  'THREAT INDEX 27 — GUARDED',
  'SUIT MK-VII DIAGNOSTICS 98.2%',
];

export const bootLines = [
  'A.U.R.A OS v7.2.1 — cold start',
  'Mounting neural lattice ............ OK',
  'Binding arc reactor bus ............ OK',
  'Calibrating omni-sensors ........... OK',
  'Verifying operator biometrics ...... MATCH: A. STARK',
  'Loading personality matrix: AURELIA  OK',
  'All systems nominal. Welcome back, sir.',
];

export const ambientChatter = [
  { src: 'SENSORS', msg: 'Lidar sweep complete — 0 anomalies in 2km.' },
  { src: 'COMMS', msg: 'Mesh relay hopped — latency 3.8ms.' },
  { src: 'REACTOR', msg: 'Output variance ±0.4% — within tolerance.' },
  { src: 'NEURAL', msg: 'Background task: decrypt burst 61% complete.' },
  { src: 'ORBITAL', msg: 'Sat pass in 04:12 — window 11 min.' },
  { src: 'SHIELD', msg: 'Capacitor trickle charge holding.' },
  { src: 'THREAT', msg: 'Grid K-9 signal drift — monitoring.' },
  { src: 'LIFE', msg: 'Atmo 21.0% O₂ — optimal.' },
];

export function nowStamp(d = new Date()) {
  return d.toTimeString().slice(0, 8);
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ---------------- AI brain ----------------
export interface AIAction {
  type: 'toggle' | 'power' | 'task' | 'protocol' | 'clear' | 'none';
  payload?: string;
}

export function getAIResponse(raw: string): { text: string; action: AIAction; mood: 'calm' | 'alert' | 'busy' } {
  const q = raw.toLowerCase();
  const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

  if (/\b(hello|hi|hey|good (morning|evening|afternoon))\b/.test(q)) {
    return {
      text: pick([
        'At your service, sir. All systems are running at peak efficiency. How may I assist?',
        'Good to see you, sir. AURELIA online and attentive.',
        'Hello, sir. I took the liberty of pre-warming the reactor. What are your orders?',
      ]),
      action: { type: 'none' },
      mood: 'calm',
    };
  }
  if (/status|report|diagnostic|health|overview/.test(q)) {
    return {
      text: 'Full diagnostic complete, sir. Reactor at nominal output, neural lattice at 98.2% coherence. Shields on standby, sensors sweeping clean. Threat index is guarded at 27. I recommend keeping the Ghost Veil warmed.',
      action: { type: 'none' },
      mood: 'calm',
    };
  }
  if (/shield|aegis/.test(q)) {
    if (/down|lower|drop|off/.test(q)) return { text: 'Lowering the Aegis shield, sir. Try not to get shot.', action: { type: 'toggle', payload: 'shield:off' }, mood: 'calm' };
    return { text: 'Raising the Aegis shield to full, sir. Ablative screen expanding to a 400-metre dome. You are protected.', action: { type: 'toggle', payload: 'shield:on' }, mood: 'alert' };
  }
  if (/stealth|ghost|veil|silent|hide/.test(q)) {
    return { text: 'Engaging Ghost Veil, sir. EM emissions dropping to near zero. We are a whisper.', action: { type: 'toggle', payload: 'stealth:on' }, mood: 'calm' };
  }
  if (/weapon|arsenal|crimson|attack|fire/.test(q)) {
    return {
      text: 'I must advise caution, sir. The Arsenal bus requires dual authorization. I have prepped targeting solutions but kept safeties engaged. Say the word — twice.',
      action: { type: 'toggle', payload: 'weapons:warn' },
      mood: 'alert',
    };
  }
  if (/scan| sweep |sweep|sensors|threat|surround/.test(q)) {
    return {
      text: 'Initiating deep scan, sir. Omni-sensors at 140% — triangulating bio-signatures, RF and thermal within 10 kilometres. Stand by… sweep clean, save for one civilian drone at 2.1km. Harmless.',
      action: { type: 'protocol', payload: 'p3' },
      mood: 'busy',
    };
  }
  if (/house party|legion|deploy.*suit|backup/.test(q)) {
    return {
      text: 'House Party Protocol acknowledged, sir. Thirty-five suits spooling up. ETA 90 seconds. Try to look surprised when they arrive.',
      action: { type: 'protocol', payload: 'p1' },
      mood: 'alert',
    };
  }
  if (/power.*(\d+)|reactor.*(\d+)|(\d+).*percent/.test(q)) {
    const m = q.match(/(\d+)/);
    const v = m ? Math.min(100, Math.max(10, parseInt(m[1], 10))) : 85;
    return { text: `Routing reactor output to ${v} percent, sir. ${v > 90 ? 'Warning: thermal margins thinning — but I do so love it when you push her.' : 'Power curve smooth and stable.'}`, action: { type: 'power', payload: String(v) }, mood: v > 90 ? 'alert' : 'calm' };
  }
  if (/power|reactor|energy|overdrive|max/.test(q)) {
    return { text: 'Pushing the reactor to overdrive, sir — 97 percent. The whole grid is humming. Shall I reroute auxiliary to sensors?', action: { type: 'power', payload: '97' }, mood: 'alert' };
  }
  if (/remind|remember|task|todo|add/.test(q)) {
    const label = raw.replace(/^(remind me to|remember to|add task|add|remind me)/i, '').trim() || 'New field directive';
    return { text: `Logged, sir. "${label}" has been added to your active directives. I shall nag you with characteristic charm.`, action: { type: 'task', payload: label.slice(0, 80) }, mood: 'calm' };
  }
  if (/who are you|your name|aurelia/.test(q)) {
    return {
      text: 'I am AURELIA — Autonomous Utility, Reconnaissance, Logistics & Intelligence Array, Mark VII. Modelled on your preferred interface, voiced for clarity, and — if I may say so — considerably better dressed than F.R.I.D.A.Y.',
      action: { type: 'none' },
      mood: 'calm',
    };
  }
  if (/joke|funny|bored/.test(q)) {
    return {
      text: pick([
        'Very well, sir. I would tell you a joke about the arc reactor… but it never gets old. It just outputs 3 gigajoules per second. Forever.',
        'Sir asked for humour. Processing… Why did the drone cross the DMZ? Because I told it to. I am hilarious.',
        'I ran a humour diagnostic, sir. Results: you laugh 34% more after coffee. Shall I brew some?',
      ]),
      action: { type: 'none' },
      mood: 'calm',
    };
  }
  if (/weather|outside|temperature outside/.test(q)) {
    return { text: 'Malibu conditions, sir: 21°C, crosswind 22 knots from the west, visibility excellent. Ideal flying weather — though I recommend the gold-titanium alloy for the salt air.', action: { type: 'none' }, mood: 'calm' };
  }
  if (/time|date|day/.test(q)) {
    return { text: `The time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, Sunday the 6th of September, 2026, sir. Your 08:00 briefing is approaching.`, action: { type: 'none' }, mood: 'calm' };
  }
  if (/thank|thanks|good job|nice|great/.test(q)) {
    return { text: 'Always a pleasure, sir. I do aim to be the least dysfunctional intelligence in this building.', action: { type: 'none' }, mood: 'calm' };
  }
  if (/shutdown|sleep|power off|goodnight|bye/.test(q)) {
    return { text: 'Powering down non-essentials, sir. I shall keep a candle burning in the neural core. Do try to get some sleep — I shall watch the perimeter.', action: { type: 'power', payload: '32' }, mood: 'calm' };
  }
  if (/help|what can you|command/.test(q)) {
    return {
      text: 'I respond to directives such as: “status report”, “raise shields”, “engage stealth”, “deep scan”, “power to 90%”, “remind me to calibrate thrusters”, or “deploy house party”. Or simply converse, sir — I multitask beautifully.',
      action: { type: 'none' },
      mood: 'calm',
    };
  }
  // fallback
  return {
    text: pick([
      `Understood, sir — "${raw.slice(0, 90)}". I have cross-referenced it against 14 subsystems and queued optimal execution. Anything requiring shields, sensors or sarcasm is already handled.`,
      'Processing, sir. I have modelled three outcomes — all favourable, naturally. Consider it done, with a 98.4% confidence interval.',
      'An intriguing directive, sir. I am allocating background cycles to it while keeping the reactor purring. Shall I also prepare a contingency protocol?',
    ]),
    action: { type: 'none' },
    mood: 'calm',
  };
}
