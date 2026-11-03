import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const skeletonSource = readFileSync(join(dir, '../components/DiaryEditorSkeleton.tsx'), 'utf8')
const screenSource = readFileSync(join(dir, '../DiaryEditorScreen.tsx'), 'utf8')
const webViewSourceHook = readFileSync(
  join(dir, '../../../hooks/useDiaryEditorWebViewSource.ts'),
  'utf8'
)

describe('mobile diary editor skeleton & loading layout', () => {
  it('should structure skeleton exactly matching real editor controls layout', () => {
    // AppBar 占位：返回键、居中标题、保存键
    expect(skeletonSource).toContain('appBarBack')
    expect(skeletonSource).toContain('appBarCenter')
    expect(skeletonSource).toContain('appBarTitle')
    expect(skeletonSource).toContain('appBarSave')
    expect(skeletonSource).toContain('borderBottomWidth: 1')

    // MetaBar 占位：天气/心情 Picker、朗读键、收藏键
    expect(skeletonSource).toContain('metaPickers')
    expect(skeletonSource).toContain('metaPickerItem')
    expect(skeletonSource).toContain('metaSquareBtn')

    // EditorBody 占位：标签药丸、正文行、图片块
    expect(skeletonSource).toContain('tagPill')
    expect(skeletonSource).toContain('imageBlock')
    expect(skeletonSource).toContain('lineFull')

    // 常驻底部工具栏占位
    expect(skeletonSource).toContain('toolbar')
    expect(skeletonSource).toContain('toolbarBtn')
    expect(skeletonSource).toContain('borderTopWidth: 1')
  })

  it('should gate editor screen rendering on both data and webview source readiness', () => {
    expect(screenSource).toContain('isEditorReady = !loading && !!editorWebViewSource')
    expect(screenSource).toContain('<DiaryEditorSkeleton />')
  })

  it('should immediately resolve cached webview source without dev mode penalty', () => {
    expect(webViewSourceHook).toMatch(
      /preloadDiaryEditorWebViewSource[\s\S]*?if\s*\(\s*cachedSource\s*\)\s*\{\s*return Promise\.resolve\(cachedSource\)/
    )
    expect(webViewSourceHook).not.toContain(
      "if (cachedSource && (typeof __DEV__ === 'undefined' || !__DEV__))"
    )
  })
})
