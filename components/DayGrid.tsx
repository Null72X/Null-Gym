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

          const fallbackTitles = ['Push 1', 'Pull 1', 'Leg 1', 'Push 2', 'Pull 2', 'Leg 2', 'Rest'];
          const displayTitle = day.isRestDay
            ? 'Rest'
            : !day.title || day.title.toLowerCase() === day.dayOfWeek.toLowerCase()
            ? (fallbackTitles[idx] || day.title)
            : day.title.replace(' #', ' ');

          return (
            <button
              key={day.id || idx}
              type="button"
              className={`day-btn ${idx === selectedDayIndex ? 'active' : ''} ${
                isDone ? 'done-all' : ''
              }`}
              onClick={() => {
                if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                  navigator.vibrate(15);
                }
                onSelectDay(idx);
              }}
            >
              <span className="day-btn-name">{SHORT_NAMES[idx] || day.dayOfWeek.substring(0, 3)}</span>
              <span className="day-btn-title">{displayTitle}</span>
            </button>
          );
      })}
    </nav>
  );
}
