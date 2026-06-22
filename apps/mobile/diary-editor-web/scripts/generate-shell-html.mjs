/**
 * 从 index.template.html 生成 assets/diary-editor/index.html（shell + 外部 bundle 引用）。
 * 运行时由 RN 将 index.html 与 diary-editor.bundle 复制到同一目录再加载 WebView。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const assetDir = path.resolve(__dirname, '../../assets/diary-editor')
const bundlePath = path.join(assetDir, 'diary-editor.bundle')
const templatePath = path.join(webRoot, 'index.template.html')
const outPath = path.join(assetDir, 'index.html')

const MIN_BUNDLE_BYTES = 100_000
const MAX_SHELL_HTML_BYTES = 8_192

if (!fs.existsSync(bundlePath)) {
  console.error('generate-shell-html: diary-editor.bundle 不存在，请先 vite build')
  process.exit(1)
}
if (!fs.existsSync(templatePath)) {
  console.error('generate-shell-html: index.template.html 不存在')
  process.exit(1)
}

const bundle = fs.readFileSync(bundlePath, 'utf8')
if (!bundle.includes('__diaryCmOnNativeMessage')) {
  console.error('generate-shell-html: bundle 缺少 __diaryCmOnNativeMessage，构建可能损坏')
  process.exit(1)
}

const bundleSize = fs.statSync(bundlePath).size
if (bundleSize < MIN_BUNDLE_BYTES) {
  console.error(
    `generate-shell-html: bundle 过小 (${bundleSize} bytes)，期望 >= ${MIN_BUNDLE_BYTES}`
  )
  process.exit(1)
}

const template = fs.readFileSync(templatePath, 'utf8')
if (!template.includes('diary-editor.bundle')) {
  console.error('generate-shell-html: template 须引用 diary-editor.bundle')
  process.exit(1)
}

fs.writeFileSync(outPath, template)

const shellSize = fs.statSync(outPath).size
if (shellSize > MAX_SHELL_HTML_BYTES) {
  console.error(
    `generate-shell-html: shell 过大 (${shellSize} bytes)，不应内联 bundle`
  )
  process.exit(1)
}

console.log(
  `generate-shell-html: 已生成 ${outPath} (${shellSize} bytes), bundle ${bundleSize} bytes`
)
