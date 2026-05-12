import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { forceImageRefresh } from './codeMirrorDecorations';

export function attachmentUrlPlugin(resolveUrl: (fileName: string) => string) {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        setTimeout(() => processAttachments(view, resolveUrl), 50);
      }
      update(update: ViewUpdate) {
        const needsRefresh = update.transactions.some(
          (t) => t.effects.some((e) => e.is(forceImageRefresh)),
        );
        if (update.docChanged || update.viewportChanged || needsRefresh) {
          if (needsRefresh) {
            resetProcessedFlags(update.view);
          }
          setTimeout(() => processAttachments(update.view, resolveUrl), 50);
        }
      }
    },
  );
}

function resetProcessedFlags(view: EditorView) {
  const dom = view.dom;
  dom.querySelectorAll('[data-processed="true"]').forEach((el) => {
    const htmlEl = el as HTMLElement;
    delete htmlEl.dataset.processed;
    if (htmlEl instanceof HTMLImageElement && htmlEl.dataset.originalSrc) {
      htmlEl.src = htmlEl.dataset.originalSrc;
    }
    if (htmlEl instanceof HTMLVideoElement && htmlEl.dataset.originalSrc) {
      htmlEl.src = htmlEl.dataset.originalSrc;
    }
    if (htmlEl instanceof HTMLAudioElement && htmlEl.dataset.originalSrc) {
      htmlEl.src = htmlEl.dataset.originalSrc;
    }
    if (htmlEl instanceof HTMLAnchorElement && htmlEl.dataset.originalHref) {
      htmlEl.href = htmlEl.dataset.originalHref;
    }
  });
}

function processAttachments(
  view: EditorView,
  resolveUrl: (fileName: string) => string,
) {
  const dom = view.dom;

  dom.querySelectorAll('img[src^="attachment/"]').forEach((el) => {
    const img = el as HTMLImageElement;
    if (img.dataset.processed) return;
    const url = resolveUrl(img.getAttribute('src')!);
    img.dataset.originalSrc = img.getAttribute('src')!;
    img.dataset.processed = 'true';
    img.src = url;
    Object.assign(img.style, {
      cursor: 'pointer',
      maxWidth: '100%',
      height: 'auto',
      borderRadius: '8px',
    });
  });

  dom.querySelectorAll('video[src^="attachment/"]').forEach((el) => {
    const video = el as HTMLVideoElement;
    if (video.dataset.processed) return;
    video.dataset.originalSrc = video.getAttribute('src')!;
    video.dataset.processed = 'true';
    video.src = resolveUrl(video.getAttribute('src')!);
    Object.assign(video.style, { maxWidth: '100%', borderRadius: '8px' });
  });

  dom.querySelectorAll('audio[src^="attachment/"]').forEach((el) => {
    const audio = el as HTMLAudioElement;
    if (audio.dataset.processed) return;
    audio.dataset.originalSrc = audio.getAttribute('src')!;
    audio.dataset.processed = 'true';
    audio.src = resolveUrl(audio.getAttribute('src')!);
    (audio as HTMLElement).style.width = '100%';
  });

  dom.querySelectorAll('a[href^="attachment/"]').forEach((el) => {
    const link = el as HTMLAnchorElement;
    if (link.dataset.processed) return;
    link.dataset.originalHref = link.getAttribute('href')!;
    link.dataset.processed = 'true';
    link.href = resolveUrl(link.getAttribute('href')!);
    link.target = '_blank';
    Object.assign(link.style, {
      color: 'var(--color-primary)',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px',
      borderRadius: '4px',
      background: 'var(--bg-secondary)',
    });
  });
}
