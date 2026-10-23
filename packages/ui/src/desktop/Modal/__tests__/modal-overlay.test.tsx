import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from '../Modal'

describe('Modal overlay dismiss', () => {
  it('should close when the overlay is pointer-down by default', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose}>
        内容
      </Modal>
    )

    const overlay = document.querySelector('.overlay')
    expect(overlay).toBeTruthy()
    fireEvent.pointerDown(overlay!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should not close when pointer-down happens on the dialog card', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose}>
        内容
      </Modal>
    )

    fireEvent.pointerDown(screen.getByText('内容'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('should not close when closeOnOverlayClick is false', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} closeOnOverlayClick={false}>
        内容
      </Modal>
    )

    fireEvent.pointerDown(document.querySelector('.overlay')!)
    expect(onClose).not.toHaveBeenCalled()
  })
})
