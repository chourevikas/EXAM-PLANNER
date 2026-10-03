import type { APIRoute } from 'astro';
import { api } from '../lib/api';
import { absoluteUrl, slugify } from '../lib/site';

export const prerender = false;

const BATCH = 1000;
const MAX_URLS = 50000; // sitemap protocol limit per file

export const GET: APIRoute = async () => {
  const urls: string[] = [];
  try {
    for (let page = 1; urls.length < MAX_URLS; page++) {
      const { items, total } = await api.currentAffairs(page, BATCH);
      for (const a of items) {
        urls.push(
          `  <url><loc>${absoluteUrl(`/current-affairs/${a.id}-${slugify(a.title)}`)}</loc><lastmod>${a.updated_at.slice(0, 10)}</lastmod></url>`,
        );
      }
      if (items.length < BATCH || page * BATCH >= total) break;
    }
  } catch (err) {
    console.error('sitemap-current-affairs: failed', err);
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } });
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
