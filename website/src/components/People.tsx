import { useEffect, useState, type FC } from 'react';
import {
  CONTRIBUTORS_URL,
  FALLBACK_CONTRIBUTORS,
  REPO_URL,
  type Contributor,
} from '../data/site';
import { useApp } from '../context/AppContext';

const CACHE_TIME_KEY = 'baishou_contributors_time_v5';
const CACHE_DATA_KEY = 'baishou_contributors_data_v5';
const MAX_DISPLAY = 20;

function resolveBadge(login: string): string {
  const key = login.toLowerCase();
  if (key === 'anson-trio') return '🦊';
  if (key === 'ctnilpp' || key.startsWith('ctn')) return '🐦';
  if (key === 'magnemomet') return '😺';
  if (key === 'ratman463' || key.startsWith('ratman')) return '🧀';
  return '🌿';
}

function sortList(list: Contributor[]): Contributor[] {
  return [...list]
    .sort((a, b) => {
      const aFounder = a.login.toLowerCase() === 'anson-trio' ? 1 : 0;
      const bFounder = b.login.toLowerCase() === 'anson-trio' ? 1 : 0;
      if (aFounder !== bFounder) return bFounder - aFounder;
      if (b.contributions !== a.contributions) {
        return b.contributions - a.contributions;
      }
      return a.login.toLowerCase().localeCompare(b.login.toLowerCase());
    })
    .slice(0, MAX_DISPLAY);
}

async function fetchMergedContributors(): Promise<Contributor[]> {
  const repos = [
    'https://api.github.com/repos/foxletters-hq/BaiShou-Next/contributors?per_page=100',
  ];
  const results = await Promise.allSettled(
    repos.map((url) =>
      fetch(url, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      }).then((res) => (res.ok ? res.json() : [])),
    ),
  );
  const map = new Map<string, Contributor>();
  for (const c of FALLBACK_CONTRIBUTORS) {
    map.set(c.login.toLowerCase(), { ...c });
  }
  for (const res of results) {
    if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
    for (const item of res.value) {
      if (
        !item?.login ||
        item.login.endsWith('[bot]') ||
        item.type === 'Bot' ||
        item.login.toLowerCase() === 'alice'
      ) {
        continue;
      }
      const key = item.login.toLowerCase();
      const prev = map.get(key);
      const fallbackCommits = FALLBACK_CONTRIBUTORS.find(
        (f) => f.login.toLowerCase() === key,
      )?.contributions;
      if (prev && prev.contributions !== fallbackCommits) {
        prev.contributions += Number(item.contributions) || 0;
      } else {
        map.set(key, {
          login: item.login,
          avatar_url:
            item.avatar_url || `https://github.com/${item.login}.png`,
          html_url: item.html_url || `https://github.com/${item.login}`,
          contributions: Number(item.contributions) || 1,
        });
      }
    }
  }
  return sortList(Array.from(map.values()));
}

interface ContributorCardProps {
  contributor: Contributor;
  founderRole: string;
  commitsUnit: string;
}

const ContributorCard: FC<ContributorCardProps> = ({
  contributor: c,
  founderRole,
  commitsUnit,
}) => {
  const isFounder = c.login.toLowerCase() === 'anson-trio';
  const badge = resolveBadge(c.login);
  const titleText = isFounder
    ? `@${c.login} · ${founderRole} (${c.contributions} ${commitsUnit})`
    : `@${c.login}`;
  return (
    <a
      href={c.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className={['contributor-item', isFounder && 'contributor-item-founder']
        .filter(Boolean)
        .join(' ')}
      title={titleText}
      aria-label={`@${c.login}`}
      data-commits={c.contributions}
    >
      <div className="contributor-avatar-wrap">
        <img
          src={c.avatar_url}
          alt={c.login}
          className="contributor-avatar"
          width="50"
          height="50"
          loading="lazy"
        />
        {badge && (
          <span className="contributor-badge-founder" aria-hidden="true">
            {badge}
          </span>
        )}
      </div>
      {isFounder && c.contributions > 0 && (
        <span className="contributor-commits">
          <span className="contributor-commits-num">
            {c.contributions.toLocaleString()}
          </span>
          <span
            className="contributor-commits-unit"
            data-i18n="people.commitsUnit"
          >
            {commitsUnit}
          </span>
        </span>
      )}
      <div className="contributor-info">
        <span className="contributor-login">@{c.login}</span>
        {isFounder && (
          <span
            className="contributor-role-tag"
            data-i18n="people.founderRole"
          >
            {founderRole}
          </span>
        )}
      </div>
    </a>
  );
};

export const People: FC = () => {
  const { dict } = useApp();
  const [contributors, setContributors] = useState<Contributor[]>(() =>
    sortList(FALLBACK_CONTRIBUTORS),
  );

  useEffect(() => {
    const now = Date.now();
    const last = parseInt(sessionStorage.getItem(CACHE_TIME_KEY) || '0', 10);
    const cachedRaw = sessionStorage.getItem(CACHE_DATA_KEY);

    if (now - last < 5 * 60 * 1000 && cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw) as Contributor[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setContributors(sortList(parsed));
          return;
        }
      } catch {
        // ignore cache error
      }
    }

    void fetchMergedContributors().then((merged) => {
      if (merged.length > 0) {
        sessionStorage.setItem(CACHE_TIME_KEY, String(now));
        sessionStorage.setItem(CACHE_DATA_KEY, JSON.stringify(merged));
        setContributors(merged);
      }
    });
  }, []);

  return (
    <section id="people" className="snap-page snap-page-footer">
      <div className="container snap-page-inner">
        <div className="people-section people-section-wall reveal">
          <div className="section-heading">
            <p className="section-eyebrow" data-i18n="people.wallEyebrow">
              {dict.people.wallEyebrow}
            </p>
            <h2 data-i18n="people.wallTitle">{dict.people.wallTitle}</h2>
            <p className="section-lead">
              <span data-i18n="people.wallLeadBefore">
                {dict.people.wallLeadBefore}
              </span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-i18n="people.wallLeadLink"
              >
                {dict.people.wallLeadLink}
              </a>
              <span data-i18n="people.wallLeadAfter">
                {dict.people.wallLeadAfter}
              </span>
            </p>
          </div>

          <div className="contributors-wall card reveal">
            <div className="contributors-grid" id="contributors-grid">
              {contributors.map((c) => (
                <ContributorCard
                  key={c.login}
                  contributor={c}
                  founderRole={dict.people.founderRole}
                  commitsUnit={dict.people.commitsUnit}
                />
              ))}
            </div>
            <div className="contributors-wall-footer">
              <p className="contributors-badge-hint">
                <span data-i18n="people.badgeHintBefore">
                  {dict.people.badgeHintBefore}
                </span>
                <a
                  href={`${REPO_URL}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-i18n="people.badgeHintLink"
                >
                  {dict.people.badgeHintLink}
                </a>
                <span data-i18n="people.badgeHintAfter">
                  {dict.people.badgeHintAfter}
                </span>
              </p>
              <a
                href={CONTRIBUTORS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="contributors-view-all"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
                <span data-i18n="people.collabLeadLink">
                  {dict.people.collabLeadLink}
                </span>
                <span className="wall-arrow">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default People;
