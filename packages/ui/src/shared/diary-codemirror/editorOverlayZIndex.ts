/** 日记编辑器内浮动层 z-index：高于表格把手（~350），低于应用级弹窗（~1000） */
export const DIARY_EDITOR_OVERLAY_Z = {
  menuBackdrop: 400,
  menu: 401,
  tableMenu: 402,
  imagePreview: 450,
  imagePreviewControl: 451,
  tableSheet: 460
} as const
