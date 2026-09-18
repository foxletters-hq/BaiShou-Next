export function isPendingLocalAvatar(uri: string | null | undefined): uri is string {
  if (!uri) return false
  return (
    !uri.startsWith('avatars/') &&
    (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/'))
  )
}
