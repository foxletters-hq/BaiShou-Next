/**
 * 记忆图与笔记本图共用的维护端口。
 * 算法只认这些方法；账本路径、表名、身份盐由各 workspace 自己接。
 */

export type GraphWorkspaceKind = 'memory' | 'notebook'

export type GraphWorkspaceIdentity = {
  kind: GraphWorkspaceKind
  nodeIdForEntity(type: string, name: string, discriminator?: string): string
  forbiddenAnchorTypes: readonly string[]
}

export type GraphWorkspaceScope = {
  vaultId: string
  vaultName: string
  notebookId?: string
}
