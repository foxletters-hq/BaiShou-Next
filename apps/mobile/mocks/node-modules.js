const noop = () => {}
const noopAsync = () => Promise.resolve()
const emptyObj = {}
const emptyArr = []
const emptyStr = ''

class AsyncLocalStorage {
  constructor() {
    this._store = undefined
  }
  run(store, fn) {
    const previous = this._store
    this._store = store
    try {
      const result = fn()
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          this._store = previous
        })
      }
      this._store = previous
      return result
    } catch (error) {
      this._store = previous
      throw error
    }
  }
  getStore() {
    return this._store
  }
}

module.exports = {
  AsyncLocalStorage,
  readFile: noopAsync,
  writeFile: noopAsync,
  access: noopAsync,
  mkdir: noopAsync,
  unlink: noopAsync,
  readdir: noopAsync,
  createReadStream: noop,
  createWriteStream: noop,
  existsSync: () => false,
  readdirSync: () => emptyArr,
  statSync: () => emptyObj,
  pathToFileURL: (p) => ({ href: p }),
  fileURLToPath: (p) => p,
  join: (...args) => args.join('/'),
  resolve: (...args) => args.join('/'),
  relative: (from, to) => to || from,
  isAbsolute: (p) => typeof p === 'string' && p.startsWith('/'),
  delimiter: ':',
  sep: '/',
  spawn: () => {
    throw new Error('child_process is unavailable on mobile')
  },
  rm: noopAsync,
  stat: noopAsync,
  copyFile: noopAsync,
  basename: (p) => p.split('/').pop() || '',
  dirname: (p) => p.split('/').slice(0, -1).join('/') || '/',
  extname: (p) => {
    const parts = p.split('.')
    return parts.length > 1 ? '.' + parts.pop() : ''
  },
  randomUUID: () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    }),
  createHash: () => ({
    update() {
      return this
    },
    digest: () => ''
  }),
  TextDecoder: typeof TextDecoder === 'function' ? TextDecoder : class TextDecoder {},
  TextEncoder: typeof TextEncoder === 'function' ? TextEncoder : class TextEncoder {},
  homedir: () => '/',
  tmpdir: () => '/tmp',
  platform: () => 'linux',
  arch: () => 'x64',
  cpus: () => [],
  totalmem: () => 0,
  freemem: () => 0,
  networkInterfaces: () => emptyObj
}
