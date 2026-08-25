import { useEffect, useState } from 'react';

/** True when the user has requested reduced motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const EMOJIS = ['🎉', '✨', '💪', '🔥', '⭐'];

interface CelebrationBurstProps {
  /** Play the burst when this becomes true (e.g. progression/PR detected). */
  play: boolean;
  /** How long the overlay stays mounted, ms. */
  durationMs?: number;
}

/**
 * A brief, celebratory overlay shown when an exercise beats the previous
 * session. Pure CSS/Tailwind (see keyframes in tailwind.config.js); no
 * dependency. Respects prefers-reduced-motion by not animating.
 */
export function CelebrationBurst({ play, durationMs = 1600 }: CelebrationBurstProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!play) return;
    if (prefersReducedMotion()) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [play, durationMs]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <div className="text-5xl animate-celebrate">🎉</div>
      {EMOJIS.map((emoji, i) => (
        <span
          key={i}
          className="absolute bottom-1/2 text-3xl animate-float-up"
          style={{
            left: `${15 + i * 17}%`,
            animationDelay: `${i * 90}ms`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
