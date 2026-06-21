/** 桌面端统一入口：共用逻辑 + Git / 旧版导入等桌面专用模块 */
export * from '@baishou/core/shared'
export * from '@baishou/core/desktop'
export { createNodeFileSystem } from './node-file-system'
export { registerDugiteGitBinary } from './git-binary.dugite'
