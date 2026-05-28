/// <reference path="./pdf-parse.d.ts" />
import fs from 'fs'

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
  const pdfParse = (await import('pdf-parse')).default
  const dataBuffer = fs.readFileSync(filePath)
  const pdfData = await pdfParse(dataBuffer)
  return pdfData.text || ''
}
