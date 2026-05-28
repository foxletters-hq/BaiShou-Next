import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { DiaryExportServiceImpl } from '@baishou/core-mobile'
import type { DiaryService } from '@baishou/core-mobile'
import type { Diary } from '@baishou/shared'

export async function exportDiariesToShare(
  diaryService: DiaryService,
  format: 'md' | 'txt' | 'json' = 'md'
): Promise<void> {
  const metas = await diaryService.listAll({ limit: 10000, offset: 0 })
  const diaries: Diary[] = []
  for (const meta of metas) {
    const d = await diaryService.findById(meta.id)
    if (d) diaries.push(d as Diary)
  }

  const exporter = new DiaryExportServiceImpl()
  const buffer = await exporter.export(diaries, { format })
  const text = buffer.toString('utf-8')

  const ext = format === 'json' ? 'json' : format === 'txt' ? 'txt' : 'md'
  const outPath = `${FileSystem.cacheDirectory}BaiShou_Diary_Export_${Date.now()}.${ext}`
  await FileSystem.writeAsStringAsync(outPath, text, { encoding: FileSystem.EncodingType.UTF8 })

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(outPath, {
      mimeType: format === 'json' ? 'application/json' : 'text/plain',
      dialogTitle: '导出日记'
    })
  } else {
    throw new Error('当前设备不支持分享导出文件')
  }
}
