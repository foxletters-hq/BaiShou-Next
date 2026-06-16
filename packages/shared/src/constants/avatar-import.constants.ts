/** 头像导入：超过此体积才压缩（3 MiB） */
export const AVATAR_IMPORT_MAX_BYTES = 3 * 1024 * 1024

/** 压缩时最长边上限（保留清晰度，头像展示足够） */
export const AVATAR_IMPORT_MAX_DIMENSION = 1024

/** Electron nativeImage.toJPEG：0–100 */
export const AVATAR_IMPORT_JPEG_QUALITY_DESKTOP = 88

export function shouldCompressAvatarFileSize(byteSize: number): boolean {
  return byteSize > AVATAR_IMPORT_MAX_BYTES
}
