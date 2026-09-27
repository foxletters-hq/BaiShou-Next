import { resolveAttachmentAbsolutePath } from '@baishou/shared'

export type ImagePreviewFileResult = { success: boolean; canceled?: boolean; error?: string }

type CopyAttachmentResult = ImagePreviewFileResult

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** 解析为可供复制的本地路径；data URL 不含在此（避免 IPC 写文本） */
export function resolveCopyFilePath(src: string): string | null {
  const trimmed = src.trim()
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null
  if (trimmed.startsWith('local://') || trimmed.startsWith('file://')) {
    const abs = resolveAttachmentAbsolutePath(trimmed)
    return abs || null
  }
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed
  }
  return null
}

function getDiaryCopyApi(): {
  copyAttachment?: (p: string) => Promise<CopyAttachmentResult>
} | null {
  const w = window as Window & {
    api?: { diary?: { copyAttachment?: (p: string) => Promise<CopyAttachmentResult> } }
    electron?: { ipcRenderer?: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }
  }
  if (w.api?.diary?.copyAttachment) return w.api.diary
  if (w.electron?.ipcRenderer?.invoke) {
    return {
      copyAttachment: (p: string) =>
        w.electron!.ipcRenderer!.invoke('diary:copy-attachment', p) as Promise<CopyAttachmentResult>
    }
  }
  return null
}

/** 渲染进程把 data URL 写成图片剪贴板（不走 IPC，避免把 base64 当文本） */
async function copyDataUrlAsImage(dataUrl: string): Promise<CopyAttachmentResult> {
  try {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const type = blob.type.startsWith('image/') ? blob.type : 'image/png'
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Copy failed' }
  }
}

/**
 * 优先用本地文件路径走主进程 writeImage；
 * 仅预览 data URL 时在渲染进程写图片，绝不把 base64 文本写入剪贴板。
 */
export async function copyPreviewImage(src: string, copySource?: string): Promise<CopyAttachmentResult> {
  const diary = getDiaryCopyApi()
  const fileCandidates = [copySource, src]
    .map((s) => (s ? resolveCopyFilePath(s) : null))
    .filter((p): p is string => !!p)

  for (const filePath of fileCandidates) {
    if (!diary?.copyAttachment) break
    const res = await diary.copyAttachment(filePath)
    if (res?.success) return res
  }

  const dataUrl =
    (copySource?.startsWith('data:image/') ? copySource : null) ||
    (src.startsWith('data:image/') ? src : null)

  if (dataUrl) {
    const local = await copyDataUrlAsImage(dataUrl)
    if (local.success) return local
    if (diary?.copyAttachment) {
      return diary.copyAttachment(dataUrl)
    }
    return local
  }

  return { success: false, error: 'No image to copy' }
}

export function inferImagePreviewDownloadName(
  src: string,
  options?: { alt?: string; fileName?: string }
): string {
  const explicit = options?.fileName?.trim()
  if (explicit) return explicit
  const path = src.split(/[?#]/)[0] ?? ''
  const leaf = decodeURIComponent(path.split('/').pop() ?? '')
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(leaf)) return leaf
  const alt = options?.alt?.trim()
  if (alt) return `${alt}.png`
  return 'image.png'
}

type SaveFilePickerHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>
}

function getSaveFilePicker():
  | ((options: {
      suggestedName: string
      types: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<SaveFilePickerHandle>)
  | undefined {
  const picker = (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker
  return typeof picker === 'function'
    ? (picker as (options: {
        suggestedName: string
        types: Array<{ description: string; accept: Record<string, string[]> }>
      }) => Promise<SaveFilePickerHandle>)
    : undefined
}

/** 弹出另存为；取消不报错。无文件选择器时退回浏览器下载。 */
export async function savePreviewImage(
  src: string,
  options?: { alt?: string; fileName?: string }
): Promise<ImagePreviewFileResult> {
  try {
    const fileName = inferImagePreviewDownloadName(src, options)
    const response = await fetch(src)
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }
    const blob = await response.blob()
    const picker = getSaveFilePicker()
    if (picker) {
      try {
        const handle = await picker({
          suggestedName: fileName,
          types: [
            {
              description: 'Image',
              accept: {
                'image/png': ['.png'],
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/webp': ['.webp']
              }
            }
          ]
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return { success: true }
      } catch (err) {
        if (isAbortError(err)) return { success: true, canceled: true }
        throw err
      }
    }

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    return { success: true }
  } catch (err) {
    if (isAbortError(err)) return { success: true, canceled: true }
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
