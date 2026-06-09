import { registerLocalFileReader } from '@baishou/ai'
import type { IFileSystem } from '@baishou/core-mobile'

/** 向 @baishou/ai 注册移动端读盘（BaiShou_Root 外部存储 + 沙盒），发送模型时按需读 base64 */
export function setupMobileLocalFileReader(fileSystem: IFileSystem): void {
  registerLocalFileReader({
    readBase64: (path) => fileSystem.readFile(path, 'base64')
  })
}
