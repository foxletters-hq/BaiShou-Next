import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_FORCE_DEFAULTS
} from '@baishou/shared'
import { GraphCanvasSettingsPanel } from '../GraphCanvasSettingsPanel'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key
    })
  }
})

vi.mock('@baishou/ui', () => ({
  Checkbox: ({
    checked,
    onChange
  }: {
    checked: boolean
    onChange: (event: { target: { checked: boolean } }) => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange({ target: { checked: event.target.checked } })}
    />
  )
}))

describe('GraphCanvasSettingsPanel', () => {
  it('shows browse, appearance and force controls, but not identity', () => {
    render(
      <GraphCanvasSettingsPanel
        focusDepth={1}
        appearanceSettings={{ ...GRAPH_APPEARANCE_DEFAULTS }}
        forceSettings={{ ...GRAPH_FORCE_DEFAULTS }}
        onFocusDepthChange={vi.fn()}
        onAppearanceChange={vi.fn()}
        onForceChange={vi.fn()}
        onReplayLayout={vi.fn()}
      />
    )

    expect(screen.getByText('浏览')).toBeTruthy()
    expect(screen.getByText('外观')).toBeTruthy()
    expect(screen.getByText('力度')).toBeTruthy()
    expect(screen.getByText('展开等级')).toBeTruthy()
    expect(screen.getByText('箭头')).toBeTruthy()
    expect(screen.getByText('文本透明度')).toBeTruthy()
    expect(screen.getByText('节点大小')).toBeTruthy()
    expect(screen.getByText('连线粗细')).toBeTruthy()
    expect(screen.getByText('显名边数')).toBeTruthy()
    expect(screen.getByText('显名提及')).toBeTruthy()
    expect(screen.getByText('重新布局')).toBeTruthy()
    expect(screen.getByText('图谱向心力')).toBeTruthy()
    expect(screen.getByText('节点排斥力')).toBeTruthy()
    expect(screen.getByText('相连吸引力')).toBeTruthy()
    expect(screen.getByText('连线长度')).toBeTruthy()
    expect(screen.queryByText('身份资料')).toBeNull()
  })
})
