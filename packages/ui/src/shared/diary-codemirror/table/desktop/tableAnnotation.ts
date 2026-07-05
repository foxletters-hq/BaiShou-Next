import { Annotation } from '@codemirror/state'

/** 表格 widget 触发的 doc 变更（对齐 ckant table.edit） */
export const tableEditAnnotation = Annotation.define<boolean>()

export function isTableEditTransaction(tr: { annotation: (a: typeof tableEditAnnotation) => boolean }): boolean {
  return tr.annotation(tableEditAnnotation) === true
}
