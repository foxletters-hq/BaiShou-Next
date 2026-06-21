import { emitDomainMutation } from '@baishou/core-desktop'

/** 外部文件系统变更（watcher）写入影子索引后，通知缓存协调器失效 */
export function emitDiaryWatcherMutation(reason = 'diary-watcher'): void {
  emitDomainMutation({ domain: 'diary', action: 'update', reason })
}

/** 外部总结文件变更同步到 DB 后，通知缓存协调器失效 */
export function emitSummaryWatcherMutation(reason = 'summary-watcher'): void {
  emitDomainMutation({ domain: 'summary', action: 'update', reason })
}
