import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(dir, '..', 'SummaryScreen.tsx'), 'utf8')

describe('SummaryScreen mobile chrome layout', () => {
  it('groups DashboardHeroBanner and dashboard cards in dashboardSection with tight gap', () => {
    // 验证 DashboardHeroBanner 和 卡片布局 被包裹在 dashboardSection 中
    expect(src).toContain('styles.dashboardSection')
    expect(src).toMatch(
      /<View style=\{styles\.dashboardSection\}>\s*<DashboardHeroBanner \/>\s*<View style=\{isWide \? styles\.wideLayout : styles\.narrowLayout\}>/
    )

    // 验证 dashboardSection 使用 mdTight 间距（12px），收紧白守回忆卡片与共同回忆卡片之间的间距
    expect(src).toMatch(/dashboardSection:\s*\{\s*gap:\s*sharedTokens\.spacing\.mdTight\s*\}/)
  })

  it('uses standard size centered SegmentedControl in SummaryTabBar', () => {
    const tabBarSrc = readFileSync(join(dir, '../components/SummaryTabBar.tsx'), 'utf8')
    expect(tabBarSrc).toContain('SegmentedControl')
    expect(tabBarSrc).not.toContain('size="small"')
    expect(tabBarSrc).not.toContain("alignSelf: 'flex-start'")
    expect(tabBarSrc).not.toContain('stretch={false}')
    expect(tabBarSrc).toMatch(/alignItems:\s*'center'/)
    expect(tabBarSrc).toMatch(/maxWidth:\s*360/)
  })
})
