import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

const STORE_FILE = 'agent-workspace-auto-accept.json'

interface AutoAcceptFile {
  version: 1
  byWorkspaceId: Record<string, boolean>
}

let cache: AutoAcceptFile | null = null

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE)
}

function emptyStore(): AutoAcceptFile {
  return { version: 1, byWorkspaceId: {} }
}

async function loadStore(): Promise<AutoAcceptFile> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(storePath(), 'utf-8')
    const parsed = JSON.parse(raw) as AutoAcceptFile
    cache = {
      version: 1,
      byWorkspaceId:
        parsed?.byWorkspaceId && typeof parsed.byWorkspaceId === 'object'
          ? parsed.byWorkspaceId
          : {}
    }
  } catch {
    cache = emptyStore()
  }
  return cache
}

async function saveStore(): Promise<void> {
  if (!cache) return
  await fs.mkdir(path.dirname(storePath()), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify(cache, null, 2), 'utf-8')
}

export async function getWorkspaceAutoAccept(workspaceId: string): Promise<boolean> {
  const store = await loadStore()
  return store.byWorkspaceId[workspaceId] === true
}

export async function setWorkspaceAutoAccept(
  workspaceId: string,
  enabled: boolean
): Promise<boolean> {
  const store = await loadStore()
  if (enabled) {
    store.byWorkspaceId[workspaceId] = true
  } else {
    delete store.byWorkspaceId[workspaceId]
  }
  await saveStore()
  return enabled
}

export function resetWorkspaceAutoAcceptCache(): void {
  cache = null
}
