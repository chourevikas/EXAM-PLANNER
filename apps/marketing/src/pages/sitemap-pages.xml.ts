import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { absoluteUrl } from '../lib/site';

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const GET: APIRoute = async () => {
  const exams = await getCollection('exams');
  // Unreviewed legal drafts are noindex, so keep them out of the sitemap too.
  const legal = (await getCollection('legal')).filter((d) => d.data.reviewed);
  const urls: { path: string; lastmod?: Date }[] = [
    { path: '/' },
    { path: '/exams' },
    ...exams.map((e) => ({ path: `/exams/${e.id}`, lastmod: e.data.updated })),
    { path: '/current-affairs' },
    { path: '/pricing' },
    { path: '/about' },
    { path: '/contact' },
    ...legal.map((d) => ({ path: `/${d.id}`, lastmod: d.data.updated })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${escapeXml(absoluteUrl(u.path))}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
