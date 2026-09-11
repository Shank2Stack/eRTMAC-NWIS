import React from 'react';
import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
  warn?: boolean;
  safe?: boolean;
  className?: string;
}

export default function KpiCard({
  label,
  value,
  unit,
  sub,
  accent,
  danger,
  warn,
  safe,
  className = '',
}: KpiCardProps) {
  const valueColor = danger
    ? 'text-risk-high dark:text-risk-high-lt'
    : warn
    ? 'text-risk-med dark:text-risk-med-lt'
    : safe
    ? 'text-risk-low dark:text-risk-low-lt'
    : accent
    ? 'text-gold'
    : 'text-ink-900 dark:text-ivory-100';

  return (
    <div
      className={`card p-4 flex flex-col gap-1 min-w-0 overflow-hidden ${className}`}
    >
      <span className="section-label truncate">{label}</span>
      <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
        <span
          className={`num font-semibold text-2xl leading-tight truncate ${valueColor}`}
        >
          {value}
        </span>
        {unit && (
          <span className="num text-xs text-ink-400 dark:text-night-500 shrink-0">
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <span className="text-[11px] text-ink-400 dark:text-night-500 truncate">
          {sub}
        </span>
      )}
    </div>
  );
}
