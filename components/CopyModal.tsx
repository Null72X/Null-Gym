'use client';

import React, { useState } from 'react';
import { AlertTriangle, Copy, X } from 'lucide-react';
import { WeekPlan } from '../types/workout';

interface CopyModalProps {
  isOpen: boolean;
  mode: 'day' | 'week';
  currentWeekNumber: number;
  currentDayName: string;
  currentDayIndex: number;
  weeks: WeekPlan[];
  onClose: () => void;
  onCopyDay: (targetWeekNum: number, targetDayIndex: number) => void;
  onCopyWeek: (targetWeekNum: number) => void;
}

const DAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function CopyModal({
  isOpen,
  mode,
  currentWeekNumber,
  currentDayName,
  currentDayIndex,
  weeks,
  onClose,
  onCopyDay,
  onCopyWeek,
}: CopyModalProps) {
  const [targetWeek, setTargetWeek] = useState<number>(currentWeekNumber);
  const [targetDayIndex, setTargetDayIndex] = useState<number>(currentDayIndex);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExecute = () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    if (mode === 'day') {
      onCopyDay(targetWeek, targetDayIndex);
    } else {
      onCopyWeek(targetWeek);
    }
    setConfirmed(false);
    onClose();
  };

  const targetDayTitle =
    weeks[targetWeek - 1]?.days[targetDayIndex]?.title || 'Workout';

  return (
    <div className="clean-modal-backdrop" onClick={onClose}>
      <div className="clean-modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Copy size={18} color="var(--accent-red)" />
            <span>{mode === 'day' ? 'Copy Day Workout' : 'Copy Entire Week'}</span>
          </h3>
          <button
            type="button"
            className="icon-action-btn"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <p className="modal-desc">
          {mode === 'day'
            ? `Copying from Week ${currentWeekNumber} · ${currentDayName}`
            : `Copying all 7 days from Week ${currentWeekNumber}`}
        </p>

        {/* Destination Week */}
        <div style={{ marginBottom: '12px' }}>
          <label className="clean-label">Target Week</label>
          <select
            className="clean-input"
            value={targetWeek}
            onChange={(e) => {
              setTargetWeek(parseInt(e.target.value, 10));
              setConfirmed(false);
            }}
          >
            {weeks.map((w) => (
              <option key={w.weekNumber} value={w.weekNumber}>
                Week {w.weekNumber}
              </option>
            ))}
          </select>
        </div>

        {/* Destination Day (if mode is day) */}
        {mode === 'day' && (
          <div style={{ marginBottom: '16px' }}>
            <label className="clean-label">Target Day</label>
            <select
              className="clean-input"
              value={targetDayIndex}
              onChange={(e) => {
                setTargetDayIndex(parseInt(e.target.value, 10));
                setConfirmed(false);
              }}
            >
              {DAY_OPTIONS.map((dName, idx) => (
                <option key={idx} value={idx}>
                  {dName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Overwrite Warning Box */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '16px',
            fontSize: '0.76rem',
            color: '#fca5a5',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            {mode === 'day' ? (
              <span>
                This will overwrite Week {targetWeek} · {DAY_OPTIONS[targetDayIndex]} (currently &ldquo;{targetDayTitle}&rdquo;).
              </span>
            ) : (
              <span>
                This will overwrite all workouts and exercises in Week {targetWeek}.
              </span>
            )}
            <br />
            <strong>This action cannot be undone without a backup.</strong>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-clean"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn-clean ${confirmed ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleExecute}
          >
            {confirmed
              ? 'Confirm Overwrite'
              : mode === 'day'
              ? 'Copy Day'
              : 'Copy Week'}
          </button>
        </div>
      </div>
    </div>
  );
}
