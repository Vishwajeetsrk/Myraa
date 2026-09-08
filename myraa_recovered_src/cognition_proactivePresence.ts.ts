export type ProactivePresenceMode = "active_task" | "idle_away";

export interface PresenceSignals {
  userIdleSeconds: number;
  lastMeaningfulScreenChangeAt: number;
  now?: number;
}

/**
 * A moving shared screen counts as active even when Windows input is quiet
 * (for example while watching a build, render, download, or video).
 */
export function classifyProactivePresence(signals: PresenceSignals): ProactivePresenceMode {
  const now = signals.now ?? Date.now();
  const recentVisualMotion = signals.lastMeaningfulScreenChangeAt > 0
    && now - signals.lastMeaningfulScreenChangeAt <= 15_000;
  return signals.userIdleSeconds >= 10 && !recentVisualMotion ? "idle_away" : "active_task";
}

/**
 * Speak quickly once, then back off if the user remains silent. This preserves
 * the requested 10–15 second presence without repeating a line every 12s.
 */
export function nextPresenceDelayMs(turnsWithoutUser: number, random = Math.random): number {
  const range = turnsWithoutUser <= 0
    ? [10_000, 15_000]
    : turnsWithoutUser === 1
      ? [18_000, 28_000]
      : turnsWithoutUser === 2
        ? [35_000, 55_000]
        : [90_000, 150_000];
  const [min, max] = range;
  return min + Math.floor(Math.max(0, Math.min(1, random())) * (max - min));
}

export function shouldRepeatIdlePresence(
  lastIdlePresenceAt: number,
  now = Date.now(),
  cooldownMs = 120_000,
): boolean {
  return lastIdlePresenceAt <= 0 || now - lastIdlePresenceAt >= cooldownMs;
}
