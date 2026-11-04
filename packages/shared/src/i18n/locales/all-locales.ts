/**
 * 四种语言的完整 UI 文案目录（静态导入）。
 *
 * 只给需要同时持有全部语言的地方用：主进程翻译（main-i18n.util）和测试。
 * 渲染进程走 i18n.ts 的按需加载，不要从这里引入。
 */
import en from './en'
import ja from './ja'
import zh from './zh'
import zhTW from './zh-TW'

export const UI_LOCALE_CATALOGS = {
  zh,
  en,
  ja,
  'zh-TW': zhTW
} as const

export type UiLocaleCode = keyof typeof UI_LOCALE_CATALOGS
