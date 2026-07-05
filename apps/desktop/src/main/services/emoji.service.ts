import { dialog } from 'electron'
import { DesktopAttachmentManagerService } from './desktop-attachment-manager.service'
import { DesktopStoragePathService } from './path.service'
import type { EmojiImportResult } from '@baishou/core-desktop'

/**
 * 后端表情包管理服务
 * 处理文件选择、导入、列表、删除等操作
 */
export class EmojiService {
  private pathService = new DesktopStoragePathService()
  private attachmentManager = new DesktopAttachmentManagerService(this.pathService)

  /**
   * 唤起系统文件选择框，让用户选择表情包图片文件（支持多选）
   * 然后导入到 Vault 的 emojis 目录。
   * 保留原始文件名；如果文件名冲突，跳过并收集错误信息。
   *
   * @returns 导入结果数组，每项包含 relativePath/originalName/error
   */
  async pickAndImportEmojis(): Promise<EmojiImportResult[]> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择表情包',
      buttonLabel: '导入',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp', 'gif'] }]
    })

    if (canceled || filePaths.length === 0) {
      return []
    }

    const results: EmojiImportResult[] = []
    for (const sourcePath of filePaths) {
      try {
        const result = await this.attachmentManager.importEmoji(sourcePath)
        results.push(result)
      } catch (e: any) {
        results.push({
          relativePath: '',
          originalName: '',
          error: `导入失败: ${e?.message || String(e)}`
        })
      }
    }

    return results
  }

  /**
   * 列出所有已导入的表情包文件
   * @returns 相对路径数组
   */
  async listEmojis(): Promise<string[]> {
    return await this.attachmentManager.listEmojis()
  }

  /**
   * 将相对路径解析为可渲染的 local:// URI
   */
  async resolveEmojiPath(relativePath: string): Promise<string> {
    return await this.attachmentManager.resolveEmojiPath(relativePath)
  }

  /**
   * 批量解析表情包路径
   */
  async resolveEmojiPaths(relativePaths: string[]): Promise<string[]> {
    const results: string[] = []
    for (const rp of relativePaths) {
      try {
        const resolved = await this.attachmentManager.resolveEmojiPath(rp)
        results.push(resolved)
      } catch {
        // Skip missing files
      }
    }
    return results
  }

  /**
   * 删除一个表情包文件
   */
  async deleteEmoji(relativePath: string): Promise<boolean> {
    return await this.attachmentManager.deleteEmoji(relativePath)
  }
}

export const emojiService = new EmojiService()