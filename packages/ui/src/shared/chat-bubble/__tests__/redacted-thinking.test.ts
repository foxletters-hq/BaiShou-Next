import { describe, it, expect } from 'vitest'
import { parseRedactedThinking } from '../redacted-thinking'

const OPEN_REDacted = '<' + 'redacted_thinking>'
const CLOSE_REDacted = '<' + '/redacted_thinking>'

describe('parseRedactedThinking', () => {
  it('extracts redacted_thinking blocks and sanitizes leaked metadata', () => {
    const content = `${OPEN_REDacted}\n推理\n${CLOSE_REDacted}\n<message-content>正式回复</message-content>`
    const result = parseRedactedThinking(content)

    expect(result.cleanReasoning).toBe('推理')
    expect(result.cleanContent).toBe('正式回复')
  })

  it('sanitizes metadata-only assistant text', () => {
    const content =
      '</thinking>\n<message-time>2026-02-10 14:20</message-time>\n<message-content>好的，这个问题我们已经定位到了。</message-content>'
    const result = parseRedactedThinking(content, '已有推理')

    expect(result.cleanReasoning).toBe('已有推理')
    expect(result.cleanContent).toBe('好的，这个问题我们已经定位到了。')
  })

  it('moves content after close tag in reasoning stream back to body', () => {
    const reasoning = `Let me summarize Jan-May.${CLOSE_REDacted}好的，我把一月到五月的月度总结都翻出来了。`
    const content = '🗓️ 前五个月速览'
    const result = parseRedactedThinking(content, reasoning)

    expect(result.cleanReasoning).toBe('Let me summarize Jan-May.')
    expect(result.cleanContent).toContain('好的，我把一月到五月的月度总结都翻出来了。')
    expect(result.cleanContent).toContain('🗓️ 前五个月速览')
    expect(result.cleanReasoning).not.toContain(CLOSE_REDacted)
    expect(result.cleanReasoning).not.toContain('好的')
  })

  it('strips leading close tag from text stream when thinking lived in reasoning channel', () => {
    const reasoning = 'English planning for the reply.'
    const content = `${CLOSE_REDacted}\n好的，开头段落。\n\n## 标题`
    const result = parseRedactedThinking(content, reasoning)

    expect(result.cleanReasoning).toBe('English planning for the reply.')
    expect(result.cleanContent).toContain('好的，开头段落。')
    expect(result.cleanContent).toContain('## 标题')
    expect(result.cleanContent).not.toContain(CLOSE_REDacted)
  })

  it('keeps mid-content dialogue after accidental unclosed think tag', () => {
    const content = `**拉提：** 今天的两项模块边界已经梳理完成，排版和细节效果非常好。${OPEN_REDacted}现在是不是可以专心检查界面细节、然后发版本啦？changelog还在等呢 (´・ω・\`)`
    const result = parseRedactedThinking(content, '')

    expect(result.cleanContent).toContain('非常好')
    expect(result.cleanContent).toContain('现在是不是可以专心检查界面细节')
    expect(result.cleanContent).toContain('changelog还在等呢')
    expect(result.cleanReasoning).toBe('')
  })

  it('unwraps mid-content closed think block inline instead of hiding in reasoning', () => {
    const content = `前缀段落。${OPEN_REDacted}后续对话${CLOSE_REDacted}`
    const result = parseRedactedThinking(content, '')

    expect(result.cleanContent).toBe('前缀段落。后续对话')
    expect(result.cleanReasoning).toBe('')
  })

  it('extracts leading think blocks into reasoning for completed messages', () => {
    const content = `${OPEN_REDacted}
"的人"升级成了"需要我认真对待的合作者"。

她抬起头看了看屏幕上的进度条。
${CLOSE_REDacted}

**拉提：** 今天的两项模块边界已经梳理完成。`
    const result = parseRedactedThinking(content, '', { extractContentThinkTags: true })

    expect(result.cleanReasoning).toContain('她抬起头')
    expect(result.cleanContent).not.toContain('她抬起头')
    expect(result.cleanContent).toContain('**拉提：**')
  })

  it('sanitizes malformed nested message-time tags from fixture regression', () => {
    const content =
      '</thinking>\n<message-time>2026-02-10 16:40</message-time>\n<message-content>\n<message-time>2026-02-10 16:40</time>\n明白，先按照这个方案推进第一阶段。'
    const result = parseRedactedThinking(content, 'the milestone still matters.')

    expect(result.cleanReasoning).toBe('the milestone still matters.')
    expect(result.cleanContent).toBe('明白，先按照这个方案推进第一阶段。')
  })
})
