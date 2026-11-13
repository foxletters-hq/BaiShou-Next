export const REPO_URL = 'https://github.com/foxletters-hq/BaiShou-Next';

export const CDN_DOWNLOAD_BASE_URL = 'https://dl.foxletters.com';

export const RELEASE_CHANNEL_CDN_MANIFEST_URL = `${CDN_DOWNLOAD_BASE_URL}/channel.json`;

export const RELEASE_CHANNEL_GITHUB_MANIFEST_URL =
  'https://raw.githubusercontent.com/foxletters-hq/BaiShou-Next/main/releases/channel.json';

export const RELEASE_CHANNEL_MANIFEST_URL = RELEASE_CHANNEL_CDN_MANIFEST_URL;

export const RELEASE_CHANNEL_MANIFEST_URLS = [
  RELEASE_CHANNEL_CDN_MANIFEST_URL,
  RELEASE_CHANNEL_GITHUB_MANIFEST_URL,
] as const;

export const DOWNLOAD_URLS = {
  windows: `${CDN_DOWNLOAD_BASE_URL}/latest/BaiShou-Windows-Setup.exe`,
  android: `${CDN_DOWNLOAD_BASE_URL}/latest/BaiShou-Android.apk`,
} as const;

export interface ReleaseChannelPlatform {
  version?: string;
  downloadUrl?: string;
  githubDownloadUrl?: string;
}

export interface ReleaseChannelManifest {
  android?: ReleaseChannelPlatform;
  windows?: ReleaseChannelPlatform;
}

export interface ResolvedDownloadEntry {
  url: string;
  version?: string;
}

export interface ResolvedDownloads {
  android: ResolvedDownloadEntry;
  windows: ResolvedDownloadEntry;
}

export function formatReleaseVersion(version?: string): string | undefined {
  if (!version) return undefined;
  return version.startsWith('v') ? version : `v${version}`;
}

const FALLBACK_DOWNLOADS: ResolvedDownloads = {
  android: { url: DOWNLOAD_URLS.android },
  windows: { url: DOWNLOAD_URLS.windows },
};

/** Node fetch / undici 默认等响应头 300s；国内 VPS 访问 GitHub 经常踩中，构建会假死一整页 */
const MANIFEST_FETCH_TIMEOUT_MS = 8_000;

let cachedDefaultDownloads: Promise<ResolvedDownloads> | null = null;

export async function resolveReleaseDownloads(
  manifestUrl: string = RELEASE_CHANNEL_MANIFEST_URL,
): Promise<ResolvedDownloads> {
  if (manifestUrl === RELEASE_CHANNEL_MANIFEST_URL) {
    cachedDefaultDownloads ??= fetchReleaseDownloads(manifestUrl);
    return cachedDefaultDownloads;
  }
  return fetchReleaseDownloads(manifestUrl);
}

async function fetchReleaseDownloads(
  manifestUrl: string,
): Promise<ResolvedDownloads> {
  const candidates =
    manifestUrl === RELEASE_CHANNEL_MANIFEST_URL
      ? [...RELEASE_CHANNEL_MANIFEST_URLS]
      : [manifestUrl];

  for (const candidateUrl of candidates) {
    try {
      const res = await fetch(candidateUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as ReleaseChannelManifest;
      return {
        android: {
          url: data.android?.downloadUrl ?? DOWNLOAD_URLS.android,
          version: data.android?.version,
        },
        windows: {
          url: data.windows?.downloadUrl ?? DOWNLOAD_URLS.windows,
          version: data.windows?.version,
        },
      };
    } catch {
      // 当前节点不可用时继续尝试下一个备用源
    }
  }
  return FALLBACK_DOWNLOADS;
}
