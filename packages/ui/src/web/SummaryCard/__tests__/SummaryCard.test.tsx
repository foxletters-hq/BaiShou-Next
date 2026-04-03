// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SummaryCard } from '../SummaryCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe('SummaryCard Component', () => {
  const baseProps = {
    id: '1',
    title: 'Test Title',
    dateRange: '03.01-03.31',
    summaryText: 'Test summary content',
    type: 'month' as const,
  };

  it('renders default fields correctly', () => {
    render(<SummaryCard {...baseProps} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('03.01-03.31')).toBeInTheDocument();
    expect(screen.getByText('Test summary content')).toBeInTheDocument();
    expect(screen.getByText('summary.stats_month')).toBeInTheDocument();
  });

  it('triggers onClick when clicked', () => {
    const fn = vi.fn();
    const { container } = render(<SummaryCard {...baseProps} onClick={fn} />);
    if (container.firstChild) {
      fireEvent.click(container.firstChild);
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('renders delete icon if onDelete is provided, and triggers it', () => {
    const fnDelete = vi.fn();
    const fnClick = vi.fn();
    render(<SummaryCard {...baseProps} onClick={fnClick} onDelete={fnDelete} />);
    const deleteBtn = screen.getByText('🗑️');
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn);
    expect(fnDelete).toHaveBeenCalledTimes(1);
    expect(fnClick).not.toHaveBeenCalled();
  });
});
