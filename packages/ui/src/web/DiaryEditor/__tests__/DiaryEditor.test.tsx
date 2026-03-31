import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { DiaryEditor } from '../DiaryEditor';

describe('DiaryEditor component', () => {
  it('renders content correctly and responds to text changes', () => {
    const onContentChange = vi.fn();
    const { getByPlaceholderText } = render(
      <DiaryEditor 
        content="Hello world"
        tags={[]}
        selectedDate={new Date()}
        onContentChange={onContentChange}
        onTagsChange={vi.fn()}
        onDateChange={vi.fn()}
      />
    );

    const textarea = getByPlaceholderText(/记录下/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Hello world');

    fireEvent.change(textarea, { target: { value: 'New text' } });
    expect(onContentChange).toHaveBeenCalledWith('New text');
  });

  it('triggers onSave when save button clicked', () => {
    const onSave = vi.fn();
    const { getByText } = render(
      <DiaryEditor 
        content="Time to save"
        tags={['diary']}
        selectedDate={new Date('2026-03-31')}
        onContentChange={vi.fn()}
        onTagsChange={vi.fn()}
        onDateChange={vi.fn()}
        onSave={onSave}
      />
    );

    const saveBtn = getByText(/保存|save/i);
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledWith('Time to save', ['diary'], expect.any(Date));
  });
});
