# ExamPlanner marketing site

Astro site for the public, indexable pages on examplanner.in: `/`, `/about`, `/contact`, `/pricing`,
`/exams/*`, `/current-affairs/*`, `/privacy`, `/terms`, `/refund-policy`, sitemaps and `robots.txt`.
Everything else (the app) is the React SPA in `apps/frontend`; host nginx routes by path
(`deploy/nginx/examplanner.in.conf`).

- **Landing sections are shared**: `src/pages/index.astro` renders `apps/frontend/src/components/landing/*`
  via the `@app` alias. Static sections ship zero JS; interactive ones are islands (`src/islands/*`), and
  `RouterShim` turns their `navigate()` calls into full page loads into the SPA.
- **Static vs server-rendered**: most pages are prerendered at build time. `/pricing`, `/current-affairs/*`
  and the sitemaps render per request from the backend (`API_URL`, default `http://127.0.0.1:8000`) with a
  5-minute in-process cache.
- **Content**: exam guides live in `src/content/exams/*.md`, legal pages in `src/content/legal/*.md`.
  Legal pages are served `noindex` and kept out of the sitemap until `reviewed: true` is set.
- **SEO head**: `src/layouts/BaseLayout.astro` (title, description, canonical, OG/Twitter, JSON-LD).
  Set `PUBLIC_GA_ID` / `PUBLIC_GSC_TOKEN` at build time for GA4 and Search Console verification.

## Develop

```bash
npm install
npm run dev            # http://localhost:4321, proxies /api to the backend on :8000
npm run build          # astro check + build
npm run preview        # node dist/server/entry.mjs
```

In dev the SPA (port 3000) sends marketing paths to `http://localhost:4321`
(override with `VITE_MARKETING_ORIGIN`). Production images are built from the `./apps` context:
`docker build -f apps/marketing/Dockerfile apps`.
