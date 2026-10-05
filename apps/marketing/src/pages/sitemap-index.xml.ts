import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/site';

export const prerender = false;

export const GET: APIRoute = () => {
  const now = new Date().toISOString();
  const maps = ['/sitemap-pages.xml', '/sitemap-current-affairs.xml'];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${maps.map((m) => `  <sitemap><loc>${absoluteUrl(m)}</loc><lastmod>${now}</lastmod></sitemap>`).join('\n')}
</sitemapindex>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
