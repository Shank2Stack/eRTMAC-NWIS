import React from 'react';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  sub?: string;
  action?: ReactNode;
  className?: string;
}

export default function SectionHeader({
  title,
  sub,
  action,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-ink-900 dark:text-ivory-100 leading-tight">
          {title}
        </h2>
        {sub && (
          <p className="mt-0.5 text-[12px] text-ink-400 dark:text-night-500 leading-snug">
            {sub}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
