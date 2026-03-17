/** @fileoverview Worker pool with idle timeout - auto-cleanup after inactivity */
import type { ChartDataPoint } from "@0xsignal/shared";
import type {
  ICTWorkerRequest,
  ICTWorkerResponse,
  ICTAnalysisResult,
  ICTConfig,
} from "../ict/workers/ict-worker";
import type {
  WyckoffWorkerRequest,
  WyckoffWorkerResponse,
  WyckoffAnalysisResult,
  WyckoffConfig,
} from "../wyckoff/workers/wyckoff-worker";

type WorkerType = "ict" | "wyckoff";
type WorkerRequest = ICTWorkerRequest | WyckoffWorkerRequest;
type WorkerResponse = ICTWorkerResponse | WyckoffWorkerResponse;

interface QueuedTask<T> {
  id: string;
  type: WorkerType;
  request: WorkerRequest;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timestamp: number;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

class AnalysisWorkerPool {
  private workers: Map<WorkerType, Worker | null> = new Map();
  private taskQueue: QueuedTask<unknown>[] = [];
  private pendingTasks: Map<string, QueuedTask<unknown>> = new Map();
  private isProcessing = false;
  private readonly maxConcurrent = 2;
  private requestCounter = 0;
  private lastActivity = Date.now();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private getWorkerPath(type: WorkerType): URL {
    const path =
      type === "ict" ? "../ict/workers/ict-worker.ts" : "../wyckoff/workers/wyckoff-worker.ts";
    return new URL(path, import.meta.url);
  }

  private resetIdleTimer(): void {
    this.lastActivity = Date.now();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.checkIdle(), IDLE_TIMEOUT_MS);
  }

  private checkIdle(): void {
    const idleTime = Date.now() - this.lastActivity;
    if (
      idleTime >= IDLE_TIMEOUT_MS &&
      this.pendingTasks.size === 0 &&
      this.taskQueue.length === 0
    ) {
      this.terminate();
    }
  }

  private ensureWorker(type: WorkerType): Worker {
    let worker = this.workers.get(type);
    if (!worker) {
      worker = new Worker(this.getWorkerPath(type), { type: "module" });
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.handleMessage(e);
      worker.onerror = (err) => this.handleError(err, type);
      this.workers.set(type, worker);
    }
    this.resetIdleTimer();
    return worker;
  }

  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, result, error } = event.data;
    const task = this.pendingTasks.get(id);
    if (!task) return;

    this.pendingTasks.delete(id);
    this.resetIdleTimer();

    if (error) {
      task.reject(new Error(error));
    } else {
      task.resolve(result);
    }

    this.processQueue();
  }

  private handleError(error: ErrorEvent, type: WorkerType): void {
    console.error(`Worker ${type} error:`, error);
    this.workers.set(type, null);
  }

  private processQueue(): void {
    if (this.isProcessing || this.taskQueue.length === 0) return;
    if (this.pendingTasks.size >= this.maxConcurrent) return;

    this.isProcessing = true;

    while (this.taskQueue.length > 0 && this.pendingTasks.size < this.maxConcurrent) {
      const task = this.taskQueue.shift();
      if (!task) continue;

      const worker = this.ensureWorker(task.type);
      this.pendingTasks.set(task.id, task);
      worker.postMessage(task.request);
    }

    this.isProcessing = false;
  }

  private generateId(type: WorkerType): string {
    this.requestCounter += 1;
    return `${type}-${Date.now()}-${this.requestCounter}`;
  }

  executeICT<T = ICTAnalysisResult>(
    candles: ChartDataPoint[],
    config?: Partial<ICTConfig>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateId("ict");
      const request: ICTWorkerRequest = {
        id,
        type: "ANALYZE_ICT",
        data: { candles, config },
      };

      const task: QueuedTask<T> = {
        id,
        type: "ict",
        request,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.taskQueue.push(task as QueuedTask<unknown>);
      this.processQueue();
    });
  }

  executeWyckoff<T = WyckoffAnalysisResult>(
    candles: ChartDataPoint[],
    config?: Partial<WyckoffConfig>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateId("wyckoff");
      const request: WyckoffWorkerRequest = {
        id,
        type: "ANALYZE_WYCKOFF",
        data: { candles, config },
      };

      const task: QueuedTask<T> = {
        id,
        type: "wyckoff",
        request,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.taskQueue.push(task as QueuedTask<unknown>);
      this.processQueue();
    });
  }

  terminate(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.workers.forEach((worker) => worker?.terminate());
    this.workers.clear();
    this.pendingTasks.clear();
    this.taskQueue = [];
  }
}

export const workerPool = new AnalysisWorkerPool();
