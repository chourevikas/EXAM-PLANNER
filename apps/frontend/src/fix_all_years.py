import re
import os

files = [
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/GuestExamPage.tsx",
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/MockSelectionPage.tsx",
    "/home/neerajpandey/Documents/examplanner_code/apps/frontend/src/pages/StudentPracticeExamPage.tsx"
]

replacements = [
    (r"`All Years \(\$\{minYear\} - \$\{maxYear\}\)`", r"'All Years'"),
    (r"'All Years \(2017 - 2024\)'", r"'All Years'"),
    (r"All Years \(2017 - 2024\)", r"All Years"),
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    with open(file, 'w') as f:
        f.write(content)

print("All Years fixed.")
