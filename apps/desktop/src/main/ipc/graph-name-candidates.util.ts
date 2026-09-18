export type GraphNameCandidate = {
  nodeId: string
  name: string
  discriminator: string
  label: string
}

export function toNameCandidate(
  row: { id: string; name: string; discriminator?: string },
  label?: string
): GraphNameCandidate {
  const discriminator = row.discriminator ?? ''
  return {
    nodeId: row.id,
    name: row.name,
    discriminator,
    label: label?.trim() || (discriminator ? discriminator : row.name)
  }
}
