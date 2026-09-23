'use client';

import React from 'react';
import { ProgressionPoint } from '../lib/history';

interface ProgressionChartProps {
  data: ProgressionPoint[];
  exerciseName: string;
  unit?: string;
}

export function ProgressionChart({ data, exerciseName, unit = 'kg' }: ProgressionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '24px 12px' }}>
        <div className="empty-state-title" style={{ fontSize: '0.9rem' }}>No progression logged yet</div>
        <p style={{ fontSize: '0.75rem' }}>
          Complete workouts with {exerciseName} to view load progression over time.
        </p>
      </div>
    );
  }

  // Determine min and max for scaling
  const weights = data.map((d) => d.maxWeight);
  const minWeight = Math.max(0, Math.floor(Math.min(...weights) * 0.9));
  const maxWeight = Math.ceil(Math.max(...weights) * 1.1) || 100;
  const weightRange = maxWeight - minWeight || 1;

  const width = 460;
  const height = 180;
  const paddingX = 40;
  const paddingY = 24;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Map data to SVG coordinates
  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? width / 2
        : paddingX + (i / (data.length - 1)) * chartWidth;
    const y =
      paddingY + chartHeight - ((d.maxWeight - minWeight) / weightRange) * chartHeight;
    return { x, y, point: d };
  });

  const pathD =
    points.length === 1
      ? `M ${points[0].x} ${points[0].y}`
      : points.reduce(
          (acc, p, i) =>
            i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`,
          ''
        );

  const areaD =
    points.length === 1
      ? ''
      : `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${
          points[0].x
        } ${height - paddingY} Z`;

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '14px',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
            {exerciseName} Progression
          </h4>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            Max Weight ({unit}) over time
          </span>
        </div>
        <div className="clean-badge red" style={{ fontSize: '0.75rem' }}>
          Peak: {Math.max(...weights)} {unit}
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 3"
          />
          <text
            x={paddingX - 8}
            y={paddingY + 4}
            fill="#64748b"
            fontSize="9"
            fontFamily="var(--font-mono)"
            textAnchor="end"
          >
            {maxWeight}
          </text>

          <line
            x1={paddingX}
            y1={paddingY + chartHeight / 2}
            x2={width - paddingX}
            y2={paddingY + chartHeight / 2}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 3"
          />
          <text
            x={paddingX - 8}
            y={paddingY + chartHeight / 2 + 4}
            fill="#64748b"
            fontSize="9"
            fontFamily="var(--font-mono)"
            textAnchor="end"
          >
            {Math.round((maxWeight + minWeight) / 2)}
          </text>

          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="rgba(255,255,255,0.08)"
          />
          <text
            x={paddingX - 8}
            y={height - paddingY + 3}
            fill="#64748b"
            fontSize="9"
            fontFamily="var(--font-mono)"
            textAnchor="end"
          >
            {minWeight}
          </text>

          {/* Area Fill */}
          {areaD && <path d={areaD} fill="url(#lineGrad)" />}

          {/* Trend Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#070709"
                stroke="#ef4444"
                strokeWidth="2.5"
              />
              <text
                x={p.x}
                y={p.y - 8}
                fill="#f8fafc"
                fontSize="9.5"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                textAnchor="middle"
              >
                {p.point.maxWeight}
              </text>
              <text
                x={p.x}
                y={height - paddingY + 14}
                fill="#94a3b8"
                fontSize="8.5"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                W{p.point.weekNumber}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

interface WeeklyBarChartProps {
  weeklyRates: { week: number; percent: number; completedSets: number; totalSets: number }[];
}

export function WeeklyBarChart({ weeklyRates }: WeeklyBarChartProps) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '14px',
        marginBottom: '16px',
      }}
    >
      <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
        6-Week Completion Rates
      </h4>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeklyRates.length || 6}, 1fr)`, gap: '8px', alignItems: 'flex-end', height: '120px' }}>
        {weeklyRates.map((w) => {
          const heightPct = Math.max(8, w.percent);
          const isComplete = w.percent === 100 && w.totalSets > 0;

          return (
            <div
              key={w.week}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                gap: '4px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.62rem',
                  color: isComplete ? 'var(--accent-green)' : '#f87171',
                  fontWeight: 800,
                }}
              >
                {w.percent}%
              </span>

              <div
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  background: isComplete
                    ? 'var(--accent-green)'
                    : 'var(--accent-gradient)',
                  borderRadius: '6px 6px 3px 3px',
                  boxShadow: isComplete
                    ? '0 0 8px var(--accent-green-glow)'
                    : '0 0 8px var(--accent-red-glow)',
                  transition: 'height 0.3s ease',
                }}
              />

              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-dim)',
                  fontWeight: 700,
                }}
              >
                W{w.week}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
