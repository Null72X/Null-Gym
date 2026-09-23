'use client';

import React, { useMemo } from 'react';
import { extractMatchedTokens } from '../lib/searchEngine';

interface HighlightedTextProps {
  text: string;
  query?: string;
  tokens?: string[];
  className?: string;
  highlightClassName?: string;
  style?: React.CSSProperties;
}

/**
 * Safely highlights matching query tokens within a text string.
 * Preserves original text casing and avoids dangerous HTML injections.
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  query = '',
  tokens,
  className,
  highlightClassName = 'search-highlight',
  style,
}) => {
  const parts = useMemo(() => {
    if (!text) return null;

    const activeTokens: string[] = tokens && tokens.length > 0
      ? tokens.filter((t) => t && t.trim().length > 0)
      : query ? extractMatchedTokens(query) : [];

    if (activeTokens.length === 0) {
      return null;
    }

    // Escape regex characters
    const escaped = activeTokens
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);

    if (escaped.length === 0) return null;

    try {
      // Create global case-insensitive regex
      const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
      return text.split(regex);
    } catch {
      return null;
    }
  }, [text, query, tokens]);

  if (!parts) {
    return <span className={className} style={style}>{text}</span>;
  }

  const queryLower = query.toLowerCase().trim();

  return (
    <span className={className} style={style}>
      {parts.map((part, i) => {
        const isMatch = part.length > 0 && (
          (queryLower && queryLower.includes(part.toLowerCase())) ||
          (tokens && tokens.some((t) => t.toLowerCase() === part.toLowerCase())) ||
          extractMatchedTokens(query).some((t) => t.toLowerCase() === part.toLowerCase())
        );

        if (isMatch) {
          return (
            <mark key={i} className={highlightClassName}>
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default HighlightedText;
