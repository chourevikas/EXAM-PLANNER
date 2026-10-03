export const SITE = {
  name: 'ExamPlanner',
  url: 'https://examplanner.in',
  description:
    'PYQ-first preparation for UPSC and State PSC exams: previous year questions, smart mock tests, daily current affairs and performance analytics.',
  supportEmail: 'support@examplanner.in',
  ogImage: '/og-image.png',
};

export const absoluteUrl = (path: string) => new URL(path, SITE.url).toString();

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';
}

/** Plain-text excerpt for meta descriptions from markdown content. */
export function excerpt(markdown: string, max = 155): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}
