import { SITE, absoluteUrl } from '../lib/site';

export const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  logo: absoluteUrl('/icon-512.png'),
  email: SITE.supportEmail,
  contactPoint: { '@type': 'ContactPoint', email: SITE.supportEmail, contactType: 'customer support', areaServed: 'IN' },
};

export const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: SITE.url,
  inLanguage: 'en-IN',
};

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}
