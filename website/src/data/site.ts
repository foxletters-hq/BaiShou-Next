export const CONTRIBUTORS_URL =
  'https://github.com/foxletters-hq/BaiShou-Next/graphs/contributors';
export const BILIBILI_URL = 'https://space.bilibili.com/18187585';

/** foxletters.com / 白守软件分享 的网站备案号，须挂工信部查询入口 */
export const ICP_FILING_NUMBER = '豫ICP备2024102539号-3';
export const ICP_FILING_URL = 'https://beian.miit.gov.cn/';

/** 公安联网备案号，须挂全国互联网安全管理服务平台查询入口 */
export const MPS_FILING_NUMBER = '豫公网安备41010502007985号';
export const MPS_FILING_CODE = '41010502007985';
export const MPS_FILING_URL = `https://beian.mps.gov.cn/#/query/webSearch?code=${MPS_FILING_CODE}`;

// 重新导出 releases 与 contributors 模块，保持外部兼容
export * from './releases';
export * from './contributors';

export const QQ_GROUPS = [
  {
    id: 'group1' as const,
    number: '234030411',
    qrImage: '/assets/images/community/qq-group-1.png',
  },
  {
    id: 'group2' as const,
    number: '618635637',
    qrImage: '/assets/images/community/qq-group-2.png',
  },
] as const;

export const FEATURE_IDS = [
  'diary',
  'graph',
  'rag',
  'agent',
  'companion',
  'sync',
] as const;

export const ORIGIN_TRIO_IDS = ['anson', 'sakura', 'akatsuki'] as const;
export const PRINCIPLE_IDS = ['local', 'open', 'ai', 'official'] as const;

export const NAV_SECTION_IDS = [
  'features',
  'principles',
  'origin',
  'mascot',
  'people',
] as const;

/** 跳转到独立二级页面（非首页锚点）的导航项 */
export const ROUTE_NAV_IDS = [] as const;

/** 首页 snap 分屏导航点（不含独立页面） */
export const SNAP_SECTION_IDS = ['hero', ...NAV_SECTION_IDS] as const;

/** 根据导航项 id 解析链接地址 */
export function navHref(id: string): string {
  return (ROUTE_NAV_IDS as readonly string[]).includes(id)
    ? `/${id}`
    : `#${id}`;
}
