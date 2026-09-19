import re

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'r') as f:
    content = f.read()

# Update activeSubjects
content = content.replace(
"""  const [activeSubjects, setActiveSubjects] = useState<string[]>([
    'Polity',
    'Economy',
    'Environment',
    'Science & Tech',
    'Modern History',
    'Geography',
  ]);""",
"""  const [activeSubjects, setActiveSubjects] = useState<string[]>([]);"""
)

# Insert logic to set active subjects in loadBackgroundTaxonomy
tax_update = """
        const nodes: FlatSyllabusNode[] = [];
        const subjects: string[] = [];
        if (taxData.subjects && Array.isArray(taxData.subjects)) {
          taxData.subjects.forEach((subj: any) => {
            const subjName = subj.name || '';
            if (!subjName) return;
            
            if (subjects.length < 8 && !subjects.includes(subjName)) {
                subjects.push(subjName);
            }
"""
content = content.replace("""        const nodes: FlatSyllabusNode[] = [];
        if (taxData.subjects && Array.isArray(taxData.subjects)) {
          taxData.subjects.forEach((subj: any) => {
            const subjName = subj.name || '';
            if (!subjName) return;""", tax_update)

content = content.replace(
"""        if (nodes.length > 0) {
          // You could potentially merge them into FLAT_SYLLABUS_NODES if you like
        }""",
"""        if (nodes.length > 0) {
          // You could potentially merge them into FLAT_SYLLABUS_NODES if you like
        }
        if (subjects.length > 0) {
          setActiveSubjects(subjects);
        }"""
)

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'w') as f:
    f.write(content)
