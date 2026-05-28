import { createNodeFileSystem } from '@baishou/core-desktop'

/** Shared Node.js filesystem for all desktop main-process file services. */
export const fileSystem = createNodeFileSystem()
