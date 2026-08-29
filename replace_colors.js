const fs = require('fs');
const path = require('path');

const directories = [
  path.join(__dirname, 'apps/frontend/src/components'),
  path.join(__dirname, 'apps/frontend/src/pages')
];

const colorMap = {
  // Primary Red (Replacing old blues)
  '#2563EB': '#E31B23',
  '#2563eb': '#E31B23',
  '#1D4ED8': '#C1121F',
  '#1d4ed8': '#C1121F',
  '#3B82F6': '#E31B23',
  '#3b82f6': '#E31B23',
  '#1E40AF': '#A4161A',
  '#1e40af': '#A4161A',
  
  // Success Green
  '#10B981': '#3A8B53',
  '#10b981': '#3A8B53',
  '#059669': '#3A8B53',
  
  // Warning Yellow/Orange
  '#F59E0B': '#F2B623',
  '#f59e0b': '#F2B623',
  '#F97316': '#F47B35',
  '#f97316': '#F47B35',
  '#D97706': '#F2B623',
  
  // Deep Navy replacing dark slate blues
  '#1E293B': '#172033',
  '#1e293b': '#172033',
  '#0F172A': '#172033',
  '#0f172a': '#172033',

  // Ink Black
  '#111827': '#111111',
  '#111827': '#111111',

  // Subtle backgrounds (blueish -> soft white/gray)
  '#EFF6FF': '#F8FAFC',
  '#eff6ff': '#F8FAFC',
  '#DBEAFE': '#E2E8F0',
  '#dbeafe': '#E2E8F0',
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      for (const [oldColor, newColor] of Object.entries(colorMap)) {
        if (content.includes(oldColor)) {
          content = content.split(oldColor).join(newColor);
          changed = true;
        }
      }
      
      // Force all borderRadius to 0 globally, if they are inline.
      // E.g. borderRadius: 12, borderRadius: 8, borderRadius: '12px'
      const borderRegex = /borderRadius:\s*['"]?[0-9]+(px)?['"]?/g;
      if (borderRegex.test(content)) {
          content = content.replace(borderRegex, "borderRadius: 0");
          changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

directories.forEach(processDirectory);
console.log('Done mapping colors.');
