import { requireNativeModule } from 'expo-modules-core'

export type NativePdfPageBitmap = {
  page: number
  pngBase64: string
  width: number
  height: number
}

export type ExpoPdfPageRenderModule = {
  isAvailable(): boolean
  getPageCount(filePath: string): Promise<number>
  renderPages(filePath: string, pageNumbers: number[], dpi: number): Promise<NativePdfPageBitmap[]>
}

let nativeModule: ExpoPdfPageRenderModule | null | undefined

export function getPdfPageRenderNative(): ExpoPdfPageRenderModule | null {
  if (nativeModule !== undefined) return nativeModule
  try {
    const loaded = requireNativeModule<ExpoPdfPageRenderModule>('ExpoPdfPageRender')
    nativeModule = loaded?.isAvailable?.() ? loaded : null
  } catch {
    nativeModule = null
  }
  return nativeModule
}
