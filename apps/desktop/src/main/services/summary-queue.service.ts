import { BrowserWindow } from 'electron';
import { MissingSummary } from '@baishou/shared';
import { SummaryGeneratorService, SummaryManagerService } from '@baishou/core';

export interface QueueItem {
  id: string; // Type_Time format e.g. "weekly_16200000"
  target: MissingSummary;
  progress: number;
  phaseIdx: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

export class SummaryQueueService {
  private static instance: SummaryQueueService;
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private concurrencyLimit = 1;
  private abortController: AbortController | null = null;

  // Dependencies injected later after everything boot up
  private summaryManager!: SummaryManagerService;
  private generatorFactory!: () => Promise<SummaryGeneratorService>;

  private constructor() {}

  static getInstance(): SummaryQueueService {
    if (!SummaryQueueService.instance) {
      SummaryQueueService.instance = new SummaryQueueService();
    }
    return SummaryQueueService.instance;
  }

  setDependencies(summaryManager: SummaryManagerService, generatorFactory: () => Promise<SummaryGeneratorService>) {
    this.summaryManager = summaryManager;
    this.generatorFactory = generatorFactory;
  }

  setConcurrencyLimit(limit: number) {
    this.concurrencyLimit = Math.max(1, Math.min(5, limit));
    // 并发数提升后，立即尝试调度更多任务
    this.scheduleNext();
  }

  getQueueState() {
    return this.queue;
  }

  /**
   * 停止所有正在处理和等待中的任务。
   * 已完成的不会被影响。
   */
  stop() {
    this.abortController?.abort();
    this.abortController = null;

    for (const item of this.queue) {
      if (item.status === 'running' || item.status === 'pending') {
        item.status = 'error';
        item.error = '用户取消了生成';
      }
    }

    this.queue = this.queue.filter(q => q.status !== 'error');
    this.activeCount = 0;
    this.broadcastState();
  }

  get isRunning(): boolean {
    return this.activeCount > 0;
  }

  enqueue(items: MissingSummary[], concurrency?: number) {
    if (concurrency !== undefined) {
      this.concurrencyLimit = Math.max(1, Math.min(5, concurrency));
    }

    let added = 0;
    for (const item of items) {
      const uKey = `${item.type}_${new Date(item.startDate).getTime()}`;
      if (!this.queue.find(q => q.id === uKey)) {
        this.queue.push({
          id: uKey,
          target: item,
          progress: 0,
          phaseIdx: 0,
          status: 'pending'
        });
        added++;
      }
    }
    
    if (added > 0) {
      if (!this.abortController) {
        this.abortController = new AbortController();
      }
      this.broadcastState();
      this.scheduleNext();
    }
  }

  private broadcastState() {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('summary:queue-progress', this.queue);
    });
  }

  /** 尝试启动下一个待处理任务，受并发数限制 */
  private scheduleNext() {
    while (this.activeCount < this.concurrencyLimit) {
      const next = this.queue.find(q => q.status === 'pending');
      if (!next) break;

      next.status = 'running';
      next.progress = 5;
      this.activeCount++;
      this.broadcastState();
      this.processTask(next);
    }
  }

  /** 处理单个任务（与其他任务并发运行） */
  private async processTask(task: QueueItem) {
    const signal = this.abortController?.signal;

    try {
      const generator = await this.generatorFactory();
      const stream = generator.generate(task.target);

      let finalContent = '';

      for await (const chunk of stream) {
        if (signal?.aborted) {
          task.status = 'error';
          task.error = '用户取消了生成';
          this.broadcastState();
          break;
        }
        if (chunk.includes('STATUS:reading_data')) {
          task.phaseIdx = 1;
          task.progress = 25;
        } else if (chunk.includes('STATUS:thinking_via_')) {
          task.phaseIdx = 2;
          task.progress = 50;
        } else if (chunk.includes('STATUS:generation_failed_error')) {
          const cleanMsg = chunk.replace('STATUS:generation_failed_error:', '').trim();
          throw new Error(cleanMsg);
        } else if (!chunk.startsWith('STATUS:')) {
          task.phaseIdx = 3;
          task.progress = 85;
          finalContent += chunk;
        }
        this.broadcastState();
      }

      if (task.status === 'error') return;

      if (finalContent.trim().length > 0) {
        task.progress = 95;
        this.broadcastState();

        await this.summaryManager.save({
          type: task.target.type,
          startDate: task.target.startDate,
          endDate: task.target.endDate,
          content: finalContent
        });

        task.status = 'completed';
        task.progress = 100;
        task.phaseIdx = 4;
        this.broadcastState();
      } else {
        throw new Error('Generated content was empty.');
      }
    } catch (e: any) {
      console.error('[SummaryQueueService] Task Failed:', e);
      task.status = 'error';
      task.error = e.message || String(e);
      this.broadcastState();
    } finally {
      this.activeCount--;

      if (!signal?.aborted) {
        this.scheduleNext();
      }

      if (this.activeCount === 0) {
        this.abortController = null;

        setTimeout(() => {
          const hasFinished = this.queue.some(q => q.status === 'completed' || q.status === 'error');
          if (hasFinished) {
            this.queue = this.queue.filter(q => q.status === 'pending' || q.status === 'running');
            this.broadcastState();
          }
        }, 3000);
      }
    }
  }
}
