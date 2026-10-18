const fs = require('node:fs')
const path = require('node:path')

const LUCIDE_SOURCE = 'lucide-react-native'
const ICON_MODULE_PREFIX = 'lucide-react-native/dist/esm/icons/'
const BARREL_EXPORT_RE = /export\s*\{([^}]+)\}\s*from\s*['"]\.\/icons\/([^'"]+)['"]/g
const DEFAULT_AS_RE = /default as\s+([A-Za-z0-9_]+)/g

const mapCache = new Map()

function defaultBarrelCandidates() {
  return [
    path.resolve(process.cwd(), 'node_modules/lucide-react-native/dist/esm/lucide-react-native.js'),
    path.resolve(
      process.cwd(),
      '../../node_modules/lucide-react-native/dist/esm/lucide-react-native.js'
    )
  ]
}

function resolveBarrelFile(barrelFile) {
  if (barrelFile && fs.existsSync(barrelFile)) return barrelFile
  for (const candidate of defaultBarrelCandidates()) {
    if (fs.existsSync(candidate)) return candidate
  }
  try {
    return require.resolve('lucide-react-native/dist/esm/lucide-react-native.js')
  } catch {
    return null
  }
}

function parseLucideBarrel(source) {
  const map = Object.create(null)
  BARREL_EXPORT_RE.lastIndex = 0
  let match
  while ((match = BARREL_EXPORT_RE.exec(source))) {
    const specifiers = match[1]
    const fileName = match[2]
    const modulePath = `${ICON_MODULE_PREFIX}${fileName}`
    DEFAULT_AS_RE.lastIndex = 0
    let spec
    while ((spec = DEFAULT_AS_RE.exec(specifiers))) {
      map[spec[1]] = modulePath
    }
  }
  return map
}

function loadLucideIconModuleMap(barrelFile) {
  const resolved = resolveBarrelFile(barrelFile)
  if (!resolved) {
    throw new Error('lucide-native-deep-import: 找不到 lucide-react-native 的导出清单文件')
  }
  const cached = mapCache.get(resolved)
  if (cached) return cached
  const map = parseLucideBarrel(fs.readFileSync(resolved, 'utf8'))
  mapCache.set(resolved, map)
  return map
}

function importedName(types, specifier) {
  const imported = specifier.imported
  return types.isIdentifier(imported) ? imported.name : imported.value
}

function isTypeSpecifier(specifier) {
  return specifier.importKind === 'type' || specifier.importKind === 'typeof'
}

module.exports = function lucideNativeDeepImport(babel) {
  const t = babel.types
  return {
    name: 'lucide-native-deep-import',
    visitor: {
      ImportDeclaration(importPath, state) {
        if (importPath.node.source.value !== LUCIDE_SOURCE) return
        if (importPath.node.importKind === 'type' || importPath.node.importKind === 'typeof') {
          return
        }

        const valueSpecs = []
        const typeSpecs = []
        for (const spec of importPath.node.specifiers) {
          if (!t.isImportSpecifier(spec)) return
          if (isTypeSpecifier(spec)) typeSpecs.push(spec)
          else valueSpecs.push(spec)
        }
        if (valueSpecs.length === 0) return

        const iconMap = loadLucideIconModuleMap(state.opts && state.opts.barrelFile)
        const nextImports = []

        if (typeSpecs.length > 0) {
          const typeImport = t.importDeclaration(
            typeSpecs.map((spec) => t.importSpecifier(spec.local, spec.imported)),
            t.stringLiteral(LUCIDE_SOURCE)
          )
          typeImport.importKind = 'type'
          nextImports.push(typeImport)
        }

        for (const spec of valueSpecs) {
          const name = importedName(t, spec)
          const modulePath = iconMap[name]
          if (!modulePath) {
            throw importPath.buildCodeFrameError(
              `lucide-native-deep-import: 未找到图标导出 ${name}`
            )
          }
          nextImports.push(
            t.importDeclaration([t.importDefaultSpecifier(spec.local)], t.stringLiteral(modulePath))
          )
        }

        importPath.replaceWithMultiple(nextImports)
      }
    }
  }
}

module.exports.parseLucideBarrel = parseLucideBarrel
module.exports.loadLucideIconModuleMap = loadLucideIconModuleMap
