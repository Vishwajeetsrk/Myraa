// MYRAA — Connector policies: permission, risk, approval, audit, rate-limit, cache.
// Mirrors existing Tauri permission_check + CONFIRM_REQUIRED semantics.

import type { RiskLevel } from '../tools/registry.js';

export interface PolicyDecision { allowed: boolean; needsConfirm: boolean; reason: string }

export function approvalFor(risk: RiskLevel, contextConfirmed?: boolean): PolicyDecision {
  switch (risk) {
    case 'READ_ONLY': return { allowed: true, needsConfirm: false, reason: 'read → automatic' };
    case 'SAFE_WRITE': return { allowed: true, needsConfirm: !contextConfirmed, reason: 'write → confirmation' };
    case 'DESTRUCTIVE': return { allowed: true, needsConfirm: true, reason: 'destructive → explicit confirmation' };
    case 'CRITICAL_SYSTEM': return { allowed: !!contextConfirmed, needsConfirm: true, reason: 'critical → elevated confirmation + audit' };
  }
}

export const FORBIDDEN = [
  'DROP', 'DELETE FROM (production)', 'TRUNCATE', 'ALTER (production)',
  'rmdir /s /q c:\\', 'del /f /s /q c:\\',
];

export interface RateLimit { maxPerMin: number; backoffMs: number; maxRetries: number }
export const DEFAULT_RATE_LIMIT: RateLimit = { maxPerMin: 30, backoffMs: 2000, maxRetries: 2 };

// Cache only read-only, never secrets. Honor provider freshness.
export const CACHEABLE_TOOLS = new Set([
  'myraa.weather.get', 'myraa.currency.convert', 'myraa.news.search',
  'myraa.knowledge.book_lookup', 'myraa.calendar.get_holidays',
]);
