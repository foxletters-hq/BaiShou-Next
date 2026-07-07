let vaultRuntimeGeneration = 0

export function bumpVaultRuntimeGeneration(): number {
  vaultRuntimeGeneration += 1
  return vaultRuntimeGeneration
}

export function getVaultRuntimeGeneration(): number {
  return vaultRuntimeGeneration
}

export function isVaultRuntimeGenerationCurrent(generation: number): boolean {
  return generation === vaultRuntimeGeneration
}
