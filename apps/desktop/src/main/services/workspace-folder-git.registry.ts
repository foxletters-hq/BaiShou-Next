import { WorkspaceFolderGitService } from '@baishou/core-desktop'
import * as path from 'path'

const services = new Map<string, WorkspaceFolderGitService>()

export function getWorkspaceFolderGitService(folderRoot: string): WorkspaceFolderGitService {
  const key = path.resolve(folderRoot)
  let service = services.get(key)
  if (!service) {
    service = new WorkspaceFolderGitService(key)
    services.set(key, service)
  }
  return service
}
