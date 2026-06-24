import { describe, expect, it } from 'vitest'
import {
  applyDiaryTemplateVars,
  resolveDiaryAiWritingPrompt,
  resolveDiaryAppendBlock,
  resolveDiaryNewEntryContent,
  buildDiaryWritingGuidelinesForSystemPrompt,
  buildDiaryFormatRulesFromTemplates,
  previewDiaryAgentWritingGuidelines,
  prepareDiaryAppendContent,
  prepareDiaryWriteContent,
  joinDiaryContentWithAppendBlock,
  resolveDiaryWritingStyleSupplement,
  stripLeadingDiaryTimestampHeading
} from '../diary-template.util'
import { LEGACY_DEFAULT_DIARY_AI_WRITING_PROMPT } from '../../constants/diary-templates'

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

  it('derives format rules from templates without legacy default prompt', () => {
    const rules = buildDiaryFormatRulesFromTemplates(
      { appendBlockTemplate: '## {time}' },
      fixedDate
    )
    expect(rules).toContain('## {time}')
    expect(rules).toContain('## 15:30:45')
    expect(rules).not.toContain(LEGACY_DEFAULT_DIARY_AI_WRITING_PROMPT)
  })

  it('migrates legacy aiWritingPrompt to supplement', () => {
    expect(
      resolveDiaryWritingStyleSupplement({ aiWritingPrompt: '用第一人称记录' })
    ).toBe('用第一人称记录')
    expect(resolveDiaryWritingStyleSupplement({})).toBe('')
    expect(
      resolveDiaryWritingStyleSupplement({ aiWritingPrompt: LEGACY_DEFAULT_DIARY_AI_WRITING_PROMPT })
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

  it('prepareDiaryWriteContent prepends new entry template when heading is missing', () => {
    const config = { newEntryTemplate: '###### {time}\n\n\u200B' }
    expect(prepareDiaryWriteContent('今天很开心', config, fixedDate)).toBe(
      '###### 15:30:45\n\n今天很开心'
    )
  })

  it('prepareDiaryAppendContent uses append template and strips duplicate heading', () => {
    const config = { appendBlockTemplate: '\n\n###### {time}\n\n\u200B' }
    expect(
      prepareDiaryAppendContent('已有正文', '###### 15:30:45\n\n新增内容', config, fixedDate)
    ).toBe('已有正文\n\n###### 15:30:45\n\n新增内容')
  })

  it('prepareDiaryAppendContent inserts newline when append template lacks leading breaks', () => {
    const config = { appendBlockTemplate: '###### {time}\n\n' }
    expect(
      prepareDiaryAppendContent('三个人安静地缩在一起，慢慢稳下来了。', '今天很充实', config, fixedDate)
    ).toBe('三个人安静地缩在一起，慢慢稳下来了。\n\n###### 15:30:45\n\n今天很充实')
  })

  it('joinDiaryContentWithAppendBlock preserves template leading breaks', () => {
    expect(joinDiaryContentWithAppendBlock('已有正文', '\n\n##### 12:00:00\n\n')).toBe(
      '已有正文\n\n##### 12:00:00\n\n'
    )
  })

  it('stripLeadingDiaryTimestampHeading removes h6 timestamp line', () => {
    expect(stripLeadingDiaryTimestampHeading('###### 09:01:02\n\n正文')).toBe('正文')
  })
})
