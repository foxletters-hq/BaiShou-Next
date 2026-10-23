import {
  DEFAULT_AGENT_SKILLS,
  hashSkillContent,
  isValidSkillName,
  parseSkillMarkdown,
  serializeSkillMarkdown,
  slugifySkillName,
  type AgentSkillWriteInput
} from '@baishou/shared'

const SKILL_FILE_NAME = 'SKILL.md'
const USER_SKILLS_RELATIVE = ['.agents', 'skills'] as const
const SOFTWARE_SKILLS_RELATIVE = ['AI', 'skills'] as const

export type MobileSkillFs = {
  exists(path: string): Promise<boolean>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  writeFile(path: string, data: string): Promise<void>
  readFile(path: string): Promise<string>
  readdir(path: string): Promise<string[]>
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>
}

function joinPath(base: string, ...parts: string[]): string {
  return [base.replace(/[\\/]+$/, ''), ...parts].join('/').replace(/\\/g, '/')
}

function userSkillsRoot(vaultRoot: string): string {
  return joinPath(vaultRoot, ...USER_SKILLS_RELATIVE)
}

function softwareSkillsRoot(vaultRoot: string): string {
  return joinPath(vaultRoot, ...SOFTWARE_SKILLS_RELATIVE)
}

export async function listMobileSkillNames(
  vaultRoot: string,
  fs: MobileSkillFs
): Promise<string[]> {
  const root = vaultRoot.trim()
  if (!root) return []
  const [userNames, softwareNames] = await Promise.all([
    listSkillNames(fs, userSkillsRoot(root)),
    listSkillNames(fs, softwareSkillsRoot(root))
  ])
  return [...new Set([...userNames, ...softwareNames])]
}

async function listSkillNames(fs: MobileSkillFs, root: string): Promise<string[]> {
  let names: string[]
  try {
    names = await fs.readdir(root)
  } catch {
    return []
  }
  const out: string[] = []
  for (const name of names) {
    if (!isValidSkillName(name)) continue
    if (await fs.exists(joinPath(root, name, SKILL_FILE_NAME))) out.push(name)
  }
  return out
}

async function writeSkillMarkdown(
  fs: MobileSkillFs,
  skillsRoot: string,
  input: { name: string; description: string; content: string; bundledHash?: string }
): Promise<string> {
  const dir = joinPath(skillsRoot, input.name)
  const location = joinPath(dir, SKILL_FILE_NAME)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(location, serializeSkillMarkdown(input))
  return location
}

/** 把 skill_write 落到当前存储根的 `.agents/skills/<name>/SKILL.md` */
export async function writeMobileUserSkill(
  vaultRoot: string,
  input: AgentSkillWriteInput,
  fs: MobileSkillFs
): Promise<{ name: string; description: string; location: string }> {
  const root = vaultRoot.trim()
  if (!root) throw new Error('Storage root is not available')

  const name = slugifySkillName(input.name)
  if (!isValidSkillName(name)) throw new Error(`Invalid skill name: ${input.name}`)

  const description = input.description.trim() || name
  const userRoot = userSkillsRoot(root)
  const [userNames, softwareNames] = await Promise.all([
    listSkillNames(fs, userRoot),
    listSkillNames(fs, softwareSkillsRoot(root))
  ])
  const merged = new Set([...userNames, ...softwareNames])
  const previousName = input.previousName?.trim()

  if (previousName) {
    if (!merged.has(previousName)) throw new Error(`Skill not found: ${previousName}`)
    if (name !== previousName && merged.has(name)) throw new Error('DUPLICATE_SKILL_NAME')
  }

  const location = await writeSkillMarkdown(fs, userRoot, {
    name,
    description,
    content: input.content
  })

  if (previousName && name !== previousName && userNames.includes(previousName)) {
    await fs.rm(joinPath(userRoot, previousName), { recursive: true, force: true })
  }

  return { name, description, location }
}

/**
 * 旧版移动端把用户技能写到当前 Vault 的 `.agents/skills`。
 * 统一迁到存储根 `.agents/skills`，只复制主 SKILL.md（资源文件仍可从旧目录手动取回）。
 */
export async function migrateLegacyVaultUserSkills(
  vaultRoot: string,
  activeVaultRoot: string | null | undefined,
  fs: MobileSkillFs
): Promise<string[]> {
  const root = vaultRoot.trim()
  const active = activeVaultRoot?.trim()
  if (!root || !active) return []
  if (root.replace(/[\\/]+$/, '') === active.replace(/[\\/]+$/, '')) return []

  const sourceRoot = userSkillsRoot(active)
  const targetRoot = userSkillsRoot(root)
  const [sourceNames, targetNames] = await Promise.all([
    listSkillNames(fs, sourceRoot),
    listSkillNames(fs, targetRoot)
  ])
  const existing = new Set(targetNames)
  const migrated: string[] = []
  for (const name of sourceNames) {
    if (existing.has(name)) continue
    const skill = await readMobileSkill(active, name, fs)
    if (!skill) continue
    await writeMobileUserSkill(
      root,
      { name, description: skill.description, content: skill.content },
      fs
    )
    existing.add(name)
    migrated.push(name)
  }
  return migrated
}

/** 对齐桌面端：把 DEFAULT_AGENT_SKILLS 落到存储根 AI/skills，供 skill_read 按名读取 */
export async function ensureMobileDefaultSkills(
  vaultRoot: string,
  fs: MobileSkillFs
): Promise<string[]> {
  const root = vaultRoot.trim()
  if (!root) return []

  const softwareRoot = softwareSkillsRoot(root)
  const written: string[] = []

  for (const skill of DEFAULT_AGENT_SKILLS) {
    const location = joinPath(softwareRoot, skill.name, SKILL_FILE_NAME)
    let current: { description: string; content: string; bundledHash?: string } | null = null
    try {
      if (await fs.exists(location)) {
        const parsed = parseSkillMarkdown(await fs.readFile(location), location, {
          fallbackName: skill.name
        })
        if (parsed) {
          current = {
            description: parsed.description,
            content: parsed.content,
            ...(parsed.bundledHash ? { bundledHash: parsed.bundledHash } : {})
          }
        }
      }
    } catch {
      current = null
    }

    const bundledHash = hashSkillContent(skill.content)
    // 磁盘副本仍带旧版内置指纹 → 未被改动的内置技能，可整体升级正文
    if (current?.bundledHash && current.bundledHash !== bundledHash) {
      await writeSkillMarkdown(fs, softwareRoot, { ...skill, bundledHash })
      written.push(skill.name)
      continue
    }

    if (current && current.description === skill.description) continue

    // 旧版无指纹或用户已接管：只同步描述，保留用户正文
    await writeSkillMarkdown(fs, softwareRoot, {
      name: skill.name,
      description: skill.description,
      content: current?.content || skill.content
    })
    written.push(skill.name)
  }

  return written
}

/** 用户目录覆盖官方目录；都没有则返回 null */
export async function readMobileSkill(
  vaultRoot: string,
  rawName: string,
  fs: MobileSkillFs
): Promise<{ name: string; description: string; content: string; location: string } | null> {
  const root = vaultRoot.trim()
  if (!root) return null
  const name = slugifySkillName(rawName)
  if (!isValidSkillName(name)) return null

  for (const skillsRoot of [userSkillsRoot(root), softwareSkillsRoot(root)]) {
    const location = joinPath(skillsRoot, name, SKILL_FILE_NAME)
    try {
      if (!(await fs.exists(location))) continue
      const parsed = parseSkillMarkdown(await fs.readFile(location), location, {
        fallbackName: name
      })
      if (!parsed) continue
      return {
        name,
        description: parsed.description,
        content: parsed.content,
        location
      }
    } catch {
      /* 试下一个根 */
    }
  }
  return null
}

export async function deleteMobileUserSkill(
  vaultRoot: string,
  rawName: string,
  fs: MobileSkillFs
): Promise<boolean> {
  const root = vaultRoot.trim()
  if (!root) return false
  const name = slugifySkillName(rawName)
  if (!isValidSkillName(name)) return false
  const userRoot = userSkillsRoot(root)
  const dir = joinPath(userRoot, name)
  try {
    if (await fs.exists(dir)) {
      await fs.rm(dir, { recursive: true, force: true })
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}
