const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (preserve Expo defaults)
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Add sqlite wasm support
config.resolver.assetExts.push('wasm');

// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths` (REMOVED - breaks pnpm symlink traversal in Expo 50+)
// config.resolver.disableHierarchicalLookup = true;

// 4. Inject global polyfills before any other module evaluates natively
const originalGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (ctx) => {
  const polyfills = originalGetPolyfills ? originalGetPolyfills(ctx) : [];
  return [path.resolve(projectRoot, 'polyfill.js'), ...polyfills];
};

// 5. Redirect Node.js built-in modules to mock stubs for React Native compatibility
const nodeBuiltinPrefixes = ['fs/', 'fs', 'path/', 'path', 'crypto', 'os', 'url', 'stream', 'buffer', 'child_process', 'util', 'http', 'https', 'net', 'tls', 'dns', 'dgram', 'cluster', 'events', 'readline', 'repl', 'string_decoder', 'tty', 'v8', 'vm', 'zlib'];
const mockPath = path.resolve(projectRoot, 'mocks/node-modules.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('node:') || nodeBuiltinPrefixes.some(p => moduleName === p || moduleName.startsWith(p + '/'))) {
    return {
      filePath: mockPath,
      type: 'sourceFile',
    };
  }
  // Fallback to default resolver - Expo 55 Metro API
  if (context.resolveRequest) {
    return context.resolveRequest(context, moduleName, platform);
  }
  return null;
};

module.exports = config;
