import type { FC } from 'react';
import { HardDrive, Unlock, Network, Cloud } from 'lucide-react';
import { PRINCIPLE_IDS } from '../data/site';
import { t } from '../i18n';
import { useApp } from '../context/AppContext';

const principleIcons = {
  local: HardDrive,
  open: Unlock,
  ai: Network,
  official: Cloud,
} as const;

export const Principles: FC = () => {
  const { dict } = useApp();

  return (
    <section id="principles" className="snap-page">
      <div className="container snap-page-inner">
        <div className="reveal section-heading">
          <p className="section-eyebrow" data-i18n="principles.eyebrow">
            {dict.principles.eyebrow}
          </p>
          <h2 data-i18n="principles.title">{dict.principles.title}</h2>
          <p className="section-lead" data-i18n="principles.lead">
            {dict.principles.lead}
          </p>
        </div>

        <div className="principles-grid reveal">
          {PRINCIPLE_IDS.map((id) => {
            const Icon = principleIcons[id];
            const badge = dict.principles.items[id].badge;
            return (
              <article key={id} className="card principle-card">
                <div className="principle-card-head">
                  <div
                    className="feature-icon principle-icon"
                    aria-hidden="true"
                  >
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <h3 data-i18n={`principles.items.${id}.title`}>
                    {t(dict, `principles.items.${id}.title`)}
                  </h3>
                  {badge && (
                    <span
                      className="feature-badge"
                      data-i18n-badge={`principles.items.${id}.badge`}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <p data-i18n={`principles.items.${id}.desc`}>
                  {t(dict, `principles.items.${id}.desc`)}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Principles;
