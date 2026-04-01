import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { TimelineNode } from '../index';

describe('TimelineNode component', () => {
  it('renders a month separator via children', () => {
    render(
      <TimelineNode>
        <div>2026-03</div>
      </TimelineNode>
    );
    expect(screen.getByText('2026-03')).toBeInTheDocument();
  });

  it('renders a diary entry node via children', () => {
    render(
      <TimelineNode>
        <div>Test entry</div>
      </TimelineNode>
    );
    expect(screen.getByText('Test entry')).toBeInTheDocument();
  });
  
  it('hides the timeline track line when isLast is true', () => {
    const { container } = render(
      <TimelineNode isLast>
        <div>Final entry</div>
      </TimelineNode>
    );
    const line = container.querySelector('.timeline-line-v2');
    expect(line).not.toBeInTheDocument();
  });
});
