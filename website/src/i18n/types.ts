export type Locale = 'zh-CN' | 'zh-TW' | 'en' | 'ja';

export interface LocaleOption {
  code: Locale;
  label: string;
  shortLabel: string;
}

export interface Messages {
  meta: { title: string; description: string };
  brand: { name: string; suffix: string };
  nav: {
    home: string;
    features: string;
    principles: string;
    origin: string;
    mascot: string;
    people: string;
    docsAction: string;
  };
  a11y: {
    mainNav: string;
    snapNav: string;
    footerNav: string;
    themeToggle: string;
    langSelect: string;
    avatar: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    tagline: string;
    positioning: string;
    desc: string;
    ctaGithub: string;
    ctaCommunity: string;
    ctaBilibili: string;
    iconAlt: string;
  };
  features: {
    eyebrow: string;
    title: string;
    lead: string;
    devBadge: string;
    items: Record<
      'diary' | 'graph' | 'agent' | 'companion' | 'rag' | 'sync',
      { title: string; desc: string; badge?: string }
    >;
  };
  principles: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Record<
      'local' | 'open' | 'ai' | 'official',
      { title: string; desc: string; badge?: string }
    >;
  };
  origin: {
    eyebrow: string;
    title: string;
    lead: string;
    story: {
      p1: string;
      p2: string;
      p3: string;
      quote: string;
    };
    trio: Record<
      'anson' | 'sakura' | 'akatsuki',
      { name: string; role: string; desc: string }
    >;
  };
  mascot: {
    eyebrow: string;
    title: string;
    lead: string;
    name: string;
    role: string;
    quote: string;
    p1: string;
    p2: string;
    tags: {
      t1: string;
      t2: string;
      t3: string;
      t4: string;
    };
    cta: string;
  };
  people: {
    founderRole: string;
    collabLeadLink: string;
    wallEyebrow: string;
    wallTitle: string;
    wallLeadBefore: string;
    wallLeadLink: string;
    wallLeadAfter: string;
    commitsUnit: string;
    badgeHintBefore: string;
    badgeHintLink: string;
    badgeHintAfter: string;
  };
  footer: {
    copy: string;
    bilibili: string;
    joinCommunity: string;
    github: string;
  };
  community: {
    eyebrow: string;
    title: string;
    lead: string;
    groupIdLabel: string;
    scanHint: string;
    closeAria: string;
    groups: Record<'group1' | 'group2', { name: string; qrAlt: string }>;
  };
  download: {
    button: string;
    title: string;
    lead: string;
    windows: string;
    android: string;
    closeAria: string;
  };
}
