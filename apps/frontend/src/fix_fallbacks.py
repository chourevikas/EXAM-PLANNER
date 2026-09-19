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
    (r"availableExams\.length > 0 \? availableExams : \['UPSC CSE'\]", r"availableExams"),
    (r"useState<string\[\]>\(\['UPSC CSE'\]\)", r"useState<string[]>([])"),
    (r"gExam \|\| 'UPSC CSE'", r"gExam"),
    (r"gExam && !gExam\.startsWith\('All Exams'\) \? gExam : 'UPSC CSE'", r"gExam && !gExam.startsWith('All Exams') ? gExam : ''"),
]

changed_files = 0
for file in files:
    with open(file, 'r') as f:
        original = f.read()
    
    content = original
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    if content != original:
        with open(file, 'w') as f:
            f.write(content)
        changed_files += 1

print(f"Fallbacks replaced in {changed_files} files.")
