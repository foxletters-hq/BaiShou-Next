import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HotkeySettingsCard } from '../index'

const disabledConfig = {
  hotkeyEnabled: false,
  hotkeyModifier: 'Alt',
  hotkeyKey: 'Space'
}

const enabledConfig = {
  hotkeyEnabled: true,
  hotkeyModifier: 'Alt',
  hotkeyKey: 'Space'
}

describe('HotkeySettingsCard', () => {
  it('关闭时仍显示右侧展开按钮', () => {
    const { container } = render(
      <HotkeySettingsCard config={disabledConfig} onChange={vi.fn()} />
    )
    expect(container.querySelector('.settings-expansion-toggle')).toBeInTheDocument()
    expect(screen.getByText('启用全局快捷键唤出')).toBeInTheDocument()
  })

  it('关闭时点击展开可看到录入快捷组合键', () => {
    const { container } = render(
      <HotkeySettingsCard config={disabledConfig} onChange={vi.fn()} />
    )
    fireEvent.click(container.querySelector('.settings-list-tile-expandable')!)
    expect(container.querySelector('.settings-expansion-grid-wrapper')).toHaveClass('expanded')
    expect(screen.getByText('录入快捷组合键')).toBeInTheDocument()
  })

  it('开启时仍显示右侧展开按钮', () => {
    const { container } = render(
      <HotkeySettingsCard config={enabledConfig} onChange={vi.fn()} />
    )
    expect(container.querySelector('.settings-expansion-toggle')).toBeInTheDocument()
  })
})
