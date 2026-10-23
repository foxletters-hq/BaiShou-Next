import { canvasStyles } from './graph-screen-canvas.styles'
import { detailStyles } from './graph-screen-detail.styles'
import { listStyles } from './graph-screen-list.styles'
import { overlayStyles } from './graph-screen-overlay.styles'

/**
 * 图谱页样式总出口：按画布 / 详情 / 列表 / 弹层职责拆分后合并，
 * 保持原有 `styles` 字段与引用方式不变。
 */
export const styles = {
  ...canvasStyles,
  ...detailStyles,
  ...overlayStyles,
  ...listStyles
}
