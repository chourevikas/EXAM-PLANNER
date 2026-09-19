with open('apps/frontend/src/components/landing/HeroSection.tsx', 'r') as f:
    content = f.read()

helper = """
const shortenExamName = (name: string) => {
  if (!name) return name;
  const n = name.toLowerCase();
  if (n.includes('upsc') || n.includes('union public service')) return 'UPSC';
  if (n.includes('mpsc') || n.includes('maharashtra public service')) return 'MPSC';
  if (n.includes('ssc') || n.includes('staff selection')) return 'SSC';
  return name;
};
"""

# Insert the helper inside HeroSection before it's used
content = content.replace('export default function HeroSection(', helper + '\nexport default function HeroSection(')

# Replace the dropdown text
content = content.replace('{et.name}\n                  </option>', '{shortenExamName(et.name)}\n                  </option>')

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'w') as f:
    f.write(content)
