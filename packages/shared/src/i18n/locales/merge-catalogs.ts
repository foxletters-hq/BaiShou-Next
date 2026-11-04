/**
 * 把按领域拆分的文案片段合并成一个 i18next `translation` 命名空间。
 *
 * 每个片段都是从根开始的局部目录（如 `{ "settings": { "rag_title": "…" } }`），
 * 同一个顶层命名空间可以分布在多个片段里，合并时逐层深合并，键路径与拆分前完全一致。
 *
 * 两个片段写了同一个叶子键时直接抛错：JSON 里的重复键会被静默覆盖，
 * 在这里显式失败，单元测试加载四种语言目录时就能拦住。
 */

type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
  arg: infer I
) => void
  ? I
  : never

/** 片段类型的交集：对象类型求交会逐层合并属性，正好对应运行时的深合并。 */
export type MergedCatalog<T extends readonly object[]> = UnionToIntersection<T[number]>

type CatalogNode = Record<string, unknown>

function isCatalogNode(value: unknown): value is CatalogNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeInto(target: CatalogNode, source: CatalogNode, parentPath: string): CatalogNode {
  for (const [key, value] of Object.entries(source)) {
    const keyPath = parentPath ? `${parentPath}.${key}` : key
    const existing = target[key]
    if (existing === undefined) {
      // 嵌套对象复制一份再写入，避免后续合并改动被导入的 JSON 模块对象
      target[key] = isCatalogNode(value) ? mergeInto({}, value, keyPath) : value
      continue
    }
    if (isCatalogNode(existing) && isCatalogNode(value)) {
      mergeInto(existing, value, keyPath)
      continue
    }
    throw new Error(`[i18n] 文案片段之间存在重复键：${keyPath}`)
  }
  return target
}

export function mergeCatalogs<T extends object[]>(...fragments: T): MergedCatalog<T> {
  const catalog: CatalogNode = {}
  for (const fragment of fragments) {
    mergeInto(catalog, fragment as CatalogNode, '')
  }
  return catalog as MergedCatalog<T>
}
