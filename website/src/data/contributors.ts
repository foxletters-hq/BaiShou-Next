export interface TeamMember {
  id: 'anson';
  name: string;
  github: string;
  avatar: string;
  badge?: string;
}

export const FOUNDER: TeamMember = {
  id: 'anson',
  name: 'Anson',
  github: 'https://github.com/Anson-Trio',
  avatar: 'https://avatars.githubusercontent.com/u/107763915?v=4',
  badge: '🦊',
};

export const CORE_DEVELOPERS: TeamMember[] = [FOUNDER];
export const COLLABORATORS: TeamMember[] = [];

export interface Contributor {
  login: string;
  name?: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export const FALLBACK_CONTRIBUTORS: Contributor[] = [
  {
    login: 'Anson-Trio',
    avatar_url: 'https://avatars.githubusercontent.com/u/107763915?v=4',
    html_url: 'https://github.com/Anson-Trio',
    contributions: 3334,
  },
  {
    login: 'ctnilpp',
    avatar_url: 'https://avatars.githubusercontent.com/u/49940531?v=4',
    html_url: 'https://github.com/ctnilpp',
    contributions: 2,
  },
  {
    login: 'Asamizu-saki',
    avatar_url: 'https://avatars.githubusercontent.com/u/231084446?v=4',
    html_url: 'https://github.com/Asamizu-saki',
    contributions: 1,
  },
  {
    login: 'C-H-001',
    avatar_url: 'https://avatars.githubusercontent.com/u/93237727?v=4',
    html_url: 'https://github.com/C-H-001',
    contributions: 1,
  },
  {
    login: 'david082321',
    name: 'david082321',
    avatar_url: 'https://avatars.githubusercontent.com/u/7046617?v=4',
    html_url: 'https://github.com/david082321',
    contributions: 1,
  },
  {
    login: 'Magnemomet',
    name: 'mite',
    avatar_url: 'https://avatars.githubusercontent.com/u/269363200?v=4',
    html_url: 'https://github.com/Magnemomet',
    contributions: 1,
  },
  {
    login: 'fisHarly0',
    name: 'fisHarly0',
    avatar_url: 'https://avatars.githubusercontent.com/u/188205924?v=4',
    html_url: 'https://github.com/fisHarly0',
    contributions: 1,
  },
];

const MAX_DISPLAY_CONTRIBUTORS = 20;

function sortContributors(list: Contributor[]): Contributor[] {
  return [...list]
    .sort((a, b) => {
      const aFounder = a.login.toLowerCase() === 'anson-trio' ? 1 : 0;
      const bFounder = b.login.toLowerCase() === 'anson-trio' ? 1 : 0;
      if (aFounder !== bFounder) return bFounder - aFounder;
      if (b.contributions !== a.contributions) return b.contributions - a.contributions;
      return a.login.toLowerCase().localeCompare(b.login.toLowerCase());
    })
    .slice(0, MAX_DISPLAY_CONTRIBUTORS);
}

let cachedContributorsPromise: Promise<Contributor[]> | null = null;

export async function getContributors(): Promise<Contributor[]> {
  cachedContributorsPromise ??= fetchGitHubContributors();
  return cachedContributorsPromise;
}

async function fetchGitHubContributors(): Promise<Contributor[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const repos = [
      'https://api.github.com/repos/foxletters-hq/BaiShou-Next/contributors?per_page=100',
    ];
    const results = await Promise.allSettled(
      repos.map((url) =>
        fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'BaiShou-Website-Build',
            Accept: 'application/vnd.github.v3+json',
          },
        }).then((res) => (res.ok ? res.json() : [])),
      ),
    );
    clearTimeout(timer);

    const map = new Map<string, Contributor>();

    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        for (const item of res.value) {
          if (
            !item?.login ||
            item.login.endsWith('[bot]') ||
            item.type === 'Bot' ||
            item.login.toLowerCase() === 'alice'
          )
            continue;
          const key = item.login.toLowerCase();
          const existing = map.get(key);
          if (existing) {
            existing.contributions += item.contributions || 0;
            if (
              item.avatar_url &&
              !existing.avatar_url.startsWith('/assets/')
            ) {
              existing.avatar_url = item.avatar_url;
            }
          } else {
            map.set(key, {
              login: item.login,
              avatar_url:
                item.avatar_url || `https://github.com/${item.login}.png`,
              html_url: item.html_url || `https://github.com/${item.login}`,
              contributions: item.contributions || 1,
            });
          }
        }
      }
    }

    // 仅当接口未返回某位预设成员（如网络受限或限流）时才用预设数据兜底
    for (const c of FALLBACK_CONTRIBUTORS) {
      const key = c.login.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { ...c });
      }
    }

    return sortContributors(Array.from(map.values()));
  } catch {
    return sortContributors(FALLBACK_CONTRIBUTORS);
  }
}
