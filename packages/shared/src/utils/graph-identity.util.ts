/**
 * Stable graph node/edge identity helpers (vault-scoped, content-addressable edges).
 * Pure utilities — no Node crypto; MD5 matches packages/core fs/md5 for entry ids.
 */

function md5cycle(x: number[], k: number[]) {
  let a = x[0]!
  let b = x[1]!
  let c = x[2]!
  let d = x[3]!

  a = ff(a, b, c, d, k[0]!, 7, -680876936)
  d = ff(d, a, b, c, k[1]!, 12, -389564586)
  c = ff(c, d, a, b, k[2]!, 17, 606105819)
  b = ff(b, c, d, a, k[3]!, 22, -1044525330)
  a = ff(a, b, c, d, k[4]!, 7, -176418897)
  d = ff(d, a, b, c, k[5]!, 12, 1200080426)
  c = ff(c, d, a, b, k[6]!, 17, -1473231341)
  b = ff(b, c, d, a, k[7]!, 22, -45705983)
  a = ff(a, b, c, d, k[8]!, 7, 1770035416)
  d = ff(d, a, b, c, k[9]!, 12, -1958414417)
  c = ff(c, d, a, b, k[10]!, 17, -42063)
  b = ff(b, c, d, a, k[11]!, 22, -1990404162)
  a = ff(a, b, c, d, k[12]!, 7, 1804603682)
  d = ff(d, a, b, c, k[13]!, 12, -40341101)
  c = ff(c, d, a, b, k[14]!, 17, -1502002290)
  b = ff(b, c, d, a, k[15]!, 22, 1236535329)

  a = gg(a, b, c, d, k[1]!, 5, -165796510)
  d = gg(d, a, b, c, k[6]!, 9, -1069501632)
  c = gg(c, d, a, b, k[11]!, 14, 643717713)
  b = gg(b, c, d, a, k[0]!, 20, -373897302)
  a = gg(a, b, c, d, k[5]!, 5, -701558691)
  d = gg(d, a, b, c, k[10]!, 9, 38016083)
  c = gg(c, d, a, b, k[15]!, 14, -660478335)
  b = gg(b, c, d, a, k[4]!, 20, -405537848)
  a = gg(a, b, c, d, k[9]!, 5, 568446438)
  d = gg(d, a, b, c, k[14]!, 9, -1019803690)
  c = gg(c, d, a, b, k[3]!, 14, -187363961)
  b = gg(b, c, d, a, k[8]!, 20, 1163531501)
  a = gg(a, b, c, d, k[13]!, 5, -1444681467)
  d = gg(d, a, b, c, k[2]!, 9, -51403784)
  c = gg(c, d, a, b, k[7]!, 14, 1735328473)
  b = gg(b, c, d, a, k[12]!, 20, -1926607734)

  a = hh(a, b, c, d, k[5]!, 4, -378558)
  d = hh(d, a, b, c, k[8]!, 11, -2022574463)
  c = hh(c, d, a, b, k[11]!, 16, 1839030562)
  b = hh(b, c, d, a, k[14]!, 23, -35309556)
  a = hh(a, b, c, d, k[1]!, 4, -1530992060)
  d = hh(d, a, b, c, k[4]!, 11, 1272893353)
  c = hh(c, d, a, b, k[7]!, 16, -155497632)
  b = hh(b, c, d, a, k[10]!, 23, -1094730640)
  a = hh(a, b, c, d, k[13]!, 4, 681279174)
  d = hh(d, a, b, c, k[0]!, 11, -358537222)
  c = hh(c, d, a, b, k[3]!, 16, -722521979)
  b = hh(b, c, d, a, k[6]!, 23, 76029189)
  a = hh(a, b, c, d, k[9]!, 4, -640364487)
  d = hh(d, a, b, c, k[12]!, 11, -421815835)
  c = hh(c, d, a, b, k[15]!, 16, 530742520)
  b = hh(b, c, d, a, k[2]!, 23, -995338651)

  a = ii(a, b, c, d, k[0]!, 6, -198630844)
  d = ii(d, a, b, c, k[7]!, 10, 1126891415)
  c = ii(c, d, a, b, k[14]!, 15, -1416354905)
  b = ii(b, c, d, a, k[5]!, 21, -57434055)
  a = ii(a, b, c, d, k[12]!, 6, 1700485571)
  d = ii(d, a, b, c, k[3]!, 10, -1894986606)
  c = ii(c, d, a, b, k[10]!, 15, -1051523)
  b = ii(b, c, d, a, k[1]!, 21, -2054922799)
  a = ii(a, b, c, d, k[8]!, 6, 1873313359)
  d = ii(d, a, b, c, k[15]!, 10, -30611744)
  c = ii(c, d, a, b, k[6]!, 15, -1560198380)
  b = ii(b, c, d, a, k[13]!, 21, 1309151649)
  a = ii(a, b, c, d, k[4]!, 6, -145523070)
  d = ii(d, a, b, c, k[11]!, 10, -1120210379)
  c = ii(c, d, a, b, k[2]!, 15, 718787259)
  b = ii(b, c, d, a, k[9]!, 21, -343485551)

  x[0] = add32(a, x[0]!)
  x[1] = add32(b, x[1]!)
  x[2] = add32(c, x[2]!)
  x[3] = add32(d, x[3]!)
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
  a = add32(add32(a, q), add32(x, t))
  return add32((a << s) | (a >>> (32 - s)), b)
}
function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & c) | (~b & d), a, b, x, s, t)
}
function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & d) | (c & ~d), a, b, x, s, t)
}
function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(b ^ c ^ d, a, b, x, s, t)
}
function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(c ^ (b | ~d), a, b, x, s, t)
}
function add32(a: number, b: number) {
  return (a + b) & 0xffffffff
}

function md51(s: string): number[] {
  const n = s.length
  const state = [1732584193, -271733879, -1732584194, 271733878]
  let i: number
  for (i = 64; i <= n; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)))
  }
  s = s.substring(i - 64)
  const tail = new Array<number>(16).fill(0)
  for (i = 0; i < s.length; i++) tail[i >> 2]! |= s.charCodeAt(i) << (i % 4) * 8
  tail[i >> 2]! |= 0x80 << (i % 4) * 8
  if (i > 55) {
    md5cycle(state, tail)
    for (let j = 0; j < 16; j++) tail[j] = 0
  }
  tail[14] = n * 8
  md5cycle(state, tail)
  return state
}

function md5blk(s: string): number[] {
  const md5blks: number[] = []
  for (let i = 0; i < 64; i += 4) {
    md5blks[i >> 2] =
      s.charCodeAt(i) +
      (s.charCodeAt(i + 1) << 8) +
      (s.charCodeAt(i + 2) << 16) +
      (s.charCodeAt(i + 3) << 24)
  }
  return md5blks
}

function rhex(n: number) {
  const hex = '0123456789abcdef'
  let s = ''
  for (let j = 0; j < 4; j++) {
    s += hex.charAt((n >> (j * 8 + 4)) & 0x0f) + hex.charAt((n >> (j * 8)) & 0x0f)
  }
  return s
}

function md5Hex(content: string): string {
  return md51(content).map(rhex).join('')
}

/** Content-addressable id from an already-composed salt key. */
export function graphIdFromKey(key: string): string {
  return graphIdFromDigest(md5Hex(key))
}

/** UUID-shaped hex from MD5 (version-ish 5 / variant a). */
export function graphIdFromDigest(hex: string): string {
  const h = hex.toLowerCase().replace(/[^0-9a-f]/g, '')
  const padded = (h + '0'.repeat(32)).slice(0, 32)
  return `${padded.slice(0, 8)}-${padded.slice(8, 12)}-5${padded.slice(13, 16)}-a${padded.slice(17, 20)}-${padded.slice(20, 32)}`
}

/** Trim, collapse whitespace, lower-case — logical key for entity nodes. */
export function normalizeGraphName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export type GraphExactNameHit = {
  id: string
  name: string
  aliases?: string[] | null
}

/** Only name / alias equality after normalize. Never pick a fuzzy first hit. */
export function pickExactGraphNameHit<T extends GraphExactNameHit>(
  hits: readonly T[],
  name: string
): T | null {
  const key = normalizeGraphName(name)
  if (!key) return null
  for (const hit of hits) {
    if (normalizeGraphName(hit.name) === key) return hit
    if ((hit.aliases ?? []).some((alias) => normalizeGraphName(alias) === key)) return hit
  }
  return null
}

/**
 * Chat / tool lookup: name or alias equality only.
 * Typed lookup stays typed; untyped lookup is fail-closed when several types match.
 * Never consults a ranked / truncated search list.
 */
export async function resolveExactGraphNodeHit<T extends GraphExactNameHit>(
  opts: { name: string; nodeType?: string },
  deps: {
    findByNameOrAlias: (name: string, nodeType?: string) => Promise<T | null>
  }
): Promise<T | null> {
  const name = opts.name.trim()
  if (!name) return null
  return deps.findByNameOrAlias(name, opts.nodeType)
}

/** Existing `user` always wins; incoming `user` may upgrade `ai`. */
export function preferGraphOrigin(
  existing?: string | null,
  incoming?: 'ai' | 'user'
): 'ai' | 'user' {
  if (existing === 'user' || incoming === 'user') return 'user'
  return 'ai'
}

export function normalizeGraphFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '')
}

/**
 * Structural diary entry anchor id (vault-salted).
 * Same algorithm as legacy core `entryNodeIdForFilePath`.
 */
export function entryNodeIdForFilePath(filePath: string, vaultId?: string): string {
  const salt = vaultId?.trim() ? `${vaultId.trim()}\0` : ''
  return graphIdFromDigest(md5Hex(salt + normalizeGraphFilePath(filePath)))
}

/** Pre-vault-salt entry id (compat dual-lookup for old extracts). */
export function legacyEntryNodeIdForFilePath(filePath: string): string {
  return entryNodeIdForFilePath(filePath)
}

/**
 * Stable id for non-entry entities: (vaultId, nodeType, normalizedName).
 * Do not use for `entry` — use entryNodeIdForFilePath.
 */
export function graphNodeIdForEntity(vaultId: string, nodeType: string, name: string): string {
  const v = vaultId.trim()
  const t = nodeType.trim().toLowerCase() || 'topic'
  const n = normalizeGraphName(name)
  return graphIdFromDigest(md5Hex(`${v}\0${t}\0${n}`))
}

/** Prefer the content-addressable id so unique-index merges do not flip-flop across devices. */
export function shouldKeepIncomingGraphNodeId(opts: {
  vaultId: string
  nodeType: string
  name: string
  incomingId: string
  existingId: string
}): boolean {
  const stable = graphNodeIdForEntity(opts.vaultId, opts.nodeType, opts.name)
  if (opts.incomingId === stable) return true
  if (opts.existingId === stable) return false
  return false
}

/**
 * Content-addressable edge id so dual-device extract of the same diary merges via LWW.
 */
export function graphEdgeId(
  vaultId: string,
  fromId: string,
  toId: string,
  edgeType: string,
  sourceRef: string | null | undefined
): string {
  const v = vaultId.trim()
  const et = edgeType.trim().toLowerCase() || 'relates_to'
  const ref = (sourceRef ?? '').trim()
  return graphIdFromDigest(md5Hex(`${v}\0${fromId}\0${toId}\0${et}\0${ref}`))
}
