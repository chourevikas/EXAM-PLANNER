with open('apps/frontend/src/components/landing/HeroSection.tsx', 'r') as f:
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

content = content.replace('export function HeroSection(', helper + '\nexport function HeroSection(')

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'w') as f:
    f.write(content)
