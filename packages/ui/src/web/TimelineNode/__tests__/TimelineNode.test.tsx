import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { TimelineNode } from '../index';
import type { TimelineNode as TimelineNodeType } from '@baishou/shared';
describe('TimelineNode component', () => {
  it('renders a month separator correctly', () => {
    const node: TimelineNodeType = {
      id: 'sep-2026-03',
      type: 'month_separator',
      date: new Date('2026-03-31T00:00:00Z')
    };

    render(<TimelineNode node={node} />);
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('renders a diary entry node correctly', () => {
    const node: TimelineNodeType = {
      id: 1,
      type: 'diary_entry',
      date: new Date('2026-03-31T10:00:00Z'),
      meta: {
        id: 1,
        date: new Date('2026-03-31T10:00:00Z'),
        preview: 'Test entry',
        tags: []
      }
    };

    render(<TimelineNode node={node} />);
    expect(screen.getByText('Test entry')).toBeInTheDocument();
  });
});
