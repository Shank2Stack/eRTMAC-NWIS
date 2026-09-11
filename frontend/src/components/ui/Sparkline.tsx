import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export default function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#C9A84C',
  className = '',
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  // Area fill
  const first = points[0].split(',');
  const last = points[points.length - 1].split(',');
  const area = [
    `${first[0]},${height - pad}`,
    ...points,
    `${last[0]},${height - pad}`,
  ].join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <polygon points={area} fill={color} fillOpacity={0.12} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
