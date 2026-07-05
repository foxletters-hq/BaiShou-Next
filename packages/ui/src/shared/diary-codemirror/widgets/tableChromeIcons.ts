const SVG_NS = 'http://www.w3.org/2000/svg'

function dot(cx: number, cy: number, r = 1.35): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, 'circle')
  circle.setAttribute('cx', String(cx))
  circle.setAttribute('cy', String(cy))
  circle.setAttribute('r', String(r))
  return circle
}

/** 三圆点横条（ckant 列把手） */
export function createCkantHorizontalGrip(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'cm-tbl-grip-h')
  svg.setAttribute('width', '15')
  svg.setAttribute('height', '3')
  svg.setAttribute('viewBox', '0 0 15 3')
  svg.setAttribute('aria-hidden', 'true')
  for (const cx of [1.5, 7.5, 13.5]) {
    svg.appendChild(dot(cx, 1.5, 1.5))
  }
  return svg
}

/** 三圆点竖条（ckant 行把手） */
export function createCkantVerticalGrip(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'cm-tbl-grip-v')
  svg.setAttribute('width', '3')
  svg.setAttribute('height', '15')
  svg.setAttribute('viewBox', '0 0 3 15')
  svg.setAttribute('aria-hidden', 'true')
  for (const cy of [1.5, 7.5, 13.5]) {
    svg.appendChild(dot(1.5, cy, 1.5))
  }
  return svg
}

/** 列/行把手：两列三行圆点（⋮⋮ 视觉） */
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

/** 加行/加列「+」图标（粗线条，避免字体 + 过细） */
export function createCkantPlusIcon(size = 14): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'cm-tbl-plus')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 14 14')
  svg.setAttribute('aria-hidden', 'true')

  const stroke = '2.5'
  const h = document.createElementNS(SVG_NS, 'line')
  h.setAttribute('x1', '2')
  h.setAttribute('y1', '7')
  h.setAttribute('x2', '12')
  h.setAttribute('y2', '7')
  h.setAttribute('stroke', 'currentColor')
  h.setAttribute('stroke-width', stroke)
  h.setAttribute('stroke-linecap', 'round')

  const v = document.createElementNS(SVG_NS, 'line')
  v.setAttribute('x1', '7')
  v.setAttribute('y1', '2')
  v.setAttribute('x2', '7')
  v.setAttribute('y2', '12')
  v.setAttribute('stroke', 'currentColor')
  v.setAttribute('stroke-width', stroke)
  v.setAttribute('stroke-linecap', 'round')

  svg.appendChild(h)
  svg.appendChild(v)
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
