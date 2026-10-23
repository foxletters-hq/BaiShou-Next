/** 自动生成 — 运行 node scripts/generate-demo-data.mjs 更新 */
import { DEMO_DIARIES_RECENT } from './demo-diaries-recent.generated'
import { DEMO_DIARIES_ARCHIVE } from './demo-diaries-archive.generated'

export const DEMO_DIARIES = [...DEMO_DIARIES_RECENT, ...DEMO_DIARIES_ARCHIVE]
