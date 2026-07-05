import { useTheme } from '../../hooks/useTheme'

export function useAgentMarkdownThemeClass(): 'x-markdown-light' | 'x-markdown-dark' {
  const { isDark } = useTheme()
  return isDark ? 'x-markdown-dark' : 'x-markdown-light'
}
