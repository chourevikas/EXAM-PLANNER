# Marketing site & SEO – what changed and how to launch

## Why

The public pages (home, about, exams, pricing) were part of the React app, which only renders in the browser. Search engines and social previews saw an empty page with the same title everywhere. There was also no sitemap or `robots.txt`, pricing and current affairs were hidden behind login, and there were no legal pages.

## What changed

**New marketing site: `apps/marketing` (Astro).** It serves every public page as ready-made HTML on the same domain, examplanner.in:

| Page | Notes |
|---|---|
| `/` | Same look as before; reuses the existing landing components |
| `/exams`, `/exams/upsc-cse`, `/exams/mpsc-rajyaseva` | New exam guides (pattern, syllabus, FAQs) with a "practise free" button |
| `/current-affairs` | New public, indexable current affairs, pulled live from the database |
| `/pricing` | Now public; plans come live from the database |
| `/about`, `/contact` | Moved from the app |
| `/privacy`, `/terms`, `/refund-policy` | New, **drafts** (see below) |

Every page has its own title, description, canonical URL, social preview image and structured data. The site also serves `robots.txt`, `sitemap-index.xml` (current affairs are added automatically) and real 404 pages.

**App (`apps/frontend`):**
- In-app pricing moved to `/billing` and in-app current affairs to `/learn/current-affairs`. All internal links are updated.
- `/signin` and `/signup` show the login popup on its own page.
- App screens are marked `noindex` so they stay out of Google.

**Backend:** a new public endpoint, `GET /api/v1/public/current-affairs` (published items only, no login). Students can no longer open unpublished drafts through the in-app endpoint.

**How requests are routed.** Host nginx sends the marketing paths to the Astro container and everything else to the app. The config is in `deploy/nginx/examplanner.in.conf`.

```
examplanner.in ─┬─ /, /about, /contact, /pricing, /exams/*, /current-affairs/*, legal, sitemaps ──▶ marketing (127.0.0.1:3020)
                └─ everything else (/dashboard, /signin, /billing, /api/…) ──────────────────────▶ app (127.0.0.1:3000)
```

## Before launch – checklist

**Content (client sign-off)**
- [ ] Review the legal pages in `apps/marketing/src/content/legal/`. The refund terms (7-day window, 5–7 day processing) are **placeholders**. When a page is approved, set `reviewed: true` in its file so it becomes indexable and appears in the sitemap. Cashfree needs these pages live before go-live.
- [ ] Check the exam facts in `apps/marketing/src/content/exams/`, especially MPSC (the pattern changed recently).
- [ ] Optionally, add a feature list per plan (`metadata_json.features`) in the admin plans screen. The free plan currently shows only its description.

**Configuration**
- [ ] Add these GitHub repo variables: `GA_MEASUREMENT_ID` (Google Analytics 4) and `GOOGLE_SITE_VERIFICATION` (the Search Console meta token).
- [ ] Add `pankajpandey/seo-marketing-site` (or the merge target) to the `on:` branches list in the publish workflow, if it should build images.

**Deployment**
- [ ] Merge, and let CI build and push `examplanner-marketing`. The deploy step brings up the new `marketing` service from `docker-compose.prod.yml`.
- [ ] On the server, install `deploy/nginx/examplanner.in.conf` and keep the existing certbot/TLS lines. Then run `nginx -t && systemctl reload nginx`.
- [ ] Smoke test: `/`, `/exams/upsc-cse`, `/pricing`, `/current-affairs`, `/robots.txt` and `/sitemap-index.xml` load. Login → dashboard works. `/billing` loads. An unknown path returns 404.

**After launch**
- [ ] In Google Search Console, verify the domain, submit `https://examplanner.in/sitemap-index.xml` and request indexing for the home and exam pages. Repeat in Bing Webmaster Tools.
- [ ] Create a Google Business Profile.
- [ ] Publish current affairs daily. Fresh pages are the main ranking driver.
- [ ] Add more exam guides (one Markdown file each) for the searches that show the most impressions in Search Console.

## Local development

```bash
cd apps/marketing && npm install && npm run dev   # http://localhost:4321 (backend on :8000)
```

The app's dev server sends marketing paths to `localhost:4321`. See `apps/marketing/README.md` for details.

## Known issues (not caused by this change)
- The in-app current affairs list groups items by creation date and parses it wrongly (for example, 1 October shows as "10 March"), in `CurrentAffairsPage.tsx`.
- Three backend tests already fail on the base branch: bookmarks, admin notifications and exam deletion.
