import React from 'react';
import { Loader2 } from 'lucide-react';

interface ExamLoaderOverlayProps {
  title?: string;
  subtitle?: string;
  isFullScreen?: boolean;
}

export function ExamLoaderOverlay({
  isFullScreen = true,
}: ExamLoaderOverlayProps) {
  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 24px',
      }}
    >
      <Loader2 size={40} className="spin-loader" color="var(--primary-red)" />
    </div>
  );

  if (!isFullScreen) {
    return content;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'var(--bg-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {content}
    </div>
  );
}
