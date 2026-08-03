export class VaultNotFoundError extends Error {
  constructor(vaultName: string) {
    super(`Vault with name "${vaultName}" not found.`)
    this.name = 'VaultNotFoundError'
  }
}

export class VaultActiveDeleteError extends Error {
  constructor(vaultName: string) {
    super(
      `Cannot delete the currently active vault "${vaultName}". Please switch to another vault first.`
    )
    this.name = 'VaultActiveDeleteError'
  }
}

export class VaultNameExistsError extends Error {
  readonly vaultName: string
  readonly conflictingName?: string
  readonly conflictKind?: 'exact' | 'case' | 'directory'

  constructor(
    vaultName: string,
    options?: { conflictingName?: string; conflictKind?: 'exact' | 'case' | 'directory' }
  ) {
    const conflictingName = options?.conflictingName
    const conflictKind = options?.conflictKind
    let message = `Vault with name "${vaultName}" already exists.`
    if (conflictKind === 'case' && conflictingName) {
      message = `Vault name "${vaultName}" conflicts with existing vault "${conflictingName}" (case-insensitive).`
    } else if (conflictKind === 'directory' && conflictingName) {
      message = `Vault name "${vaultName}" would use the same directory as existing vault "${conflictingName}".`
    }
    super(message)
    this.name = 'VaultNameExistsError'
    this.vaultName = vaultName
    this.conflictingName = conflictingName
    this.conflictKind = conflictKind
  }
}

export class VaultInvalidNameError extends Error {
  readonly reason: 'empty' | 'invalid_chars'

  constructor(input: string, reason: 'empty' | 'invalid_chars') {
    super(
      reason === 'empty'
        ? 'Vault name cannot be empty.'
        : `Vault name "${input}" contains invalid characters.`
    )
    this.name = 'VaultInvalidNameError'
    this.reason = reason
  }
}

export class VaultDeleteFilesystemError extends Error {
  readonly vaultName: string
  readonly cause: unknown

  constructor(vaultName: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`Failed to delete vault directory for "${vaultName}": ${detail}`)
    this.name = 'VaultDeleteFilesystemError'
    this.vaultName = vaultName
    this.cause = cause
  }
}

export class VaultRenameFilesystemError extends Error {
  readonly oldName: string
  readonly newName: string
  readonly cause: unknown

  constructor(oldName: string, newName: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`Failed to rename vault directory from "${oldName}" to "${newName}": ${detail}`)
    this.name = 'VaultRenameFilesystemError'
    this.oldName = oldName
    this.newName = newName
    this.cause = cause
  }
}
