export enum RagProgressType {
  None = 'none',
  BatchEmbed = 'batchEmbed',
  Migration = 'migration'
}

export interface RagProgressState {
  type: RagProgressType;
  isRunning: boolean;
  progress: number;
  total: number;
  statusText: string;
}

/**
 * 缺省状态集
 */
export const initialRagProgressState: RagProgressState = {
  type: RagProgressType.None,
  isRunning: false,
  progress: 0,
  total: 0,
  statusText: ''
};

/**
 * 封装前端 UI 刷新所需的进度聚合方法，与 Jotai 等前端库适配对接。
 */
export class RagProgressNotifierModel {
  private lastUpdateTime: number | null = null;
  public state: RagProgressState = { ...initialRagProgressState };

  constructor(private emitChange?: (state: RagProgressState) => void) {}

  public startBatch(total: number) {
    this.lastUpdateTime = Date.now();
    this.updateState({
      type: RagProgressType.BatchEmbed,
      isRunning: true,
      progress: 0,
      total,
    });
  }

  public updateBatch(progress: number) {
    if (this.state.type === RagProgressType.BatchEmbed) {
      const now = Date.now();
      // 限流策略：50ms 或者满流才触发界面绘制更新
      if (
        this.lastUpdateTime === null ||
        now - this.lastUpdateTime > 50 ||
        progress === this.state.total
      ) {
        this.lastUpdateTime = now;
        this.updateState({ progress });
      }
    }
  }

  public startMigration() {
    this.lastUpdateTime = Date.now();
    this.updateState({
      type: RagProgressType.Migration,
      isRunning: true,
      progress: 0,
      total: 0,
      statusText: '',
    });
  }

  public updateMigration(progress: number, total: number, statusText: string) {
    if (this.state.type === RagProgressType.Migration) {
      const now = Date.now();
      if (
        this.lastUpdateTime === null ||
        now - this.lastUpdateTime > 50 ||
        progress === total
      ) {
        this.lastUpdateTime = now;
        this.updateState({ progress, total, statusText });
      }
    }
  }

  public finish() {
    this.updateState(initialRagProgressState);
  }

  private updateState(patch: Partial<RagProgressState>) {
    this.state = { ...this.state, ...patch };
    if (this.emitChange) {
      this.emitChange(this.state);
    }
  }
}
