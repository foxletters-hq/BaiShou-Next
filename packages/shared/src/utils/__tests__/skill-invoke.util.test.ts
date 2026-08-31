import { describe, expect, it } from 'vitest'
import { CREATE_SKILL_SLASH_COMMAND } from '../create-skill-guide.util'
import {
  buildSkillInvocationBody,
  buildSkillSendText,
  composerExtraPlain
} from '../skill-invoke.util'

describe('skill-invoke.util', () => {
  it('wraps a skill body as an immediate invocation', () => {
    expect(buildSkillInvocationBody({ command: 'daily-news-digest', content: '先搜索再写入' })).toBe(
      [
        '用户已启用技能「daily-news-digest」。现在按下列说明执行；不要复述或改写技能文件，除非说明要求这样做。',
        '',
        '先搜索再写入'
      ].join('\n')
    )
  })

  it('still asks the model to run a skill when body is missing', () => {
    expect(buildSkillInvocationBody({ command: 'daily-news-digest', content: '' })).toContain(
      '请读取该技能的 SKILL.md 后立即执行'
    )
  })

  it('does not wrap create-skill guide text', () => {
    expect(
      buildSkillInvocationBody({ command: CREATE_SKILL_SLASH_COMMAND, content: '请引导我创建' })
    ).toBe('请引导我创建')
  })

  it('joins invocation bodies with extra user text', () => {
    expect(
      buildSkillSendText([{ command: 'writer', content: '先看目录' }], '只要设定')
    ).toContain('只要设定')
  })

  it('strips skill chip labels from composer plain text', () => {
    expect(composerExtraPlain('/daily-news-digest 只要科技', [{ command: 'daily-news-digest' }])).toBe(
      '只要科技'
    )
  })
})
