import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const agentScreenSrc = readFileSync(join(currentDir, '../../AgentScreen.tsx'), 'utf8')
const agentChatListSrc = readFileSync(join(currentDir, '../AgentChatList.tsx'), 'utf8')
const agentAppBarSrc = readFileSync(
  join(currentDir, '../../../../components/AgentChatAppBar.tsx'),
  'utf8'
)
const inputBarSrc = readFileSync(
  join(currentDir, '../../../../../../../packages/ui/src/native/InputBar/index.tsx'),
  'utf8'
)

const chatBubbleSrc = readFileSync(
  join(currentDir, '../../../../../../../packages/ui/src/native/ChatBubble/ChatBubble.tsx'),
  'utf8'
)
const metaStyleSrc = readFileSync(
  join(
    currentDir,
    '../../../../../../../packages/ui/src/shared/chat-over-background-meta.style.ts'
  ),
  'utf8'
)

describe('Agent Chat Background frosted chrome', () => {
  it('makes StatusBar translucent and ScreenSafeArea transparent when hasChatBackground is true', () => {
    expect(agentScreenSrc).toContain(
      "backgroundColor={c.hasChatBackground ? 'transparent' : c.colors.bgApp}"
    )
    expect(agentScreenSrc).toContain('translucent={c.hasChatBackground}')
    expect(agentScreenSrc).toContain("edges={c.hasChatBackground ? ['left', 'right'] : undefined}")
  })

  it('passes hasChatBackground to AgentChatAppBar and InputBar in AgentChatList', () => {
    expect(agentChatListSrc).toContain('hasChatBackground={p.hasChatBackground}')
  })

  it('passes hasChatBackground to AgentMessageRow in AgentChatList', () => {
    expect(agentChatListSrc).toContain('hasChatBackground={p.hasChatBackground}')
  })

  it('applies frosted glass styling and top inset in AgentChatAppBar when hasChatBackground is active', () => {
    expect(agentAppBarSrc).toContain('hasChatBackground?: boolean')
    expect(agentAppBarSrc).toContain('useSafeAreaInsets')
    expect(agentAppBarSrc).toContain('topInset = hasChatBackground ? insets.top : 0')
    expect(agentAppBarSrc).toContain('rgba(255, 255, 255, 0.75)')
  })

  it('renders transparent composerChrome so input card floats over wallpaper without white margins', () => {
    expect(inputBarSrc).toContain("hasChatBackground ? 'transparent' : colors.bgSurface")
    expect(inputBarSrc).toContain('hasChatBackground ? 0 : StyleSheet.hairlineWidth')
  })

  it('applies frosted glass opacity styling to ChatBubble matching composerShell when hasChatBackground is active', () => {
    expect(chatBubbleSrc).toContain(
      'getChatBubbleOverBackgroundStyle(hasBackground, isDark, colors)'
    )
    expect(metaStyleSrc).toContain('rgba(32, 33, 37, 0.85)')
    expect(metaStyleSrc).toContain('rgba(255, 255, 255, 0.88)')
    expect(metaStyleSrc).toContain('rgba(255, 255, 255, 0.16)')
    expect(metaStyleSrc).toContain('rgba(0, 0, 0, 0.10)')
  })

  it('uses clean black and white meta colors without textShadow, dropShadow, or difference blend mode', () => {
    expect(metaStyleSrc).toContain("CHAT_OVER_BG_BLACK = '#000000'")
    expect(metaStyleSrc).not.toContain('textShadowColor')
    expect(metaStyleSrc).not.toContain('shadowColor')
    expect(metaStyleSrc).not.toContain("mixBlendMode: 'difference'")
  })

  it('calculates overall background luminance once and resolves unified pure black (#000000) or pure white (#ffffff)', async () => {
    const { deflateSync } = await import('node:zlib')
    const { decodePngBase64ToLuminance, resolveChatBackgroundMetaTone } =
      await import('../../../../lib/chat-background-luminance.util')
    const { getChatOverBackgroundMetaIconColor, getChatOverBackgroundMetaTextStyle } =
      await import('../../../../../../../packages/ui/src/shared/chat-over-background-meta.style')

    const makeSolidPngBase64 = (val: number) => {
      const width = 2
      const height = 2
      const raw = Buffer.alloc(height * (1 + width * 4))
      for (let y = 0; y < height; y++) {
        const rowOffset = y * (1 + width * 4)
        raw[rowOffset] = 0 // filter: None
        for (let x = 0; x < width; x++) {
          const px = rowOffset + 1 + x * 4
          raw[px] = val
          raw[px + 1] = val
          raw[px + 2] = val
          raw[px + 3] = 255
        }
      }
      const idatData = deflateSync(raw)
      const makeChunk = (type: string, data: Buffer) => {
        const len = Buffer.alloc(4)
        len.writeUInt32BE(data.length, 0)
        const typeBuf = Buffer.from(type, 'ascii')
        const crc = Buffer.alloc(4)
        return Buffer.concat([len, typeBuf, data, crc])
      }
      const ihdr = Buffer.alloc(13)
      ihdr.writeUInt32BE(width, 0)
      ihdr.writeUInt32BE(height, 4)
      ihdr[8] = 8 // bitDepth
      ihdr[9] = 6 // RGBA
      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        makeChunk('IHDR', ihdr),
        makeChunk('IDAT', idatData),
        makeChunk('IEND', Buffer.alloc(0))
      ]).toString('base64')
    }

    const whiteLuminance = decodePngBase64ToLuminance(makeSolidPngBase64(255))
    const blackLuminance = decodePngBase64ToLuminance(makeSolidPngBase64(0))
    expect(whiteLuminance).toBe(1)
    expect(blackLuminance).toBe(0)

    const lightBgTone = resolveChatBackgroundMetaTone({
      luminance: whiteLuminance,
      overlayOpacity: 0
    })
    const darkBgTone = resolveChatBackgroundMetaTone({
      luminance: blackLuminance,
      overlayOpacity: 0
    })

    expect(lightBgTone).toBe('light')
    expect(darkBgTone).toBe('dark')
    expect(getChatOverBackgroundMetaTextStyle(lightBgTone)).toEqual({ color: '#000000' })
    expect(getChatOverBackgroundMetaIconColor(lightBgTone)).toBe('#000000')
    expect(getChatOverBackgroundMetaTextStyle(darkBgTone)).toEqual({ color: '#FFFFFF' })
    expect(getChatOverBackgroundMetaIconColor(darkBgTone)).toBe('#FFFFFF')
  })
})
