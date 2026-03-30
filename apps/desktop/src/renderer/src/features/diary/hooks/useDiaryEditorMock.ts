import { useState, useEffect } from 'react';

export function useDiaryEditorMock(initialContent: string = '', appendOnLoad: boolean = false) {
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    // 纯逻辑层面计算字符串，而不再耦合于 UI 生命周期内
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
    console.log('Saved:', { content: c, tags: t, date: d });
  };

  const handleCancel = () => {
    console.log('Cancelled editing');
  };

  return {
    state: { content, tags, selectedDate },
    actions: { setContent, setTags, setSelectedDate, handleSave, handleCancel }
  };
}
