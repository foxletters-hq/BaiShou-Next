import { useCallback } from 'react'
import { Linking } from 'react-native'
import type { LinkPressEvent } from 'react-native-enriched-markdown'
import { useKnowledgeCitationOpener } from '../KnowledgeCitationBlock'

export function useMarkdownLinkPress() {
  const { openFromHref } = useKnowledgeCitationOpener()
  const tryOpenCitation = useCallback((url: string) => openFromHref(url), [openFromHref])
  const handleLinkPress = useCallback(
    ({ url }: LinkPressEvent) => {
      if (tryOpenCitation(url)) return false
      void Linking.openURL(url).catch(() => undefined)
      return false
    },
    [tryOpenCitation]
  )

  return { handleLinkPress, tryOpenCitation }
}
