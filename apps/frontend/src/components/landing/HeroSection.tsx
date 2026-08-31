import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Zap, CheckCircle2, ArrowRight, Search } from 'lucide-react';
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

  // Dynamic 3-level taxonomy state fetched directly from Syllabus API (/api/v1/syllabus)
  const [masterSubjects, setMasterSubjects] = useState<any[]>([]);
  const [threeLevelHierarchy, setThreeLevelHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState<boolean>(true);

  // Syllabus search nodes (flat list for search bar)
  const allSyllabusNodes = useMemo(() => {
    const nodes: { type: 'subject' | 'topic' | 'subtopic'; subject: string; topic?: string; subtopic?: string; label: string; breadcrumb: string }[] = [];
    masterSubjects.forEach((subj) => {
      const subjName = subj.name || '';
      if (!subjName) return;
      nodes.push({ type: 'subject', subject: subjName, label: subjName, breadcrumb: subjName });
      (subj.topics || []).forEach((topic: any) => {
        const topicName = topic.name || '';
        if (!topicName) return;
        nodes.push({ type: 'topic', subject: subjName, topic: topicName, label: topicName, breadcrumb: `${subjName} › ${topicName}` });
        (topic.subtopics || []).forEach((sub: any) => {
          const subName = typeof sub === 'string' ? sub : sub.name || '';
          if (!subName) return;
          nodes.push({ type: 'subtopic', subject: subjName, topic: topicName, subtopic: subName, label: subName, breadcrumb: `${subjName} › ${topicName} › ${subName}` });
        });
      });
    });
    Object.entries(threeLevelHierarchy).forEach(([subjKey, topicMap]) => {
      if (!nodes.some(n => n.type === 'subject' && n.subject === subjKey)) {
        nodes.push({ type: 'subject', subject: subjKey, label: subjKey, breadcrumb: subjKey });
      }
      if (topicMap && typeof topicMap === 'object') {
        Object.entries(topicMap).forEach(([topicKey, subtopics]) => {
          if (!nodes.some(n => n.type === 'topic' && n.subject === subjKey && n.topic === topicKey)) {
            nodes.push({ type: 'topic', subject: subjKey, topic: topicKey, label: topicKey, breadcrumb: `${subjKey} › ${topicKey}` });
          }
          if (Array.isArray(subtopics)) {
            subtopics.forEach((sub) => {
              const subName = typeof sub === 'string' ? sub : '';
              if (!subName || nodes.some(n => n.type === 'subtopic' && n.topic === topicKey && n.subtopic === subName)) return;
              nodes.push({ type: 'subtopic', subject: subjKey, topic: topicKey, subtopic: subName, label: subName, breadcrumb: `${subjKey} › ${topicKey} › ${subName}` });
            });
          }
        });
      }
    });
    return nodes;
  }, [masterSubjects, threeLevelHierarchy]);

  const syllabusSearchResults = useMemo(() => {
    const q = syllabusSearchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return allSyllabusNodes
      .filter(n => n.label.toLowerCase().includes(q) || n.breadcrumb.toLowerCase().includes(q))
      .slice(0, 10);
  }, [syllabusSearchQuery, allSyllabusNodes]);

  const handleSyllabusResultClick = (result: typeof allSyllabusNodes[number]) => {
    const params = new URLSearchParams({ exam: 'UPSC CSE' });
    params.set('subject', result.subject);
    if (result.topic) params.set('topic', result.topic);
    if (result.subtopic) params.set('subtopic', result.subtopic);
    params.set('count', '10');
    setSyllabusSearchQuery('');
    setIsSyllabusSearchFocused(false);
    navigate(`/guest-exam?${params.toString()}`);
  };

  // Fetch Dynamic 3-level Taxonomy from Backend API (/api/v1/syllabus)
  useEffect(() => {
    async function loadDynamicData() {
      setIsTaxonomyLoading(true);
      try {
        const taxData = await fetchMasterSyllabus();
        if (taxData) {
          if (taxData.subjects && Array.isArray(taxData.subjects) && taxData.subjects.length > 0) {
            setMasterSubjects(taxData.subjects);
          }
          if (taxData.hierarchy && typeof taxData.hierarchy === 'object') {
            setThreeLevelHierarchy(taxData.hierarchy);
          }
        }
      } catch (err) {
        console.warn('Taxonomy fetch warning:', err);
      } finally {
        setIsTaxonomyLoading(false);
      }
    }

    loadDynamicData();
  }, []);

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
              onChange={(e) => setSyllabusSearchQuery(e.target.value)}
              onFocus={() => setIsSyllabusSearchFocused(true)}
              placeholder={isTaxonomyLoading ? 'Loading syllabus…' : 'Search a topic, year, or question...'}
              disabled={isTaxonomyLoading}
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
                onClick={() => setSyllabusSearchQuery('')}
                style={{ padding: '0 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0, fontSize: 18 }}
              >✕</button>
            )}
            <button
              onClick={() => {
                const searchSection = document.getElementById("featured-pyqs");
                if (searchSection) searchSection.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: '#E31B23',
                color: '#FFFFFF',
                border: 'none',
                height: 58,
                padding: '0 24px',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#B91C1C'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#E31B23'}
            >
              Search
            </button>
          </div>

          {/* Results Dropdown (Removed in favor of inline grid below) */}
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
