import { describe, expect, it } from 'vitest'
import * as path from 'path'
import { resolveAppInstallRoot } from '../agent-workspace-scratch.util'
import {
  AI_ROOT_DIR_NAME,
  AI_SKILLS_DIR_NAME,
  AGENTS_DIR_NAME,
  LEGACY_WRITER_SKILL_REMOVED_FLAG_KEY,
  NON_OFFICIAL_SKILLS_RELOCATED_FLAG_KEY,
  RETIRED_OFFICIAL_SKILLS_REMOVED_FLAG_KEY,
  WORKSPACE_SKILL_FOLDER_NAMES,
  WORKSPACE_SKILL_RELATIVE_DIRS,
  resolveAgentsSkillsRoot,
  resolveAiSkillsRoot,
  resolveSkillDir,
  resolveSkillFile
} from '../agent-skills.util'

describe('agent-skills.util', () => {
  it('resolves AI/skills under install root when available', () => {
    expect(
      resolveAiSkillsRoot({
        installRoot: 'D:/Apps/BaiShou',
        userDataRoot: 'C:/Users/me/AppData/BaiShou'
      })
    ).toBe(path.join('D:/Apps/BaiShou', AI_ROOT_DIR_NAME, AI_SKILLS_DIR_NAME))
  })

  it('falls back to userData when install root missing', () => {
    expect(
      resolveAiSkillsRoot({
        installRoot: null,
        userDataRoot: 'C:/Users/me/AppData/BaiShou'
      })
    ).toBe(path.join('C:/Users/me/AppData/BaiShou', AI_ROOT_DIR_NAME, AI_SKILLS_DIR_NAME))
  })

  it('builds skill file path', () => {
    const skillsRoot = resolveAiSkillsRoot({
      installRoot: '/app',
      userDataRoot: '/data'
    })
    expect(resolveSkillDir(skillsRoot, 'translate')).toBe(path.join(skillsRoot, 'translate'))
    expect(resolveSkillFile(skillsRoot, 'translate')).toBe(
      path.join(skillsRoot, 'translate', 'SKILL.md')
    )
  })

  it('resolves .agents/skills under a base directory', () => {
    expect(resolveAgentsSkillsRoot('D:/proj')).toBe(
      path.join('D:/proj', AGENTS_DIR_NAME, 'skills')
    )
  })

  it('scans skill, skills, then .agents/skills under the workspace root', () => {
    expect(WORKSPACE_SKILL_FOLDER_NAMES).toEqual(['skill', 'skills'])
    expect(WORKSPACE_SKILL_RELATIVE_DIRS).toEqual([
      ['skill'],
      ['skills'],
      ['.agents', 'skills']
    ])
  })

  it('keeps shortcut migration and official-to-user relocation as separate flags', () => {
    expect(NON_OFFICIAL_SKILLS_RELOCATED_FLAG_KEY).toBe('non_official_skills_relocated_to_agents_v1')
    expect(LEGACY_WRITER_SKILL_REMOVED_FLAG_KEY).toBe('legacy_writer_skill_removed_v1')
    expect(RETIRED_OFFICIAL_SKILLS_REMOVED_FLAG_KEY).toBe('retired_official_skills_removed_v1')
  })

  it('resolveAppInstallRoot still works for packaged exe dir', () => {
    expect(
      resolveAppInstallRoot({
        isPackaged: true,
        exePath: 'D:/Apps/BaiShou/BaiShou.exe',
        appPath: 'D:/Apps/BaiShou/resources/app.asar'
      }).replace(/\\/g, '/')
    ).toBe('D:/Apps/BaiShou')
  })
})
