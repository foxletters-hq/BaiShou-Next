import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, describe, test } from 'vitest';
import { ToolResultGroup } from '../index';

describe('ToolResultGroup', () => {
  const mockInvocations = [
    { toolCallId: '1', toolName: 'diary_read', result: { content: 'Entry 1' } },
    { toolCallId: '2', toolName: 'web_search', result: 'Search found something' },
  ];

  test('renders nothing if invocations empty', () => {
    const { container } = render(<ToolResultGroup invocations={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders count of invocations', () => {
    render(<ToolResultGroup invocations={mockInvocations} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('expands to show children on click', () => {
    const { container } = render(<ToolResultGroup invocations={mockInvocations} />);
    
    // initially hidden
    expect(screen.queryByText('diary_read')).not.toBeInTheDocument();

    const header = container.querySelector('div[class*="headerRow"]');
    if (header) {
      fireEvent.click(header);
    }
    
    expect(screen.getByText('diary_read')).toBeInTheDocument();
    expect(screen.getByText('web_search')).toBeInTheDocument();
  });

  test('renders error state correctly', () => {
    const errorInvocations = [{ toolCallId: '3', toolName: 'test', result: 'Error: timeout' }];
    const { container } = render(<ToolResultGroup invocations={errorInvocations} />);
    
    const header = container.querySelector('div[class*="headerRow"]');
    if (header) {
      fireEvent.click(header);
    }

    expect(screen.getByText('Error: timeout')).toBeInTheDocument();
  });
});
