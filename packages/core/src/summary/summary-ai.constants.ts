import { AI_FIRST_OUTPUT_TIMEOUT_MS } from '@baishou/shared'

/** 等待模型首个输出（正文或推理增量）的超时 */
export const SUMMARY_AI_GENERATION_TIMEOUT_MS = AI_FIRST_OUTPUT_TIMEOUT_MS

/** 已有输出后，连续这么久没有新增量则中止，避免首个 token 后挂死 */
export const SUMMARY_AI_IDLE_TIMEOUT_MS = AI_FIRST_OUTPUT_TIMEOUT_MS
