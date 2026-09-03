import { describe, expect, it } from 'vitest'
import {
  applyDiaryTemplateVars,
  resolveDiaryAiWritingPrompt,
  resolveDiaryAppendBlock,
  resolveDiaryNewEntryContent,
  buildDiaryWritingGuidelinesForSystemPrompt,
  buildDiaryFormatRulesFromTemplates,
  previewDiaryAgentWritingGuidelines,
  joinDiaryContentWithAppendBlock,
  resolveDiaryWritingStyleSupplement
} from '../diary-template.util'
import { LEGACY_DEFAULT_DIARY_AI_WRITING_PROMPT } from '../../constants/diary-templates'

describe('diary-template.util', () => {
  const fixedDate = new Date('2026-06-11T15:30:45')

  it('replaces template variables', () => {
    expect(applyDiaryTemplateVars('##### {time} on {date} ({datetime})', fixedDate)).toBe(
      '##### 15:30 on 2026-06-11 (2026-06-11 15:30)'
    )
  })

  it('uses defaults when config is empty', () => {
    expect(resolveDiaryNewEntryContent({}, fixedDate)).toBe('##### 15:30\n\n\u200B')
    expect(resolveDiaryAppendBlock({}, fixedDate)).toBe('\n\n##### 15:30\n\n\u200B')
  })

  it('uses custom templates from config', () => {
    const content = resolveDiaryNewEntryContent({ newEntryTemplate: '## {time}' }, fixedDate)
    expect(content).toBe('## 15:30')
  })

  it('derives format rules from templates without legacy default prompt', () => {
    const rules = buildDiaryFormatRulesFromTemplates(
      { appendBlockTemplate: '## {time}' },
      fixedDate
    )
    expect(rules).toContain('## {time}')
    expect(rules).toContain('## 15:30')
    expect(rules).not.toContain(LEGACY_DEFAULT_DIARY_AI_WRITING_PROMPT)
  })

  it('migrates legacy aiWritingPrompt to supplement', () => {
    expect(resolveDiaryWritingStyleSupplement({ aiWritingPrompt: '用第一人称记录' })).toBe(
      '用第一人称记录'
    )
    expect(resolveDiaryWritingStyleSupplement({})).toBe('')
    expect(
      resolveDiaryWritingStyleSupplement({
        aiWritingPrompt: LEGACY_DEFAULT_DIARY_AI_WRITING_PROMPT
      })
    ).toBe('')
  })

  it('builds system prompt guidelines with template and optional supplement', () => {
    const guidelines = buildDiaryWritingGuidelinesForSystemPrompt(
      {
        appendBlockTemplate: '###### {time}',
        writingStyleSupplement: '语气轻松一些'
      },
      fixedDate
    )
    expect(guidelines).toContain('###### {time}')
    expect(guidelines).toContain('语气轻松一些')
    expect(guidelines).toContain('diary_edit 追加模式')
    expect(guidelines).toContain('diary_write 新建日记')
    expect(guidelines).toContain('日记正文由你完整编写')
    expect(guidelines).toContain('系统不会自动添加、识别、删除或改写时间标题')
    expect(guidelines).toContain('系统只会把 content 作为新段落追加')
    expect(guidelines).toContain('工具不提供独立的标签参数')
    expect(guidelines).not.toContain('系统会自动按上述模板插入')
  })

  it('preview uses draft templates before save', () => {
    const preview = previewDiaryAgentWritingGuidelines({
      newEntryTemplate: '###### {time}\n\n',
      appendBlockTemplate: '\n\n###### {time}\n\n'
    })
    expect(preview).toContain('###### {time}')
  })

  it('resolveDiaryAiWritingPrompt returns full guidelines', () => {
    const prompt = resolveDiaryAiWritingPrompt({ appendBlockTemplate: '## {time}' }, fixedDate)
    expect(prompt).toContain('diary_write 新建日记')
  })

  it('编辑器追加模板时保留模板的前导空行', () => {
    expect(joinDiaryContentWithAppendBlock('已有正文', '\n\n##### 12:00:00\n\n')).toBe(
      '已有正文\n\n##### 12:00:00\n\n'
    )
  })
})
