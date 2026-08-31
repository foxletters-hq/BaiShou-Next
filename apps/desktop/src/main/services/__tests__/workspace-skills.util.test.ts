import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { serializeSkillMarkdown } from '@baishou/shared'
import { SKILL_FILE_NAME } from '../agent-skills.util'
import { listWorkspaceSkillsFromFolder } from '../workspace-skills.util'

async function writeSkill(
  root: string,
  folder: 'skill' | 'skills' | '.agents/skills',
  name: string,
  markdown: string
): Promise<void> {
  const dir = path.join(root, ...folder.split('/'), name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, SKILL_FILE_NAME), markdown, 'utf-8')
}

describe('listWorkspaceSkillsFromFolder', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-skills-'))
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('reads skill and skills folders and lets skills override the same name', async () => {
    await writeSkill(
      root,
      'skill',
      'alpha',
      serializeSkillMarkdown({
        name: 'alpha',
        description: 'from-skill',
        content: 'skill-body'
      })
    )
    await writeSkill(
      root,
      'skills',
      'alpha',
      serializeSkillMarkdown({
        name: 'alpha',
        description: 'from-skills',
        content: 'skills-body'
      })
    )
    await writeSkill(root, 'skill', 'beta', '没有 properties 的正文')

    const listed = await listWorkspaceSkillsFromFolder(root)
    expect(listed.map((item) => item.name)).toEqual(['alpha', 'beta'])
    expect(listed[0]).toMatchObject({
      name: 'alpha',
      description: 'from-skills',
      content: 'skills-body',
      source: 'workspace'
    })
    expect(listed[1]).toMatchObject({
      name: 'beta',
      description: 'beta',
      content: '没有 properties 的正文',
      source: 'workspace'
    })
  })

  it('lets .agents/skills override skill and skills with the same name', async () => {
    await writeSkill(
      root,
      'skills',
      'alpha',
      serializeSkillMarkdown({
        name: 'alpha',
        description: 'from-skills',
        content: 'skills-body'
      })
    )
    await writeSkill(
      root,
      '.agents/skills',
      'alpha',
      serializeSkillMarkdown({
        name: 'alpha',
        description: 'from-agents',
        content: 'agents-body'
      })
    )

    const listed = await listWorkspaceSkillsFromFolder(root)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({
      name: 'alpha',
      description: 'from-agents',
      content: 'agents-body',
      source: 'workspace'
    })
  })

  it('reads properties header in .agents/skills without yaml fences', async () => {
    await writeSkill(
      root,
      '.agents/skills',
      'daily-news-digest',
      'name: daily-news-digest\ndescription: 整理当天新闻\n\n# 简报\n'
    )

    const listed = await listWorkspaceSkillsFromFolder(root)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({
      name: 'daily-news-digest',
      description: '整理当天新闻',
      content: '# 简报',
      source: 'workspace'
    })
  })

  it('ignores invalid names and nested folders outside skill/skills', async () => {
    await writeSkill(root, 'skill', 'NotValid', 'skip')
    await fs.mkdir(path.join(root, 'nested', 'skills', 'gamma'), { recursive: true })
    await fs.writeFile(
      path.join(root, 'nested', 'skills', 'gamma', SKILL_FILE_NAME),
      serializeSkillMarkdown({
        name: 'gamma',
        description: 'nested',
        content: 'should-not-appear'
      }),
      'utf-8'
    )

    const listed = await listWorkspaceSkillsFromFolder(root)
    expect(listed).toEqual([])
  })
})
