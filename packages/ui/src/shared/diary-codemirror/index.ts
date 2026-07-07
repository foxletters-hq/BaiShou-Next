export type {
  DiaryCmBridgeProtocol,
  DiaryCmGuestMessage,
  DiaryCmHostMessage,
  DiaryCmImageAction,
  DiaryCmImageActionPayload,
  DiaryCmInteractionMode,
  DiaryCmPlatform
} from './types'

export {
  createDiaryCodeMirror,
  createDiaryCodeMirrorExtensions,
  type CreateDiaryCodeMirrorOptions
} from './createDiaryCodeMirror'

export {
  clampPosToDoc,
  replaceEditorDocumentContent,
  type ReplaceEditorDocumentOptions
} from './editorContentSync'

export {
  forceImageRefresh,
  setImageActionCallback,
  setUpdateImageWidthCallback,
  invokeImageAction,
  invokeUpdateImageWidth,
  type ImageAction
} from './extensions/effects'

export { livePreviewSyntaxHighlighting } from './extensions/syntax'
export { livePreviewField, livePreviewPlugin } from './extensions/livePreviewPlugin'
export {
  tablePreviewField,
  buildTablePreviewDecorations,
  changeAffectsTables,
  changeOverlapsTableDecorations
} from './extensions/tablePreviewField'
export { attachmentUrlPlugin } from './extensions/attachmentUrlPlugin'
export { markdownKeymap, toggleMarkdownMark } from './extensions/keymap'
export { buildMarkerHidingDecorations } from './extensions/build'
export { placePreviewCursorPastHeading, placePreviewCursorAt, resolvePreviewCursorPos } from './extensions/previewCursor'

export { ImageWidget } from './widgets/ImageWidget'
export { editorTheme, mobileTouchEditorLayoutTheme } from './theme/editorTheme'
export { workbenchEditorTheme } from './theme/workbenchEditorTheme'

export {
  parseImageMarkdown,
  buildImageMarkdown,
  clampWidth,
  IMAGE_SIZE_CONFIG,
  type ParsedImage
} from './utils/image-utils'
