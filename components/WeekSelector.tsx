'use client';

import React from 'react';

interface WeekSelectorProps {
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
}

export default function WeekSelector({ selectedWeek, onSelectWeek }: WeekSelectorProps) {
  const weeks = [1, 2, 3, 4, 5, 6];

  return (
    <div className="week-segmented">
      {weeks.map((w) => (
        <button
          key={w}
          type="button"
          className={`week-seg-btn ${selectedWeek === w ? 'active' : ''}`}
          onClick={() => onSelectWeek(w)}
        >
          <span className="week-full">Week </span>
          <span className="week-short">W</span>
          {w}
        </button>
      ))}
    </div>
  );
}
