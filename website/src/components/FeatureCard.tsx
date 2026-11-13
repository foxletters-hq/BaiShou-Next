import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import { t } from '../i18n';
import { useApp } from '../context/AppContext';

export interface FeatureCardProps {
  i18nId: string;
  icon: LucideIcon;
  showBadge?: boolean;
}

const FeatureCard: FC<FeatureCardProps> = ({ i18nId, icon: Icon, showBadge }) => {
  const { dict } = useApp();
  const title = t(dict, `features.items.${i18nId}.title`);
  const desc = t(dict, `features.items.${i18nId}.desc`);
  const badgeKey = `features.items.${i18nId}.badge`;
  const rawBadge = t(dict, badgeKey);
  const badge = rawBadge !== badgeKey ? rawBadge : undefined;

  return (
    <article className="card feature-card reveal">
      <div className="feature-card-head">
        <div className="feature-icon" aria-hidden="true">
          <Icon size={22} strokeWidth={1.8} />
        </div>
        {showBadge && (
          <span
            className="feature-badge"
            data-i18n-badge={`features.items.${i18nId}.badge`}
          >
            {badge || '开发中'}
          </span>
        )}
      </div>
      <h3
        className="feature-card-title"
        data-i18n={`features.items.${i18nId}.title`}
      >
        {title}
      </h3>
      <p
        className="feature-card-desc"
        data-i18n={`features.items.${i18nId}.desc`}
      >
        {desc}
      </p>
    </article>
  );
};

export default FeatureCard;
