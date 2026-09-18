import { logger } from '@baishou/shared'
import { registerGraphExtractIpc } from './graph-extract.ipc'
import { registerGraphMutateIpc } from './graph-mutate.ipc'
import { registerGraphQueryIpc } from './graph-query.ipc'

export { enqueueGraphExtract } from './graph-extract.runtime'

export function registerGraphIPC(): void {
  registerGraphExtractIpc()
  registerGraphQueryIpc()
  registerGraphMutateIpc()
  logger.info('[GraphIPC] Graph IPC registered')
}
