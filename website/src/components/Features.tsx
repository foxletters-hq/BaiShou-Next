import type { FC } from 'react';
import {
  BookHeart,
  Network,
  Bot,
  Sparkles,
  Search,
  Shield,
} from 'lucide-react';
import { FEATURE_IDS } from '../data/site';
import { useApp } from '../context/AppContext';
import FeatureCard from './FeatureCard';

const featureIcons = {
  diary: BookHeart,
  graph: Network,
  agent: Bot,
  companion: Sparkles,
  rag: Search,
  sync: Shield,
} as const;

export const Features: FC = () => {
  const { dict } = useApp();

  return (
    <section id="features" className="snap-page">
      <div className="container snap-page-inner">
        <div className="reveal section-heading">
          <p className="section-eyebrow" data-i18n="features.eyebrow">
            {dict.features.eyebrow}
          </p>
          <h2 data-i18n="features.title">{dict.features.title}</h2>
          <p className="section-lead" data-i18n="features.lead">
            {dict.features.lead}
          </p>
        </div>

        <div className="features-grid reveal">
          {FEATURE_IDS.map((id) => (
            <FeatureCard key={id} i18nId={id} icon={featureIcons[id]} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
