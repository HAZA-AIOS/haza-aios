import { createServer } from "node:http";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { createLogger, type Logger } from "./common/logging/logger.js";
import { loadConfig, type ApiConfig } from "./config/env.js";
import { createDatabaseClient, type DatabaseClient } from "./database/client.js";
import { AgentRuntimeService } from "./modules/agents/services/agent-runtime.service.js";

export interface WorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  maxConcurrency?: number;
  heartbeatIntervalMs?: number;
  leaseDurationSeconds?: number;
}

export class AgentExecutionWorker {
  readonly workerId: string;
  private readonly config: ApiConfig;
  private readonly logger: Logger;
  private readonly database: DatabaseClient;
  private readonly runtimeService: AgentRuntimeService;

  private readonly pollIntervalMs: number;
  private readonly maxConcurrency: number;
  private readonly heartbeatIntervalMs: number;
  private readonly leaseDurationSeconds: number;

  private isRunning = false;
  private isStopping = false;
  private activeJobsCount = 0;
  private pollTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private processedRunsTotal = 0;
  private failedRunsTotal = 0;
  private readonly startedAt = new Date();

  constructor(
    config: ApiConfig = loadConfig(),
    logger: Logger = createLogger(config),
    database: DatabaseClient = createDatabaseClient(config.database, logger, { appEnv: config.appEnv }),
    options: WorkerOptions = {},
  ) {
    this.config = config;
    this.logger = logger;
    this.database = database;
    this.runtimeService = new AgentRuntimeService(database);

    const suffix = randomUUID().slice(0, 8);
    this.workerId = options.workerId ?? `worker-${os.hostname().slice(0, 16)}-${process.pid}-${suffix}`;
    this.pollIntervalMs = options.pollIntervalMs ?? Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000);
    this.maxConcurrency = options.maxConcurrency ?? Number(process.env.WORKER_MAX_CONCURRENCY ?? 3);
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000;
    this.leaseDurationSeconds = options.leaseDurationSeconds ?? 300;
  }

  getHealthMetrics() {
    return {
      workerId: this.workerId,
      status: this.isStopping ? "stopping" : this.isRunning ? "running" : "idle",
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      activeJobs: this.activeJobsCount,
      maxConcurrency: this.maxConcurrency,
      processedRunsTotal: this.processedRunsTotal,
      failedRunsTotal: this.failedRunsTotal,
      startedAt: this.startedAt.toISOString(),
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isStopping = false;

    this.logger.info("agent_worker_started", {
      workerId: this.workerId,
      pollIntervalMs: this.pollIntervalMs,
      maxConcurrency: this.maxConcurrency,
      leaseDurationSeconds: this.leaseDurationSeconds,
      environment: this.config.appEnv,
    });

    // Start periodic heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.logger.info("agent_worker_heartbeat", this.getHealthMetrics());
    }, this.heartbeatIntervalMs);

    // Initial poll
    this.scheduleNextPoll(100);
  }

  private scheduleNextPoll(delayMs: number): void {
    if (this.isStopping || !this.isRunning) return;
    if (this.pollTimeout) clearTimeout(this.pollTimeout);

    this.pollTimeout = setTimeout(async () => {
      await this.poll();
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (this.isStopping || !this.isRunning) return;

    if (this.activeJobsCount >= this.maxConcurrency) {
      // Saturated: wait for in-flight tasks to complete
      this.scheduleNextPoll(this.pollIntervalMs);
      return;
    }

    try {
      this.activeJobsCount++;
      const outcome = await this.runtimeService.claimAndExecute(this.workerId);

      if (outcome.executed && outcome.run) {
        this.processedRunsTotal++;
        if (outcome.run.status === "failed") {
          this.failedRunsTotal++;
        }

        this.logger.info("agent_worker_job_executed", {
          workerId: this.workerId,
          runId: outcome.run.id,
          agentId: outcome.run.agentId,
          status: outcome.run.status,
          attemptNumber: outcome.attempt?.attemptNumber,
        });

        // More work might be waiting, poll immediately
        this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
        this.scheduleNextPoll(50);
        return;
      }

      // No job claimed, back off to standard interval
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
      this.scheduleNextPoll(this.pollIntervalMs);
    } catch (error: any) {
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
      this.logger.error("agent_worker_poll_error", {
        workerId: this.workerId,
        message: error?.message ?? String(error),
      });
      this.scheduleNextPoll(this.pollIntervalMs * 2);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning || this.isStopping) return;
    this.isStopping = true;

    this.logger.info("agent_worker_shutdown_initiated", {
      workerId: this.workerId,
      activeJobs: this.activeJobsCount,
    });

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Wait bounded time for active jobs to finish
    const maxWaitMs = 15000;
    const pollInterval = 250;
    let waitedMs = 0;

    while (this.activeJobsCount > 0 && waitedMs < maxWaitMs) {
      await new Promise((r) => setTimeout(r, pollInterval));
      waitedMs += pollInterval;
    }

    this.isRunning = false;
    await this.database.close();

    this.logger.info("agent_worker_shutdown_complete", {
      workerId: this.workerId,
      activeJobsRemaining: this.activeJobsCount,
      processedRunsTotal: this.processedRunsTotal,
    });
  }
}

// Standalone execution entrypoint
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js")) {
  const config = loadConfig();
  const logger = createLogger(config);
  const database = createDatabaseClient(config.database, logger, { appEnv: config.appEnv });
  const worker = new AgentExecutionWorker(config, logger, database);

  // Optional HTTP health server for Railway healthcheck verification
  const port = Number(process.env.PORT || process.env.WORKER_PORT || 0);
  let healthServer: ReturnType<typeof createServer> | null = null;

  if (port > 0) {
    healthServer = createServer((req, res) => {
      if (req.url === "/health" || req.url === "/" || req.url === "/metrics") {
        const metrics = worker.getHealthMetrics();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(metrics, null, 2));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      }
    });

    healthServer.listen(port, "0.0.0.0", () => {
      logger.info("agent_worker_health_server_listening", { port });
    });
  }

  worker.start().catch((err) => {
    logger.error("agent_worker_fatal_startup_error", { error: err?.message ?? String(err) });
    process.exit(1);
  });

  const handleSignal = async (signal: NodeJS.Signals) => {
    logger.info("agent_worker_received_signal", { signal });
    if (healthServer) {
      healthServer.close();
    }
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => handleSignal("SIGINT"));
  process.on("SIGTERM", () => handleSignal("SIGTERM"));
}
