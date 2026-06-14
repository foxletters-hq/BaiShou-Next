export type ImageCompressRequest = {
  filePath?: string
  base64?: string
  mimeType?: string
  maxDimension: number
  maxBase64Chars: number
}

export type ImageCompressResult = {
  base64: string
  mimeType: string
}

export type ImageCompressor = {
  compress: (request: ImageCompressRequest) => Promise<ImageCompressResult | null>
}

let injectedCompressor: ImageCompressor | null = null

/** 移动端注入 expo-image-manipulator 等宿主压缩能力 */
export function registerImageCompressor(compressor: ImageCompressor): void {
  injectedCompressor = compressor
}

export function getImageCompressor(): ImageCompressor | null {
  return injectedCompressor
}

export function clearImageCompressor(): void {
  injectedCompressor = null
}
