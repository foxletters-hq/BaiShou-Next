import { AttachmentManagerService } from '@baishou/core-desktop'
import type { IStoragePathService } from '@baishou/core-desktop'
import { prepareAvatarSourceForImport } from './avatar-compress.service'

/** 桌面端附件管理：头像导入前对大图做有损压缩 */
export class DesktopAttachmentManagerService extends AttachmentManagerService {
  constructor(pathProvider: IStoragePathService) {
    super(pathProvider)
  }

  override async importAvatar(
    absoluteSourcePath: string,
    prefix?: string,
    _sourceByteSize?: number
  ): Promise<string> {
    const prepared = await prepareAvatarSourceForImport(absoluteSourcePath)
    return super.importAvatar(prepared, prefix)
  }

  override async importBackground(absoluteSourcePath: string): Promise<string> {
    // Backgrounds also benefit from compression for large images
    const prepared = await prepareAvatarSourceForImport(absoluteSourcePath)
    return super.importBackground(prepared)
  }
}
