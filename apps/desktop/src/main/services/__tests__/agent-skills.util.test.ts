import * as path from 'path'
import { resolveAppInstallRoot } from '../agent-workspace-scratch.util'
import {
  AI_ROOT_DIR_NAME,
  AI_SKILLS_DIR_NAME,
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
