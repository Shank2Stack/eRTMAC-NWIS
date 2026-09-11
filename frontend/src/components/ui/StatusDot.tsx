import React from 'react';
import type { RiskLevel } from '../../types';

interface StatusDotProps {
  level: RiskLevel | 'online' | 'offline';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const colorMap: Record<string, string> = {
  critical: 'bg-risk-high',
  warning:  'bg-risk-med',
  normal:   'bg-risk-low',
  online:   'bg-risk-low',
  offline:  'bg-ink-400 dark:bg-night-500',
};

const sizeMap = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
};

export default function StatusDot({
  level,
  pulse = false,
  size = 'md',
  label,
}: StatusDotProps) {
  const dotColor = colorMap[level] ?? 'bg-ink-400';
  const dotSize = sizeMap[size];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`relative inline-flex rounded-full ${dotSize} ${dotColor}`}>
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-60`}
          />
        )}
      </span>
      {label && (
        <span className="text-[11px] text-ink-600 dark:text-night-400 leading-none">
          {label}
        </span>
      )}
    </span>
  );
}
