import type { PlannerTask } from '../services/plannerService';

/** Branding on the downloaded PDF, as in the client's planner. */
const BRAND = 'UPSC PLANNER MENTORSHIP';
const TAGLINE = 'Exam Planner  |  Smart study plans for UPSC and MPSC';

const pad = (n: number) => String(n).padStart(2, '0');
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

function groupByDay(tasks: PlannerTask[]): { date: string; tasks: PlannerTask[] }[] {
  const map = new Map<string, PlannerTask[]>();
  tasks.forEach((t) => { if (!map.has(t.date)) map.set(t.date, []); map.get(t.date)!.push(t); });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, tasks: list }));
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** A dependency-free, branded PDF of the plan: one line per task, grouped by day. */
export function buildPlanPdf(tasks: PlannerTask[], examLabel: string): Blob {
  const days = groupByDay(tasks);
  if (!days.length) throw new Error('No plan to download yet.');
  const lines: { t: string; size: number; bold: boolean; gap: number }[] = [];
  const L = (t: string, size = 10, bold = false, gap = 0) => lines.push({ t, size, bold, gap });
  const total = tasks.filter((t) => t.planner_subtopic_id && !t.block).length;
  const fmtLong = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  L(`Study Plan - ${examLabel}`, 18, true);
  L(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  |  ${total} topics  |  ${days.length} days  |  Ends ${parseKey(days[days.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 10, false, 6);
  L('Revision reminders (+1, +3, +7 days) are listed as "Revise".', 9, false, 10);
  days.forEach((x, i) => {
    L(`Day ${i + 1}  -  ${fmtLong(parseKey(x.date))}`, 12, true, 10);
    x.tasks.forEach((t) => L(`${t.done ? '[x] ' : '[  ] '}${t.title}   (${t.subject || 'Task'}, ${t.minutes} min)`, 10, false, 2));
  });

  const W = 595, H = 842, M = 44, HDR = 58;
  const pages: { x: number; y: number; s: string; size: number; bold: boolean }[][] = [[]];
  let y = H - HDR - 16;
  lines.forEach((ln) => {
    const maxCh = Math.floor((W - 2 * M) / (ln.size * 0.5));
    let rest = String(ln.t).replace(/[^\x20-\x7e]/g, '?');
    const parts: string[] = [];
    while (rest.length > maxCh) {
      let cut = rest.lastIndexOf(' ', maxCh);
      if (cut < 20) cut = maxCh;
      parts.push(rest.slice(0, cut));
      rest = '      ' + rest.slice(cut).trim();
    }
    parts.push(rest);
    parts.forEach((s, i) => {
      const h = ln.size * 1.35 + (i === 0 ? ln.gap : 0);
      if (y - h < 52) { pages.push([]); y = H - HDR - 16; }
      y -= h;
      pages[pages.length - 1].push({ x: M, y, s, size: ln.size, bold: ln.bold });
    });
  });
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const NV = '0.051 0.106 0.243', GD = '0.788 0.659 0.298';
  const brand = (pi: number, n: number) => [
    `${NV} rg 0 ${H - HDR} ${W} ${HDR} re f`,
    `${GD} rg 0 ${H - HDR - 3} ${W} 3 re f`,
    `${GD} rg 40 ${H - HDR + 12} 34 34 re f`,
    `${NV} rg BT /F2 16 Tf 46 ${H - HDR + 23} Td (UP) Tj ET`,
    `1 1 1 rg BT /F2 16 Tf 86 ${H - 34} Td (${esc(BRAND)}) Tj ET`,
    `${GD} rg BT /F1 8 Tf 86 ${H - 48} Td (${esc(TAGLINE)}) Tj ET`,
    `${GD} RG 0.8 w 44 40 m ${W - 44} 40 l S`,
    `${NV} rg BT /F2 8 Tf 44 28 Td (${esc(BRAND)}) Tj ET`,
    `0.35 0.4 0.5 rg BT /F1 8 Tf ${W - 104} 28 Td (Page ${pi + 1} of ${n}) Tj ET`,
    '0.08 0.1 0.19 rg'].join('\n') + '\n';
  const objs: string[] = [];
  const add = (s: string) => { objs.push(s); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const kids: string[] = [];
  pages.forEach((pg, pi) => {
    const c = brand(pi, pages.length) + pg.map((o) => `BT /${o.bold ? 'F2' : 'F1'} ${o.size} Tf ${o.x} ${o.y.toFixed(1)} Td (${esc(o.s)}) Tj ET`).join('\n');
    const cid = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`) + ' 0 R');
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xr = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: 'application/pdf' });
}

export function downloadPlanPdf(tasks: PlannerTask[], examLabel: string) {
  download(buildPlanPdf(tasks, examLabel), 'study-plan.pdf');
}

const icsDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsEsc = (s: string) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** An .ics with all-day events: one for each day's topics, one per daily block, one for that day's revisions. */
export function buildPlanIcs(tasks: PlannerTask[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev: string[] = [];
  groupByDay(tasks).forEach(({ date, tasks: list }) => {
    const d = parseKey(date);
    const nx = new Date(d);
    nx.setDate(nx.getDate() + 1);
    const add = (title: string, desc: string, uid: string) => ev.push([
      'BEGIN:VEVENT', `UID:${uid}@examplanner`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(d)}`,
      `DTEND;VALUE=DATE:${icsDate(nx)}`, `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(desc)}`, 'END:VEVENT'].join('\r\n'));
    const topics = list.filter((t) => !t.block);
    const blocks = list.filter((t) => t.block && t.block !== 'auto_rev');
    const revs = list.filter((t) => t.block === 'auto_rev');
    if (topics.length) add(`Study: ${topics.length} topic${topics.length > 1 ? 's' : ''}`, topics.map((t) => `${t.title} (${t.subject}, ${t.minutes} min)`).join('\n'), `${date}-plan`);
    blocks.forEach((t, i) => add(t.title, `${t.minutes} min`, `${date}-blk${i}`));
    if (revs.length) add(`Revise: ${revs.length} topic${revs.length > 1 ? 's' : ''}`, revs.map((t) => t.title).join('\n'), `${date}-rev`);
  });
  if (!ev.length) throw new Error('No plan to export yet.');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ExamPlanner//EN', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

export function downloadPlanIcs(tasks: PlannerTask[]) {
  download(new Blob([buildPlanIcs(tasks)], { type: 'text/calendar' }), 'study-plan.ics');
}
