import React, { useEffect, useState } from 'react';
import { Ico } from '../common/Icons';
import { fetchApprovedTestimonials, submitTestimonial, TestimonialItem } from '../../services/testimonialService';
import { Star, MessageSquarePlus, CheckCircle2, X } from 'lucide-react';

const DEFAULT_STORIES: TestimonialItem[] = [
  {
    id: 'default-1',
    user_name: 'Arjun Sharma',
    user_exam: 'UPSC CSE 2024 · Rank 47',
    user_photo: '/reviewer_arjun.png',
    rating: 5,
    quote:
      'ExamPlanner completely changed how I prepared. The platform identified my weak spots in Polity within days — accuracy jumped from 54% to 83% in just two months.',
    status: 'APPROVED',
    created_at: new Date().toISOString(),
  },
  {
    id: 'default-2',
    user_name: 'Priya Nair',
    user_exam: 'UPSC CSE 2024 · Selected IAS',
    user_photo: '/reviewer_priya.png',
    rating: 5,
    quote:
      'The personalized study plan felt like having a dedicated mentor. I never had to wonder what to study — the platform always knew exactly where I needed to focus.',
    status: 'APPROVED',
    created_at: new Date().toISOString(),
  },
  {
    id: 'default-3',
    user_name: 'Rohit Gupta',
    user_exam: 'SSC CGL 2024 · AIR 12',
    user_photo: '/reviewer_rohit.png',
    rating: 5,
    quote:
      '10,000+ questions with intelligent tagging is a game-changer. I solved 4 years of PYQs systematically and the psychometric analysis caught every gap.',
    status: 'APPROVED',
    created_at: new Date().toISOString(),
  },
];

export function Testimonials() {
  const [stories, setStories] = useState<TestimonialItem[]>(DEFAULT_STORIES);
  const [loading, setLoading] = useState(true);

  // Submit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [examTitle, setExamTitle] = useState('UPSC CSE Aspirant');
  const [rating, setRating] = useState(5);
  const [quoteText, setQuoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadTestimonials() {
      try {
        const approved = await fetchApprovedTestimonials();
        if (approved && approved.length > 0) {
          setStories(approved);
        }
      } catch (err) {
        console.error('Failed to load testimonials:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTestimonials();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteText.trim()) {
      setErrorMsg('Please enter your testimonial story.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      await submitTestimonial({
        quote: quoteText,
        user_exam: examTitle,
        rating: rating,
      });
      setSuccessMsg('Thank you! Your story has been submitted and is currently pending Super Admin review.');
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg('');
        setQuoteText('');
      }, 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit testimonial. Make sure you are logged in.');
    } finally {
      setSubmitting(false);
    }
  };

  const colors = ['#E31B23', '#3A8B53', '#F2B623', '#199EAE', '#F47B35'];

  return (
    <section
      className="landing-section-padding"
      style={{
        background: 'var(--bg-body)',
        transition: 'background-color 0.3s ease',
        position: 'relative',
      }}
    >
      <div className="landing-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="section-label">
              Student Stories
            </div>
            <h2
              className="section-heading"
              style={{ fontWeight: 800, color: 'var(--text-main)', margin: 0 }}
            >
              What Aspirants Say
            </h2>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '12px 24px',
              borderRadius: 0,
              fontSize: 14,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #E31B23, #C1121F)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 8px 24px -6px rgba(227, 27, 35, 0.4)',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <MessageSquarePlus size={16} />
            <span>Share Your Success Story</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((d, index) => {
            const accentColor = colors[index % colors.length];
            const initials = d.user_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase();

            return (
              <div
                key={d.id || d.user_name}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 0,
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.28s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'translateY(-5px)';
                  el.style.borderColor = accentColor + '44';
                  el.style.boxShadow = `0 16px 40px ${accentColor}18`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'translateY(0)';
                  el.style.borderColor = 'var(--border-color)';
                  el.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Top accent bar */}
                <div
                  style={{
                    height: 3,
                    background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}44 70%, transparent 100%)`,
                    flexShrink: 0,
                  }}
                />

                {/* Card body */}
                <div style={{ padding: '28px 28px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>

                  {/* Stars */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        fill={i < (d.rating || 5) ? '#F2B623' : 'transparent'}
                        color={i < (d.rating || 5) ? '#F2B623' : 'var(--text-muted)'}
                      />
                    ))}
                  </div>

                  {/* Quote */}
                  <p
                    style={{
                      fontSize: 14.5,
                      color: 'var(--text-main)',
                      lineHeight: 1.75,
                      flex: 1,
                      fontStyle: 'italic',
                      marginBottom: 24,
                    }}
                  >
                    "{d.quote}"
                  </p>

                  {/* Divider */}
                  <div
                    style={{
                      height: 1,
                      background: `linear-gradient(90deg, ${accentColor}33 0%, var(--border-color) 100%)`,
                      marginBottom: 20,
                    }}
                  />

                  {/* Author row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Photo / Avatar */}
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 0,
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: `2px solid ${accentColor}55`,
                        boxShadow: `0 4px 14px ${accentColor}30`,
                        background: `linear-gradient(135deg, ${accentColor}, #172033)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      {d.user_photo ? (
                        <img
                          src={d.user_photo}
                          alt={d.user_name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <span>{initials}</span>
                    </div>

                    {/* Name + Exam */}
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          marginBottom: 2,
                        }}
                      >
                        {d.user_name}
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: accentColor,
                          fontWeight: 600,
                          letterSpacing: '0.2px',
                        }}
                      >
                        {d.user_exam}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit Testimonial Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 0,
              width: '100%',
              maxWidth: 540,
              padding: 32,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              fontFamily: 'Inter, sans-serif',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              Share Your Success Story
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 24px 0' }}>
              Tell other aspirants how ExamPlanner helped your exam preparation journey. Submissions are reviewed by Super Admins before publishing.
            </p>

            {successMsg ? (
              <div
                style={{
                  padding: 20,
                  borderRadius: 0,
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#3A8B53',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <CheckCircle2 size={28} style={{ margin: '0 auto 10px auto' }} />
                <div>{successMsg}</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {errorMsg && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 0,
                      background: 'rgba(227, 27, 35, 0.12)',
                      color: '#ef4444',
                      border: '1px solid rgba(227, 27, 35, 0.25)',
                      fontSize: 13,
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                    Target Exam / Rank / Role Badge
                  </label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="e.g., UPSC CSE 2026 Aspirant or Rank 42"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 0,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-body)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                    Your Rating
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        <Star
                          size={24}
                          fill={star <= rating ? '#F2B623' : 'transparent'}
                          color={star <= rating ? '#F2B623' : 'var(--text-muted)'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                    Your Testimonial Story
                  </label>
                  <textarea
                    rows={4}
                    value={quoteText}
                    onChange={(e) => setQuoteText(e.target.value)}
                    placeholder="Share how ExamPlanner boosted your accuracy, subject mastery, or daily streak..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 0,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-body)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      outline: 'none',
                      fontFamily: 'Inter, sans-serif',
                      resize: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-body)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      border: 'none',
                      background: '#E31B23',
                      color: '#ffffff',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Story for Approval'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
