const { getDefaultConfig } = require('expo/metro-config')
const fs = require('fs')
const path = require('path')
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

function resolveWorkletsWatchDir() {
  const candidates = [
    path.resolve(projectRoot, 'node_modules/react-native-worklets/.worklets'),
    path.resolve(workspaceRoot, 'node_modules/react-native-worklets/.worklets')
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  try {
    const pkgRoot = path.dirname(
      require.resolve('react-native-worklets/package.json', {
        paths: [projectRoot, workspaceRoot]
      })
    )
    return path.join(pkgRoot, '.worklets')
  } catch {
    return candidates[1]
  }
}

let config = getDefaultConfig(projectRoot)

config.watchFolders = [...(config.watchFolders || []), workspaceRoot]

const workletsDir = resolveWorkletsWatchDir()
if (!config.watchFolders.includes(workletsDir)) {
  config.watchFolders.push(workletsDir)
}

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
]

config.resolver.assetExts.push('wasm', 'html', 'bundle')

// SVG 编译为 react-native-svg 组件（打进 JS 包），避免 Release 运行时再去读 android_res 资源
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo')
}
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg')
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg']

const originalGetPolyfills = config.serializer.getPolyfills
config.serializer.getPolyfills = (ctx) => {
  const polyfills = originalGetPolyfills ? originalGetPolyfills(ctx) : []
  return [path.resolve(projectRoot, 'polyfill.js'), ...polyfills]
}

// 仅对仍可能由传递依赖引入的 Node 内置模块做兜底；共用文件服务已走 IFileSystem + Expo
const nodeBuiltinPrefixes = ['crypto', 'fs', 'os', 'stream', 'buffer', 'util', 'zlib', 'path']
const mockPath = path.resolve(projectRoot, 'mocks/node-modules.js')

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /[/\\]@modelcontextprotocol[/\\]sdk[/\\].*[/\\]server[/\\]streamableHttp\.(js|cjs|mjs|ts)$/,
  /[/\\]@modelcontextprotocol[/\\]sdk[/\\].*[/\\]server[/\\]sse\.(js|cjs|mjs|ts)$/,
  /[/\\]@modelcontextprotocol[/\\]sdk[/\\].*[/\\]examples[/\\]/,
  new RegExp(`${path.resolve(workspaceRoot, 'apps/desktop').replace(/[/\\]/g, '[/\\\\]')}.*`),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/index.desktop.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/fs/node-file-system.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/fs/create-node-file-system.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/sync').replace(/[/\\]/g, '[/\\\\]')}[/\\\\](?!incremental-sync-external-mounts\\.ts$).+`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/import/legacy-import.service.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/database/src/index.desktop.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/database/src/connection.manager').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/database/src/shadow-index.connection.manager').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/database/src/drivers/node-sqlite.driver').replace(/[/\\]/g, '[/\\\\]')}`
  )
]

const databaseNativeEntry = path.resolve(workspaceRoot, 'packages/database/src/index.native.ts')

const preBundleResolveRequest = config.resolver.resolveRequest

config = getBundleModeMetroConfig(config)

const bundleModeResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('react-native-worklets/.worklets/')) {
    return bundleModeResolveRequest(context, moduleName, platform)
  }

  if (
    moduleName.startsWith('node:') ||
    nodeBuiltinPrefixes.some((p) => moduleName === p || moduleName.startsWith(p + '/'))
  ) {
    return {
      filePath: mockPath,
      type: 'sourceFile'
    }
  }

  if (moduleName === '@baishou/database') {
    return {
      filePath: databaseNativeEntry,
      type: 'sourceFile'
    }
  }

  if (typeof preBundleResolveRequest === 'function') {
    return preBundleResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

const { withUniwindConfig } = require('uniwind/metro')

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts'
})
