import React from 'react';
import Link from 'next/link';
import { Github, ExternalLink, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: '48px',
        padding: '24px 16px 36px',
        borderTop: '1px solid var(--border)',
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 800 }}>
        <span>Null Gym</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span
          style={{
            fontSize: '0.62rem',
            color: 'var(--accent-red)',
            background: 'rgba(239, 68, 68, 0.12)',
            padding: '2px 7px',
            borderRadius: '4px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          v2.0 Final Release
        </span>
      </div>

      <p style={{ margin: 0, maxWidth: '440px', lineHeight: 1.5 }}>
        Built for serious lifters with 1,323 ExerciseDB animated form guides, bi-weekly progressive overload, and offline mode.
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: '4px',
        }}
      >
        <a
          href="https://github.com/Null72X/Null-Gym"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Github size={12} />
          <span>GitHub</span>
        </a>
        <span>·</span>
        <a
          href="https://github.com/ExerciseDB/exercisedb-api"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>ExerciseDB</span>
          <ExternalLink size={10} />
        </a>
        <span>·</span>
        <Link
          href="/settings"
          style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          Credits &amp; Settings
        </Link>
      </div>

      <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.25)', marginTop: '4px' }}>
        Crafted by Null72X · Open-source under MIT License
      </div>
    </footer>
  );
}
