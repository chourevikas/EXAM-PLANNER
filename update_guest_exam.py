import re

with open('apps/frontend/src/pages/GuestExamPage.tsx', 'r') as f:
    content = f.read()

# 1. Add selectedExamsList
# Find `const selectedSubjectsList = useMemo(() => {` and insert before it
selected_exams_code = """  const selectedExamsList = useMemo(() => {
    return parseTaxonomyParam(gExam, availableExams.length > 0 ? availableExams : []);
  }, [gExam, availableExams]);

"""
content = content.replace("  const selectedSubjectsList = useMemo(() => {", selected_exams_code + "  const selectedSubjectsList = useMemo(() => {")

# 2. Add toggleExamFilter and selectAllExams
# Find `const toggleSubjectFilter =` and insert before it
exam_filter_code = """  const toggleExamFilter = (examName: string) => {
    const current = new URLSearchParams(searchParams);
    if (examName === 'All Exams') {
      current.delete('exam');
    } else {
      let updated: string[];
      if (selectedExamsList.includes(examName)) {
        updated = selectedExamsList.filter((e) => e !== examName);
      } else {
        updated = [...selectedExamsList, examName];
      }
      if (updated.length === 0) {
        current.delete('exam');
      } else {
        current.set('exam', formatTaxonomyParam(updated));
      }
    }
    navigate(`/guest-exam?${current.toString()}`);
  };

  const selectAllExams = () => {
    const current = new URLSearchParams(searchParams);
    const individualExams = availableExams.filter((e) => e !== 'All Exams');
    if (individualExams.length > 0) {
      current.set('exam', formatTaxonomyParam(individualExams));
    } else {
      current.delete('exam');
    }
    navigate(`/guest-exam?${current.toString()}`);
  };

"""
content = content.replace("  const toggleSubjectFilter = (subjectName: string) => {", exam_filter_code + "  const toggleSubjectFilter = (subjectName: string) => {")

# 3. Replace {shortenExamName(gExam)} with the multi-select label
# It appears twice (desktop/mobile)
label_code = """{selectedExamsList.length === 0 ? 'All Exams' : selectedExamsList.length === 1 ? shortenExamName(selectedExamsList[0]) : `${selectedExamsList.length} Exams`}"""
content = content.replace("{shortenExamName(gExam)}", label_code)

# 4. Replace Exam Popover 1
popover_search = r"\{\/\* Exam Popover \*\/}.*?activeDropdown === 'exam' && \(\s*<div\s*style=\{\{\s*position: 'absolute',\s*top: 'calc\(100% \+ 8px\)',\s*left: 0,\s*width: 220,\s*maxWidth: 'calc\(100vw \- 32px\)',\s*backgroundColor: '#FFFFFF',\s*border: '1px solid #E2E8F0',\s*borderRadius: 0,\s*boxShadow: '0 12px 32px rgba\(15, 23, 42, 0\.14\)',\s*padding: 8,\s*zIndex: 100,\s*\}\}.*?\{\(availableExams\.length > 0 \? availableExams : \['UPSC CSE'\]\)\.map\(\(opt\) => \(.*?</div\>\s*\)\s*\)\}\s*</div\>\s*\)\}"

popover_replace = """{/* Exam Popover with Multi-Select */}
                  {activeDropdown === 'exam' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 260,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 10,
                        zIndex: 100,
                      }}
                    >
                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                        <button type="button" onClick={selectAllExams} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                        <button type="button" onClick={() => toggleExamFilter('All Exams')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                      </div>

                      <div
                        style={{
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        {['All Exams', ...(availableExams.length > 0 ? availableExams : ['UPSC CSE'])]
                          .map((opt) => {
                            const isSelected = opt === 'All Exams' ? selectedExamsList.length === 0 : selectedExamsList.includes(opt);
                            return (
                              <div
                                key={opt}
                                onClick={() => toggleExamFilter(opt)}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? '#1E3A8A' : '#334155',
                                  backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected)
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    border: isSelected ? '1px solid #1E3A8A' : '1px solid #CBD5E1',
                                    borderRadius: 3,
                                    marginRight: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isSelected ? '#1E3A8A' : '#FFFFFF',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isSelected && <Check size={10} color="#FFFFFF" />}
                                </div>
                                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {opt === 'All Exams' ? opt : shortenExamName(opt)}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}"""

content = re.sub(popover_search, popover_replace, content, flags=re.DOTALL)

with open('apps/frontend/src/pages/GuestExamPage.tsx', 'w') as f:
    f.write(content)

