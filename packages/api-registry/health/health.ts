// MYRAA — Connector health model (§28). States must match UI truth, never fake-green.
export type { ConnectorHealthState, ConnectorHealth } from '../connectors/types.js';
export const HEALTH_POLL_MS = 15 * 60 * 1000; // matches existing tauri-bridge healthInterval
export function isUsable(state: string): boolean { return state === 'connected' || state === 'healthy'; }
