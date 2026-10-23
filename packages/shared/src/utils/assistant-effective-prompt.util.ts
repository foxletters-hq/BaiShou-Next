/**
 * 拼接伙伴生效系统提示词：人设 +（可选）自定义段。
 * 自定义为空时与仅使用 systemPrompt 的行为一致。
 */
export function buildEffectiveAssistantSystemPrompt(
  systemPrompt?: string | null,
  customSystemPrompt?: string | null
): string {
  const persona = systemPrompt ?? ''
  const custom = (customSystemPrompt ?? '').trim()
  if (!custom) return persona
  if (!persona) return custom
  return `${persona}\n\n${custom}`
}
