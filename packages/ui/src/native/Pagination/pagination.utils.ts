/**
 * Native 端分页算法工具函数
 */

/** 计算页码范围 */
export function getNativePaginationRange(
  current: number,
  total: number,
  siblingCount: number
): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = []

  if (siblingCount === 0) {
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i)
      return pages
    }
    if (current <= 2) {
      pages.push(1, 2, 'ellipsis', total)
      return pages
    }
    if (current >= total - 1) {
      pages.push(1, 'ellipsis', total - 1, total)
      return pages
    }
    pages.push(1, 'ellipsis', current, 'ellipsis', total)
    return pages
  }

  const totalPageNumbers = siblingCount * 2 + 3
  if (total <= totalPageNumbers) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
    return pages
  }

  const leftSiblingIndex = Math.max(current - siblingCount, 1)
  const rightSiblingIndex = Math.min(current + siblingCount, total)

  const showLeftEllipsis = leftSiblingIndex > 2
  const showRightEllipsis = rightSiblingIndex < total - 1

  if (!showLeftEllipsis) {
    for (let i = 1; i <= rightSiblingIndex + 1; i++) {
      pages.push(i)
    }
    pages.push('ellipsis')
    pages.push(total)
    return pages
  }

  if (!showRightEllipsis) {
    pages.push(1)
    pages.push('ellipsis')
    for (let i = leftSiblingIndex - 1; i <= total; i++) {
      pages.push(i)
    }
    return pages
  }

  pages.push(1)
  pages.push('ellipsis')
  for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
    pages.push(i)
  }
  pages.push('ellipsis')
  pages.push(total)

  return pages
}
