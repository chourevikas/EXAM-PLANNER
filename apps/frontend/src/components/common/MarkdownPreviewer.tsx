import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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

  // Helper to parse inline markdown (bold, italic, code, links)
  const renderInline = (text: string): React.ReactNode => {
    // Regex matches inline code `code`, bold **bold**, italic *italic*
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // 1. Inline code: `...`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code
            key={keyIdx++}
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              color: isDark ? '#f472b6' : '#db2777',
              padding: '2px 6px',
              borderRadius: 4,
              fontFamily: 'monospace',
              fontSize: '0.9em',
            }}
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // 2. Bold: **...**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        parts.push(
          <strong key={keyIdx++} style={{ fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // 3. Italic: *...*
      const italicMatch = remaining.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        parts.push(<em key={keyIdx++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // 4. Regular characters until next special token
      const nextSpecial = remaining.search(/[`*]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return parts;
  };

  // Parses block-level markdown elements
  const renderMarkdownBlocks = (md: string): React.ReactNode => {
    if (!md) return <div style={{ color: 'var(--text-muted)' }}>No audit content available.</div>;

    const lines = md.split('\n');
    const blocks: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        i++;
        continue;
      }

      // Horizontal Rule
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        blocks.push(
          <hr
            key={`hr-${i}`}
            style={{
              border: 'none',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
              margin: '20px 0',
            }}
          />
        );
        i++;
        continue;
      }

      // Headers
      if (trimmed.startsWith('# ')) {
        blocks.push(
          <h1
            key={`h1-${i}`}
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: isDark ? '#ffffff' : '#0f172a',
              margin: '24px 0 12px 0',
              borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
              paddingBottom: 8,
            }}
          >
            {renderInline(trimmed.slice(2))}
          </h1>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('## ')) {
        blocks.push(
          <h2
            key={`h2-${i}`}
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: isDark ? '#60a5fa' : '#2563eb',
              margin: '20px 0 10px 0',
            }}
          >
            {renderInline(trimmed.slice(3))}
          </h2>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('### ')) {
        blocks.push(
          <h3
            key={`h3-${i}`}
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: isDark ? '#e2e8f0' : '#1e293b',
              margin: '16px 0 8px 0',
            }}
          >
            {renderInline(trimmed.slice(4))}
          </h3>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('#### ')) {
        blocks.push(
          <h4
            key={`h4-${i}`}
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: isDark ? '#cbd5e1' : '#334155',
              margin: '12px 0 6px 0',
            }}
          >
            {renderInline(trimmed.slice(5))}
          </h4>
        );
        i++;
        continue;
      }

      // Code Block: ```
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        blocks.push(
          <div
            key={`code-${i}`}
            style={{
              margin: '14px 0',
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: isDark ? '#0b1120' : '#0f172a',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#1e293b'}`,
            }}
          >
            {lang && (
              <div
                style={{
                  padding: '4px 12px',
                  backgroundColor: isDark ? '#1e293b' : '#1e293b',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                }}
              >
                {lang}
              </div>
            )}
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
              <code>{codeLines.join('\n')}</code>
            </pre>
          </div>
        );
        continue;
      }

      // GitHub Alert Callouts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
      if (trimmed.startsWith('> [!')) {
        const alertTypeMatch = trimmed.match(/^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
        if (alertTypeMatch) {
          const aType = alertTypeMatch[1].toUpperCase();
          const alertLines: string[] = [];
          i++;
          while (i < lines.length && lines[i].trim().startsWith('>')) {
            alertLines.push(lines[i].replace(/^>\s?/, ''));
            i++;
          }

          const alertStyles: Record<string, { bg: string; border: string; color: string; icon: any; label: string }> = {
            NOTE: { bg: 'rgba(59, 130, 246, 0.12)', border: '#3b82f6', color: '#3b82f6', icon: Info, label: 'Note' },
            TIP: { bg: 'rgba(16, 185, 129, 0.12)', border: '#10b981', color: '#10b981', icon: Lightbulb, label: 'Tip' },
            IMPORTANT: { bg: 'rgba(139, 92, 246, 0.12)', border: '#8b5cf6', color: '#8b5cf6', icon: CheckCircle2, label: 'Important' },
            WARNING: { bg: 'rgba(245, 158, 11, 0.12)', border: '#f59e0b', color: '#f59e0b', icon: AlertTriangle, label: 'Warning' },
            CAUTION: { bg: 'rgba(239, 68, 68, 0.12)', border: '#ef4444', color: '#ef4444', icon: ShieldAlert, label: 'Caution' },
          };

          const s = alertStyles[aType] || alertStyles.NOTE;
          const AlertIcon = s.icon;

          blocks.push(
            <div
              key={`alert-${i}`}
              style={{
                margin: '14px 0',
                padding: 14,
                borderRadius: 12,
                backgroundColor: s.bg,
                borderLeft: `4px solid ${s.border}`,
                borderTop: `1px solid ${s.border}33`,
                borderRight: `1px solid ${s.border}33`,
                borderBottom: `1px solid ${s.border}33`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: s.color, marginBottom: 6 }}>
                <AlertIcon size={16} />
                <span>{s.label}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: isDark ? '#e2e8f0' : '#334155' }}>
                {alertLines.map((al, idx) => (
                  <p key={idx} style={{ margin: '4px 0' }}>{renderInline(al)}</p>
                ))}
              </div>
            </div>
          );
          continue;
        }
      }

      // Generic Blockquote: > text
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        blocks.push(
          <blockquote
            key={`quote-${i}`}
            style={{
              margin: '12px 0',
              padding: '10px 16px',
              borderLeft: '4px solid #2563eb',
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.08)' : '#f8fafc',
              borderRadius: '0 8px 8px 0',
              fontStyle: 'italic',
              color: isDark ? '#cbd5e1' : '#475569',
              fontSize: 13.5,
            }}
          >
            {quoteLines.map((ql, idx) => (
              <p key={idx} style={{ margin: '4px 0' }}>{renderInline(ql)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // Markdown Tables: | header | header |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headerCells = tableLines[0].split('|').slice(1, -1).map((c) => c.trim());
          const dataRows = tableLines.slice(2).map((row) => row.split('|').slice(1, -1).map((c) => c.trim()));

          blocks.push(
            <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                  borderRadius: 8,
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
                    {headerCells.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          padding: '10px 14px',
                          fontWeight: 700,
                          textAlign: 'left',
                          borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'}`,
                          color: isDark ? '#ffffff' : '#0f172a',
                        }}
                      >
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((r, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        backgroundColor: rIdx % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc') : 'transparent',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                      }}
                    >
                      {r.map((cell, cIdx) => (
                        <td key={cIdx} style={{ padding: '9px 14px', color: isDark ? '#e2e8f0' : '#334155' }}>
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Unordered Lists: - or *
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const listItems: string[] = [];
        while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
          listItems.push(lines[i].trim().slice(2));
          i++;
        }
        blocks.push(
          <ul key={`ul-${i}`} style={{ margin: '8px 0', paddingLeft: 22, color: isDark ? '#e2e8f0' : '#334155' }}>
            {listItems.map((li, liIdx) => (
              <li key={liIdx} style={{ margin: '4px 0', fontSize: 13.5, lineHeight: 1.5 }}>
                {renderInline(li)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered Lists: 1. 2.
      if (/^\d+\.\s/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
          i++;
        }
        blocks.push(
          <ol key={`ol-${i}`} style={{ margin: '8px 0', paddingLeft: 22, color: isDark ? '#e2e8f0' : '#334155' }}>
            {listItems.map((li, liIdx) => (
              <li key={liIdx} style={{ margin: '4px 0', fontSize: 13.5, lineHeight: 1.5 }}>
                {renderInline(li)}
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Paragraph
      blocks.push(
        <p
          key={`p-${i}`}
          style={{
            margin: '8px 0',
            fontSize: 13.5,
            lineHeight: 1.6,
            color: isDark ? '#e2e8f0' : '#334155',
          }}
        >
          {renderInline(trimmed)}
        </p>
      );
      i++;
    }

    return blocks;
  };

  return (
    <div
      style={{
        backgroundColor: isDark ? '#131f37' : '#ffffff',
        borderRadius: 20,
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
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
            {title}
          </h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 10,
              backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff',
              color: '#2563eb',
              border: '1px solid rgba(37,99,235,0.3)',
            }}
          >
            Markdown Previewer
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex',
              padding: 3,
              borderRadius: 10,
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
                borderRadius: 8,
                border: 'none',
                backgroundColor: mode === 'preview' ? '#2563eb' : 'transparent',
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
                borderRadius: 8,
                border: 'none',
                backgroundColor: mode === 'raw' ? '#2563eb' : 'transparent',
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
              borderRadius: 10,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: isDark ? '#e2e8f0' : '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
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
              borderRadius: 10,
              border: 'none',
              backgroundColor: '#2563eb',
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
          <div style={{ lineHeight: 1.6, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {renderMarkdownBlocks(content)}
          </div>
        ) : (
          <textarea
            readOnly
            value={content}
            style={{
              width: '100%',
              minHeight: 480,
              backgroundColor: isDark ? '#0b1120' : '#f8fafc',
              color: isDark ? '#f8fafc' : '#0f172a',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
              borderRadius: 12,
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
