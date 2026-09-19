import re

files = [
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/StudentPracticeExamPage.tsx",
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/ExamEnginePage.tsx"
]

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
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content, flags=re.IGNORECASE)
        
    with open(file, 'w') as f:
        f.write(content)

print("Colors replaced.")
