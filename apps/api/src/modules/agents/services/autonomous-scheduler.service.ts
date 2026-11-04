import { createHash } from "node:crypto";
import type { AutonomousTaskTriggerEntity } from "../autonomous.types.js";

export class AutonomousSchedulerService {
  /**
   * Calculates the next execution timestamp for a given cron expression and timezone.
   */
  calculateNextRun(cronExpression: string, _timezone: string = "UTC", fromDate: Date = new Date()): Date {
    // Standard cron parsing or interval computation
    const cleaned = cronExpression.trim().toLowerCase();

    if (cleaned === "@hourly" || cleaned === "0 * * * *") {
      const next = new Date(fromDate.getTime());
      next.setUTCMinutes(0, 0, 0);
      next.setUTCHours(next.getUTCHours() + 1);
      return next;
    }

    if (cleaned === "@daily" || cleaned === "0 0 * * *") {
      const next = new Date(fromDate.getTime());
      next.setUTCHours(0, 0, 0, 0);
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    }

    if (cleaned.startsWith("*/")) {
      // e.g. */15 * * * * or */5 * * * *
      const parts = cleaned.split(" ");
      const intervalStr = parts[0].replace("*/", "");
      const intervalMinutes = parseInt(intervalStr, 10) || 15;
      const next = new Date(fromDate.getTime() + intervalMinutes * 60 * 1000);
      return next;
    }

    // Default interval fallback for custom expressions (adds 1 hour)
    return new Date(fromDate.getTime() + 3600 * 1000);
  }

  /**
   * Evaluates missed schedule windows between lastRunAt and now according to policy.
   */
  evaluateMissedWindows(
    trigger: AutonomousTaskTriggerEntity,
    now: Date = new Date(),
  ): { windowsToRun: Date[]; nextScheduledRun: Date | null } {
    if (!trigger.nextRunAt) {
      return { windowsToRun: [], nextScheduledRun: null };
    }

    const scheduledTime = trigger.nextRunAt.getTime();
    const currentTime = now.getTime();

    // Not yet due
    if (scheduledTime > currentTime) {
      return { windowsToRun: [], nextScheduledRun: trigger.nextRunAt };
    }

    // It is due or overdue
    const policy = trigger.missedSchedulePolicy || "run_once";

    if (trigger.scheduleType === "once") {
      return {
        windowsToRun: [trigger.nextRunAt],
        nextScheduledRun: null, // one-time does not repeat
      };
    }

    // Recurring schedule
    const cron = trigger.cronExpression || "0 0 * * *";
    const nextFutureRun = this.calculateNextRun(cron, trigger.timezone, now);

    if (policy === "skip") {
      return {
        windowsToRun: [],
        nextScheduledRun: nextFutureRun,
      };
    }

    if (policy === "run_once") {
      return {
        windowsToRun: [trigger.nextRunAt],
        nextScheduledRun: nextFutureRun,
      };
    }

    // run_all: generate up to 5 backfill windows
    const windows: Date[] = [trigger.nextRunAt];
    let cursor = this.calculateNextRun(cron, trigger.timezone, trigger.nextRunAt);
    let count = 1;
    while (cursor.getTime() <= currentTime && count < 5) {
      windows.push(cursor);
      cursor = this.calculateNextRun(cron, trigger.timezone, cursor);
      count++;
    }

    return {
      windowsToRun: windows,
      nextScheduledRun: nextFutureRun,
    };
  }

  /**
   * Checks if an application domain event matches the trigger's event pattern.
   * Supports wildcard matching e.g. "academic.lesson_plan.*" matches "academic.lesson_plan.submitted".
   */
  matchesEventPattern(pattern: string | null | undefined, eventName: string): boolean {
    if (!pattern) return false;
    if (pattern === "*" || pattern === eventName) return true;

    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return eventName.startsWith(prefix);
    }

    return false;
  }

  /**
   * Generates a deterministic idempotency key for scheduled or event triggers.
   */
  generateIdempotencyKey(
    taskDefinitionId: string,
    triggerId: string,
    targetTimestampOrEventId: string | number,
  ): string {
    const raw = `${taskDefinitionId}:${triggerId}:${targetTimestampOrEventId}`;
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
    return `idem_${hash}`;
  }
}
