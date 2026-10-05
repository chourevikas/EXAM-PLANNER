import { Marked } from 'marked';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// API-sourced markdown: render raw HTML as text, keep links safe, make tables scrollable on phones.
const marked = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return escape(text);
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:|mailto:|\/|#)/i.test(href)) return label;
      const external = /^https?:/i.test(href) && !href.startsWith('https://examplanner.in');
      return `<a href="${escape(href)}"${external ? ' rel="nofollow noopener" target="_blank"' : ''}>${label}</a>`;
    },
  },
  hooks: {
    postprocess: (html) => html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>'),
  },
});

export const renderMarkdown = (md: string) => marked.parse(md, { async: false }) as string;
