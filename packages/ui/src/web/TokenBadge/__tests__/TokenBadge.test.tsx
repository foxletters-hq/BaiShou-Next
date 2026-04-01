import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, describe, test, vi } from 'vitest';
import { TokenBadge } from '../index';

describe('TokenBadge', () => {
  test('renders total tokens below 1000', () => {
    render(<TokenBadge inputTokens={150} outputTokens={250} />);
    expect(screen.getByText('400')).toBeInTheDocument();
  });

  test('renders total tokens >= 1000 with k format', () => {
    render(<TokenBadge inputTokens={1500} outputTokens={0} />);
    expect(screen.getByText('1.5k')).toBeInTheDocument();
  });

  test('renders cost text if costMicros is provided', () => {
    render(<TokenBadge inputTokens={100} outputTokens={100} costMicros={2500000} />);
    expect(screen.getByText('$2.5000')).toBeInTheDocument();
  });

  test('triggers onClick when clicked', () => {
    const fn = vi.fn();
    const { container } = render(<TokenBadge inputTokens={10} outputTokens={10} onClick={fn} />);
    if (container.firstChild) {
      fireEvent.click(container.firstChild);
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
