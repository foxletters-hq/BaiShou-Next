import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { DiaryAttachmentFileItem } from './attachment-manager.types'
import { extractReferencedFileNames } from './attachment-manager.utils'

export class AttachmentDiaryOps {
  constructor(private readonly pathProvider: IStoragePathService) {}

  async listDiaryAttachments(): Promise<DiaryAttachmentFileItem[]> {
    const list: DiaryAttachmentFileItem[] = []
    let journalsDir: string
    try {
      journalsDir = await this.pathProvider.getJournalsBaseDirectory()
      if (!existsSync(journalsDir)) {
        return []
      }
    } catch {
      return []
    }

    try {
      const years = await fs.readdir(journalsDir, { withFileTypes: true })
      for (const yearDir of years) {
        if (!yearDir.isDirectory() || !/^\d{4}$/.test(yearDir.name)) {
          continue
        }

        const yearPath = path.join(journalsDir, yearDir.name)
        const months = await fs.readdir(yearPath, { withFileTypes: true })
        for (const monthDir of months) {
          if (!monthDir.isDirectory() || !/^\d{2}$/.test(monthDir.name)) {
            continue
          }

          const monthPath = path.join(yearPath, monthDir.name)
          const attachDir = path.join(monthPath, 'attachment')

          if (!existsSync(attachDir)) {
            continue
          }

          const attachFiles = await fs.readdir(attachDir, { withFileTypes: true })
          const monthFiles = attachFiles.filter((f) => f.isFile())

          if (monthFiles.length === 0) {
            continue
          }

          const referencedNames = new Set<string>()
          const diaryPlainTexts: string[] = []
          const siblingFiles = await fs.readdir(monthPath, { withFileTypes: true })
          const diaryFiles = siblingFiles.filter(
            (f) => f.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(f.name)
          )

          await Promise.all(
            diaryFiles.map(async (df) => {
              try {
                const diaryPath = path.join(monthPath, df.name)
                const content = await fs.readFile(diaryPath, 'utf8')
                diaryPlainTexts.push(content)

                const refs = extractReferencedFileNames(content)
                for (const r of refs) {
                  referencedNames.add(r)
                }
              } catch (err) {
                console.warn(`[AttachmentManager] Failed to read diary ${df.name}:`, err)
              }
            })
          )

          for (const mf of monthFiles) {
            const fullFilePath = path.join(attachDir, mf.name)
            try {
              const stat = await fs.stat(fullFilePath)
              const relativePath = path.relative(journalsDir, fullFilePath).replace(/\\/g, '/')

              const lowerFileName = mf.name.toLowerCase()
              let isOrphan = !referencedNames.has(lowerFileName)

              if (isOrphan && diaryPlainTexts.length > 0) {
                const isMentioned = diaryPlainTexts.some((content) =>
                  content.toLowerCase().includes(lowerFileName)
                )
                if (isMentioned) {
                  isOrphan = false
                }
              }

              list.push({
                name: mf.name,
                path: fullFilePath,
                relativePath,
                sizeMB: stat.size / (1024 * 1024),
                birthtime: stat.birthtime.toISOString(),
                yearMonth: `${yearDir.name}-${monthDir.name}`,
                isOrphan
              })
            } catch (err) {
              console.warn(`[AttachmentManager] Failed to stat file ${mf.name}:`, err)
            }
          }
        }
      }
    } catch (e) {
      console.error('[AttachmentManager] Error listing diary attachments:', e)
    }

    return list
  }

  async deleteDiaryAttachment(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        await fs.unlink(filePath)
      }

      let currentDir = path.dirname(filePath)
      const journalsDir = await this.pathProvider.getJournalsBaseDirectory()

      while (currentDir !== journalsDir && currentDir.startsWith(journalsDir)) {
        if (existsSync(currentDir)) {
          const files = await fs.readdir(currentDir)
          if (files.length === 0) {
            await fs.rmdir(currentDir)
            currentDir = path.dirname(currentDir)
          } else {
            break
          }
        } else {
          break
        }
      }
    } catch (e) {
      console.error(`[AttachmentManager] Failed to delete diary attachment file ${filePath}:`, e)
    }
  }
}
