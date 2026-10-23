import { describe, expect, it } from 'vitest'
import { EmojiSendTool } from '../tools/emoji-send.tool'
import type { ToolContext } from '../tools/agent.tool'

const emojis = [{ id: 'happy.png', name: 'happy', relativePath: 'emojis/happy.png' }]

function buildDescription(frequency?: string): string {
  const tool = new EmojiSendTool()
  const vercelTool = tool.toVercelTool({
    sessionId: 'session-1',
    vaultId: 'vault-1',
    vaultName: 'test',
    userConfig: {
      emojiConfig: {
        enabled: true,
        frequency,
        emojis
      }
    }
  } as ToolContext)

  return vercelTool.description as string
}

describe('EmojiSendTool frequency guidance', () => {
  it('defaults to balanced guidance when frequency is missing', () => {
    const description = buildDescription()
    expect(description).toContain('Frequency preference: BALANCED')
    expect(description).not.toContain('EVERY REPLY')
  })

  it('tells the model to send a sticker in every reply when configured', () => {
    const description = buildDescription('always')
    expect(description).toContain('Frequency preference: EVERY REPLY')
  })

  it('scales the guidance for low and high frequencies', () => {
    expect(buildDescription('low')).toContain('Frequency preference: RARELY')
    expect(buildDescription('high')).toContain('Frequency preference: OFTEN')
  })

  it('still lists available stickers and enforces one sticker per reply', () => {
    const description = buildDescription('always')
    expect(description).toContain('- happy: happy')
    expect(description).toContain('at most once per turn')
    expect(description).toContain('at most one sticker per reply')
  })
})
