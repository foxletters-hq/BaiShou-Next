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

export async function readPdfTextFromPath(filePath: string): Promise<string> {
  if (!filePath) return ''
  const pdfParse = nodeRequire('pdf-parse') as (
    buffer: Buffer
  ) => Promise<{ text?: string }>
  const dataBuffer = fs.readFileSync(filePath)
  const pdfData = await pdfParse(dataBuffer)
  return pdfData.text || ''
}
