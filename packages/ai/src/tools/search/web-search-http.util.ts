export function createFetchSignal(timeoutMs: number): AbortSignal {
  if (
    typeof AbortSignal !== 'undefined' &&
    'timeout' in AbortSignal &&
    typeof AbortSignal.timeout === 'function'
  ) {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export function cleanApiKey(apiKey?: string): string {
  return (apiKey || '').replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, '').trim()
}

const USER_AGENT_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
]

export function getBrowserHeaders(): Record<string, string> {
  const ua = USER_AGENT_POOL[Math.floor(Math.random() * USER_AGENT_POOL.length)]
  return {
    'User-Agent':
      ua ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    DNT: '1',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
}
