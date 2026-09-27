export interface CheckoutBranchOption {
  name: string
  isCurrent: boolean
}

export function listCheckoutBranches(
  current: string | undefined,
  branches: string[] | undefined
): CheckoutBranchOption[] {
  const currentName = current?.trim() ?? ''
  return (branches ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name !== 'HEAD')
    .map((name) => ({
      name,
      isCurrent: currentName.length > 0 && name === currentName
    }))
}

export function displayGitBranchName(current: string | undefined): string | undefined {
  const name = current?.trim()
  if (!name || name === 'HEAD') return undefined
  return name
}

/** 本地修改挡住 checkout 时，Git 原文很长，状态栏只需要一句原因。 */
export function isGitCheckoutBlockedByLocalChanges(message: string | undefined): boolean {
  const text = message?.trim() ?? ''
  if (!text) return false
  return /local changes|would be overwritten|please commit your changes or stash/i.test(text)
}
