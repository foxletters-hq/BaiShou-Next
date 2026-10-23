import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotebookCoverEditor } from '../NotebookCoverEditor'

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
  SegmentedControl: ({
    value,
    options,
    onChange
  }: {
    value: string
    options: Array<{ value: string; label: string }>
    onChange: (value: string) => void
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}))

const labels = {
  cover: '笔记本封面',
  emoji: 'emoji',
  pickIcon: '选择图标',
  uploadImage: '上传图片',
  clearImage: '清除图片'
}

describe('NotebookCoverEditor', () => {
  it('should show tone picker and emoji trigger when mode is emoji', () => {
    render(
      <NotebookCoverEditor
        mode="emoji"
        onModeChange={vi.fn()}
        tone="rose"
        onToneChange={vi.fn()}
        icon="🧭"
        onPickIcon={vi.fn()}
        onUploadImage={vi.fn()}
        labels={labels}
      />
    )

    expect(screen.getByText('笔记本封面')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'emoji' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '选择图标' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '清除图片' })).toBeNull()
  })

  it('should show upload actions when mode is image', () => {
    render(
      <NotebookCoverEditor
        mode="image"
        onModeChange={vi.fn()}
        tone=""
        onToneChange={vi.fn()}
        onPickIcon={vi.fn()}
        onUploadImage={vi.fn()}
        onClearImage={vi.fn()}
        hasImage
        imageName="cover.png"
        labels={labels}
      />
    )

    expect(screen.getByRole('button', { name: 'emoji' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('button', { name: '上传图片' })[0]).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByText('cover.png')).toBeTruthy()
    expect(screen.getByRole('button', { name: '清除图片' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '选择图标' })).toBeNull()
  })

  it('should notify parent when switching to image', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()
    render(
      <NotebookCoverEditor
        mode="emoji"
        onModeChange={onModeChange}
        tone=""
        onToneChange={vi.fn()}
        onPickIcon={vi.fn()}
        onUploadImage={vi.fn()}
        labels={labels}
      />
    )

    await user.click(screen.getByRole('button', { name: '上传图片' }))
    expect(onModeChange).toHaveBeenCalledWith('image')
  })
})
