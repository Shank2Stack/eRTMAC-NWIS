import React from 'react';
import type { RiskLevel, WellStatus } from '../../types';

interface RiskBadgeProps {
  level: RiskLevel | WellStatus;
  className?: string;
}

const configs: Record<string, { label: string; classes: string }> = {
  critical: {
    label: 'CRITICAL',
    classes: 'bg-risk-high/10 text-risk-high border border-risk-high/30',
  },
  warning: {
    label: 'WARNING',
    classes: 'bg-risk-med/10 text-risk-med border border-risk-med/30',
  },
  normal: {
    label: 'NORMAL',
    classes: 'bg-risk-low/10 text-risk-low border border-risk-low/30',
  },
  active: {
    label: 'ACTIVE',
    classes: 'bg-risk-low/10 text-risk-low border border-risk-low/30',
  },
  offline: {
    label: 'OFFLINE',
    classes:
      'bg-ink-200/50 text-ink-600 border border-ink-300 dark:bg-night-700/50 dark:text-night-400 dark:border-night-600',
  },
  completed: {
    label: 'COMPLETE',
    classes: 'bg-gold/10 text-gold border border-gold/30',
  },
};

export default function RiskBadge({ level, className = '' }: RiskBadgeProps) {
  const cfg = configs[level] ?? configs.normal;
  return (
    <span
      className={`badge ${cfg.classes} ${className}`}
    >
      {cfg.label}
    </span>
  );
}
