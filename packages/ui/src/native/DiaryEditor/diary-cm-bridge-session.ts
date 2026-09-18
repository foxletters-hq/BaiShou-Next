import type {
  DiaryCmInitPayload,
  DiaryCmTheme,
  DiaryCmToWebViewMessage,
  DiaryTagColorRegistry
} from '../../shared/diary-codemirror/types'

export function buildInitPayload(
  content: string,
  placeholder: string | undefined,
  theme: DiaryCmTheme,
  editable: boolean,
  tagColorRegistry: DiaryTagColorRegistry | undefined,
  bottomScrollInset: number
): DiaryCmInitPayload {
  return {
    content,
    placeholder,
    theme,
    interactionMode: 'touch',
    editable,
    scrollMode: 'viewport',
    tagLineMode: true,
    tagColorRegistry,
    scrollInsets: { bottom: Math.max(0, bottomScrollInset) }
  }
}

export function shouldInjectDiaryBridgeMessage(
  platformOs: string,
  message: DiaryCmToWebViewMessage
): boolean {
  return (
    platformOs === 'android' &&
    (message.type === 'tableSheetResponse' || message.type === 'confirmResponse')
  )
}
