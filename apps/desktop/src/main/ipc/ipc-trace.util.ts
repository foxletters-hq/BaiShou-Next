import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { logger } from '@baishou/shared'

function summarizeIpcArgs(args: unknown[]): unknown {
  if (args.length === 0) return []
  if (args.length === 1 && Array.isArray(args[0])) {
    return {
      type: 'array',
      length: args[0].length,
      preview: (args[0] as Array<{ id?: string; name?: string }>).slice(0, 3).map((item) => ({
        id: item.id,
        name: item.name
      }))
    }
  }
  return args.map((arg) => {
    if (Array.isArray(arg)) {
      return { type: 'array', length: arg.length }
    }
    if (arg && typeof arg === 'object') {
      return { type: 'object', keys: Object.keys(arg as object).slice(0, 8) }
    }
    return arg
  })
}

export function tracedIpcHandle(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<unknown> | unknown
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const start = performance.now()
    logger.info(`[IPC Main] ➔ ${channel}`, { args: summarizeIpcArgs(args) })
    try {
      const result = await handler(event, ...args)
      const cost = Math.round(performance.now() - start)
      logger.info(`[IPC Main] ⬅ ${channel} (${cost}ms)`, {
        result: summarizeIpcArgs([result])[0]
      })
      return result
    } catch (error) {
      const cost = Math.round(performance.now() - start)
      logger.error(`[IPC Main] ❌ ${channel} (${cost}ms)`, error as Error)
      throw error
    }
  })
}
