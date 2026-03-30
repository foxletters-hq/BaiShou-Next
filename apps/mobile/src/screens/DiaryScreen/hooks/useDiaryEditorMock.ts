import { useState, useEffect } from 'react';

export function useDiaryEditorMock(initialContent: string = '', appendOnLoad: boolean = false) {
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (appendOnLoad && initialContent) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timeMark = `\n\n##### ${hh}:${mm}\n\n`;
      setContent(initialContent.trimRight() + timeMark);
    } else if (appendOnLoad && !initialContent) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timeMark = `##### ${hh}:${mm}\n\n`;
      setContent(timeMark);
    }
  }, [appendOnLoad, initialContent]);

  const handleSave = (c: string, t: string[], d: Date) => {
    console.log('Native Saved:', { content: c, tags: t, date: d });
  };

  const handleCancel = () => {
    console.log('Native Cancelled editing');
  };

  return {
    state: { content, tags, selectedDate },
    actions: { setContent, setTags, setSelectedDate, handleSave, handleCancel }
  };
}
