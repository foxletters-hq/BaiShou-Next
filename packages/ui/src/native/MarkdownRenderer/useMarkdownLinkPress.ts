import { useCallback } from 'react'
import { Linking } from 'react-native'
import type { LinkPressEvent } from 'react-native-enriched-markdown'

export function useMarkdownLinkPress() {
  const handleLinkPress = useCallback(({ url }: LinkPressEvent) => {
    void Linking.openURL(url).catch(() => undefined)
  }, [])

  return { handleLinkPress }
}
