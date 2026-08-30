import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  Download,
  Eye,
  Code2,
  Info,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface MarkdownPreviewerProps {
  content: string;
  title?: string;
  filename?: string;
}

export function MarkdownPreviewer({
  content,
  title = 'Markdown Audit Report',
  filename = 'diagnostic_audit_report.md',
}: MarkdownPreviewerProps) {
  const isDark = false;
  const [mode, setMode] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Custom components for ReactMarkdown
  const markdownComponents: any = {
    h1: ({ node, ...props }: any) => (
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: isDark ? '#ffffff' : '#172033',
          margin: '24px 0 12px 0',
          borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
          paddingBottom: 8,
        }}
        {...props}
      />
    ),
    h2: ({ node, ...props }: any) => (
      <h2
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: isDark ? '#60a5fa' : '#E31B23',
          margin: '20px 0 10px 0',
        }}
        {...props}
      />
    ),
    h3: ({ node, ...props }: any) => (
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: isDark ? '#e2e8f0' : '#172033',
          margin: '16px 0 8px 0',
        }}
        {...props}
      />
    ),
    h4: ({ node, ...props }: any) => (
      <h4
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: isDark ? '#cbd5e1' : '#334155',
          margin: '12px 0 6px 0',
        }}
        {...props}
      />
    ),
    p: ({ node, ...props }: any) => (
      <p
        style={{
          margin: '8px 0',
          fontSize: 13.5,
          lineHeight: 1.6,
          color: isDark ? '#e2e8f0' : '#334155',
        }}
        {...props}
      />
    ),
    table: ({ node, ...props }: any) => (
      <div style={{ overflowX: 'auto', margin: '16px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
            borderRadius: 0,
          }}
          {...props}
        />
      </div>
    ),
    thead: ({ node, ...props }: any) => (
      <thead
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
        }}
        {...props}
      />
    ),
    th: ({ node, ...props }: any) => (
      <th
        style={{
          padding: '10px 14px',
          fontWeight: 700,
          textAlign: 'left',
          borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'}`,
          color: isDark ? '#ffffff' : '#172033',
        }}
        {...props}
      />
    ),
    td: ({ node, ...props }: any) => (
      <td
        style={{
          padding: '9px 14px',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
          color: isDark ? '#e2e8f0' : '#334155',
        }}
        {...props}
      />
    ),
    blockquote: ({ node, children, ...props }: any) => {
      // Check if this is an alert style: [!NOTE], [!IMPORTANT], etc.
      const textContent = Array.isArray(children)
        ? children.map((c) => (typeof c === 'string' ? c : c?.props?.children || '')).join('')
        : '';
      const isImportant = textContent.includes('[!IMPORTANT]') || textContent.includes('Integrated Cognitive Readiness');
      const isTip = textContent.includes('[!TIP]') || textContent.includes('Recommendation');
      const isWarning = textContent.includes('[!WARNING]');

      let borderColor = '#E31B23';
      let bgColor = isDark ? 'rgba(227, 27, 35, 0.08)' : '#F8FAFC';
      if (isImportant) {
        borderColor = '#8b5cf6';
        bgColor = isDark ? 'rgba(139, 92, 246, 0.12)' : '#f5f3ff';
      } else if (isTip) {
        borderColor = '#3A8B53';
        bgColor = isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4';
      } else if (isWarning) {
        borderColor = '#F2B623';
        bgColor = isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb';
      }

      return (
        <blockquote
          style={{
            margin: '14px 0',
            padding: '12px 18px',
            borderLeft: `4px solid ${borderColor}`,
            backgroundColor: bgColor,
            borderRadius: 0,
            color: isDark ? '#e2e8f0' : '#334155',
            fontSize: 13.5,
            lineHeight: 1.5,
          }}
          {...props}
        >
          {children}
        </blockquote>
      );
    },
    code: ({ node, inline, className, children, ...props }: any) => {
      const isInline = !className && typeof children === 'string' && !children.includes('\n');
      if (isInline) {
        return (
          <code
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              color: isDark ? '#f472b6' : '#db2777',
              padding: '2px 6px',
              borderRadius: 0,
              fontFamily: 'monospace',
              fontSize: '0.9em',
            }}
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <div
          style={{
            margin: '14px 0',
            borderRadius: 0,
            overflow: 'hidden',
            backgroundColor: isDark ? '#0b1120' : '#172033',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#172033'}`,
          }}
        >
          <pre
            style={{
              margin: 0,
              padding: 14,
              color: '#f8fafc',
              fontFamily: 'monospace',
              fontSize: 12.5,
              lineHeight: 1.5,
              overflowX: 'auto',
            }}
          >
            <code {...props}>{children}</code>
          </pre>
        </div>
      );
    },
    ul: ({ node, ...props }: any) => (
      <ul
        style={{
          margin: '8px 0',
          paddingLeft: 22,
          color: isDark ? '#e2e8f0' : '#334155',
        }}
        {...props}
      />
    ),
    ol: ({ node, ...props }: any) => (
      <ol
        style={{
          margin: '8px 0',
          paddingLeft: 22,
          color: isDark ? '#e2e8f0' : '#334155',
        }}
        {...props}
      />
    ),
    li: ({ node, ...props }: any) => (
      <li
        style={{
          margin: '4px 0',
          fontSize: 13.5,
          lineHeight: 1.5,
        }}
        {...props}
      />
    ),
    hr: ({ node, ...props }: any) => (
      <hr
        style={{
          border: 'none',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
          margin: '20px 0',
        }}
        {...props}
      />
    ),
  };

  return (
    <div
      style={{
        backgroundColor: isDark ? '#131f37' : '#ffffff',
        borderRadius: 0,
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
        overflow: 'hidden',
      }}
    >
      {/* Top Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
          backgroundColor: isDark ? '#0f1a30' : '#f8fafc',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#172033' }}>
            {title}
          </h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 0,
              backgroundColor: isDark ? 'rgba(227, 27, 35,0.2)' : '#F8FAFC',
              color: '#E31B23',
              border: '1px solid rgba(227, 27, 35,0.3)',
            }}
          >
            ReactMarkdown (remark-gfm)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex',
              padding: 3,
              borderRadius: 0,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
            }}
          >
            <button
              onClick={() => setMode('preview')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 0,
                border: 'none',
                backgroundColor: mode === 'preview' ? '#E31B23' : 'transparent',
                color: mode === 'preview' ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>

            <button
              onClick={() => setMode('raw')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 0,
                border: 'none',
                backgroundColor: mode === 'raw' ? '#E31B23' : 'transparent',
                color: mode === 'raw' ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Code2 size={13} />
              <span>Raw</span>
            </button>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 0,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: isDark ? '#e2e8f0' : '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={13} color="#3A8B53" /> : <Copy size={13} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 0,
              border: 'none',
              backgroundColor: '#E31B23',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download size={13} />
            <span>Download .md</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ padding: 24 }}>
        {mode === 'preview' ? (
          <div style={{ lineHeight: 1.6, color: isDark ? '#e2e8f0' : '#172033' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content || 'No audit content available.'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            readOnly
            value={content}
            style={{
              width: '100%',
              minHeight: 480,
              backgroundColor: isDark ? '#0b1120' : '#f8fafc',
              color: isDark ? '#f8fafc' : '#172033',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
              borderRadius: 0,
              padding: 16,
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>
    </div>
  );
}
