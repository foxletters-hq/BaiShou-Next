/// <reference path="./pdf-parse.d.ts" />
import fs from 'fs'
import { createRequire } from 'node:module'

/** 必须从 node_modules 加载（electron-vite 将 pdf-parse 标为 external） */
const nodeRequire = createRequire(import.meta.url)

/** 桌面 Node/Electron：可读本地路径 */
export function canReadLocalPath(filePath: string): boolean {
  return Boolean(filePath)
}

export function readLocalFileAsBase64(filePath: string): string {
  if (!filePath) return ''
  return fs.readFileSync(filePath).toString('base64')
}

export async function readLocalFileAsBase64Async(filePath: string): Promise<string> {
  return readLocalFileAsBase64(filePath)
}

export async function readLocalTextFile(filePath: string, maxBytes?: number): Promise<string> {
  if (!filePath) return ''
  if (!maxBytes || maxBytes <= 0) {
    return fs.readFileSync(filePath, 'utf8')
  }
  const fd = fs.openSync(filePath, 'r')
  try {
    const buf = Buffer.alloc(maxBytes)
    const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0)
    return buf.subarray(0, bytesRead).toString('utf8')
  } finally {
    fs.closeSync(fd)
  }
}

export async function readPdfTextFromPath(filePath: string): Promise<string> {
  if (!filePath) return ''
  const pdfParse = nodeRequire('pdf-parse') as (buffer: Buffer) => Promise<{ text?: string }>
  const dataBuffer = fs.readFileSync(filePath)
  const pdfData = await pdfParse(dataBuffer)
  return pdfData.text || ''
}
