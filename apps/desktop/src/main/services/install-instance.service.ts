import { app } from 'electron'
import * as fsp from 'fs/promises'
import { existsSync } from 'fs'
import { resolveInstallInstanceId } from '@baishou/shared'

let cachedInstallInstanceId: string | null = null

export async function getDesktopInstallInstanceId(): Promise<string> {
  if (cachedInstallInstanceId) return cachedInstallInstanceId

  const userData = app.getPath('userData')
  cachedInstallInstanceId = await resolveInstallInstanceId('desktop', userData, {
    exists: (p) => existsSync(p),
    read: (p) => fsp.readFile(p, 'utf8'),
    write: (p, content) => fsp.writeFile(p, content, 'utf8'),
    mkdir: async (p) => {
      await fsp.mkdir(p, { recursive: true })
    }
  })
  return cachedInstallInstanceId
}

export function getDesktopInstallInstanceStorageDir(): string {
  return app.getPath('userData')
}
