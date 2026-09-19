import re
import os
import glob

search_dirs = [
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/**/*.tsx",
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/components/**/*.tsx"
]

files = []
for d in search_dirs:
    files.extend(glob.glob(d, recursive=True))

replacements = [
    (r"(['\"])#1E3A8A\1", r"\1var(--accent-primary)\1"),
    (r"(['\"])#2563EB\1", r"\1var(--accent-primary)\1"),
    (r"(['\"])#EFF6FF\1", r"\1var(--accent-bg)\1"),
    (r"(['\"])#172033\1", r"\1var(--deep-navy)\1"),
    (r"(['\"])#F8FAFC\1", r"\1var(--bg-subtle)\1"),
    (r"(['\"])#FFFFFF\1", r"\1var(--bg-card)\1"),
    (r"(['\"])#E2E8F0\1", r"\1var(--border-color)\1"),
    (r"(['\"])#64748B\1", r"\1var(--text-muted)\1"),
    (r"(['\"])#334155\1", r"\1var(--text-secondary)\1"),
    (r"(['\"])#F1F5F9\1", r"\1var(--bg-hover)\1"),
    (r"(['\"])#94A3B8\1", r"\1var(--text-disabled)\1"),
    (r"(['\"])#16A34A\1", r"\1var(--status-success)\1"),
    (r"(['\"])#DCFCE7\1", r"\1var(--status-success-bg)\1"),
    (r"(['\"])#B45309\1", r"\1var(--status-warning)\1"),
    (r"(['\"])#FEF3C7\1", r"\1var(--status-warning-bg)\1"),
    (r"(['\"])#EF4444\1", r"\1var(--primary-red)\1"),
    (r"(['\"])#FEE2E2\1", r"\1var(--primary-red-bg)\1"),
    (r"(['\"])#FCA5A5\1", r"\1var(--primary-red-border)\1"),
    (r"(['\"])#10B981\1", r"\1var(--status-success)\1"),
    (r"(['\"])#D1FAE5\1", r"\1var(--status-success-bg)\1"),
    (r"(['\"])#F59E0B\1", r"\1var(--status-warning)\1"),
    (r"(['\"])#FEF3C7\1", r"\1var(--status-warning-bg)\1"),
    (r"(['\"])#3B82F6\1", r"\1var(--accent-primary)\1"),
    (r"(['\"])#BFDBFE\1", r"\1var(--accent-border)\1"),
    (r"(['\"])#0F172A\1", r"\1var(--deep-navy)\1"),
    (r"(['\"])#475569\1", r"\1var(--text-secondary)\1"),
    (r"(['\"])#CBD5E1\1", r"\1var(--border-color)\1"),
    (r"(['\"])#FAFAFA\1", r"\1var(--bg-subtle)\1"),
]

changed_files = 0
for file in files:
    with open(file, 'r') as f:
        original = f.read()
    
    content = original
    for old, new in replacements:
        content = re.sub(old, new, content, flags=re.IGNORECASE)
        
    if content != original:
        with open(file, 'w') as f:
            f.write(content)
        changed_files += 1

print(f"Colors replaced in {changed_files} files.")
