import re

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'r') as f:
    content = f.read()

# Replace lines 30 to 127
old_chunk1 = """  // Form selections (Subject is required, Topic is optional)"""
old_chunk1_end = """  };"""

pattern1 = re.compile(r'  // Form selections \(Subject is required, Topic is optional\).*?  };\n', re.DOTALL)

new_chunk1 = """  const [examsList] = useState<string[]>(TARGET_EXAM_OPTIONS);

  // Search logic
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ mocks: any[], pyqs: any[], topics: any[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);
"""

content = pattern1.sub(new_chunk1, content, count=1)


pattern2 = re.compile(r'            \{\/\* Premium Mock Builder Form Card \*\/\}\n            <form.*?            </form>', re.DOTALL)

new_chunk2 = """            {/* Hero Search Form */}
            <div style={{ position: 'relative', marginTop: 10 }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#FFFFFF',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
                  overflow: 'visible',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <select
                  style={{
                    padding: '14px 16px',
                    border: 'none',
                    borderRight: '1px solid #E2E8F0',
                    background: 'transparent',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#172033',
                    outline: 'none',
                    cursor: 'pointer',
                    borderRadius: '8px 0 0 8px'
                  }}
                >
                  <option value="All Exams">All Exams</option>
                  {examsList.map((ex) => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search a topic, year, or question (e.g. Fundamental Rights)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    border: 'none',
                    fontSize: 15,
                    color: '#172033',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#E31B23',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '14px 24px',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                    borderRadius: '0 8px 8px 0',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C1121F')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E31B23')}
                >
                  Search
                </button>
              </form>

              {/* Autocomplete Dropdown */}
              {showDropdown && searchQuery.trim().length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 8,
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                    zIndex: 100,
                    maxHeight: 400,
                    overflowY: 'auto',
                    borderRadius: 8
                  }}
                >
                  {isSearching ? (
                    <div style={{ padding: '16px', fontSize: 13, color: '#64748B', textAlign: 'center' }}>Searching...</div>
                  ) : searchResults ? (
                    <>
                      {searchResults.topics.length > 0 && (
                        <div>
                          <div style={{ padding: '8px 12px', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Topics & Concepts</div>
                          {searchResults.topics.map((t) => (
                            <div key={t.id} onClick={() => { setShowDropdown(false); navigate(t.url); }} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{t.title}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{t.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.pyqs.length > 0 && (
                        <div>
                          <div style={{ padding: '8px 12px', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Previous Year Papers</div>
                          {searchResults.pyqs.map((p) => (
                            <div key={p.id} onClick={() => { setShowDropdown(false); navigate(p.url); }} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{p.title}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{p.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.mocks.length > 0 && (
                        <div>
                          <div style={{ padding: '8px 12px', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Mock Tests</div>
                          {searchResults.mocks.map((m) => (
                            <div key={m.id} onClick={() => { setShowDropdown(false); navigate(m.url); }} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{m.title}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{m.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {(!searchResults.topics.length && !searchResults.pyqs.length && !searchResults.mocks.length) && (
                        <div style={{ padding: '16px', fontSize: 13, color: '#64748B', textAlign: 'center' }}>No results found</div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
              
              {/* Compact Trust / Benefit Row */}
              <div
                style={{
                  marginTop: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontSize: 13,
                  color: '#64748B',
                  fontWeight: 500,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={15} style={{ color: '#059669' }} /> 10,000+ Solved PYQs
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={15} style={{ color: '#059669' }} /> Trap Diagnosis
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={15} style={{ color: '#059669' }} /> Adaptive Plans
                </span>
              </div>
            </div>"""

content = pattern2.sub(new_chunk2, content, count=1)

with open('apps/frontend/src/components/landing/HeroSection.tsx', 'w') as f:
    f.write(content)

print("Done")
