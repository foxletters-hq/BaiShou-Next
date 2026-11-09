import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Android 会把最后几次 onChangeText 与点击发送放进同一批原生事件派发。
 * 若发送读取渲染闭包里的 text，JS 线程繁忙时末尾几个字会被吞掉，随后输入框被清空。
 */
describe('native input bar latest text', () => {
  const hook = readFileSync(join(here, '../useNativeInputBar.tsx'), 'utf8')

  it('updates textRef synchronously on text changes', () => {
    const changeBody = hook.slice(hook.indexOf('const handleChangeText = useCallback'))
    expect(changeBody).toContain('textRef.current = nextText')
    expect(hook).toMatch(/useEffect\(\(\) => \{\s*textRef\.current = text/)
  })

  it('reads the latest text from textRef when sending', () => {
    const sendBody = hook.slice(hook.indexOf('const handleSend = useCallback'))
    expect(sendBody).toContain('const latestText = textRef.current')
    expect(sendBody).toContain('const pendingText = latestText')
  })

  it('compares shortcut prefix against textRef instead of render closure', () => {
    const changeBody = hook.slice(hook.indexOf('const handleChangeText = useCallback'))
    expect(changeBody).toContain('const prevText = textRef.current')
    expect(changeBody).toContain('handleTextChangeForShortcuts(prevText, nextText)')
  })

  it('blurs and yields event loop tick before reading text when focused', () => {
    const sendBody = hook.slice(hook.indexOf('const handleSend = useCallback'))
    expect(sendBody).toContain('inputRef.current?.blur?.()')
    expect(sendBody).toContain('await new Promise((resolve) => setTimeout(resolve, 32))')
  })

  it('optimistically clears input before awaiting onSend', () => {
    const sendBody = hook.slice(hook.indexOf('const handleSend = useCallback'))
    const clearIdx = sendBody.indexOf("setText('')")
    const onSendIdx = sendBody.indexOf('onSend(')
    expect(clearIdx).toBeGreaterThan(0)
    expect(onSendIdx).toBeGreaterThan(clearIdx)
  })
})
