import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'UserMessageSkillContent.tsx'),
  'utf8'
)

describe('desktop user message body chrome', () => {
  it('should keep user text as a plain div when there is no skill or file cite', () => {
    expect(src).toContain('return <div className={className}>{text}</div>')
    expect(src).not.toContain('AgentMarkdownRenderer')
    expect(src).not.toContain('fitMarkdown')
  })
})
