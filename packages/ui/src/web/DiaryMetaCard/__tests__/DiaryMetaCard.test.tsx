import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { DiaryMetaCard } from '../index';
import type { DiaryMeta } from '@baishou/shared';

describe('DiaryMetaCard', () => {
  const mockMeta: DiaryMeta = {
    id: 1,
    date: new Date('2026-03-31T10:00:00Z'),
    preview: 'This is a test diary preview...',
    tags: ['test', 'react']
  };

  it('renders the diary date correctly', () => {
    render(<DiaryMetaCard meta={mockMeta} />);
    // Add logic to check that month, day, or time is visible
    expect(screen.getByText(/31/)).toBeInTheDocument();
  });

  it('renders the preview text', () => {
    render(<DiaryMetaCard meta={mockMeta} />);
    expect(screen.getByText('This is a test diary preview...')).toBeInTheDocument();
  });

  it('renders tags correctly', () => {
    render(<DiaryMetaCard meta={mockMeta} />);
    expect(screen.getByText('#test')).toBeInTheDocument();
    expect(screen.getByText('#react')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<DiaryMetaCard meta={mockMeta} onDelete={onDelete} />);
    // Note: implementation needs a delete button
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
