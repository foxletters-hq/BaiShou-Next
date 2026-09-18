import { normalizeModelBaseId } from './provider-vision-models'
import type { ReasoningControl, ReasoningEffort } from './reasoning-effort'

/** DeepSeek V4 / Flash 产品档位；与 listDeepSeekReasoningEfforts 对齐 */
export const DEEPSEEK_V4_REASONING_EFFORTS: ReasoningEffort[] = ['low', 'medium', 'high', 'max']

const DEEPSEEK_V4_CONTROL: ReasoningControl = {
  mode: 'effort',
  efforts: [...DEEPSEEK_V4_REASONING_EFFORTS]
}

const OVERLAY_BY_ID: Record<string, ReasoningControl> = {
  'deepseek-flash': DEEPSEEK_V4_CONTROL
}

/**
 * 本地覆盖：短名、目录漏名、目录档位明显不对时优先于远端目录。
 */
export function getReasoningOverlayControl(modelId: string): ReasoningControl | null {
  const id = normalizeModelBaseId(modelId)
  if (!id) return null
  const exact = OVERLAY_BY_ID[id]
  if (exact) return { ...exact, efforts: exact.efforts ? [...exact.efforts] : undefined }
  if (id.startsWith('deepseek-flash-')) {
    return { ...DEEPSEEK_V4_CONTROL, efforts: [...DEEPSEEK_V4_REASONING_EFFORTS] }
  }
  return null
}
