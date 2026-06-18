import { describe, expect, it } from 'vitest'
import {
  applyDiaryTemplateVars,
  resolveDiaryAiWritingPrompt,
  resolveDiaryAppendBlock,
  resolveDiaryNewEntryContent,
  buildDiaryWritingGuidelinesForSystemPrompt
} from '../diary-template.util'
import { DEFAULT_DIARY_AI_WRITING_PROMPT } from '../../constants/diary-templates'

describe('diary-template.util', () => {
  const fixedDate = new Date('2026-06-11T15:30:45')

  it('replaces template variables', () => {
    expect(applyDiaryTemplateVars('##### {time} on {date} ({datetime})', fixedDate)).toBe(
      '##### 15:30:45 on 2026-06-11 (2026-06-11 15:30:45)'
    )
  })

  it('uses defaults when config is empty', () => {
    expect(resolveDiaryNewEntryContent({}, fixedDate)).toBe('##### 15:30:45\n\n\u200B')
    expect(resolveDiaryAppendBlock({}, fixedDate)).toBe('\n\n##### 15:30:45\n\n\u200B')
  })

  it('uses custom templates from config', () => {
    const content = resolveDiaryNewEntryContent({ newEntryTemplate: '## {time}' }, fixedDate)
    expect(content).toBe('## 15:30:45')
  })

  it('falls back to default AI writing prompt', () => {
    expect(resolveDiaryAiWritingPrompt({})).toBe(DEFAULT_DIARY_AI_WRITING_PROMPT)
    expect(resolveDiaryAiWritingPrompt({ aiWritingPrompt: 'custom' })).toBe('custom')
  })

  it('builds system prompt guidelines with append template info', () => {
    const guidelines = buildDiaryWritingGuidelinesForSystemPrompt(
      { appendBlockTemplate: '## {time}' },
      fixedDate
    )
    expect(guidelines).toContain(DEFAULT_DIARY_AI_WRITING_PROMPT)
    expect(guidelines).toContain('## {time}')
    expect(guidelines).toContain('## 15:30:45')
    expect(guidelines).toContain('diary_edit 追加模式')
  })
})
