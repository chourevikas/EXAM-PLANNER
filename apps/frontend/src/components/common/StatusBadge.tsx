import React from 'react';
import { CheckCircle2, Clock, XCircle, Trophy, FileText, RefreshCw, Flame } from 'lucide-react';

export type StatusType =
  | 'completed'
  | 'correct'
  | 'high-accuracy'
  | 'in-progress'
  | 'moderate-accuracy'
  | 'incomplete'
  | 'incorrect'
  | 'low-accuracy'
  | 'active'
  | 'pyq'
  | 'mock'
  | 'revision'
  | 'streak';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  showIcon = true,
  className = '',
  style = {}
}: StatusBadgeProps) {
  let bg = 'var(--bg-subtle)';
  let color = 'var(--text-primary)';
  let border = 'var(--border-default)';
  let icon: React.ReactNode = null;
  let defaultLabel = '';

  switch (status) {
    case 'completed':
    case 'correct':
    case 'high-accuracy':
      bg = 'var(--success-bg)';
      color = 'var(--success-text)';
      border = '1px solid var(--success-icon)';
      icon = <CheckCircle2 size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} color="var(--success-primary)" />;
      defaultLabel = status === 'completed' ? 'Completed' : status === 'correct' ? 'Correct' : 'High Accuracy';
      break;

    case 'in-progress':
    case 'moderate-accuracy':
      bg = 'var(--warning-bg)';
      color = 'var(--warning-text-dark)';
      border = '1px solid var(--warning-border)';
      icon = <Clock size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} color="var(--warning-primary)" />;
      defaultLabel = status === 'in-progress' ? 'In Progress' : 'Moderate Accuracy';
      break;

    case 'incomplete':
    case 'incorrect':
    case 'low-accuracy':
      bg = 'var(--danger-bg)';
      color = 'var(--danger-text-dark)';
      border = '1px solid var(--danger-border)';
      icon = <XCircle size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} color="var(--danger-primary)" />;
      defaultLabel = status === 'incomplete' ? 'Incomplete' : status === 'incorrect' ? 'Incorrect' : 'Low Accuracy';
      break;

    case 'active':
      bg = 'var(--accent-bg)';
      color = 'var(--accent-primary)';
      border = '1px solid var(--accent-border)';
      defaultLabel = 'Active';
      break;

    case 'pyq':
      bg = '#F3E8FF';
      color = '#7E22CE';
      border = '1px solid #E9D5FF';
      icon = <FileText size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} color="#7E22CE" />;
      defaultLabel = 'PYQ';
      break;

    case 'mock':
      bg = '#FEF9C3';
      color = '#A16207';
      border = '1px solid #FEF08A';
      icon = <Trophy size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} color="#A16207" />;
      defaultLabel = 'Mock Test';
      break;

    case 'revision':
      bg = 'var(--status-success-bg)';
      color = '#15803D';
      border = '1px solid #BBF7D0';
      icon = <RefreshCw size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} color="#15803D" />;
      defaultLabel = 'Revision';
      break;

    case 'streak':
      bg = '#FFEDD5';
      color = '#C2410C';
      border = '1px solid #FED7AA';
      icon = <Flame size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} color="#C2410C" />;
      defaultLabel = 'Streak';
      break;
  }

  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 14 : 12.5;
  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '4px 10px';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding,
        fontSize,
        fontWeight: 700,
        borderRadius: 0,
        backgroundColor: bg,
        color,
        border,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...style
      }}
    >
      {showIcon && icon}
      {label || defaultLabel}
    </span>
  );
}
