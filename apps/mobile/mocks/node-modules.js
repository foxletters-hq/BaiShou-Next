const noop = () => {};
const noopAsync = () => Promise.resolve();
const emptyObj = {};
const emptyArr = [];
const emptyStr = '';

module.exports = {
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
  basename: (p) => p.split('/').pop() || '',
  dirname: (p) => p.split('/').slice(0, -1).join('/') || '/',
  extname: (p) => { const parts = p.split('.'); return parts.length > 1 ? '.' + parts.pop() : ''; },
  randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16); }),
  homedir: () => '/',
  tmpdir: () => '/tmp',
  platform: () => 'linux',
  arch: () => 'x64',
  cpus: () => [],
  totalmem: () => 0,
  freemem: () => 0,
  networkInterfaces: () => emptyObj,
};
