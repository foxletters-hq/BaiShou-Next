import { app } from 'electron'
import { constants as fsConstants } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  isValidSkillName,
  parseSkillMarkdown,
  serializeSkillMarkdown,
  type AgentSkill
} from '@baishou/shared'
import { resolveAppInstallRoot } from './agent-workspace-scratch.util'
import {
  resolveAgentsSkillsRoot,
  resolveAiSkillsRoot,
  resolveSkillDir,
  resolveSkillFile
} from './agent-skills.util'
import { mergeSkillsByName } from './agent-skills-merge.util'
import { broadcastSkillsChanged, invalidateAgentSkillsCache } from './agent-skills-state'

export async function resolveBundledSkillsRoot(): Promise<string> {
  const installRoot = resolveAppInstallRoot({
    isPackaged: app.isPackaged,
    exePath: app.getPath('exe'),
    appPath: app.getAppPath()
  })
  const preferred = resolveAiSkillsRoot({
    installRoot,
    userDataRoot: app.getPath('userData')
  })

  try {
    await fs.mkdir(preferred, { recursive: true })
    await fs.access(preferred, fsConstants.W_OK)
    return preferred
  } catch {
    const fallback = resolveAiSkillsRoot({
      installRoot: null,
      userDataRoot: app.getPath('userData')
    })
    await fs.mkdir(fallback, { recursive: true })
    return fallback
  }
}

export async function resolveUserAgentsSkillsRoot(options?: { ensure?: boolean }): Promise<string> {
  const preferred = resolveAgentsSkillsRoot(app.getPath('home'))
  const fallback = resolveAgentsSkillsRoot(app.getPath('userData'))
  if (!options?.ensure) {
    try {
      await fs.access(preferred)
      return preferred
    } catch {
      try {
        await fs.access(fallback)
        return fallback
      } catch {
        return preferred
      }
    }
  }
  try {
    await fs.mkdir(preferred, { recursive: true })
    await fs.access(preferred, fsConstants.W_OK)
    return preferred
  } catch {
    await fs.mkdir(fallback, { recursive: true })
    return fallback
  }
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

export async function moveSkillDirectory(fromDir: string, toDir: string): Promise<void> {
  await fs.mkdir(path.dirname(toDir), { recursive: true })
  try {
    await fs.rename(fromDir, toDir)
    return
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : ''
    if (code !== 'EXDEV' && code !== 'EEXIST' && code !== 'ENOTEMPTY') throw error
  }
  await fs.cp(fromDir, toDir, { recursive: true })
  await fs.rm(fromDir, { recursive: true, force: true })
}

export async function getSkillsRootMtimeMs(skillsRoot: string): Promise<number> {
  try {
    const st = await fs.stat(skillsRoot)
    return st.mtimeMs
  } catch {
    return 0
  }
}

export async function writeSkillFile(
  skillsRoot: string,
  input: { name: string; description: string; content: string },
  source: AgentSkill['source'] = 'software'
): Promise<AgentSkill> {
  if (!isValidSkillName(input.name)) {
    throw new Error(`Invalid skill name: ${input.name}`)
  }
  const dir = resolveSkillDir(skillsRoot, input.name)
  const location = resolveSkillFile(skillsRoot, input.name)
  await fs.mkdir(dir, { recursive: true })
  const markdown = serializeSkillMarkdown(input)
  await fs.writeFile(location, markdown, 'utf-8')
  invalidateAgentSkillsCache()
  broadcastSkillsChanged()
  return {
    name: input.name,
    description: input.description.trim() || input.name,
    content: input.content,
    location,
    source
  }
}

export async function listSkillFiles(
  skillsRoot: string,
  source: AgentSkill['source'] = 'software'
): Promise<AgentSkill[]> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(skillsRoot)
  } catch {
    return []
  }

  const skills: AgentSkill[] = []
  for (const entry of entries) {
    if (!isValidSkillName(entry)) continue
    const location = resolveSkillFile(skillsRoot, entry)
    try {
      const markdown = await fs.readFile(location, 'utf-8')
      const parsed = parseSkillMarkdown(markdown, location, { fallbackName: entry })
      if (!parsed) continue
      skills.push({ ...parsed, name: entry, location, source })
    } catch {
      // skip unreadable
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills
}

export async function listMergedSoftwareSkills(): Promise<AgentSkill[]> {
  const bundledRoot = await resolveBundledSkillsRoot()
  const userRoot = await resolveUserAgentsSkillsRoot()
  const [bundled, user] = await Promise.all([
    listSkillFiles(bundledRoot, 'software'),
    listSkillFiles(userRoot, 'user')
  ])
  return mergeSkillsByName(bundled, user)
}
