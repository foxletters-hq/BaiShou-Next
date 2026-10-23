import { listReasoningEffortsForModel, type ReasoningEffortSetting } from './reasoning-effort'

/**
 * 会话菜单可用思考档位：始终含 auto；effort 模型再跟上可用档（不含 none）。
 * 与桌面 SessionModelMenu 裁剪规则对齐。
 */
export function listSessionReasoningEffortSettings(
  modelId: string,
  providerTypeOrId?: string
): ReasoningEffortSetting[] {
  const efforts = listReasoningEffortsForModel(modelId, providerTypeOrId)
  if (!efforts?.length) return ['auto']
  return ['auto', ...efforts.filter((effort) => effort !== 'none')]
}
