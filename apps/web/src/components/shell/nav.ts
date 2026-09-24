import type { IconName } from '@/components/ui/Icon';
import type { TranslationKey } from '@/i18n/translations';
import type { Role } from '@/types';

export type NavSection = 'operate' | 'resources' | 'records' | 'admin';

export type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: IconName;
  section: NavSection;
  roles: Role[];
  /** Emphasised as the primary call to action. */
  primary?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/map', labelKey: 'fireMap', icon: 'map', section: 'operate', roles: ['OFFICIAL', 'CIVILIAN'] },
  { href: '/reports-list', labelKey: 'reports', icon: 'list', section: 'operate', roles: ['OFFICIAL'] },
  { href: '/reports-list', labelKey: 'navMyReports', icon: 'list', section: 'operate', roles: ['CIVILIAN'] },
  { href: '/report', labelKey: 'reportFireCta', icon: 'fire', section: 'operate', roles: ['OFFICIAL', 'CIVILIAN'], primary: true },
  { href: '/weather', labelKey: 'weatherTitle', icon: 'cloud', section: 'records', roles: ['OFFICIAL', 'CIVILIAN'] },
  { href: '/equipment', labelKey: 'equipment', icon: 'truck', section: 'resources', roles: ['OFFICIAL'] },
  { href: '/coordination', labelKey: 'coordination', icon: 'radio', section: 'resources', roles: ['OFFICIAL'] },
  { href: '/operations', labelKey: 'operationsTitle', icon: 'clipboard', section: 'resources', roles: ['OFFICIAL'] },
  { href: '/fire-database', labelKey: 'fireDatabase', icon: 'database', section: 'records', roles: ['OFFICIAL'] },
  { href: '/analytics', labelKey: 'analytics', icon: 'analytics', section: 'records', roles: ['OFFICIAL', 'CIVILIAN'] },
  { href: '/admin/approvals', labelKey: 'navApprovals', icon: 'userCheck', section: 'admin', roles: ['OFFICIAL'] },
  { href: '/admin/audit', labelKey: 'navAudit', icon: 'audit', section: 'admin', roles: ['OFFICIAL'] },
];

export const SECTION_ORDER: NavSection[] = ['operate', 'resources', 'records', 'admin'];

export const SECTION_LABEL: Record<NavSection, TranslationKey> = {
  operate: 'navSectionOperate',
  resources: 'navSectionResources',
  records: 'navSectionRecords',
  admin: 'navSectionAdmin',
};

export function navFor(role: Role | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role ?? 'CIVILIAN'));
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function currentNavItem(pathname: string, role: Role | undefined): NavItem | undefined {
  return navFor(role)
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
