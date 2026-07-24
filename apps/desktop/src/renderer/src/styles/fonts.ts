/**
 * 桌面 UI 字体：首屏只同步拉丁 400，CJK 字重空闲后再拉，减轻 Ctrl+Shift+R 冷启动。
 */
import '@fontsource/noto-sans/latin-400.css'

const loadedRegional = new Set<string>()

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

/** 简中 / 加粗拉丁：空闲加载，避免挡住首屏 */
function ensureDefaultUiFonts(): void {
  if (loadedRegional.has('sc-base')) return
  loadedRegional.add('sc-base')
  scheduleIdle(() => {
    void Promise.all([
      import('@fontsource/noto-sans/latin-500.css'),
      import('@fontsource/noto-sans/latin-600.css'),
      import('@fontsource/noto-sans-sc/chinese-simplified-400.css'),
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
