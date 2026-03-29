export class VaultNotFoundError extends Error {
  constructor(vaultName: string) {
    super(`Vault with name "${vaultName}" not found.`);
    this.name = 'VaultNotFoundError';
  }
}

export class VaultActiveDeleteError extends Error {
  constructor(vaultName: string) {
    super(`Cannot delete the currently active vault "${vaultName}". Please switch to another vault first.`);
    this.name = 'VaultActiveDeleteError';
  }
}
