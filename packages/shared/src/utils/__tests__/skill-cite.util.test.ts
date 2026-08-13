import { describe, expect, it } from 'vitest'
import {
  normalizeSkillCiteRefs,
  resolveUserSkillDisplay,
  splitTextBySkillRefs
} from '../skill-cite.util'

describe('skill-cite.util', () => {
  it('splits display text by skill refs in order', () => {
    const segments = splitTextBySkillRefs('请用 /translate 再 /summarize 一下', [
      { command: 'translate', content: '翻译正文' },
      { command: 'summarize', content: '摘要正文' }
    ])
    expect(segments).toEqual([
      { type: 'text', value: '请用 ' },
      { type: 'skill', command: 'translate', content: '翻译正文' },
      { type: 'text', value: ' 再 ' },
      { type: 'skill', command: 'summarize', content: '摘要正文' },
      { type: 'text', value: ' 一下' }
    ])
  })

  it('returns plain text when no refs', () => {
    expect(splitTextBySkillRefs('hello', [])).toEqual([{ type: 'text', value: 'hello' }])
  })

  it('normalizes leading slash on commands', () => {
    expect(normalizeSkillCiteRefs([{ command: '/foo', content: 'x' }])).toEqual([
      { command: 'foo', content: 'x' }
    ])
  })

  it('shows cite chips from skillRefs even when body is expanded skill content', () => {
    const expanded = '请引导我创建一个软件级 Skill……'
    const resolved = resolveUserSkillDisplay(expanded, [
      { command: 'create-skill', content: expanded }
    ])
    expect(resolved.text).toBe('/create-skill')
    expect(resolved.segments).toEqual([
      { type: 'skill', command: 'create-skill', content: expanded }
    ])
  })

  it('shows cite chips from skillRefs alone without requiring /command in text', () => {
    const resolved = resolveUserSkillDisplay('', [
      { command: 'translate', content: '翻译指南' }
    ])
    expect(resolved.segments).toEqual([
      { type: 'skill', command: 'translate', content: '翻译指南' }
    ])
  })
})
