import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import type { MockChatAttachment } from '@baishou/shared'

function newAttachmentId(): string {
  return Math.random().toString(36).substring(7)
}

function attachmentFromImageAsset(asset: ImagePicker.ImagePickerAsset): MockChatAttachment {
  const fileName = asset.fileName || `photo_${Date.now()}.jpg`
  return {
    id: newAttachmentId(),
    fileName,
    filePath: asset.uri,
    isImage: true,
    isPdf: false,
    isText: false,
    fileSize: asset.fileSize
  }
}

function attachmentFromDocumentAsset(
  asset: DocumentPicker.DocumentPickerAsset
): MockChatAttachment | null {
  const fileName = asset.name || `file_${Date.now()}`
  const isImage =
    /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(fileName) ||
    (asset.mimeType?.startsWith('image/') ?? false)
  const isPdf = /\.pdf$/i.test(fileName) || asset.mimeType === 'application/pdf'
  const isText = /\.(txt|md)$/i.test(fileName) || (asset.mimeType?.startsWith('text/') ?? false)

  if (isText && asset.size && asset.size > 512 * 1024) {
    return null
  }

  return {
    id: newAttachmentId(),
    fileName,
    filePath: asset.uri,
    isImage,
    isPdf,
    isText,
    fileSize: asset.size
  }
}

export type PickAttachmentsResult =
  | { ok: true; attachments: MockChatAttachment[] }
  | { ok: false; reason: 'canceled' | 'permission_denied' | 'text_too_large' | 'error' }

export async function pickAttachmentsFromCamera(): Promise<PickAttachmentsResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) {
    return { ok: false, reason: 'permission_denied' }
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.92
  })

  if (result.canceled || !result.assets[0]) {
    return { ok: false, reason: 'canceled' }
  }

  return { ok: true, attachments: [attachmentFromImageAsset(result.assets[0])] }
}

export async function pickAttachmentsFromPhotoLibrary(): Promise<PickAttachmentsResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    return { ok: false, reason: 'permission_denied' }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.92
  })

  if (result.canceled || !result.assets.length) {
    return { ok: false, reason: 'canceled' }
  }

  return { ok: true, attachments: result.assets.map(attachmentFromImageAsset) }
}

export async function pickAttachmentsFromFileManager(): Promise<PickAttachmentsResult> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    type: '*/*'
  })

  if (result.canceled || !result.assets?.length) {
    return { ok: false, reason: 'canceled' }
  }

  const attachments: MockChatAttachment[] = []
  let textTooLarge = false

  for (const asset of result.assets) {
    const att = attachmentFromDocumentAsset(asset)
    if (!att) {
      textTooLarge = true
      continue
    }
    attachments.push(att)
  }

  if (attachments.length === 0 && textTooLarge) {
    return { ok: false, reason: 'text_too_large' }
  }

  if (attachments.length === 0) {
    return { ok: false, reason: 'canceled' }
  }

  return { ok: true, attachments }
}
