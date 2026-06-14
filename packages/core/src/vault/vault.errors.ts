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

  constructor(vaultName: string) {
    super(`Vault with name "${vaultName}" already exists.`)
    this.name = 'VaultNameExistsError'
    this.vaultName = vaultName
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
