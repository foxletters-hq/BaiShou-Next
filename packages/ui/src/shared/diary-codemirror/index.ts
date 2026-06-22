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
  forceImageRefresh,
  setImageActionCallback,
  setUpdateImageWidthCallback,
  invokeImageAction,
  invokeUpdateImageWidth,
  type ImageAction
} from './extensions/effects'

export { livePreviewSyntaxHighlighting } from './extensions/syntax'
export { livePreviewPlugin } from './extensions/livePreviewPlugin'
export { attachmentUrlPlugin } from './extensions/attachmentUrlPlugin'
export { markdownKeymap } from './extensions/keymap'
export { buildMarkerHidingDecorations } from './extensions/build'

export { ImageWidget } from './widgets/ImageWidget'
export { editorTheme, mobileTouchEditorLayoutTheme } from './theme/editorTheme'

export {
  parseImageMarkdown,
  buildImageMarkdown,
  clampWidth,
  IMAGE_SIZE_CONFIG,
  type ParsedImage
} from './utils/image-utils'
