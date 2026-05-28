declare module 'pdf-parse' {
  function pdfParse(dataBuffer: Buffer): Promise<{ text?: string }>
  export default pdfParse
}
