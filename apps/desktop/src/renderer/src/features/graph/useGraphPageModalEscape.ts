import { useEffect } from 'react'

export function useGraphPageModalEscape(opts: {
  mergeSearchOpen: boolean
  createOpen: boolean
  mergeConfirm: unknown
  splitOpen: boolean
  setMergeConfirm: (value: null) => void
  setSplitOpen: (open: boolean) => void
  setMergeSearchOpen: (open: boolean) => void
  setCreateOpen: (open: boolean) => void
}): void {
  useEffect(() => {
    if (!opts.mergeSearchOpen && !opts.createOpen && !opts.mergeConfirm && !opts.splitOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (opts.mergeConfirm) {
        opts.setMergeConfirm(null)
        return
      }
      if (opts.splitOpen) {
        opts.setSplitOpen(false)
        return
      }
      if (opts.mergeSearchOpen) {
        opts.setMergeSearchOpen(false)
        return
      }
      opts.setCreateOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // 只订阅各开关与 setter，opts 对象每次渲染都会换引用
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上
  }, [
    opts.mergeSearchOpen,
    opts.createOpen,
    opts.mergeConfirm,
    opts.splitOpen,
    opts.setMergeConfirm,
    opts.setSplitOpen,
    opts.setMergeSearchOpen,
    opts.setCreateOpen
  ])
}
