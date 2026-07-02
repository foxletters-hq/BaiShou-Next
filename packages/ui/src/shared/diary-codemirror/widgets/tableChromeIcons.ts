const SVG_NS = 'http://www.w3.org/2000/svg'

function dot(cx: number, cy: number, r = 1.35): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, 'circle')
  circle.setAttribute('cx', String(cx))
  circle.setAttribute('cy', String(cy))
  circle.setAttribute('r', String(r))
  return circle
}

/** 列/行把手：两列三行圆点（Obsidian 同款 ⋮⋮ 视觉） */
export function createTableGripIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 10 16')
  svg.setAttribute('width', '10')
  svg.setAttribute('height', '16')
  svg.setAttribute('class', 'cm-table-grip-icon')
  svg.setAttribute('aria-hidden', 'true')
  for (const y of [3, 8, 13]) {
    svg.appendChild(dot(3.25, y))
    svg.appendChild(dot(6.75, y))
  }
  return svg
}

/** 左上角表格把手：3×3 圆点网格 */
export function createTableGridIcon(cols: number, rows: number): SVGSVGElement {
  const gapX = 5
  const gapY = 5
  const width = (cols - 1) * gapX + 4
  const height = (rows - 1) * gapY + 4
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('class', 'cm-table-grid-icon')
  svg.setAttribute('aria-hidden', 'true')
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      svg.appendChild(dot(2 + col * gapX, 2 + row * gapY, 1.2))
    }
  }
  return svg
}
