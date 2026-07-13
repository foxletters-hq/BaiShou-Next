/**
 * 增量同步成功结束时的一致点提交顺序（对齐桌面与移动端）：
 * 1. local — 写入本地 `.baishou/manifest.json`
 * 2. remote — 上传云端 `.baishou/manifest.json`
 * 3. ancestor — 写入本地祖先快照 `last-remote-manifest.json`
 *
 * 中途可节流推进 local+ancestor；远端半截状态不得上传。
 */
export const INCREMENTAL_SYNC_CHECKPOINT_COMMIT_STEPS = ['local', 'remote', 'ancestor'] as const

export type IncrementalSyncCheckpointCommitStep =
  (typeof INCREMENTAL_SYNC_CHECKPOINT_COMMIT_STEPS)[number]
