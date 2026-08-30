import React, { useState } from 'react';
import { Mail, Send, MessageCircle, Clock } from 'lucide-react';
import { PublicLayout } from '../components/common/PublicLayout';

const SUPPORT_EMAIL = 'support@examplanner.in';

export function ContactUsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = `From: ${name} (${email})\n\n${message}`;
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject || 'ExamPlanner Support Request'
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    setSent(true);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-body)',
    color: 'var(--text-main)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section
        className="landing-section-padding"
        style={{
          background: 'var(--bg-body)',
          paddingTop: 'clamp(96px, 11vw, 128px)',
          paddingBottom: 0,
          textAlign: 'center',
        }}
      >
        <div className="landing-container" style={{ maxWidth: 640 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>Get In Touch</div>
          <h1 className="section-heading" style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>
            We're here to help
          </h1>
          <p className="section-subheading" style={{ color: 'var(--text-muted)', margin: '0 auto' }}>
            Questions about your account, a bug you've hit, or feedback on the platform - reach out
            and we'll get back to you.
          </p>
        </div>
      </section>

      {/* Form + Contact Info */}
      <section className="landing-section-padding" style={{ background: 'var(--bg-body)' }}>
        <div
          className="landing-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(240px, 1fr)',
            gap: 32,
            maxWidth: 980,
          }}
        >
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {sent && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--success-bg)',
                  color: 'var(--success-primary)',
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                Your email client should have opened with this message pre-filled - send it from
                there and we'll reply to {email || 'your email'} as soon as we can.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your name" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Email</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Subject</label>
              <input required value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} placeholder="What's this about?" />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Message</label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                style={{ ...inputStyle, resize: 'vertical' as const }}
                placeholder="Tell us what's going on..."
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary anim-glow"
              style={{ padding: '14px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Send size={16} />
              <span>Send Message</span>
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
              This opens your email app with the message ready to send to {SUPPORT_EMAIL}.
            </p>
          </form>

          {/* Contact Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 24, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: 'var(--accent-primary)' }}>
                <Mail size={18} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Us</span>
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                style={{ fontSize: 15, color: 'var(--text-main)', textDecoration: 'none', fontWeight: 600 }}
              >
                {SUPPORT_EMAIL}
              </a>
            </div>

            <div style={{ padding: 24, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: 'var(--accent-primary)' }}>
                <Clock size={18} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Time</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                We typically reply within 1-2 business days.
              </p>
            </div>

            <div style={{ padding: 24, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: 'var(--accent-primary)' }}>
                <MessageCircle size={18} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Already a student?</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                Sign in and use the in-app support options for faster, account-linked help.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
