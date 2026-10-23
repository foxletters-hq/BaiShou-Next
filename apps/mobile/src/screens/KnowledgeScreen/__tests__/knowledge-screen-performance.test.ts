import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const screenSrc = readFileSync(join(dir, '..', 'KnowledgeScreen.tsx'), 'utf8')
const detailHookSrc = readFileSync(join(dir, '..', 'useKnowledgeDetail.ts'), 'utf8')

describe('mobile knowledge load performance optimizations', () => {
  it('should implement memory cache and prevent duplicate mount fetch in KnowledgeScreen', () => {
    // 验证内存缓存定义与初始化
    expect(screenSrc).toContain('let cachedNotebooks: NotebookCardItem[] | null = null')
    expect(screenSrc).toContain('cachedNotebooks = withCovers')
    expect(screenSrc).toContain('useState<NotebookCardItem[]>(() => cachedNotebooks ?? [])')

    // 验证全库统计异步化，不阻塞列表卡片更新
    expect(screenSrc).toContain('setNotebooks(withCovers)')
    expect(screenSrc).toContain('cachedStatsById = next')

    // 验证挂载与聚焦防重复节流机制
    expect(screenSrc).toContain('isInitialMountRef')
    expect(screenSrc).toContain('lastFocusRefreshTimeRef')
  })

  it('should not block initial detail render on recoverStaleIngest or full stats in useKnowledgeDetail', () => {
    // 验证 mobileRecoverStaleIngest 在独立的异步任务中执行，不卡住首屏 refreshDetail
    expect(detailHookSrc).toContain('await mobileRecoverStaleIngest()')
    expect(detailHookSrc).toMatch(
      /void\s*\(\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*await mobileRecoverStaleIngest\(\)[\s\S]*\}\s*\)\(\)/
    )

    // 验证获取到基本资料后提早解开 detailLoaded 门禁
    expect(detailHookSrc).toContain('setSources(list || [])')
    expect(detailHookSrc).toContain('setDetailLoaded(true)')

    // 验证同时保留最终的 if (!cancelled) setDetailLoaded(true) 契约
    expect(detailHookSrc).toContain('if (!cancelled) setDetailLoaded(true)')

    // 验证聚焦刷新具备冷却时间保护
    expect(detailHookSrc).toContain('lastDetailFocusTimeRef')
  })
})
