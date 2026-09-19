import re

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'r') as f:
    content = f.read()

# 1. Remove FEATURED_CARDS_POOL completely
content = re.sub(r'const FEATURED_CARDS_POOL = \[.*?\];\n', '', content, flags=re.DOTALL)
content = re.sub(r'const shuffleWithSeed = \(.*?\];\n  \};\n', '', content, flags=re.DOTALL)

# 2. Add state for featured cards
state_hook = """  const [featuredQuestions, setFeaturedQuestions] = useState<any[]>([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);

  useEffect(() => {
    setIsLoadingFeatured(true);
    let url = '/api/v1/questions/recommended?limit=6';
    if (selectedExam !== 'All Exams') {
      const examParam = selectedExam === 'UPSC Civil Services Examination' ? 'UPSC' : (selectedExam === 'Maharashtra public service  commission' ? 'MPSC' : selectedExam);
      url += `&exam_name=${encodeURIComponent(examParam)}`;
    }
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        // Shuffle the results
        const items = data.items || data || [];
        if (Array.isArray(items)) {
            const shuffled = [...items].sort(() => 0.5 - Math.random());
            setFeaturedQuestions(shuffled.slice(0, 6));
        } else {
            setFeaturedQuestions([]);
        }
      })
      .catch(() => setFeaturedQuestions([]))
      .finally(() => setIsLoadingFeatured(false));
  }, [selectedExam]);
"""

content = re.sub(r'const filteredCards = useMemo\(\(\) => \{.*?\}, \[selectedExam\]\);', state_hook, content, flags=re.DOTALL)

# 3. Fix the rendering logic
# Replace filteredCards mapping with featuredQuestions
content = content.replace('filteredCards.length === 0', 'featuredQuestions.length === 0 && !isLoadingFeatured')
content = content.replace('filteredCards.map((card, i)', 'featuredQuestions.map((q, i)')

# 4. Fix card rendering
card_content = """                onClick={() =>
                  navigate(
                    `/guest-exam?exam=${encodeURIComponent(selectedExam !== 'All Exams' ? selectedExam : (q.exam_name || 'UPSC CSE'))}&subject=${encodeURIComponent(q.subject_name || 'General')}&count=10`,
                  )
                }
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(15, 23, 42, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      background: '#F1F5F9',
                      color: '#475569',
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {q.subject_name || 'General'}
                  </span>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                    {q.exam_name} {q.source_year}
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#172033',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {q.topic_name || 'Topic'}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: '#64748B',
                    margin: 0,
                    fontWeight: 500,
                  }}
                >
                  {q.subtopic_name || 'Subtopic'}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: '#334155',
                    margin: '8px 0 0 0',
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {q.text || q.question_text}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--primary-red)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Try Question &rarr;
                  </span>
                </div>"""

# Find the div inside featuredQuestions.map
content = re.sub(r'onClick=\{\(\) =>\s*navigate\(.*?\s*\)\s*\}\s*style=\{\{.*?try question \&rarr;\s*</span>\s*</div>', card_content, content, flags=re.DOTALL | re.IGNORECASE)


with open('apps/frontend/src/components/landing/HeroSection.tsx', 'w') as f:
    f.write(content)

