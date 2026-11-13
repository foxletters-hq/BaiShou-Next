import Lenis from 'lenis';

function getSections(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.snap-page, section[id]'));
}

function getHeaderHeight(): number {
  const header = document.querySelector<HTMLElement>('.site-header');
  return header ? header.offsetHeight : 64;
}

function getFooterHeight(): number {
  const footer = document.querySelector<HTMLElement>('.site-footer');
  return footer ? footer.offsetHeight : 60;
}

function getElementDocTop(el: HTMLElement): number {
  let top = 0;
  let curr: HTMLElement | null = el;
  while (curr) {
    top += curr.offsetTop;
    curr = curr.offsetParent as HTMLElement | null;
  }
  return top;
}

function getTargetElement(section: HTMLElement): HTMLElement {
  return section.querySelector<HTMLElement>('.snap-page-inner') ?? section;
}

function getTargetOffset(section: HTMLElement, index: number): number {
  if (index === 0 || section.id === 'hero') return 0;
  const innerEl = getTargetElement(section);
  const docTop = getElementDocTop(innerEl);
  const secH = innerEl.offsetHeight;
  const navH = getHeaderHeight();
  const footerH = getFooterHeight();
  const availH = window.innerHeight - navH - footerH;
  const topSpace = Math.max(24, (availH - secH) * 0.46);
  return Math.max(0, Math.round(docTop - (navH + topSpace)));
}

function revealSection(section: HTMLElement | undefined): void {
  if (!section) return;
  section.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    el.classList.add('is-visible');
  });
}

function computeProgressPercent(
  scrollY: number,
  maxScroll: number,
  offsets: number[],
): number {
  const totalSegments = offsets.length - 1;
  if (totalSegments <= 0) return 0;
  if (scrollY >= maxScroll - 8) return 100;

  let segIdx = 0;
  for (let i = 0; i < offsets.length - 1; i++) {
    if (scrollY >= offsets[i] - 4) segIdx = i;
    else break;
  }
  const startY = offsets[segIdx];
  const endY = Math.min(offsets[segIdx + 1], maxScroll);
  const span = Math.max(1, endY - startY);
  const localRatio = Math.min(1, Math.max(0, (scrollY - startY) / span));
  return Math.min(100, Math.max(0, ((segIdx + localRatio) / totalSegments) * 100));
}

function resolveActiveSection(
  sections: HTMLElement[],
  offsets: number[],
  scrollY: number,
  vh: number,
  maxScroll: number,
): string {
  const triggerY = scrollY + vh * 0.24;
  let activeIdx = 0;
  if (scrollY >= maxScroll - 16) {
    activeIdx = sections.length - 1;
  } else {
    for (let i = 0; i < offsets.length; i++) {
      if (triggerY >= offsets[i]) activeIdx = i;
      else break;
    }
  }
  return sections[activeIdx]?.id ?? '';
}

function parseAnchorTarget(event: MouseEvent): HTMLElement | null {
  const link = (event.target as HTMLElement)?.closest<HTMLAnchorElement>(
    'a[href^="#"], a[href^="/#"]'
  );
  if (!link) return null;
  const rawHref = link.getAttribute('href');
  if (!rawHref || rawHref === '#' || rawHref === '/#') return null;
  const hashIndex = rawHref.indexOf('#');
  if (hashIndex === -1) return null;
  return document.getElementById(rawHref.slice(hashIndex + 1));
}

/**
 * 首屏（#hero）滚轮一下切换 + 下方章节自然自由滚动 + 右侧进度条同步
 */
export function initLenisScroll(onSectionChange?: (sectionId: string) => void): () => void {
  const sections = getSections();
  const progressFill = document.querySelector<HTMLElement>('[data-snap-progress-fill]');
  document.documentElement.dataset.scrollMode = 'free';

  const lenis = new Lenis({
    autoRaf: true,
    duration: 0.85,
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.0,
  });

  let activeId = '';
  let lockedTargetId: string | null = null;
  let heroSnapBusy = false;
  let heroSnapTimer: number | null = null;

  const setActiveSection = (id: string) => {
    if (!id || id === activeId) return;
    activeId = id;
    onSectionChange?.(id);
  };

  const updateProgressAndActive = () => {
    if (sections.length === 0) return;
    const scrollY = window.scrollY;
    const vh = window.innerHeight;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    const offsets = sections.map((sec, idx) => getTargetOffset(sec, idx));

    const nextId = lockedTargetId || resolveActiveSection(sections, offsets, scrollY, vh, maxScroll);
    setActiveSection(nextId);

    if (progressFill && sections.length > 1) {
      const percent = computeProgressPercent(scrollY, maxScroll, offsets);
      progressFill.style.height = `${percent.toFixed(2)}%`;
    }
  };

  const jumpToSection = (section: HTMLElement, idx: number, lockHeroSnap = false) => {
    revealSection(section);
    lockedTargetId = section.id;
    setActiveSection(section.id);
    if (lockHeroSnap) {
      heroSnapBusy = true;
      if (heroSnapTimer !== null) window.clearTimeout(heroSnapTimer);
      heroSnapTimer = window.setTimeout(() => {
        heroSnapBusy = false;
        lockedTargetId = null;
      }, 880);
    }
    lenis.scrollTo(getTargetOffset(section, idx), {
      duration: 0.78,
      onComplete: () => {
        lockedTargetId = null;
        updateProgressAndActive();
      },
    });
  };

  const onWheelCapture = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || sections.length < 2) return;
    if (heroSnapBusy) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const deltaY = event.deltaY;
    if (Math.abs(deltaY) < 4) return;

    const scrollY = window.scrollY;
    const secondY = getTargetOffset(sections[1], 1);

    if (deltaY > 0 && scrollY < secondY - 20) {
      event.preventDefault();
      event.stopImmediatePropagation();
      jumpToSection(sections[1], 1, true);
      return;
    }
    if (deltaY < 0 && scrollY > 0 && scrollY <= secondY + 28) {
      event.preventDefault();
      event.stopImmediatePropagation();
      jumpToSection(sections[0], 0, true);
      return;
    }
    lockedTargetId = null;
  };

  const onMouseDown = (event: MouseEvent) => {
    if (event.button === 1) {
      lockedTargetId = null;
      heroSnapBusy = false;
      lenis.scrollTo(window.scrollY, { immediate: true });
    }
  };

  const onAnchorClick = (event: MouseEvent) => {
    const section = parseAnchorTarget(event);
    if (!section) return;
    event.preventDefault();
    jumpToSection(section, Math.max(0, sections.indexOf(section)), false);
  };

  lenis.on('scroll', updateProgressAndActive);
  window.addEventListener('scroll', updateProgressAndActive, { passive: true });
  window.addEventListener('resize', updateProgressAndActive, { passive: true });
  window.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });
  window.addEventListener('mousedown', onMouseDown, { passive: true });
  document.addEventListener('click', onAnchorClick);
  updateProgressAndActive();

  return () => {
    if (heroSnapTimer !== null) window.clearTimeout(heroSnapTimer);
    document.removeEventListener('click', onAnchorClick);
    window.removeEventListener('scroll', updateProgressAndActive);
    window.removeEventListener('resize', updateProgressAndActive);
    window.removeEventListener('wheel', onWheelCapture, true);
    window.removeEventListener('mousedown', onMouseDown);
    lenis.destroy();
    delete document.documentElement.dataset.scrollMode;
  };
}



