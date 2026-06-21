import type { IStoragePathService } from '../vault/storage-path.types'
import type { IAttachmentManager } from './attachment-manager.types'
import { AttachmentAvatarOps } from './attachment-manager.avatar'
import { AttachmentDiaryOps } from './attachment-manager.diary'
import { AttachmentSessionOps } from './attachment-manager.session'
import { AttachmentBackgroundOps } from './attachment-manager.background'

export class AttachmentManagerService implements IAttachmentManager {
  private readonly avatarOps: AttachmentAvatarOps
  private readonly sessionOps: AttachmentSessionOps
  private readonly diaryOps: AttachmentDiaryOps
  private readonly backgroundOps: AttachmentBackgroundOps

  constructor(pathProvider: IStoragePathService) {
    this.avatarOps = new AttachmentAvatarOps(pathProvider)
    this.sessionOps = new AttachmentSessionOps(pathProvider)
    this.diaryOps = new AttachmentDiaryOps(pathProvider)
    this.backgroundOps = new AttachmentBackgroundOps(pathProvider)
  }

  importAvatar(...args: Parameters<AttachmentAvatarOps['importAvatar']>) {
    return this.avatarOps.importAvatar(...args)
  }

  resolveAvatarPath(...args: Parameters<AttachmentAvatarOps['resolveAvatarPath']>) {
    return this.avatarOps.resolveAvatarPath(...args)
  }

  listOrphans(...args: Parameters<AttachmentSessionOps['listOrphans']>) {
    return this.sessionOps.listOrphans(...args)
  }

  deleteBatch(...args: Parameters<AttachmentSessionOps['deleteBatch']>) {
    return this.sessionOps.deleteBatch(...args)
  }

  listSessionGroups(...args: Parameters<AttachmentSessionOps['listSessionGroups']>) {
    return this.sessionOps.listSessionGroups(...args)
  }

  deleteFile(...args: Parameters<AttachmentSessionOps['deleteFile']>) {
    return this.sessionOps.deleteFile(...args)
  }

  listDiaryAttachments(...args: Parameters<AttachmentDiaryOps['listDiaryAttachments']>) {
    return this.diaryOps.listDiaryAttachments(...args)
  }

  deleteDiaryAttachment(...args: Parameters<AttachmentDiaryOps['deleteDiaryAttachment']>) {
    return this.diaryOps.deleteDiaryAttachment(...args)
  }

  importBackground(...args: Parameters<AttachmentBackgroundOps['importBackground']>) {
    return this.backgroundOps.importBackground(...args)
  }

  resolveBackgroundPath(...args: Parameters<AttachmentBackgroundOps['resolveBackgroundPath']>) {
    return this.backgroundOps.resolveBackgroundPath(...args)
  }
}
