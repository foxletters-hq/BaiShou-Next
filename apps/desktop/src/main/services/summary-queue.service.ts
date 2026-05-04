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
  private isProcessing = false;
  
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

  getQueueState() {
    return this.queue;
  }

  enqueue(items: MissingSummary[]) {
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
      this.broadcastState();
      this.processQueue();
    }
  }

  private broadcastState() {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('summary:queue-progress', this.queue);
    });
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        const nextIdx = this.queue.findIndex(q => q.status === 'pending');
        if (nextIdx === -1) break;

        const currentTask = this.queue[nextIdx];
        currentTask.status = 'running';
        currentTask.progress = 5;
        this.broadcastState();

        try {
          // 1. Resolve Dynamic Generator
          const generator = await this.generatorFactory();
          const stream = generator.generate(currentTask.target);

          let finalContent = '';
          
          for await (const chunk of stream) {
            if (chunk.includes('STATUS:reading_data')) {
               currentTask.phaseIdx = 1;
               currentTask.progress = 25;
            } else if (chunk.includes('STATUS:thinking_via_')) {
               currentTask.phaseIdx = 2;
               currentTask.progress = 50;
            } else if (chunk.includes('STATUS:generation_failed_error')) {
               const cleanMsg = chunk.replace('STATUS:generation_failed_error:', '').trim();
               throw new Error(cleanMsg);
            } else if (!chunk.startsWith('STATUS:')) {
               currentTask.phaseIdx = 3;
               currentTask.progress = 85;
               finalContent += chunk;
            }
            this.broadcastState();
          }

          if (finalContent.trim().length > 0) {
             currentTask.progress = 95;
             this.broadcastState();
             
             // Save it via standard manager
             await this.summaryManager.save({
                type: currentTask.target.type,
                startDate: currentTask.target.startDate,
                endDate: currentTask.target.endDate,
                content: finalContent
             });

             currentTask.status = 'completed';
             currentTask.progress = 100;
             currentTask.phaseIdx = 4;
             this.broadcastState();
          } else {
             throw new Error('Generated content was empty.');
          }
        } catch (e: any) {
          console.error('[SummaryQueueService] Task Failed:', e);
          currentTask.status = 'error';
          currentTask.error = e.message || String(e);
          this.broadcastState();
        }
      }
    } finally {
      this.isProcessing = false;
      
      // Clear out completed items after 3 seconds so UI can naturally dismiss them
      setTimeout(() => {
         const hasCompleted = this.queue.some(q => q.status === 'completed' || q.status === 'error');
         if (hasCompleted) {
             this.queue = this.queue.filter(q => q.status === 'pending' || q.status === 'running');
             this.broadcastState();
         }
      }, 3000);
    }
  }
}
