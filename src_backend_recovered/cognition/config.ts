import type { PermissionName } from "./types";

export interface CognitionConfig {
  enabled: boolean;
  initiativeEnabled: boolean;
  proactiveSpeechEnabled: boolean;
  skillLearningEnabled: boolean;
  reflectionEnabled: boolean;
  screenAwarenessEnabled: boolean;
  desktopAwarenessEnabled: boolean;
  autonomyPaused: boolean;
  debug: boolean;
  attention: {
    rememberThreshold: number;
    mentionThreshold: number;
    speakThreshold: number;
    interruptThreshold: number;
    repetitionCooldownMs: number;
  };
  limits: {
    maxPlanDepth: number;
    maxRetries: number;
    maxToolCallsPerTask: number;
    taskTimeoutMs: number;
    maxRecentEvents: number;
  };
  permissions: Record<PermissionName, boolean>;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function number(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function loadCognitionConfig(env: NodeJS.ProcessEnv = process.env): CognitionConfig {
  const permission = (name: string, fallback = true) =>
    bool(env[`MYRAA_PERMISSION_${name.toUpperCase()}`], fallback);

  return {
    enabled: bool(env.MYRAA_ENABLE_COGNITION, true),
    initiativeEnabled: bool(env.MYRAA_ENABLE_INITIATIVE, true),
    proactiveSpeechEnabled: bool(env.MYRAA_ENABLE_PROACTIVE_SPEECH, true),
    skillLearningEnabled: bool(env.MYRAA_ENABLE_SKILL_LEARNING, true),
    reflectionEnabled: bool(env.MYRAA_ENABLE_REFLECTION, true),
    screenAwarenessEnabled: bool(env.MYRAA_ENABLE_SCREEN_AWARENESS, false),
    desktopAwarenessEnabled: bool(env.MYRAA_ENABLE_DESKTOP_AWARENESS, true),
    autonomyPaused: bool(env.PAUSE_AUTONOMY, false),
    debug: bool(env.MYRAA_COGNITION_DEBUG, false),
    attention: {
      rememberThreshold: number(env.MYRAA_ATTENTION_REMEMBER, 0.24, 0, 1),
      mentionThreshold: number(env.MYRAA_ATTENTION_MENTION, 0.48, 0, 1),
      speakThreshold: number(env.MYRAA_ATTENTION_SPEAK, 0.68, 0, 1),
      interruptThreshold: number(env.MYRAA_ATTENTION_INTERRUPT, 0.86, 0, 1),
      repetitionCooldownMs: number(env.MYRAA_REPETITION_COOLDOWN_MS, 180_000, 1_000, 86_400_000),
    },
    limits: {
      maxPlanDepth: number(env.MYRAA_MAX_PLAN_DEPTH, 8, 1, 50),
      maxRetries: number(env.MYRAA_MAX_RETRIES, 2, 0, 10),
      maxToolCallsPerTask: number(env.MYRAA_MAX_TOOL_CALLS, 24, 1, 500),
      taskTimeoutMs: number(env.MYRAA_TASK_TIMEOUT_MS, 300_000, 1_000, 3_600_000),
      maxRecentEvents: number(env.MYRAA_MAX_RECENT_EVENTS, 40, 5, 500),
    },
    permissions: {
      microphone: permission("microphone"),
      screen_awareness: permission("screen_awareness"),
      filesystem_read: permission("filesystem_read"),
      filesystem_write: permission("filesystem_write"),
      desktop_control: permission("desktop_control"),
      browser: permission("browser"),
      network: permission("network"),
      automation: permission("automation"),
      code_execution: permission("code_execution"),
      system_control: permission("system_control"),
    },
  };
}
