import { CREATE_SKILL_SLASH_COMMAND } from './create-skill-guide.util'

export type SkillInvokeRef = {
  command: string
  content: string
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/^\//, '')
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

/** 去掉芯片标签后的伴随输入，避免把 `/name` 再发给模型 */
export function composerExtraPlain(plainText: string, skills: Array<{ command: string }>): string {
  let extra = plainText
  for (const skill of skills) {
    const command = normalizeCommand(skill.command)
    if (!command) continue
    extra = extra.split(`/${command}`).join('')
  }
  return extra.replace(/\u200B/g, '').replace(/[ \t]+\n/g, '\n').trim()
}
