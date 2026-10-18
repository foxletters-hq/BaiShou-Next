import type { LocalizedShortcutLabels, PromptShortcut } from '@baishou/shared'
import { isProtectedSkill, localizePromptShortcut } from '@baishou/shared'

/** 清洗并提取标题与副文本，避免 description 与 content 或名称互相重复 */
export function resolveShortcutDisplayInfo(
  item: PromptShortcut,
  defaultLabels: LocalizedShortcutLabels
) {
  const localized = localizePromptShortcut(item, defaultLabels)
  const isProtected = isProtectedSkill(item)
  const command = (item.command || item.name || '').trim().replace(/^\//, '')
  const titleCommand = command || localized.name || ''

  const rawName = (localized.name || '').trim()
  const rawDesc = (localized.description || '').trim()
  const rawContent = (localized.content || '').trim()

  // 标题别名（当名称或描述与命令不重复时作为副标题展示）
  let customName = ''
  if (rawName && rawName.toLowerCase() !== titleCommand.toLowerCase()) {
    customName = rawName
  } else if (rawDesc && rawDesc.toLowerCase() !== titleCommand.toLowerCase()) {
    customName = rawDesc
  }
  const showCustomName = Boolean(customName)

  let displayDesc = ''
  if (isProtected) {
    // 保护型技能（如 create-skill）展示第一段正文说明
    const firstLine =
      rawContent
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)[0] || rawDesc
    displayDesc = firstLine
  } else {
    // 1. 从 content 中剥离 markdown 顶级标题（如 # 标题、## 标题）
    let body = rawContent.replace(/^#+\s+[^\n]*\n*/, '').trim()

    // 2. 剥离 content 开头与 customName、rawDesc、titleCommand 重复的前缀（如 "日常写作助理："、"日常写作助理 - "）
    const prefixes = [customName, rawDesc, titleCommand].filter(Boolean)
    for (const prefix of prefixes) {
      const cleanPrefix = prefix.replace(/[。，：:\s-]+$/, '').trim()
      if (!cleanPrefix) continue
      const escaped = cleanPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`^${escaped}[\\s:：、，。\\-—–]+`, 'i')
      body = body.replace(regex, '').trim()
    }

    // 3. 决定副文本：
    // 若剥离重复前缀后 body 具有实质有效内容，优先显示 body；
    // 否则使用与名称不重复的 rawDesc，最后回退至 rawContent 或 rawDesc
    if (body) {
      displayDesc = body
    } else if (
      rawDesc &&
      rawDesc.toLowerCase() !== titleCommand.toLowerCase() &&
      rawDesc !== customName
    ) {
      displayDesc = rawDesc
    } else {
      displayDesc = rawContent || rawDesc
    }
  }

  const cleanSummary = displayDesc.replace(/[\r\n]+/g, ' ').trim()

  return {
    localized,
    isProtected,
    command: titleCommand,
    showCustomName,
    customName,
    displayDesc: cleanSummary
  }
}
