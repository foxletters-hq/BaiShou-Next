export type NotebookCoverMode = 'emoji' | 'image'

/** 已有封面图片时默认打开图片项，否则打开 emoji。 */
export function resolveNotebookCoverMode(hasImage: boolean): NotebookCoverMode {
  return hasImage ? 'image' : 'emoji'
}
