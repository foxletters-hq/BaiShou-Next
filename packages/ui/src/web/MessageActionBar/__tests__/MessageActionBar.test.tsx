// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessageActionBar } from '../index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe('MessageActionBar Component', () => {
  it('renders correctly with given icons based on role', () => {
    const { container } = render(
      <MessageActionBar 
        onCopy={vi.fn()} 
        onEdit={vi.fn()} 
        onRetry={vi.fn()}
      />
    );
    const copyBtn = container.querySelector('[title="common.copy"]');
    expect(copyBtn).toBeInTheDocument();
    const editBtn = container.querySelector('[title="common.edit"]');
    expect(editBtn).toBeInTheDocument();
    const retryBtn = container.querySelector('[title="common.retry"]');
    expect(retryBtn).toBeInTheDocument();
  });

  it('triggers onCopy securely when clicked', () => {
    const onCopy = vi.fn();
    const { container } = render(<MessageActionBar onCopy={onCopy} />);
    const copyBtn = container.querySelector('[title="common.copy"]');
    if (copyBtn) fireEvent.click(copyBtn);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('triggers onDelete if provided', () => {
    const onDelete = vi.fn();
    const { container } = render(<MessageActionBar onCopy={vi.fn()} onDelete={onDelete} />);
    const deleteBtn = container.querySelector('[title="common.delete"]');
    expect(deleteBtn).toBeInTheDocument();
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
