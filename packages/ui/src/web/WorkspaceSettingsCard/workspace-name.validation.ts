export type WorkspaceNameValidationReason =
  | 'empty'
  | 'duplicate'
  | 'invalidCharacters'
  | 'reservedName'
  | 'invalidEnding'

export interface WorkspaceNameValidationResult {
  name: string
  reason?: WorkspaceNameValidationReason
  ok: boolean
}

const INVALID_WORKSPACE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001f]/
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function validateWorkspaceName(
  input: string,
  existingNames: string[] = []
): WorkspaceNameValidationResult {
  const name = input.trim()

  if (!name) {
    return { ok: false, name, reason: 'empty' }
  }

  if (existingNames.some((existing) => existing.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, name, reason: 'duplicate' }
  }

  if (INVALID_WORKSPACE_NAME_PATTERN.test(name) || name === '.' || name === '..') {
    return { ok: false, name, reason: 'invalidCharacters' }
  }

  if (RESERVED_WINDOWS_NAMES.test(name)) {
    return { ok: false, name, reason: 'reservedName' }
  }

  if (/[. ]$/.test(name)) {
    return { ok: false, name, reason: 'invalidEnding' }
  }

  return { ok: true, name }
}
