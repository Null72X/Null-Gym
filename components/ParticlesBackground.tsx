'use client';

import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  color: string;
  glow: string;
  animationClass: string;
}

export function ParticlesBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colorPalette = [
      { color: 'rgba(239, 68, 68, 0.45)', glow: '0 0 12px rgba(239, 68, 68, 0.7)' },
      { color: 'rgba(239, 68, 68, 0.30)', glow: '0 0 8px rgba(239, 68, 68, 0.5)' },
      { color: 'rgba(220, 38, 38, 0.40)', glow: '0 0 15px rgba(220, 38, 38, 0.6)' },
      { color: 'rgba(255, 255, 255, 0.20)', glow: '0 0 6px rgba(255, 255, 255, 0.4)' },
      { color: 'rgba(168, 85, 247, 0.30)', glow: '0 0 12px rgba(168, 85, 247, 0.5)' },
    ];

    const animations = ['animate-float-slow', 'animate-float-medium', 'animate-pulse-glow'];

    const generated: Particle[] = Array.from({ length: 50 }).map((_, i) => {
      const palette = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      return {
        id: i,
        size: Math.floor(Math.random() * 5) + 2,
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        duration: Math.floor(Math.random() * 12) + 5,
        delay: Math.floor(Math.random() * 8),
        color: palette.color,
        glow: palette.glow,
        animationClass: animations[Math.floor(Math.random() * animations.length)],
      };
    });

    setParticles(generated);
  }, []);

  return (
    <div className="particles-container fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Background Ambient Glow Orbs Matching Null-Auth */}
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />
      <div className="glow-orb orb-3" />

      {/* 50 Floating Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className={`particle-dot ${p.animationClass}`}
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            boxShadow: p.glow,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default ParticlesBackground;
