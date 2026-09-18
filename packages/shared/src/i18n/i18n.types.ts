import 'react-i18next'
import zh from './zh.i18n.json'

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof zh
    }
  }
}

// 可选：供外部非 hook 调用的纯工具类型提取
type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...0[]]

export type Paths<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof T]-?: K extends string | number ? `${K}` | Join<K, Paths<T[K], Prev[D]>> : never
      }[keyof T]
    : ''

export type I18nKey = Paths<typeof zh>

/**
 * 只要求「给 key 和回退文案，返回字符串」。
 * 第二参必须是必填 string：写成 `fallback?: string` 时，strictFunctionTypes
 * 会把这个可选 string 和 i18next `TFunction` 的 options 对象重载做逆变比较，
 * 更强的 `TFunction` 反而赋不进来。调用方本来就会传入回退文案。
 */
export type FallbackTranslateFn = (key: string, defaultValue: string) => string
