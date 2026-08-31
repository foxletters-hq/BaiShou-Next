/**
 * 「创建 Skill」入口注入的引导提示：让 Agent 按问答方式帮用户写 SKILL.md，
 * 并用 skill_write 落盘到当前范围的 `.agents/skills/`。
 */
export type CreateSkillGuideScope = 'software' | 'workspace'

export const CREATE_SKILL_GUIDE_PROMPT = `请引导我创建一个软件级 Skill（可复用的 AI 工作流指令包）。

要求：
- 一次只问 1–2 个关键问题，根据回答再往下问，不要一次抛出全部问卷
- 先确认用途与触发场景，再定名称与 description，最后一起写正文
- 名称必须是 kebab-case（小写字母/数字/连字符，如 code-review），且与目录名一致
- description 用第三人称、说清「做什么 + 何时用」，便于以后 Agent 选型
- 正文保持精炼，只写 Agent 不知道的领域知识与步骤

确认信息足够后：
1. 先向我展示完整 SKILL.md 预览：文件开头用 properties 元信息（name: 与 description: 两行），不要用 --- 包裹
2. 征得我同意后，调用 skill_write 工具写入用户主目录 .agents/skills/<name>/SKILL.md（不要用工作区文件写入工具，也不要写入 AI/skills）
`

export const CREATE_SKILL_GUIDE_PROMPT_WORKSPACE = `请引导我创建一个项目级 Skill（仅当前工作区可复用的 AI 工作流指令包）。

要求：
- 一次只问 1–2 个关键问题，根据回答再往下问，不要一次抛出全部问卷
- 先确认用途与触发场景，再定名称与 description，最后一起写正文
- 名称必须是 kebab-case（小写字母/数字/连字符，如 code-review），且与目录名一致
- description 用第三人称、说清「做什么 + 何时用」，便于以后 Agent 选型
- 正文保持精炼，只写 Agent 不知道的领域知识与步骤

确认信息足够后：
1. 先向我展示完整 SKILL.md 预览：文件开头用 properties 元信息（name: 与 description: 两行），不要用 --- 包裹
2. 征得我同意后，调用 skill_write 工具写入当前工作区 .agents/skills/<name>/SKILL.md（不要用工作区文件写入工具，也不要写入 AI/skills）
`

export const CREATE_SKILL_SLASH_COMMAND = 'create-skill'

export function getCreateSkillGuidePrompt(
  t?: (key: string, defaultValue?: string) => string,
  scope: CreateSkillGuideScope = 'software'
): string {
  if (scope === 'workspace') {
    if (!t) return CREATE_SKILL_GUIDE_PROMPT_WORKSPACE
    return t('shortcut.create_skill_guide_prompt_workspace', CREATE_SKILL_GUIDE_PROMPT_WORKSPACE)
  }
  if (!t) return CREATE_SKILL_GUIDE_PROMPT
  return t('shortcut.create_skill_guide_prompt', CREATE_SKILL_GUIDE_PROMPT)
}
