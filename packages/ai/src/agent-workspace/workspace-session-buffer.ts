import type { FileChangePartData } from '@baishou/shared'

/** 收集单轮流式会话中的 file_change part 载荷，供落盘写入 assistant 消息 */
export class WorkspaceSessionBuffer {
  private readonly changes: FileChangePartData[] = []

  push(change: FileChangePartData): void {
    this.changes.push(change)
  }

  buildPartDataList(): FileChangePartData[] {
    return [...this.changes]
  }

  clear(): void {
    this.changes.length = 0
  }
}
