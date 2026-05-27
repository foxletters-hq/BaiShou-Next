import type { IGitSyncService } from './git-sync.interface'
import type { IStoragePathService } from '../vault/storage-path.types'
import { GitSyncRemoteMixin } from './git-sync.remote'

export { getAuthenticatedUrl } from './git-sync.helpers'

export class GitSyncServiceImpl extends GitSyncRemoteMixin implements IGitSyncService {
  constructor(pathService: IStoragePathService) {
    super(pathService)
  }
}
