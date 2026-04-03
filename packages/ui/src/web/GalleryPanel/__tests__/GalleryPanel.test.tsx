// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GalleryPanel } from '../GalleryPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe('GalleryPanel Component', () => {
  const mockSummaries = [
    {
      id: 1,
      type: 'weekly',
      startDate: new Date('2026-03-23T00:00:00Z'),
      endDate: new Date('2026-03-29T23:59:59Z'),
      content: 'This is a test weekly summary.',
    },
    {
      id: 2,
      type: 'monthly',
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-03-31T23:59:59Z'),
      content: 'This is a test monthly summary.',
    }
  ];

  it('renders title and view toggle buttons', () => {
    render(<GalleryPanel summaries={[]} />);
    expect(screen.getByText('summary.gallery_title')).toBeInTheDocument();
    expect(screen.getByText('summary.view_masonry')).toBeInTheDocument();
    expect(screen.getByText('summary.view_grid')).toBeInTheDocument();
  });

  it('renders mapped summaries correctly', () => {
    render(<GalleryPanel summaries={mockSummaries} />);
    expect(screen.getByText('2026年周报')).toBeInTheDocument();
    expect(screen.getByText('2026年3月总结')).toBeInTheDocument();
    expect(screen.getByText('This is a test weekly summary.')).toBeInTheDocument();
    expect(screen.getByText('This is a test monthly summary.')).toBeInTheDocument();
  });

  it('toggles view mode', () => {
    const { container } = render(<GalleryPanel summaries={[]} />);
    const gridBtn = screen.getByText('summary.view_grid');
    fireEvent.click(gridBtn);
    const contentBox = container.querySelector('.gallery-content');
    expect(contentBox?.className).toContain('gallery-mode-grid');
  });
});
