/**
 * 桌面 UI 字体：拉丁 400 + 简中 400 同步首屏；其余字重空闲后再拉。
 * Noto Sans SC = 思源黑体简体。
 */
import '@fontsource/noto-sans/latin-400.css'
import '@fontsource/noto-sans-sc/chinese-simplified-400.css'

const loadedRegional = new Set<string>(['sc-400'])

function scheduleIdle(task: () => void): void {
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }
  ).requestIdleCallback
  if (typeof ric === 'function') {
    ric(task, { timeout: 1500 })
    return
  }
  window.setTimeout(task, 200)
}

/** 加粗拉丁 / 简中 500–600：空闲加载，避免挡住首屏 */
function ensureDefaultUiFonts(): void {
  if (loadedRegional.has('sc-weights')) return
  loadedRegional.add('sc-weights')
  scheduleIdle(() => {
    void Promise.all([
      import('@fontsource/noto-sans/latin-500.css'),
      import('@fontsource/noto-sans/latin-600.css'),
      import('@fontsource/noto-sans-sc/chinese-simplified-500.css'),
      import('@fontsource/noto-sans-sc/chinese-simplified-600.css')
    ])
  })
}

ensureDefaultUiFonts()

/** 按当前 UI 语言补齐区域字形（zh-TW / ja） */
export async function ensureUiFontForLanguage(language: string): Promise<void> {
  const lang = (language || 'zh').replace('_', '-')
  if (lang === 'zh-TW' || lang.startsWith('zh-HK')) {
    if (loadedRegional.has('tc')) return
    loadedRegional.add('tc')
    await Promise.all([
      import('@fontsource/noto-sans-tc/chinese-traditional-400.css'),
      import('@fontsource/noto-sans-tc/chinese-traditional-500.css'),
      import('@fontsource/noto-sans-tc/chinese-traditional-600.css')
    ])
    return
  }
  if (lang.startsWith('ja')) {
    if (loadedRegional.has('jp')) return
    loadedRegional.add('jp')
    await Promise.all([
      import('@fontsource/noto-sans-jp/japanese-400.css'),
      import('@fontsource/noto-sans-jp/japanese-500.css'),
      import('@fontsource/noto-sans-jp/japanese-600.css')
    ])
  }
}
