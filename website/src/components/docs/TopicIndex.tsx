import type { FC } from 'react';
import { Link } from 'react-router-dom';

export interface TopicItem {
  title: string;
  href: string;
  description: string;
}

export interface TopicIndexProps {
  items: TopicItem[];
  navLabel?: string;
}

export const TopicIndex: FC<TopicIndexProps> = ({
  items,
  navLabel = 'Topics',
}) => (
  <nav className="bs-topics" aria-label={navLabel}>
    {items.map((item) => (
      <Link key={item.href + item.title} className="bs-topic card" to={item.href}>
        <span className="bs-topic__title">{item.title}</span>
        <span className="bs-topic__desc">{item.description}</span>
      </Link>
    ))}
  </nav>
);

export default TopicIndex;
