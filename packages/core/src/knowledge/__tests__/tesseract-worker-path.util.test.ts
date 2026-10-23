import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildTesseractNodeWorkerPath,
  isUsableTesseractNodeWorkerPath,
  resolveTesseractNodeWorkerPath,
  tesseractCreateWorkerOptions
} from '../extract-engines/tesseract-worker-path.util'

describe('buildTesseractNodeWorkerPath', () => {
  it('拼接官方 Node worker 入口', () => {
    const built = buildTesseractNodeWorkerPath(path.join('D:', 'vendor', 'tesseract.js'))
    expect(built).toBe(
      path.join('D:', 'vendor', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js')
    )
  })
})

describe('isUsableTesseractNodeWorkerPath', () => {
  it('空路径不可用', () => {
    expect(isUsableTesseractNodeWorkerPath(null)).toBe(false)
    expect(isUsableTesseractNodeWorkerPath('')).toBe(false)
    expect(isUsableTesseractNodeWorkerPath(path.join('D:', 'missing-worker.js'))).toBe(false)
  })
})

describe('tesseractCreateWorkerOptions', () => {
  it('仅在文件存在时返回 workerPath', () => {
    expect(tesseractCreateWorkerOptions(path.join('D:', 'missing-worker.js'))).toBeUndefined()
    const installed = resolveTesseractNodeWorkerPath()
    if (!installed) return
    expect(tesseractCreateWorkerOptions(installed)).toEqual({ workerPath: installed })
    expect(installed.replaceAll('\\', '/')).toMatch(
      /tesseract\.js\/src\/worker-script\/node\/index\.js$/
    )
  })
})
