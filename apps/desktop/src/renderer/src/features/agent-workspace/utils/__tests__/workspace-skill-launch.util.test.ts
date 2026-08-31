import { describe, expect, it } from 'vitest'
import {
  buildSkillSendMeta,
  ensureOfficialCreateSkill,
  isSkillNameLockedForEdit,
  matchesWorkbenchSkillSearch,
  orderSkillLaunchWorkspaces,
  omitHiddenBundledTemplateSkills,
  partitionWorkbenchSkills,
  resolveScopedWorkbenchSkills,
  resolveSkillEditScope,
  resolveWorkbenchSkillSection,
  resolveWorkbenchSkillsPageTab
} from '../workspace-skill-launch.util'

describe('workspace-skill-launch.util', () => {
  it('builds the same payload as a composer skill chip', () => {
    const payload = buildSkillSendMeta({
      name: 'writer',
      content: '请先检查目录\n\n同意后再创建'
    })
    expect(payload.displayText).toBe('/writer')
    expect(payload.text).toContain('用户已启用技能「writer」')
    expect(payload.text).toContain('请先检查目录\n\n同意后再创建')
    expect(payload.skillRefs).toEqual([
      { command: 'writer', content: '请先检查目录\n\n同意后再创建' }
    ])
  })

  it('filters skill cards by name, title, or description', () => {
    const writer = {
      name: 'writer',
      title: '作家',
      description: '搭建设定、素材与小说目录'
    }
    expect(matchesWorkbenchSkillSearch('', writer)).toBe(true)
    expect(matchesWorkbenchSkillSearch('作家', writer)).toBe(true)
    expect(matchesWorkbenchSkillSearch('WRITER', writer)).toBe(true)
    expect(matchesWorkbenchSkillSearch('素材', writer)).toBe(true)
    expect(matchesWorkbenchSkillSearch('mcp', writer)).toBe(false)
  })

  it('splits official, user, and project skills into separate sections', () => {
    expect(resolveWorkbenchSkillSection('software')).toBe('official')
    expect(resolveWorkbenchSkillSection(undefined)).toBe('official')
    expect(resolveWorkbenchSkillSection('user')).toBe('user')
    expect(resolveWorkbenchSkillSection('user', 'create-skill')).toBe('official')
    expect(resolveWorkbenchSkillSection('workspace', 'create-skill')).toBe('project')
    expect(resolveWorkbenchSkillSection('workspace')).toBe('project')

    const partitioned = partitionWorkbenchSkills([
      { name: 'writer', source: 'software' as const },
      { name: 'create-skill', source: 'user' as const },
      { name: 'daily-digest', source: 'user' as const },
      { name: 'repo-review', source: 'workspace' as const }
    ])
    expect(partitioned.official.map((item) => item.name)).toEqual(['writer', 'create-skill'])
    expect(partitioned.user.map((item) => item.name)).toEqual(['daily-digest'])
    expect(partitioned.project.map((item) => item.name)).toEqual(['repo-review'])
  })

  it('keeps create-skill in the official list even when the file is missing', () => {
    const fallback = { name: 'create-skill', source: 'software' as const }
    expect(ensureOfficialCreateSkill([], fallback)).toEqual([fallback])
    expect(
      ensureOfficialCreateSkill([{ name: 'create-skill', source: 'user' as const }], fallback)
    ).toEqual([{ name: 'create-skill', source: 'user', description: 'create-skill' }])
    expect(
      ensureOfficialCreateSkill([{ name: 'translate', source: 'software' as const }], fallback).map(
        (item) => item.name
      )
    ).toEqual(['create-skill', 'translate'])
  })

  it('saves official and user skills as user overlays, workspace skills in the project', () => {
    expect(resolveSkillEditScope('software')).toBe('user')
    expect(resolveSkillEditScope(undefined)).toBe('user')
    expect(resolveSkillEditScope('user')).toBe('user')
    expect(resolveSkillEditScope('workspace')).toBe('workspace')
    expect(isSkillNameLockedForEdit('software')).toBe(true)
    expect(isSkillNameLockedForEdit(undefined)).toBe(true)
    expect(isSkillNameLockedForEdit('user')).toBe(false)
    expect(isSkillNameLockedForEdit('workspace')).toBe(false)
  })

  it('shows user skills for the global scope and only workspace skills for a project', () => {
    const writer = { name: 'writer', source: 'software' as const }
    const daily = { name: 'daily-digest', source: 'user' as const }
    const review = { name: 'repo-review', source: 'workspace' as const }
    expect(
      resolveScopedWorkbenchSkills({
        scope: 'global',
        userSkills: [daily],
        projectSkills: [review, writer]
      }).map((item) => item.name)
    ).toEqual(['daily-digest'])
    expect(
      resolveScopedWorkbenchSkills({
        scope: 'project',
        userSkills: [daily],
        projectSkills: [review, writer, daily]
      }).map((item) => item.name)
    ).toEqual(['repo-review'])
  })

  it('hides the writing template from regular skill lists', () => {
    expect(resolveWorkbenchSkillsPageTab(null)).toBe('skill')
    expect(resolveWorkbenchSkillsPageTab('template')).toBe('template')
    expect(resolveWorkbenchSkillsPageTab('mcp')).toBe('mcp')
    expect(
      omitHiddenBundledTemplateSkills([
        { name: 'story-init', source: 'software' as const },
        { name: 'writer', source: 'software' as const },
        { name: 'writer', source: 'user' as const },
        { name: 'writer', source: 'workspace' as const },
        { name: 'translate', source: 'software' as const },
        { name: 'summarize', source: 'software' as const },
        { name: 'translate', source: 'user' as const },
        { name: 'create-skill', source: 'software' as const }
      ]).map((item) => `${item.source}:${item.name}`)
    ).toEqual([
      'software:writer',
      'user:writer',
      'workspace:writer',
      'user:translate',
      'software:create-skill'
    ])
  })

  it('puts the currently viewed project first when choosing where to use a skill', () => {
    expect(
      orderSkillLaunchWorkspaces(
        [
          { id: 'a', name: 'Alpha' },
          { id: 'b', name: 'Beta' },
          { id: 'c', name: 'Gamma' }
        ],
        'b'
      ).map((item) => item.id)
    ).toEqual(['b', 'a', 'c'])
    expect(orderSkillLaunchWorkspaces([{ id: 'a' }, { id: 'b' }], 'missing').map((item) => item.id)).toEqual([
      'a',
      'b'
    ])
  })
})
