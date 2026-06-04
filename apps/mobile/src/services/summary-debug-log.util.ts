import type { IFileSystem } from '@baishou/core-mobile'
import type { MobileStoragePathService } from './path.service'

const DEBUG_LOG_FILENAME = 'summary_generation_debug.log'

/**
 * 与桌面端 summary-ai-client 的 appendDebugLog 对齐：把每条调试事件以 JSON Lines 形式
 * 追加到当前 vault 根目录下的 summary_generation_debug.log。
 *
 * 移动端 IFileSystem 没有原生 append 能力，采用读-拼-写策略；不阻塞主流程：
 * 任何 I/O 错误都被静默吞掉。
 */
export async function appendVaultDebugLog(
  pathService: MobileStoragePathService,
  fileSystem: IFileSystem,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const vaultPath = await pathService.getActiveVaultPath()
    if (!vaultPath) return

    const filePath = vaultPath.endsWith('/')
      ? `${vaultPath}${DEBUG_LOG_FILENAME}`
      : `${vaultPath}/${DEBUG_LOG_FILENAME}`

    let existing = ''
    try {
      if (await fileSystem.exists(filePath)) {
        existing = await fileSystem.readFile(filePath)
      }
    } catch {
      // ignore read errors; we'll overwrite/start fresh
    }

    const line = JSON.stringify(data) + '\n'
    await fileSystem.writeFile(filePath, existing + line)
  } catch {
    // debug-only, never fail the caller
  }
}
