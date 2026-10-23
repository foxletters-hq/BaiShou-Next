import { describe, expect, it } from 'vitest'
import {
  CREATE_SKILL_GUIDE_PROMPT,
  CREATE_SKILL_SLASH_COMMAND,
  DEFAULT_AGENT_SKILLS,
  DIARY_APPEND_SKILL_NAME,
  SUMMARY_REPAIR_SKILL_NAME,
  SUMMARY_WRITE_SKILL_NAME,
  serializeSkillMarkdown
} from '@baishou/shared'
import {
  ensureMobileDefaultSkills,
  migrateLegacyVaultUserSkills,
  readMobileSkill,
  writeMobileUserSkill
} from '../mobile-skills-writer.util'

function createMemoryFs() {
  const files = new Map<string, string>()
  const dirs = new Set<string>(['/vault'])

  const norm = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '') || '/'
  const parentOf = (value: string) => {
    const index = value.lastIndexOf('/')
    return index <= 0 ? '/' : value.slice(0, index)
  }
  const ensureParents = (value: string) => {
    let current = parentOf(value)
    while (current && current !== '/') {
      dirs.add(current)
      current = parentOf(current)
    }
    dirs.add('/')
  }

  return {
    async exists(path: string) {
      const next = norm(path)
      return files.has(next) || dirs.has(next)
    },
    async mkdir(path: string, _options?: { recursive?: boolean }) {
      const next = norm(path)
      dirs.add(next)
      ensureParents(next)
    },
    async writeFile(path: string, data: string) {
      const next = norm(path)
      files.set(next, data)
      ensureParents(next)
    },
    async readFile(path: string) {
      const data = files.get(norm(path))
      if (data == null) throw new Error(`ENOENT: ${path}`)
      return data
    },
    async readdir(path: string) {
      const prefix = `${norm(path)}/`
      const names = new Set<string>()
      for (const entry of [...files.keys(), ...dirs]) {
        if (!entry.startsWith(prefix)) continue
        const name = entry.slice(prefix.length).split('/')[0]
        if (name) names.add(name)
      }
      if (!dirs.has(norm(path)) && names.size === 0) {
        throw new Error(`ENOENT: ${path}`)
      }
      return [...names]
    },
    async rm(path: string) {
      const next = norm(path)
      const prefix = `${next}/`
      for (const key of [...files.keys()]) {
        if (key === next || key.startsWith(prefix)) files.delete(key)
      }
      for (const key of [...dirs]) {
        if (key === next || key.startsWith(prefix)) dirs.delete(key)
      }
    }
  }
}

describe('migrateLegacyVaultUserSkills', () => {
  it('copies skills from active vault .agents/skills to storage root', async () => {
    const fs = createMemoryFs()
    await fs.mkdir('/vault/Personal/.agents/skills/legacy', { recursive: true })
    await fs.writeFile(
      '/vault/Personal/.agents/skills/legacy/SKILL.md',
      serializeSkillMarkdown({
        name: 'legacy',
        description: '旧仓技能',
        content: '旧正文'
      })
    )

    const migrated = await migrateLegacyVaultUserSkills('/vault', '/vault/Personal', fs)

    expect(migrated).toEqual(['legacy'])
    expect(await fs.exists('/vault/.agents/skills/legacy/SKILL.md')).toBe(true)
    const copied = await readMobileSkill('/vault', 'legacy', fs)
    expect(copied).toMatchObject({ name: 'legacy', description: '旧仓技能', content: '旧正文' })
  })
})

describe('writeMobileUserSkill', () => {
  it('should write a new skill under vault .agents/skills when creating', async () => {
    const fs = createMemoryFs()
    const result = await writeMobileUserSkill(
      '/vault',
      { name: 'Daily Brief', description: 'Summarize the day', content: '读日记后给要点。' },
      fs
    )

    expect(result.name).toBe('daily-brief')
    expect(result.location).toBe('/vault/.agents/skills/daily-brief/SKILL.md')
    expect(result.description).toBe('Summarize the day')
    expect(await fs.readFile(result.location)).toBe(
      serializeSkillMarkdown({
        name: 'daily-brief',
        description: 'Summarize the day',
        content: '读日记后给要点。'
      })
    )
  })

  it('should overwrite an existing user skill and keep the same location', async () => {
    const fs = createMemoryFs()
    await writeMobileUserSkill(
      '/vault',
      { name: 'note-taker', description: 'old', content: 'old body' },
      fs
    )

    const result = await writeMobileUserSkill(
      '/vault',
      { name: 'note-taker', description: 'new desc', content: 'new body' },
      fs
    )

    expect(result.location).toBe('/vault/.agents/skills/note-taker/SKILL.md')
    expect(await fs.readFile(result.location)).toContain('new body')
    expect(await fs.readFile(result.location)).toContain('new desc')
  })

  it('should rename a user skill and remove the previous directory', async () => {
    const fs = createMemoryFs()
    await writeMobileUserSkill(
      '/vault',
      { name: 'old-name', description: 'old', content: 'body' },
      fs
    )

    const result = await writeMobileUserSkill(
      '/vault',
      {
        name: 'new-name',
        description: 'renamed',
        content: 'body',
        previousName: 'old-name'
      },
      fs
    )

    expect(result.name).toBe('new-name')
    expect(result.location).toBe('/vault/.agents/skills/new-name/SKILL.md')
    expect(await fs.exists('/vault/.agents/skills/old-name/SKILL.md')).toBe(false)
    expect(await fs.exists('/vault/.agents/skills/new-name/SKILL.md')).toBe(true)
  })

  it('should throw when renaming onto another existing skill name', async () => {
    const fs = createMemoryFs()
    await writeMobileUserSkill('/vault', { name: 'alpha', description: 'a', content: 'a' }, fs)
    await writeMobileUserSkill('/vault', { name: 'beta', description: 'b', content: 'b' }, fs)

    await expect(
      writeMobileUserSkill(
        '/vault',
        { name: 'beta', description: 'a', content: 'a', previousName: 'alpha' },
        fs
      )
    ).rejects.toThrow('DUPLICATE_SKILL_NAME')
  })

  it('should throw when the previous skill does not exist', async () => {
    const fs = createMemoryFs()

    await expect(
      writeMobileUserSkill(
        '/vault',
        { name: 'next', description: 'n', content: 'n', previousName: 'missing' },
        fs
      )
    ).rejects.toThrow('Skill not found: missing')
  })

  it('should throw when the vault root is empty', async () => {
    const fs = createMemoryFs()
    await expect(
      writeMobileUserSkill('  ', { name: 'x', description: 'x', content: 'x' }, fs)
    ).rejects.toThrow('Storage root is not available')
  })

  it('should read a user skill and prefer it over the software copy', async () => {
    const fs = createMemoryFs()
    await writeMobileUserSkill(
      '/vault',
      { name: 'brief', description: 'user desc', content: 'user body' },
      fs
    )
    await fs.mkdir('/vault/AI/skills/brief', { recursive: true })
    await fs.writeFile(
      '/vault/AI/skills/brief/SKILL.md',
      'name: brief\ndescription: bundled\n\nold\n'
    )

    const skill = await readMobileSkill('/vault', 'brief', fs)
    expect(skill?.description).toBe('user desc')
    expect(skill?.content).toContain('user body')
    expect(skill?.location).toBe('/vault/.agents/skills/brief/SKILL.md')
  })

  it('should return null when the skill is not on disk', async () => {
    const fs = createMemoryFs()
    expect(await readMobileSkill('/vault', 'missing', fs)).toBeNull()
  })

  it('should write a user override when the name already exists under AI/skills', async () => {
    const fs = createMemoryFs()
    await fs.mkdir('/vault/AI/skills/brief', { recursive: true })
    await fs.writeFile(
      '/vault/AI/skills/brief/SKILL.md',
      'name: brief\ndescription: bundled\n\nold\n'
    )

    const result = await writeMobileUserSkill(
      '/vault',
      { name: 'brief', description: 'user override', content: 'new body' },
      fs
    )

    expect(result.location).toBe('/vault/.agents/skills/brief/SKILL.md')
    expect(await fs.readFile('/vault/.agents/skills/brief/SKILL.md')).toContain('user override')
    expect(await fs.readFile('/vault/AI/skills/brief/SKILL.md')).toContain('bundled')
  })
})

describe('ensureMobileDefaultSkills', () => {
  it('should write default skills under AI/skills when missing', async () => {
    const fs = createMemoryFs()
    const written = await ensureMobileDefaultSkills('/vault', fs)

    expect(written).toEqual([
      CREATE_SKILL_SLASH_COMMAND,
      DIARY_APPEND_SKILL_NAME,
      SUMMARY_WRITE_SKILL_NAME,
      SUMMARY_REPAIR_SKILL_NAME
    ])
    expect(await fs.exists('/vault/AI/skills/create-skill/SKILL.md')).toBe(true)
    expect(await fs.exists('/vault/AI/skills/diary-append/SKILL.md')).toBe(true)
    expect(await fs.exists('/vault/AI/skills/summary-write/SKILL.md')).toBe(true)
    expect(await fs.exists('/vault/AI/skills/summary-repair/SKILL.md')).toBe(true)
    expect(await fs.readFile('/vault/AI/skills/create-skill/SKILL.md')).toContain(
      CREATE_SKILL_GUIDE_PROMPT.trim()
    )
  })

  it('should keep existing software create-skill content when description already matches', async () => {
    const fs = createMemoryFs()
    for (const skill of DEFAULT_AGENT_SKILLS) {
      await fs.mkdir(`/vault/AI/skills/${skill.name}`, { recursive: true })
      await fs.writeFile(
        `/vault/AI/skills/${skill.name}/SKILL.md`,
        serializeSkillMarkdown({
          name: skill.name,
          description: skill.description,
          content: skill.name === CREATE_SKILL_SLASH_COMMAND ? 'custom body' : skill.content
        })
      )
    }

    const written = await ensureMobileDefaultSkills('/vault', fs)

    expect(written).toEqual([])
    expect(await fs.readFile('/vault/AI/skills/create-skill/SKILL.md')).toContain('custom body')
  })

  it('should refresh description and keep content when the software copy description differs', async () => {
    const fs = createMemoryFs()
    for (const skill of DEFAULT_AGENT_SKILLS) {
      await fs.mkdir(`/vault/AI/skills/${skill.name}`, { recursive: true })
      await fs.writeFile(
        `/vault/AI/skills/${skill.name}/SKILL.md`,
        serializeSkillMarkdown({
          name: skill.name,
          description: skill.name === CREATE_SKILL_SLASH_COMMAND ? 'old-desc' : skill.description,
          content: skill.name === CREATE_SKILL_SLASH_COMMAND ? 'keep this body' : skill.content
        })
      )
    }

    const written = await ensureMobileDefaultSkills('/vault', fs)

    expect(written).toEqual([CREATE_SKILL_SLASH_COMMAND])
    const markdown = await fs.readFile('/vault/AI/skills/create-skill/SKILL.md')
    expect(markdown).toContain(`description: ${CREATE_SKILL_SLASH_COMMAND}`)
    expect(markdown).toContain('keep this body')
  })

  it('should upgrade an untouched bundled skill body when the bundled content changed', async () => {
    const fs = createMemoryFs()
    const target = DEFAULT_AGENT_SKILLS.find((skill) => skill.name === SUMMARY_WRITE_SKILL_NAME)!
    await fs.mkdir(`/vault/AI/skills/${target.name}`, { recursive: true })
    await fs.writeFile(
      `/vault/AI/skills/${target.name}/SKILL.md`,
      serializeSkillMarkdown({
        name: target.name,
        description: target.description,
        content: '旧版内置正文',
        bundledHash: 'deadbeef'
      })
    )

    const written = await ensureMobileDefaultSkills('/vault', fs)

    expect(written).toContain(target.name)
    const markdown = await fs.readFile(`/vault/AI/skills/${target.name}/SKILL.md`)
    expect(markdown).toContain(target.content.slice(0, 20))
    expect(markdown).not.toContain('旧版内置正文')
  })

  it('should keep a user-owned skill body even when it has no bundled hash', async () => {
    const fs = createMemoryFs()
    const target = DEFAULT_AGENT_SKILLS.find((skill) => skill.name === SUMMARY_WRITE_SKILL_NAME)!
    await fs.mkdir(`/vault/AI/skills/${target.name}`, { recursive: true })
    await fs.writeFile(
      `/vault/AI/skills/${target.name}/SKILL.md`,
      serializeSkillMarkdown({
        name: target.name,
        description: target.description,
        content: '我自己的改写正文'
      })
    )

    await ensureMobileDefaultSkills('/vault', fs)

    expect(await fs.readFile(`/vault/AI/skills/${target.name}/SKILL.md`)).toContain(
      '我自己的改写正文'
    )
  })

  it('should not write when the vault root is empty', async () => {
    const fs = createMemoryFs()
    const written = await ensureMobileDefaultSkills('  ', fs)

    expect(written).toEqual([])
    expect(await fs.exists('/vault/AI/skills/create-skill/SKILL.md')).toBe(false)
  })

  it('should not overwrite a user copy under .agents/skills', async () => {
    const fs = createMemoryFs()
    await writeMobileUserSkill(
      '/vault',
      {
        name: CREATE_SKILL_SLASH_COMMAND,
        description: 'user create-skill',
        content: 'user body'
      },
      fs
    )

    await ensureMobileDefaultSkills('/vault', fs)

    expect(await fs.readFile('/vault/.agents/skills/create-skill/SKILL.md')).toContain('user body')
    expect(await fs.exists('/vault/AI/skills/create-skill/SKILL.md')).toBe(true)
  })

  it('should make readMobileSkill return create-skill after ensure', async () => {
    const fs = createMemoryFs()
    await ensureMobileDefaultSkills('/vault', fs)

    const skill = await readMobileSkill('/vault', CREATE_SKILL_SLASH_COMMAND, fs)
    expect(skill?.name).toBe(CREATE_SKILL_SLASH_COMMAND)
    expect(skill?.content).toContain('Guide me to create a software-level Skill')
    expect(skill?.location).toBe('/vault/AI/skills/create-skill/SKILL.md')
  })
})
