import { CREATE_SKILL_SLASH_COMMAND } from './create-skill-guide.util'
import { fileMentionDisplayLabels, type PromptFileSelection } from './prompt-attachment-kind.util'

export type SkillInvokeRef = {
  command: string
  content: string
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/^\//, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 只去掉完整芯片标签，避免 `@src/app.ts` 误删 `@src/app.ts.bak` */
export function stripExactChipLabel(text: string, label: string): string {
  if (!label) return text
  const pattern = new RegExp(`${escapeRegExp(label)}(?![A-Za-z0-9_./\\\\-])`, 'g')
  return text.replace(pattern, '')
}

/** 把技能正文收成模型应立即执行的说明；创建技能引导不包这层 */
export function buildSkillInvocationBody(skill: SkillInvokeRef): string {
  const command = normalizeCommand(skill.command)
  const body = skill.content.trim()
  if (command === CREATE_SKILL_SLASH_COMMAND) return body
  if (!command && !body) return ''
  const header = `用户已启用技能「${command}」。现在按下列说明执行；不要复述或改写技能文件，除非说明要求这样做。`
  if (!body) {
    return `${header}\n\n技能正文未随消息带上。请读取该技能的 SKILL.md 后立即执行，不要只确认文件已保存。`
  }
  return [header, '', body].join('\n')
}

export function buildSkillSendText(skills: SkillInvokeRef[], extraPlain = ''): string {
  return [...skills.map(buildSkillInvocationBody), extraPlain.trim()].filter(Boolean).join('\n\n')
}

/** 去掉芯片标签后的伴随输入，避免把 `/name` 或 `@path` 再发给模型 */
export function composerExtraPlain(
  plainText: string,
  skills: Array<{ command: string }>,
  fileRefs: Array<{ relativePath: string; selection?: PromptFileSelection }> = []
): string {
  let extra = plainText
  for (const skill of skills) {
    const command = normalizeCommand(skill.command)
    if (!command) continue
    extra = extra.split(`/${command}`).join('')
  }
  const mentionLabels = fileRefs
    .flatMap((ref) => fileMentionDisplayLabels(ref))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  for (const label of mentionLabels) {
    extra = stripExactChipLabel(extra, label)
  }
  return extra
    .replace(/\u200B/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
