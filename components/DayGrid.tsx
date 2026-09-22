'use client';

import React from 'react';
import { DayWorkout } from '../types/workout';

interface DayGridProps {
  days: DayWorkout[];
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
}

const SHORT_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function DayGrid({ days, selectedDayIndex, onSelectDay }: DayGridProps) {
  return (
    <nav className="day-grid">
      {days.map((day, idx) => {
        // Check if all exercises/sets are done
        const totalSets = day.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
        const doneSets = day.exercises.reduce(
          (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
          0
        );
        const isDone = (totalSets > 0 && doneSets === totalSets) || day.completed;

        return (
          <button
            key={day.id || idx}
            type="button"
            className={`day-btn ${idx === selectedDayIndex ? 'active' : ''} ${
              isDone ? 'done-all' : ''
            }`}
            onClick={() => onSelectDay(idx)}
          >
            <span className="day-btn-name">{SHORT_NAMES[idx] || day.dayOfWeek.substring(0, 3)}</span>
            <span className="day-btn-title">
              {day.isRestDay ? 'Rest' : day.title.replace(' #', ' ')}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
