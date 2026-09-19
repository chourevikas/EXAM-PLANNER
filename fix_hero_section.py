with open('apps/frontend/src/components/landing/HeroSection.tsx', 'r') as f:
    content = f.read()

content = content.replace('card.badge', 'q.subject_name || \'General\'')
content = content.replace('card.meta', '`${q.exam_name || \'\'} ${q.source_year || \'\'}`.trim()')
content = content.replace('card.q', 'q.text || q.question_text')

# Remove the old card.exam and card.subject references if they exist
import re
content = re.sub(r'`/guest-exam\?exam=\$\{encodeURIComponent\(card\.exam === \'UPSC\' \? \'UPSC CSE\' : card\.exam\)\}\&subject=\$\{encodeURIComponent\(card\.subject\)\}\&count=10`',
                 r'`/guest-exam?exam=${encodeURIComponent(selectedExam !== \'All Exams\' ? selectedExam : (q.exam_name || \'UPSC CSE\'))}&subject=${encodeURIComponent(q.subject_name || \'General\')}&count=10`',
                 content)


with open('apps/frontend/src/components/landing/HeroSection.tsx', 'w') as f:
    f.write(content)
