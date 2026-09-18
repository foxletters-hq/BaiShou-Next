import {
  DEFAULT_AGENT_SKILLS,
  parseSkillMarkdown,
  skillToPromptShortcut,
  type AgentSkill,
  type PromptShortcut
} from '@baishou/shared'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { createMobileFileSystem } from './create-mobile-file-system'

function joinPath(base: string, ...parts: string[]): string {
  return [base.replace(/[\\/]+$/, ''), ...parts].join('/').replace(/\\/g, '/')
}

async function readSkillsFromRoot(
  root: string,
  source: AgentSkill['source']
): Promise<PromptShortcut[]> {
  const fs = createMobileFileSystem()
  let names: string[]
  try {
    names = await fs.readdir(root)
  } catch {
    return []
  }
  const out: PromptShortcut[] = []
  for (const name of names) {
    const file = joinPath(root, name, 'SKILL.md')
    try {
      if (!(await fs.exists(file))) continue
      const text = await fs.readFile(file)
      const parsed = parseSkillMarkdown(String(text), file, { fallbackName: name })
      if (!parsed) continue
      out.push(skillToPromptShortcut({ ...parsed, source }))
    } catch {
      /* 单条损坏不阻断目录 */
    }
  }
  return out
}

export async function mobileListSkillShortcuts(): Promise<PromptShortcut[]> {
  const runtime = agentDbRuntimeRef.current
  const roots: Array<{ path: string; source: AgentSkill['source'] }> = []
  if (runtime?.pathService) {
    try {
      const vaultRoot = await runtime.pathService.getRootDirectory()
      if (vaultRoot) {
        roots.push({ path: joinPath(vaultRoot, 'AI', 'skills'), source: 'software' })
        roots.push({ path: joinPath(vaultRoot, '.agents', 'skills'), source: 'user' })
      }
    } catch {
      /* 无存储根时回退默认技能 */
    }
  }

  const listed: PromptShortcut[] = []
  for (const root of roots) {
    listed.push(
      ...(await readSkillsFromRoot(root.path, root.source === 'user' ? 'user' : 'software'))
    )
  }
  if (listed.length > 0) return listed
  return DEFAULT_AGENT_SKILLS.map((skill) =>
    skillToPromptShortcut({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      location: 'software',
      source: 'software'
    })
  )
}
