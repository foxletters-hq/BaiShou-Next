import {
  CREATE_SKILL_SLASH_COMMAND,
  DEFAULT_AGENT_SKILLS,
  dedupePromptShortcuts,
  parseSkillMarkdown,
  skillToPromptShortcut,
  type AgentSkill,
  type AgentSkillWriteInput,
  type PromptShortcut
} from '@baishou/shared'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { createMobileFileSystem } from './create-mobile-file-system'
import { notifyMobileSkillsChanged } from './mobile-skills-events'
import { ensureMobileShortcutsMigrated } from './mobile-skills-migrate.util'
import {
  ensureMobileDefaultSkills,
  migrateLegacyVaultUserSkills,
  readMobileSkill,
  writeMobileUserSkill
} from './mobile-skills-writer.util'

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
        const fs = createMobileFileSystem()
        if (runtime.settingsManager) {
          try {
            await ensureMobileShortcutsMigrated({
              vaultRoot,
              settings: runtime.settingsManager,
              fs
            })
          } catch {
            /* 迁移失败不阻断已有磁盘技能 */
          }
        }
        try {
          await ensureMobileDefaultSkills(vaultRoot, fs)
        } catch {
          /* 默认技能写入失败不阻断已有磁盘技能 */
        }
        try {
          const activeVaultRoot = await runtime.pathService.getActiveVaultPath()
          await migrateLegacyVaultUserSkills(vaultRoot, activeVaultRoot, fs)
        } catch {
          /* 旧目录迁移失败不阻断已有磁盘技能 */
        }
        roots.push({ path: joinPath(vaultRoot, '.agents', 'skills'), source: 'user' })
        roots.push({ path: joinPath(vaultRoot, 'AI', 'skills'), source: 'software' })
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
  const defaultShortcuts = DEFAULT_AGENT_SKILLS.map((skill) =>
    skillToPromptShortcut({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      location: 'software',
      source: 'software'
    })
  )

  const hasCreateSkill = listed.some(
    (item) =>
      item.command === CREATE_SKILL_SLASH_COMMAND ||
      item.id === CREATE_SKILL_SLASH_COMMAND ||
      item.name === CREATE_SKILL_SLASH_COMMAND
  )

  const merged = hasCreateSkill ? listed : [...defaultShortcuts, ...listed]
  return dedupePromptShortcuts(merged)
}

export async function mobileListSkillsCatalog(): Promise<
  Array<{ name: string; description?: string }>
> {
  const shortcuts = await mobileListSkillShortcuts()
  return shortcuts
    .filter((item) => item.autoinvoke !== false)
    .map((item) => ({
      name: item.command || item.id,
      description: item.description || item.name || ''
    }))
}

/** 注入 ToolContext.skillsWriter：伙伴会话经 skill_write 写入存储根 `.agents/skills` */
export function createMobileSkillsWriter() {
  return {
    async writeSkill(input: AgentSkillWriteInput) {
      const runtime = agentDbRuntimeRef.current
      if (!runtime?.pathService) {
        throw new Error('Storage root is not available')
      }
      const vaultRoot = await runtime.pathService.getRootDirectory()
      const result = await writeMobileUserSkill(vaultRoot, input, createMobileFileSystem())
      notifyMobileSkillsChanged()
      return result
    }
  }
}

/** 注入 ToolContext.skillsReader：按名读取存储根 SKILL.md */
export function createMobileSkillsReader() {
  return {
    async readSkill(name: string) {
      const runtime = agentDbRuntimeRef.current
      if (!runtime?.pathService) return null
      const vaultRoot = await runtime.pathService.getRootDirectory()
      const fs = createMobileFileSystem()
      try {
        await ensureMobileDefaultSkills(vaultRoot, fs)
      } catch {
        /* 写入失败仍尝试读已有文件 */
      }
      return readMobileSkill(vaultRoot, name, fs)
    },
    async listSkills() {
      return mobileListSkillsCatalog()
    },
    async listAllSkills() {
      const shortcuts = await mobileListSkillShortcuts()
      return shortcuts.map((item) => ({
        name: item.command || item.id,
        description: item.description || item.name || ''
      }))
    },
    async listResources(name: string) {
      const runtime = agentDbRuntimeRef.current
      if (!runtime?.pathService) return []
      const vaultRoot = await runtime.pathService.getRootDirectory()
      const fs = createMobileFileSystem()
      const skill = await readMobileSkill(vaultRoot, name, fs)
      if (!skill?.location) return []
      return listMobileSkillResourceFiles(skill.location, fs)
    }
  }
}

const MAX_MOBILE_SKILL_RESOURCE_FILES = 10
const MAX_MOBILE_SKILL_RESOURCE_DEPTH = 2

/** 列出技能目录下的资源文件（相对路径，最多 10 个；跳过 SKILL.md 与隐藏项） */
async function listMobileSkillResourceFiles(
  skillFilePath: string,
  fs: ReturnType<typeof createMobileFileSystem>
): Promise<string[]> {
  const normalized = skillFilePath.replace(/\\/g, '/')
  const root = normalized.slice(0, normalized.lastIndexOf('/')) || '/'
  const out: string[] = []

  const walk = async (current: string, depth: number): Promise<void> => {
    if (out.length >= MAX_MOBILE_SKILL_RESOURCE_FILES || depth > MAX_MOBILE_SKILL_RESOURCE_DEPTH) {
      return
    }
    let names: string[] = []
    try {
      names = await fs.readdir(current)
    } catch {
      return
    }
    for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
      if (out.length >= MAX_MOBILE_SKILL_RESOURCE_FILES) return
      if (name.startsWith('.')) continue
      const abs = joinPath(current, name)
      let nested: string[] | null = null
      try {
        nested = await fs.readdir(abs)
      } catch {
        nested = null
      }
      if (nested) {
        await walk(abs, depth + 1)
        continue
      }
      if (abs === normalized) continue
      const rel = abs.slice(root.length).replace(/^\/+/, '')
      if (rel) out.push(rel)
    }
  }

  await walk(root, 0)
  return out
}
