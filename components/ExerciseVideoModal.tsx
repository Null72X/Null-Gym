'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Play,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Dumbbell,
  Film,
  ListOrdered,
  Eye,
  WifiOff,
} from 'lucide-react';
import { getExerciseMuscleInfo } from '../lib/muscleMetadata';
import { getExerciseMedia } from '../lib/exerciseMedia';
import { isAppOffline, onOfflineChange } from '../lib/offlineManager';

interface ExerciseVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise: {
    id?: string;
    name: string;
    muscleGroup?: string;
    subMuscle?: string;
    equipment?: string;
    movementPattern?: string;
    difficulty?: string;
    notes?: string;
    videoUrl?: string;
    requiresLoad?: boolean;
    trackingType?: string;
  } | null;
}

export default function ExerciseVideoModal({
  isOpen,
  onClose,
  exercise,
}: ExerciseVideoModalProps) {
  const [activeTab, setActiveTab] = useState<'demo' | 'cues'>('demo');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(() => isAppOffline());

  // Listen to offline state changes
  useEffect(() => {
    const unsub = onOfflineChange((offline) => {
      setIsOffline(offline);
    });
    return () => unsub();
  }, []);

  // Close on Escape key & manage body scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Resolve media mapping (GIF animation, thumbnail, instructions, images)
  const media = useMemo(() => {
    if (!exercise) return null;
    return getExerciseMedia(exercise);
  }, [exercise]);

  // Reset tab and loading state when exercise changes
  useEffect(() => {
    if (isOpen) {
      if (media?.gifUrl) {
        setActiveTab('demo');
      } else {
        setActiveTab('cues');
      }
      setImgLoaded(false);
    }
  }, [isOpen, exercise?.name, media?.gifUrl]);

  if (!isOpen || !exercise) return null;

  const muscleInfo = getExerciseMuscleInfo(exercise as any);
  const cleanName = exercise.name.trim();

  const externalYtUrl =
    exercise.videoUrl ||
    `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(cleanName)}`;

  const formNotes = exercise.notes?.trim() || '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 7, 10, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
        animation: 'fadeIn 0.18s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#0d1117',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          animation: 'modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Top Bar */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '3px 8px',
                borderRadius: '6px',
                background: muscleInfo.pillarMeta.bg,
                color: muscleInfo.pillarMeta.color,
                border: `1px solid ${muscleInfo.pillarMeta.border}`,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span>{muscleInfo.pillarMeta.icon}</span>
              <span>{muscleInfo.displayPillar}</span>
            </span>

            <h3
              style={{
                fontSize: '0.92rem',
                fontWeight: 800,
                color: '#fff',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={cleanName}
            >
              {cleanName}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-dim)',
              borderRadius: '8px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            title="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            padding: '8px 16px 0',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            overflowX: 'auto',
          }}
        >
          {media?.gifUrl && (
            <button
              type="button"
              onClick={() => setActiveTab('demo')}
              style={{
                padding: '6px 12px',
                fontSize: '0.74rem',
                fontWeight: 700,
                background: 'none',
                border: 'none',
                color: activeTab === 'demo' ? '#fff' : 'var(--text-dim)',
                borderBottom: `2px solid ${activeTab === 'demo' ? 'var(--accent-red)' : 'transparent'}`,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Film size={11} color={activeTab === 'demo' ? 'var(--accent-red)' : 'currentColor'} />
              <span>Animated Demo</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('cues')}
            style={{
              padding: '6px 12px',
              fontSize: '0.74rem',
              fontWeight: 700,
              background: 'none',
              border: 'none',
              color: activeTab === 'cues' ? '#fff' : 'var(--text-dim)',
              borderBottom: `2px solid ${activeTab === 'cues' ? 'var(--accent-red)' : 'transparent'}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={11} />
            <span>Form &amp; Cues</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ overflowY: 'auto', padding: '16px', flex: 1 }}>
          {/* Metadata Badges Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '14px',
            }}
          >
            {exercise.subMuscle && (
              <span
                style={{
                  fontSize: '0.66rem',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontWeight: 600,
                }}
              >
                Target: {exercise.subMuscle}
              </span>
            )}
            {exercise.equipment && (
              <span
                style={{
                  fontSize: '0.66rem',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontWeight: 600,
                }}
              >
                Equip: {exercise.equipment}
              </span>
            )}
            {exercise.movementPattern && (
              <span
                style={{
                  fontSize: '0.66rem',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontWeight: 600,
                }}
              >
                Pattern: {exercise.movementPattern}
              </span>
            )}
            {exercise.difficulty && (
              <span
                style={{
                  fontSize: '0.66rem',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontWeight: 500,
                }}
              >
                Level: {exercise.difficulty}
              </span>
            )}
          </div>

          {/* TAB 1: ANIMATED DEMO (GIF + Step-by-Step Instructions) */}
          {activeTab === 'demo' && media?.gifUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Animated GIF Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '260px',
                  maxHeight: '340px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#05070a',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!imgLoaded && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      color: 'var(--text-dim)',
                      fontSize: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.7)',
                    }}
                  >
                    <Dumbbell size={24} color="var(--accent-red)" style={{ opacity: 0.8 }} />
                    <span>Loading animation for {cleanName}...</span>
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={media.gifUrl}
                  alt={`Animation: ${cleanName}`}
                  onLoad={() => setImgLoaded(true)}
                  style={{
                    width: '100%',
                    maxHeight: '340px',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>

              {/* Start & End Posture Frames (If available) */}
              {media.images && media.images.length >= 2 && (
                <div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono)',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Eye size={12} />
                    <span>Posture Checkpoints</span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    {media.images.slice(0, 2).map((imgUrl, i) => (
                      <div
                        key={i}
                        style={{
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          background: '#000',
                          position: 'relative',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={`${cleanName} step ${i + 1}`}
                          style={{ width: '100%', height: '110px', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            insetInline: 0,
                            padding: '3px 6px',
                            background: 'rgba(0, 0, 0, 0.75)',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            color: '#e2e8f0',
                            textAlign: 'center',
                          }}
                        >
                          {i === 0 ? '1. Starting Position' : '2. Peak Contraction'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step-by-Step Instructions */}
              {media.instructions && media.instructions.length > 0 && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '10px',
                    padding: '12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: 'var(--accent-red)',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <ListOrdered size={12} />
                    <span>Step-by-Step Execution</span>
                  </div>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      fontSize: '0.76rem',
                      color: '#cbd5e1',
                      lineHeight: '1.65',
                    }}
                  >
                    {media.instructions.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: BIOMECHANICS & CUES */}
          {activeTab === 'cues' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Step by Step Breakdown */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: 'var(--accent-red)',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Dumbbell size={12} />
                  <span>Setup &amp; Execution</span>
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '18px',
                    fontSize: '0.76rem',
                    color: '#cbd5e1',
                    lineHeight: '1.6',
                  }}
                >
                  <li>
                    <strong>Setup:</strong> Position equipment securely, establish stable base of support with neutral spine.
                  </li>
                  <li>
                    <strong>Eccentric (Lowering):</strong> Control the weight smoothly over 2&ndash;3 seconds into deep active stretch.
                  </li>
                  <li>
                    <strong>Concentric (Drive):</strong> Explode upward using target musculature, pausing 1 second at peak contraction.
                  </li>
                  <li>
                    <strong>Breathing:</strong> Inhale on eccentric descent, brace core throughout movement, exhale through concentric effort.
                  </li>
                </ul>
              </div>

              {/* Notes if available */}
              {formNotes && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '0.75rem',
                    color: '#e2e8f0',
                    lineHeight: '1.45',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: 'var(--accent-red)',
                      fontWeight: 700,
                      marginBottom: '4px',
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    <CheckCircle2 size={12} />
                    <span>Exercise Notes</span>
                  </div>
                  <div>{formNotes}</div>
                </div>
              )}

              {/* Injury Prevention Checkpoint */}
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '0.74rem',
                  color: '#fef3c7',
                  lineHeight: '1.45',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 700,
                    color: '#fbbf24',
                    marginBottom: '3px',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                  }}
                >
                  <AlertTriangle size={12} />
                  <span>Safety Checkpoint</span>
                </div>
                <div>
                  Maintain active scapular control, avoid joint lockouts under load, and stop reps immediately if form deteriorates.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.3)',
            gap: '8px',
          }}
        >
          <a
            href={externalYtUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              fontSize: '0.74rem',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Play size={11} fill="#ef4444" color="#ef4444" />
            <span>Open on YouTube</span>
            <ExternalLink size={10} style={{ opacity: 0.7 }} />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="btn-clean btn-sm"
            style={{
              padding: '7px 16px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
