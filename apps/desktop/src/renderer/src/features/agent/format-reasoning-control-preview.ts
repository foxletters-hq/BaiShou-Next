import {
  getReasoningControlForModel,
  normalizeReasoningEffortSetting,
  formatReasoningEffortLabel,
  type ReasoningEffortSetting
} from '@baishou/shared'
import { getReasoningEffortForModel, reasoningEffortModelKey } from './reasoning-effort-session'

/** 当前模型思考控制的预览文案（触发按钮 / 列表后缀）；档位固定英文 */
export function formatReasoningControlPreview(params: {
  modelId?: string | null
  providerTypeOrId?: string | null
  effort: ReasoningEffortSetting
}): string {
  const modelId = params.modelId?.trim() || ''
  const ctl = getReasoningControlForModel(modelId, params.providerTypeOrId || undefined)
  const effort = normalizeReasoningEffortSetting(params.effort)

  if (ctl.mode === 'effort' && ctl.efforts?.length) {
    // 历史可能存了 none（关闭），UI 已去掉该档，预览按 Default
    if (effort === 'auto' || effort === 'none') {
      return formatReasoningEffortLabel('auto')
    }
    return formatReasoningEffortLabel(effort)
  }
  return formatReasoningEffortLabel('auto')
}

export type ModelReasoningPreviewMap = Record<string, { effort: ReasoningEffortSetting }>

/** 读取本机全部模型的思考持久化，供菜单列表预览 */
export function buildModelReasoningPreviewMap(
  providers: Array<{ id: string; type?: string; models?: string[]; enabledModels?: string[] }>
): ModelReasoningPreviewMap {
  const out: ModelReasoningPreviewMap = {}
  for (const p of providers) {
    const models =
      p.enabledModels && p.enabledModels.length > 0 ? p.enabledModels : p.models || []
    for (const modelId of models) {
      const key = reasoningEffortModelKey(p.id, modelId)
      out[key] = { effort: getReasoningEffortForModel(p.id, modelId) }
    }
  }
  return out
}
