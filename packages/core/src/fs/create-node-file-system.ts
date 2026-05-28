import { NodeFileSystem } from './node-file-system'
import type { IFileSystem } from './file-system.types'

export type { IFileSystem }

export function createNodeFileSystem(): IFileSystem {
  return new NodeFileSystem()
}
