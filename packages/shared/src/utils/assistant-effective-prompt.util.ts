import {
  isFactoryLatteAssistantSystemPrompt,
  isLegacyDefaultAssistantSystemPrompt
} from '../constants/latte-assistant-prompt.defaults'
import { isFactoryLatteAssistantName } from '../constants/latte-default-assistant.constants'

function applyCustomAssistantNameToFactoryPersona(
  persona: string,
  assistantName?: string | null
): string {
  const trimmedName = assistantName?.trim()
  if (
    !trimmedName ||
    isFactoryLatteAssistantName(trimmedName) ||
    !persona ||
    !isFactoryLatteAssistantSystemPrompt(persona) ||
    isLegacyDefaultAssistantSystemPrompt(persona)
  ) {
    return persona
  }
  return persona
    .replace(/Latte（拉提）/g, trimmedName)
    .replace(/Latte（ラテ）/g, trimmedName)
    .replace(/\bLatte\b/g, trimmedName)
}

/**
 * 拼接伙伴生效系统提示词：人设 +（可选）自定义段。
 * 自定义为空时与仅使用 systemPrompt 的行为一致。
 * 若用户已将伙伴改名（如「酒狐」），但人设文本仍停留为出厂 Latte 模板，则自动将人设自称替换为当前伙伴名。
 */
export function buildEffectiveAssistantSystemPrompt(
  systemPrompt?: string | null,
  customSystemPrompt?: string | null,
  assistantName?: string | null
): string {
  const persona = applyCustomAssistantNameToFactoryPersona(systemPrompt ?? '', assistantName)
  const custom = (customSystemPrompt ?? '').trim()
  if (!custom) return persona
  if (!persona) return custom
  return `${persona}\n\n${custom}`
}
