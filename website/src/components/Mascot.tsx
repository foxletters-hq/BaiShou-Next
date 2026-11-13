import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { docsHref } from '../data/docs-nav';
import { useApp } from '../context/AppContext';

const tagKeys = ['t1', 't2', 't3', 't4'] as const;

export const Mascot: FC = () => {
  const { locale, dict } = useApp();

  return (
    <section id="mascot" className="snap-page mascot-section">
      <div className="container snap-page-inner">
        <div className="reveal section-heading">
          <p className="section-eyebrow" data-i18n="mascot.eyebrow">
            {dict.mascot.eyebrow}
          </p>
          <h2 data-i18n="mascot.title">{dict.mascot.title}</h2>
          <p className="section-lead" data-i18n="mascot.lead">
            {dict.mascot.lead}
          </p>
        </div>

        <article className="card mascot-card reveal">
          <div className="mascot-visual">
            <img
              src="/assets/images/latte-companion.png"
              alt="Latte"
              className="mascot-avatar"
              width="320"
              height="400"
              loading="lazy"
              draggable={false}
            />
          </div>

          <div className="mascot-content">
            <div className="mascot-head">
              <h3 className="mascot-name" data-i18n="mascot.name">
                {dict.mascot.name}
              </h3>
              <span className="mascot-role" data-i18n="mascot.role">
                {dict.mascot.role}
              </span>
            </div>

            <blockquote className="mascot-quote" data-i18n="mascot.quote">
              {dict.mascot.quote}
            </blockquote>

            <div className="mascot-prose">
              <p data-i18n="mascot.p1">{dict.mascot.p1}</p>
              <p data-i18n="mascot.p2">{dict.mascot.p2}</p>
            </div>

            <div className="mascot-footer">
              <div className="mascot-tags">
                {tagKeys.map((k) => (
                  <span
                    key={k}
                    className="mascot-tag"
                    data-i18n={`mascot.tags.${k}`}
                  >
                    {dict.mascot.tags[k]}
                  </span>
                ))}
              </div>

              <Link
                to={docsHref(locale, 'basics/latte')}
                className="mascot-link"
                data-i18n="mascot.cta"
              >
                {dict.mascot.cta}
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};

export default Mascot;
