import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SessionModelMenu } from '../index'

const providers = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    models: ['gpt-5', 'gpt-4o-mini'],
    enabledModels: ['gpt-5', 'gpt-4o-mini']
  }
]

describe('SessionModelMenu', () => {
  it('keeps the menu open when selecting a model and closes after selecting reasoning effort', () => {
    vi.useFakeTimers()
    const onSelect = vi.fn()
    const onReasoningEffortChange = vi.fn()
    const onClose = vi.fn()

    render(
      <SessionModelMenu
        providers={providers}
        currentProviderId="openai"
        currentModelId="gpt-4o-mini"
        onSelect={onSelect}
        onClose={onClose}
        reasoningEffort="auto"
        onReasoningEffortChange={onReasoningEffortChange}
        reasoningControl={{ mode: 'effort', efforts: ['low', 'medium', 'high'] }}
        showReasoningPanel
      />
    )

    fireEvent.click(screen.getByText('gpt-5'))
    expect(onSelect).toHaveBeenCalledWith('openai', 'gpt-5')

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('high'))
    expect(onReasoningEffortChange).toHaveBeenCalledWith('high')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('closes immediately after selecting a model when showReasoningPanel is false', () => {
    vi.useFakeTimers()
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <SessionModelMenu
        providers={providers}
        currentProviderId="openai"
        currentModelId="gpt-4o-mini"
        onSelect={onSelect}
        onClose={onClose}
        showReasoningPanel={false}
      />
    )

    fireEvent.click(screen.getByText('gpt-5'))
    expect(onSelect).toHaveBeenCalledWith('openai', 'gpt-5')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
