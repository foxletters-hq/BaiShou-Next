import { normalizeModelBaseId } from './provider-vision-models'

/**
 * Kimi / Moonshot 的采样参数由服务端固定，官方文档要求不要显式传 temperature：
 * - kimi-k3 / kimi-k2.7-code：固定 1.0
 * - kimi-k2.6 / kimi-k2.5：思考模式 1.0、非思考模式 0.6
 *
 * 传错值会直接 400（invalid temperature: only 1 is allowed for this model），
 * 因此统一省略该字段，交由服务端按当前模式选择。
 * 注意：moonshot-v1-* 等非 Kimi 模型仍支持自定义 temperature，不能一并省略。
 */
export function isServerFixedTemperatureModel(modelId: string): boolean {
  const id = normalizeModelBaseId(modelId)
  if (!id) return false
  if (/^kimi(?:$|[-_.])/.test(id)) return true
  // Kimi 供应商短名（如 k3-256k / k2p5）
  if (/^k3(?:$|[-_.])/.test(id)) return true
  return /^k2p\d(?:$|[-_.])/.test(id)
}

/**
 * 按模型约束收敛 temperature；返回 undefined 表示不发送该字段，由服务端决定。
 * 用于关系抽取、标题、压缩等辅助任务，避免因 400 整体失败。
 */
export function resolveTemperatureForModel(modelId: string, desired: number): number | undefined {
  return isServerFixedTemperatureModel(modelId) ? undefined : desired
}
