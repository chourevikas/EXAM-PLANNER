with open('apps/frontend/src/pages/GuestExamPage.tsx', 'r') as f:
    content = f.read()

helper = """
const shortenExamName = (name: string) => {
  if (!name) return name;
  const n = name.toLowerCase();
  if (n.includes('upsc') || n.includes('union public service')) return 'UPSC CSE';
  if (n.includes('mpsc') || n.includes('maharashtra public service')) return 'MPSC';
  if (n.includes('ssc') || n.includes('staff selection')) return 'SSC';
  return name;
};
"""

content = content.replace('export function GuestExamPage() {', helper + '\nexport function GuestExamPage() {')
content = content.replace('{gExam}', '{shortenExamName(gExam)}')
content = content.replace('<span>{opt}</span>', '<span>{shortenExamName(opt)}</span>')

with open('apps/frontend/src/pages/GuestExamPage.tsx', 'w') as f:
    f.write(content)
