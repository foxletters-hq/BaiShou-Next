import { describe, expect, it } from 'vitest'
import { buildNativeComposerSend, isSkillShortcut } from '../composer-send-meta.util'

describe('buildNativeComposerSend', () => {
  it('should expand skill content for the model and keep slash text for display', () => {
    const result = buildNativeComposerSend({
      text: '/summarize 帮我看这封信',
      skillRefs: [{ command: 'summarize', content: '请总结要点' }],
      attachments: []
    })
    expect(result.meta?.displayText).toContain('/summarize')
    expect(result.modelText).toContain('请总结要点')
    expect(result.modelText).toContain('帮我看这封信')
  })

  it('should treat software shortcuts as skills', () => {
    expect(isSkillShortcut({ id: 'a', content: 'x', command: 'a', source: 'software' })).toBe(true)
    expect(isSkillShortcut({ id: 'b', content: 'y' })).toBe(false)
  })

  it('should attach fileRefs from non-image attachments', () => {
    const result = buildNativeComposerSend({
      text: '看这个附件',
      skillRefs: [],
      attachments: [
        {
          id: '1',
          fileName: 'notes.md',
          filePath: 'notes.md',
          relativePath: 'notes.md',
          isImage: false,
          isPdf: false
        },
        {
          id: '2',
          fileName: 'shot.png',
          filePath: 'shot.png',
          relativePath: 'shot.png',
          isImage: true,
          isPdf: false
        }
      ]
    })
    expect(result.meta?.fileRefs).toEqual([
      expect.objectContaining({ relativePath: 'notes.md' })
    ])
    expect(result.meta?.displayText).toContain('看这个附件')
  })
})
