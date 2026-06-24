const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [...(config.watchFolders || []), workspaceRoot]

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

const databaseNativeEntry = path.resolve(
  workspaceRoot,
  'packages/database/src/index.native.ts'
)

const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith('node:') ||
    nodeBuiltinPrefixes.some((p) => moduleName === p || moduleName.startsWith(p + '/'))
  ) {
    return {
      filePath: mockPath,
      type: 'sourceFile'
    }
  }

  // Expo Web / SSR 不走 react-native export condition，会误解析到 index.ts → index.desktop（已被 blockList）
  if (moduleName === '@baishou/database') {
    return {
      filePath: databaseNativeEntry,
      type: 'sourceFile'
    }
  }

  // Expo SDK 55 默认 resolveRequest 为 null，必须回退到 context.resolveRequest（Metro 内置解析器）
  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

const { withUniwindConfig } = require('uniwind/metro')

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts'
})
