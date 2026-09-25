import { normalizeImageForModel } from './normalize-image-for-model'

export type VisionPageImagePart = {
  type: 'image'
  image: string
  mediaType: string
}

/**
 * 把 PDF 页图编成 AI SDK ImagePart：裸 base64 + mediaType。
 * 不能传 data URL，否则兼容网关会再套一层前缀，模型按「不是 png/jpeg」拒掉。
 */
export async function buildVisionPageImagePart(pngBase64: string): Promise<VisionPageImagePart> {
  const data = String(pngBase64 || '').trim()
  if (!data) {
    throw new Error('视觉 OCR：页面图片为空')
  }
  const normalized = await normalizeImageForModel({
    data,
    mimeType: 'image/png',
    fileName: 'page.png'
  })
  if (!normalized?.base64) {
    throw new Error('视觉 OCR：页面图片无法规范化')
  }
  return {
    type: 'image',
    image: normalized.base64,
    mediaType: normalized.mimeType
  }
}
