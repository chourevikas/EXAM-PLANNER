import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Zap, CheckCircle2, ArrowRight, Search } from 'lucide-react';
import { FLAT_SYLLABUS_NODES, FlatSyllabusNode } from '../../constants/syllabusData';
import { fetchMasterSyllabus } from '../../services/examService';

interface HeroSectionProps {
  onSignup?: () => void;
  onLogin?: () => void;
}

export function HeroSection({ }: HeroSectionProps) {
  const navigate = useNavigate();

  // Syllabus search state
  const [syllabusSearchQuery, setSyllabusSearchQuery] = useState('');
  const [selectedExam, setSelectedExam] = useState('All Exams');
  const [isSyllabusSearchFocused, setIsSyllabusSearchFocused] = useState(false);
  const [hoveredSyllabusResult, setHoveredSyllabusResult] = useState<number | null>(null);
  const syllabusSearchRef = useRef<HTMLDivElement>(null);

  // Dynamic supplementary nodes if backend provides extra taxonomy nodes
  const [dynamicNodes, setDynamicNodes] = useState<FlatSyllabusNode[]>([]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (syllabusSearchRef.current && !syllabusSearchRef.current.contains(e.target as Node)) {
        setIsSyllabusSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const FEATURED_CARDS = [
    { badge: "GS Paper 1", meta: "UPSC 2024 · Q.14", exam: "UPSC", q: 'In the context of the Constitution of India, "Due Process of Law" implies:', qIndex: 0 },
    { badge: "GS Paper 1", meta: "UPSC 2023 · Q.32", exam: "UPSC", q: "Which Constitutional Amendment was enacted to overcome judicial interpretations of the Fundamental Rights, particularly regarding the Right to Equality and Property?", qIndex: 1 },
    { badge: "GS Paper 1", meta: "UPSC 2022 · Q.45", exam: "UPSC", q: "In India, which of the following is responsible for maintaining price stability by controlling inflation?", qIndex: 2 },
    { badge: "GS Paper 1", meta: "UPSC 2021 · Q.52", exam: "UPSC", q: "With reference to the Indian economy, consider the statements on Real Effective Exchange Rate (REER) and its relation to NEER and domestic inflation.", qIndex: 0 },
    { badge: "GS Paper 1", meta: "UPSC 2023 · Q.68", exam: "UPSC", q: "Consider the statements regarding the Wild Life (Protection) Amendment Act, 2022, on Schedules and CITES specimens.", qIndex: 1 },
    { badge: "GS Paper 1", meta: "UPSC 2020 · Q.21", exam: "UPSC", q: "Which Parliamentary Committee scrutinizes whether powers to make rules and regulations delegated by Parliament are properly exercised?", qIndex: 2 },
  ];

  const filteredCards = useMemo(() => {
    const q = syllabusSearchQuery.trim().toLowerCase();

    return FEATURED_CARDS.filter(card => {
      const matchesText = !q || card.q.toLowerCase().includes(q) || card.badge.toLowerCase().includes(q) || card.exam.toLowerCase().includes(q) || card.meta.toLowerCase().includes(q);
      const matchesExam = selectedExam === 'All Exams' || card.exam === selectedExam;
      return matchesText && matchesExam;
    });
  }, [syllabusSearchQuery, selectedExam]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ mocks: any[], pyqs: any[], topics: any[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Background sync for any dynamically configured custom subjects/topics from API
  useEffect(() => {
    let isCancelled = false;
    async function loadBackgroundTaxonomy() {
      try {
        const taxData = await fetchMasterSyllabus();
        if (isCancelled || !taxData) return;

        const extraNodes: FlatSyllabusNode[] = [];
        if (taxData.subjects && Array.isArray(taxData.subjects)) {
          taxData.subjects.forEach((subj: any) => {
            const subjName = subj.name || '';
            if (!subjName) return;
            (subj.topics || []).forEach((topic: any) => {
              const topicName = topic.name || '';
              if (!topicName) return;
              (topic.subtopics || []).forEach((sub: any) => {
                const subName = typeof sub === 'string' ? sub : sub.name || '';
                if (!subName) return;
                if (!FLAT_SYLLABUS_NODES.some(n => n.type === 'subtopic' && n.label.toLowerCase() === subName.toLowerCase())) {
                  extraNodes.push({
                    type: 'subtopic',
                    subject: subjName,
                    topic: topicName,
                    subtopic: subName,
                    label: subName,
                    breadcrumb: `${subjName} › ${topicName} › ${subName}`,
                    keywords: `${subjName} ${topicName} ${subName}`.toLowerCase(),
                  });
                }
              });
            });
          });
        }
        if (!isCancelled && extraNodes.length > 0) {
          setDynamicNodes(extraNodes);
        }
      } catch {
        // Silently keep pre-bundled static syllabus
      }
    }

    loadBackgroundTaxonomy();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Combined searchable syllabus nodes (pre-bundled canonical + any runtime additions)
  const allSyllabusNodes = useMemo(() => {
    if (dynamicNodes.length === 0) return FLAT_SYLLABUS_NODES;
    return [...FLAT_SYLLABUS_NODES, ...dynamicNodes];
  }, [dynamicNodes]);

  // Fast, ranked search across all Subjects, Topics, and Subtopics
  const syllabusSearchResults = useMemo(() => {
    const rawQuery = syllabusSearchQuery.trim().toLowerCase();
    if (!rawQuery || rawQuery.length < 2) return [];

    const queryTokens = rawQuery.split(/\s+/).filter(Boolean);

    const scoredResults: { node: FlatSyllabusNode; score: number }[] = [];

    for (const node of allSyllabusNodes) {
      const labelLower = node.label.toLowerCase();
      const breadcrumbLower = node.breadcrumb.toLowerCase();
      const keywordsLower = node.keywords;

      let score = 0;

      // Exact label match
      if (labelLower === rawQuery) {
        score += 100;
      } else if (labelLower.startsWith(rawQuery)) {
        // Prefix match on label
        score += 80;
      } else if (labelLower.includes(rawQuery)) {
        // Substring match on label
        score += 60;
      } else if (breadcrumbLower.includes(rawQuery) || keywordsLower.includes(rawQuery)) {
        // Match in hierarchy breadcrumb
        score += 40;
      }

      // Check multi-word tokens
      if (score === 0 && queryTokens.length > 1) {
        const allTokensMatch = queryTokens.every(
          token => labelLower.includes(token) || breadcrumbLower.includes(token) || keywordsLower.includes(token)
        );
        if (allTokensMatch) {
          score += 50;
        }
      }

      if (score > 0) {
        // Bonus for specific topics/subtopics vs broad subjects when searching specific concepts
        if (node.type === 'topic') score += 5;
        if (node.type === 'subtopic') score += 10;
        scoredResults.push({ node, score });
      }
    }

    // Sort descending by relevance score
    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, 10).map(r => r.node);
  }, [syllabusSearchQuery, allSyllabusNodes]);

  // Launch the exam with proper filters (Subject, Topic, Subtopic; ignoring exam year)
  const handleSyllabusResultClick = (result: FlatSyllabusNode) => {
    const params = new URLSearchParams({ exam: 'UPSC CSE' });
    params.set('subject', result.subject);
    if (result.topic) {
      params.set('topic', result.topic);
    }
    if (result.subtopic) {
      params.set('subtopic', result.subtopic);
    }
    params.set('count', '10');
    setSyllabusSearchQuery('');
    setIsSyllabusSearchFocused(false);
    navigate(`/guest-exam?${params.toString()}`);
  };

  // Keyboard navigation inside search input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoveredSyllabusResult(prev => {
        if (prev === null || prev >= syllabusSearchResults.length - 1) return 0;
        return prev + 1;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoveredSyllabusResult(prev => {
        if (prev === null || prev <= 0) return syllabusSearchResults.length - 1;
        return prev - 1;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (syllabusSearchResults.length > 0) {
        const targetIndex = hoveredSyllabusResult !== null && hoveredSyllabusResult < syllabusSearchResults.length
          ? hoveredSyllabusResult
          : 0;
        handleSyllabusResultClick(syllabusSearchResults[targetIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsSyllabusSearchFocused(false);
    }
  };

  // Canonical chip launcher for popular subject quick picks
  const handleQuickPickClick = (chipName: string) => {
    let targetSubject = 'Indian Polity & Governance';
    let targetTopic: string | undefined = undefined;

    if (chipName === 'Polity') {
      targetSubject = 'Indian Polity & Governance';
    } else if (chipName === 'Modern History') {
      targetSubject = 'History';
      targetTopic = 'Modern History';
    } else if (chipName === 'Indian Economy') {
      targetSubject = 'Economy';
    } else if (chipName === 'Geography') {
      targetSubject = 'Geography';
    } else if (chipName === 'Environment & Ecology') {
      targetSubject = 'Ecology & Environment';
    } else if (chipName === 'Science & Tech') {
      targetSubject = 'Science & Technology';
    } else {
      const match = allSyllabusNodes.find(n => n.label.toLowerCase() === chipName.toLowerCase() || n.label.toLowerCase().includes(chipName.toLowerCase()));
      if (match) {
        handleSyllabusResultClick(match);
        return;
      }
      targetSubject = chipName;
    }

    const params = new URLSearchParams({ exam: 'UPSC CSE' });
    params.set('subject', targetSubject);
    if (targetTopic) {
      params.set('topic', targetTopic);
    }
    params.set('count', '10');
    setSyllabusSearchQuery('');
    setIsSyllabusSearchFocused(false);
    navigate(`/guest-exam?${params.toString()}`);
  };

  return (
    <section
      style={{
        position: 'relative',
        background: '#F8FAFC',
        paddingTop: 'clamp(76px, 9vw, 104px)',
        paddingBottom: 'clamp(48px, 6vw, 72px)',
        transition: 'background-color 0.3s ease',
        zIndex: 10,
      }}
    >
      {/* Subtle background dot-grid */}
      <div
        className="dot-grid"
        style={{ position: 'absolute', inset: 0, opacity: 0.38, pointerEvents: 'none' }}
      />

      {/* Soft red radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(800px, 95vw)',
          height: 380,
          background: 'radial-gradient(ellipse at center, rgba(227,27,35,0.055) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="landing-container"
        style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', textAlign: 'center' }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: '5px 12px',
            marginBottom: 18,
          }}
        >
          <Zap size={13} strokeWidth={2.5} style={{ color: '#E31B23' }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#E31B23', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            INSTANT PYQ MOCK TEST
          </span>
        </div>

        {/* Main Heading */}
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 800,
            color: '#172033',
            lineHeight: 1.12,
            letterSpacing: '-0.025em',
            marginBottom: 14,
          }}
        >
          Master UPSC with{' '}
          <span style={{ color: '#E31B23' }}>Precision Analytics.</span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(14px, 2vw, 16px)',
            color: '#64748B',
            marginBottom: 36,
            lineHeight: 1.6,
            maxWidth: 520,
            margin: '0 auto 36px',
          }}
        >
          Search any subject, topic, or subtopic — your custom PYQ practice session starts instantly, no login needed.
        </p>

        {/* ─── Centered Search Bar ─── */}
        <div ref={syllabusSearchRef} style={{ position: 'relative', maxWidth: 800, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#FFFFFF',
              border: `2px solid ${isSyllabusSearchFocused ? '#E31B23' : '#E2E8F0'}`,
              borderRadius: 8,
              boxShadow: isSyllabusSearchFocused
                ? '0 0 0 4px rgba(227, 27, 35, 0.1), 0 8px 24px rgba(15,23,42,0.08)'
                : '0 6px 20px rgba(15,23,42,0.07)',
              transition: 'all 0.18s ease',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '0 16px', color: isSyllabusSearchFocused ? '#E31B23' : '#94A3B8', flexShrink: 0, display: 'flex', alignItems: 'center', borderRight: '1px solid #E2E8F0', height: 58 }}>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#172033',
                  fontWeight: 600,
                  fontSize: 14,
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <option value="All Exams">All Exams</option>
                <option value="UPSC">UPSC</option>
                <option value="MPSC">MPSC</option>
                <option value="SSC">SSC</option>
                <option value="Banking">Banking</option>
                <option value="Railways">Railways</option>
                <option value="State PSC">State PSC</option>
              </select>
            </div>
            <input
              id="hero-topic-search"
              type="text"
              value={syllabusSearchQuery}
              onChange={(e) => {
                setSyllabusSearchQuery(e.target.value);
                setHoveredSyllabusResult(null);
              }}
              onFocus={() => setIsSyllabusSearchFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search a topic, subject, or subtopic (e.g. Fundamental Rights, Indian Economy)"
              style={{
                flex: 1,
                height: 58,
                border: 'none',
                background: 'transparent',
                fontSize: 15,
                color: '#172033',
                outline: 'none',
                fontFamily: 'inherit',
                padding: '0 16px',
                minWidth: 0,
                textOverflow: 'ellipsis',
              }}
            />
            {syllabusSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSyllabusSearchQuery('');
                  setHoveredSyllabusResult(null);
                }}
                style={{ padding: '0 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0, fontSize: 18 }}
              >✕</button>
            )}
          </div>

          {/* Results Dropdown */}
          {isSyllabusSearchFocused && syllabusSearchQuery.trim().length >= 2 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 200,
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14)',
                maxHeight: 360,
                overflowY: 'auto',
                marginTop: 6,
                textAlign: 'left',
              }}
            >
              {syllabusSearchResults.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                  No matches for "<strong>{syllabusSearchQuery}</strong>"
                </div>
              ) : (
                <>
                  <div style={{ padding: '8px 16px 6px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #F1F5F9' }}>
                    {syllabusSearchResults.length} result{syllabusSearchResults.length !== 1 ? 's' : ''} — click to start instantly
                  </div>
                  {syllabusSearchResults.map((result, idx) => {
                    const isHovered = hoveredSyllabusResult === idx;
                    const typeBg = result.type === 'subject' ? '#FFF1F2' : result.type === 'topic' ? '#F0F9FF' : '#F0FDF4';
                    const typeColor = result.type === 'subject' ? '#E31B23' : result.type === 'topic' ? '#0369A1' : '#059669';
                    const typeLabel = result.type === 'subject' ? 'Subject' : result.type === 'topic' ? 'Topic' : 'Subtopic';
                    return (
                      <div
                        key={`${result.type}_${result.subject}_${result.topic || ''}_${result.subtopic || ''}_${idx}`}
                        onMouseEnter={() => setHoveredSyllabusResult(idx)}
                        onMouseLeave={() => setHoveredSyllabusResult(null)}
                        onClick={() => handleSyllabusResultClick(result)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '11px 16px',
                          cursor: 'pointer',
                          background: isHovered ? '#F8FAFC' : '#FFFFFF',
                          borderBottom: idx < syllabusSearchResults.length - 1 ? '1px solid #F8FAFC' : 'none',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#172033', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {result.label}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                            {result.breadcrumb}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', background: typeBg, color: typeColor, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {typeLabel}
                        </span>
                        <ArrowRight size={14} color="#CBD5E1" style={{ flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Quick-pick hint chips */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Polity', 'Modern History', 'Indian Economy', 'Geography', 'Environment & Ecology', 'Science & Tech'].map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => handleQuickPickClick(hint)}
                style={{
                  padding: '5px 14px',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#E31B23'; e.currentTarget.style.color = '#E31B23'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#475569'; }}
              >
                {hint}
              </button>
            ))}
          </div>
        </div>

        {/* Trust strip */}
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(12px, 3vw, 24px)',
            fontSize: 12.5,
            color: '#64748B',
            fontWeight: 500,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={14} style={{ color: '#3A8B53' }} /> Authentic PYQs
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Zap size={13} style={{ color: '#E31B23' }} /> Instant — no signup
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Target size={13} style={{ color: '#6366F1' }} /> Topic-wise precision
          </span>
        </div>
      </div>

      {/* Featured Solved PYQs Section (Filters dynamically) */}
      <div id="featured-pyqs" style={{ maxWidth: 1080, margin: '64px auto 0', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#172033', margin: 0 }}>
            {syllabusSearchQuery ? 'Suggested PYQs' : 'Featured Solved PYQs'}
          </h2>
          <a href="#" style={{ fontSize: 14, color: '#E31B23', fontWeight: 600, textDecoration: 'none' }}>View all questions &rarr;</a>
        </div>

        {filteredCards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748B', background: '#FFFFFF', border: '1px dashed #E2E8F0' }}>
            No PYQs match "{syllabusSearchQuery}". Try another topic like "Fundamental Rights".
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            {filteredCards.map((card, i) => (
              <div
                key={i}
                onClick={() => navigate(`/guest-exam?subject=UPSC&topic=${encodeURIComponent(card.badge)}&count=10`)}
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
                  textAlign: 'left'
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700 }}>
                  <span style={{ background: '#FFF1F2', color: '#E31B23', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {card.badge}
                  </span>
                  <span style={{ color: '#94A3B8' }}>{card.meta}</span>
                </div>
                <p style={{ fontSize: 15, color: '#1E293B', lineHeight: 1.5, margin: 0, flex: 1, fontWeight: 500 }}>
                  {card.q}
                </p>
                <span style={{ fontSize: 13, color: '#0369A1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  View solution &rarr;
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
