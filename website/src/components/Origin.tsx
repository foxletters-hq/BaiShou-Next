import type { FC } from 'react';
import { ORIGIN_TRIO_IDS } from '../data/site';
import { t } from '../i18n';
import { useApp } from '../context/AppContext';

const trioAvatars = {
  anson: 'https://avatars.githubusercontent.com/u/107763915?v=4',
  sakura: '/assets/images/sakura-avatar.jpg',
  akatsuki: '/assets/images/akatsuki-avatar.jpg',
} as const;

export const Origin: FC = () => {
  const { dict } = useApp();

  return (
    <section id="origin" className="snap-page origin-section">
      <div className="container snap-page-inner">
        <div className="reveal section-heading">
          <p className="section-eyebrow" data-i18n="origin.eyebrow">
            {dict.origin.eyebrow}
          </p>
          <h2 data-i18n="origin.title">{dict.origin.title}</h2>
          <p className="section-lead origin-lead" data-i18n="origin.lead">
            {dict.origin.lead}
          </p>
        </div>

        <article className="card origin-story-card reveal">
          <div className="origin-story-prose">
            <p data-i18n="origin.story.p1">{dict.origin.story.p1}</p>
            <p data-i18n="origin.story.p2">{dict.origin.story.p2}</p>
            <p data-i18n="origin.story.p3">{dict.origin.story.p3}</p>
          </div>
          <blockquote
            className="origin-story-quote"
            data-i18n="origin.story.quote"
          >
            {dict.origin.story.quote}
          </blockquote>
        </article>

        <div className="origin-trio-grid reveal">
          {ORIGIN_TRIO_IDS.map((id) => {
            const avatar = trioAvatars[id];
            const nameText = t(dict, `origin.trio.${id}.name`);
            return (
              <article key={id} className="card origin-trio-card">
                <div className="origin-trio-top">
                  <img
                    src={avatar}
                    alt={nameText}
                    className="origin-trio-avatar"
                    width="64"
                    height="64"
                    loading="lazy"
                  />
                  <div className="origin-trio-titles">
                    <h3 data-i18n={`origin.trio.${id}.name`}>{nameText}</h3>
                    <span
                      className="origin-trio-role"
                      data-i18n={`origin.trio.${id}.role`}
                    >
                      {t(dict, `origin.trio.${id}.role`)}
                    </span>
                  </div>
                </div>
                <p
                  className="origin-trio-desc"
                  data-i18n={`origin.trio.${id}.desc`}
                >
                  {t(dict, `origin.trio.${id}.desc`)}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Origin;
