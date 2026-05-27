/** sessionStorage：保存后返回日记列表时触发揭示动画 */
export const DIARY_RETURN_REVEAL_KEY = 'diary_return_reveal'

export function markDiaryReturnReveal(): void {
  sessionStorage.setItem(DIARY_RETURN_REVEAL_KEY, '1')
}

export function consumeDiaryReturnReveal(): boolean {
  if (sessionStorage.getItem(DIARY_RETURN_REVEAL_KEY) === '1') {
    sessionStorage.removeItem(DIARY_RETURN_REVEAL_KEY)
    return true
  }
  return false
}

export const DIARY_RETURN_REVEAL_TRANSITION = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1] as const
}

export const DIARY_EDITOR_SAVE_EXIT_TRANSITION = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1] as const
}
