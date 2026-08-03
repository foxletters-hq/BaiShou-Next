declare module 'tesseract.js' {
  export function createWorker(
    langs?: string | string[],
    oem?: number,
    options?: unknown
  ): Promise<{
    loadLanguage: (lang: string) => Promise<void>
    initialize: (lang: string) => Promise<void>
    recognize: (image: string | Buffer) => Promise<{ data: { text: string } }>
    terminate: () => Promise<void>
  }>
  const _default: { createWorker: typeof createWorker }
  export default _default
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export const getDocument: (src: unknown) => { promise: Promise<unknown> }
  export const GlobalWorkerOptions: { workerSrc: string }
}
