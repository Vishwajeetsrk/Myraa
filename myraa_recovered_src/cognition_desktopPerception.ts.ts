import type { CognitiveEventInput } from "./types";

export interface DesktopDownloadSnapshot {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  status: "downloading" | "complete";
}

export interface DesktopSnapshot {
  timestamp: string;
  activeWindow: {
    title: string | null;
    application: string | null;
    pid: number | null;
  };
  applications: string[];
  disk: {
    path: string;
    freeBytes: number;
    totalBytes: number;
    percentUsed: number;
  } | null;
  downloads: DesktopDownloadSnapshot[];
  userIdleSeconds: number;
}

export interface DesktopPerceptionOptions {
  fetchSnapshot: (signal: AbortSignal) => Promise<DesktopSnapshot>;
  emit: (event: CognitiveEventInput) => void | Promise<void>;
  pollIntervalMs?: number;
}

export class DesktopPerception {
  private timer: NodeJS.Timeout | null = null;
  private previous: DesktopSnapshot | null = null;
  private polling = false;
  private consecutiveFailures = 0;
  private availabilityReported = true;
  private activityState: "active" | "idle" | "away" = "active";
  private diskWasCritical = false;

  constructor(private readonly options: DesktopPerceptionOptions) {}

  start(): void {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.options.pollIntervalMs || 2_500);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);
    try {
      const snapshot = await this.options.fetchSnapshot(controller.signal);
      this.consecutiveFailures = 0;
      if (!this.availabilityReported) {
        this.availabilityReported = true;
        await this.options.emit({
          type: "system.perception_restored",
          source: "system",
          importance: 0.45,
        });
      }
      if (this.previous) await this.diff(this.previous, snapshot);
      this.previous = snapshot;
      await this.updateActivity(snapshot.userIdleSeconds);
      await this.checkDisk(snapshot);
    } catch {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= 3 && this.availabilityReported) {
        this.availabilityReported = false;
        await this.options.emit({
          type: "system.perception_unavailable",
          source: "system",
          importance: 0.22,
          metadata: { reason: "desktop agent observation endpoint unavailable" },
        });
      }
    } finally {
      clearTimeout(timeout);
      this.polling = false;
    }
  }

  private async diff(previous: DesktopSnapshot, current: DesktopSnapshot): Promise<void> {
    const previousWindow = `${previous.activeWindow.application || ""}|${previous.activeWindow.title || ""}`;
    const currentWindow = `${current.activeWindow.application || ""}|${current.activeWindow.title || ""}`;
    if (previousWindow !== currentWindow) {
      await this.options.emit({
        type: "desktop.active_window_changed",
        source: "desktop",
        importance: 0.12,
        confidence: 0.95,
        dedupeKey: `active-window:${current.activeWindow.application || "unknown"}`,
        metadata: {
          application: current.activeWindow.application,
          title: current.activeWindow.title,
          activeApp: current.activeWindow.application,
          activeWindow: current.activeWindow.title,
        },
      });
    }

    const beforeApps = new Set(previous.applications);
    const afterApps = new Set(current.applications);
    for (const application of afterApps) {
      if (!beforeApps.has(application)) {
        await this.options.emit({
          type: "desktop.application_opened",
          source: "desktop",
          importance: 0.28,
          metadata: { application },
        });
      }
    }
    for (const application of beforeApps) {
      if (!afterApps.has(application)) {
        await this.options.emit({
          type: "desktop.application_closed",
          source: "desktop",
          importance: 0.24,
          metadata: { application },
        });
      }
    }

    const beforeDownloads = new Map(previous.downloads.map((item) => [downloadKey(item.name), item]));
    const afterDownloads = new Map(current.downloads.map((item) => [downloadKey(item.name), item]));
    for (const [key, item] of afterDownloads) {
      const before = beforeDownloads.get(key);
      if (!before && item.status === "downloading") {
        await this.options.emit({
          type: "desktop.download_started",
          source: "desktop",
          importance: 0.38,
          dedupeKey: `download:${key}`,
          metadata: { path: item.path, name: item.name },
        });
      } else if (item.status === "complete" && (!before || before.status === "downloading")) {
        await this.options.emit({
          type: "desktop.download_completed",
          source: "desktop",
          importance: 0.68,
          dedupeKey: `download:${key}`,
          metadata: {
            path: item.path,
            name: item.name,
            size: item.size,
            relevance: 0.66,
            userImpact: 0.64,
          },
        });
      }
    }
  }

  private async updateActivity(idleSeconds: number): Promise<void> {
    const next = idleSeconds >= 120 ? "away" : idleSeconds >= 10 ? "idle" : "active";
    if (next === this.activityState) return;
    this.activityState = next;
    await this.options.emit({
      type: `system.user_${next}`,
      source: "system",
      importance: 0.18,
      metadata: { idleSeconds },
    });
  }

  private async checkDisk(snapshot: DesktopSnapshot): Promise<void> {
    if (!snapshot.disk) return;
    const freePercent = 100 - snapshot.disk.percentUsed;
    const critical = snapshot.disk.freeBytes < 5 * 1024 ** 3 || freePercent < 5;
    if (critical && !this.diskWasCritical) {
      this.diskWasCritical = true;
      await this.options.emit({
        type: "system.disk_space_critical",
        source: "system",
        importance: 0.94,
        dedupeKey: `disk-critical:${snapshot.disk.path}`,
        metadata: {
          path: snapshot.disk.path,
          freeBytes: snapshot.disk.freeBytes,
          percentUsed: snapshot.disk.percentUsed,
          risk: 0.92,
          urgency: 0.9,
          userImpact: 0.94,
        },
      });
    } else if (!critical && this.diskWasCritical) {
      this.diskWasCritical = false;
      await this.options.emit({
        type: "system.disk_space_recovered",
        source: "system",
        importance: 0.55,
        metadata: { path: snapshot.disk.path, freeBytes: snapshot.disk.freeBytes },
      });
    }
  }
}

function downloadKey(name: string): string {
  return name.toLowerCase().replace(/\.(crdownload|part|partial|tmp)$/i, "");
}
