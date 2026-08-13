import * as fs from 'fs/promises'
import * as path from 'path'

function normalizeRelative(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/$/, '')
}

function joinRelative(parent: string, name: string): string {
  const base = normalizeRelative(parent)
  const leaf = name.trim().replace(/\\/g, '/').split('/').pop() ?? ''
  if (!leaf) return base
  return base ? `${base}/${leaf}` : leaf
}

function incrementSmartEntryName(name: string, isFolder: boolean): string {
  const lastDot = !isFolder ? name.lastIndexOf('.') : -1

  if (!isFolder && lastDot >= 0) {
    const suffixRegex = /(.*[.\-_])(\d+)(\..*)$/
    if (suffixRegex.test(name)) {
      return name.replace(suffixRegex, (_match, prefix: string, number: string, ext: string) => {
        const next = parseInt(number, 10) + 1
        return `${prefix}${String(next).padStart(number.length, '0')}${ext}`
      })
    }
    return `${name.slice(0, lastDot)}.1${name.slice(lastDot)}`
  }

  const trailingNumber = /(\d+)$/
  if (trailingNumber.test(name)) {
    return name.replace(trailingNumber, (_match, number: string) => {
      const next = parseInt(number, 10) + 1
      return String(next).padStart(number.length, '0')
    })
  }

  return `${name}1`
}

async function uniqueNameInDir(
  parentAbs: string,
  desiredName: string,
  isDirectory: boolean
): Promise<string> {
  let candidate = desiredName
  for (;;) {
    try {
      await fs.access(path.join(parentAbs, candidate))
      candidate = incrementSmartEntryName(candidate, isDirectory)
    } catch {
      return candidate
    }
  }
}

async function copyRecursive(src: string, dest: string): Promise<void> {
  const stat = await fs.stat(src)
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry.name), path.join(dest, entry.name))
    }
    return
  }
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.copyFile(src, dest)
}

function assertNotIntoSelf(fromRelative: string, toParentRelative: string): void {
  const from = normalizeRelative(fromRelative)
  const toParent = normalizeRelative(toParentRelative)
  if (!from) throw new Error('Cannot transfer workspace root')
  if (toParent === from || toParent.startsWith(`${from}/`)) {
    throw new Error('Cannot move or copy a folder into itself')
  }
}

export async function moveWorkspaceEntry(params: {
  resolveWithinRoot: (rootPath: string, relativePath?: string) => string
  rootPath: string
  fromRelative: string
  toParentRelative: string
}): Promise<{ relativePath: string }> {
  const fromRelative = normalizeRelative(params.fromRelative)
  const toParentRelative = normalizeRelative(params.toParentRelative)
  assertNotIntoSelf(fromRelative, toParentRelative)

  const fromAbs = params.resolveWithinRoot(params.rootPath, fromRelative)
  const toParentAbs = params.resolveWithinRoot(params.rootPath, toParentRelative || '')
  const fromStat = await fs.stat(fromAbs)
  if (!(await fs.stat(toParentAbs)).isDirectory()) {
    throw new Error('Drop target is not a directory')
  }

  const baseName = path.basename(fromAbs)
  const uniqueName = await uniqueNameInDir(toParentAbs, baseName, fromStat.isDirectory())
  const nextRelative = joinRelative(toParentRelative, uniqueName)
  const toAbs = params.resolveWithinRoot(params.rootPath, nextRelative)

  try {
    await fs.rename(fromAbs, toAbs)
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined
    if (code === 'EXDEV') {
      await copyRecursive(fromAbs, toAbs)
      await fs.rm(fromAbs, { recursive: true, force: true })
    } else {
      throw error
    }
  }

  return { relativePath: nextRelative }
}

export async function copyWorkspaceEntry(params: {
  resolveWithinRoot: (rootPath: string, relativePath?: string) => string
  rootPath: string
  fromRelative: string
  toParentRelative: string
}): Promise<{ relativePath: string }> {
  const fromRelative = normalizeRelative(params.fromRelative)
  const toParentRelative = normalizeRelative(params.toParentRelative)
  assertNotIntoSelf(fromRelative, toParentRelative)

  const fromAbs = params.resolveWithinRoot(params.rootPath, fromRelative)
  const toParentAbs = params.resolveWithinRoot(params.rootPath, toParentRelative || '')
  const fromStat = await fs.stat(fromAbs)
  if (!(await fs.stat(toParentAbs)).isDirectory()) {
    throw new Error('Drop target is not a directory')
  }

  const baseName = path.basename(fromAbs)
  const uniqueName = await uniqueNameInDir(toParentAbs, baseName, fromStat.isDirectory())
  const nextRelative = joinRelative(toParentRelative, uniqueName)
  const toAbs = params.resolveWithinRoot(params.rootPath, nextRelative)
  await copyRecursive(fromAbs, toAbs)
  return { relativePath: nextRelative }
}

export async function importExternalPaths(params: {
  resolveWithinRoot: (rootPath: string, relativePath?: string) => string
  rootPath: string
  toParentRelative: string
  absolutePaths: string[]
}): Promise<{ imported: string[] }> {
  const toParentRelative = normalizeRelative(params.toParentRelative)
  const toParentAbs = params.resolveWithinRoot(params.rootPath, toParentRelative || '')
  if (!(await fs.stat(toParentAbs)).isDirectory()) {
    throw new Error('Drop target is not a directory')
  }

  const rootAbs = path.resolve(params.rootPath)
  const imported: string[] = []

  for (const raw of params.absolutePaths) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    const srcAbs = path.resolve(raw)
    let srcStat
    try {
      srcStat = await fs.stat(srcAbs)
    } catch {
      continue
    }

    // 禁止把工作区根自身再导入；允许从工作区内路径复制一份
    if (srcAbs === rootAbs) continue

    const baseName = path.basename(srcAbs)
    const uniqueName = await uniqueNameInDir(toParentAbs, baseName, srcStat.isDirectory())
    const nextRelative = joinRelative(toParentRelative, uniqueName)
    const destAbs = params.resolveWithinRoot(params.rootPath, nextRelative)
    await copyRecursive(srcAbs, destAbs)
    imported.push(nextRelative)
  }

  return { imported }
}
